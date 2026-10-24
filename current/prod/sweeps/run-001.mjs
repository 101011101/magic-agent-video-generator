// RUN-001: image-model cost sweep. Six generator models x three prompts (prop scale, no-text, count) + four editor models
// x one identity-preserving edit. One variable moves per group — the model. Answers whether a 5-50 credit model holds the
// properties both pipelines currently buy at 150-200.
// Two phases on purpose: `generate` spends and needs no ffmpeg; `score` needs ffmpeg (vision.js pipes images through it)
// and spends nothing. Paid frames land on disk before anything can fail, so scoring never loses work that was paid for.
// Usage: node current/prod/sweeps/run-001.mjs [--execute] [--phase generate|score|all] [--only <arm id>] [--editor-source <file>] [--label <name>]
//   Default is a DRY RUN: it prints every request body and the exact cost and sends nothing. --execute spends.
//   --only takes an arm id as printed (e.g. scale:krea-2, edit:qwen-edit, source) and runs just that one.
import { writeFileSync, readFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { REPO } from "../state-manager/src/paths.js";
import { runJob, download, uploadFile } from "../state-manager/src/magichour.js";
import { usage } from "../state-manager/src/llm.js";
import { ledger, spend, check, release, CAP } from "./src/ledger.js";
import { GEN_MODELS, EDIT_MODELS, PROMPTS, EDIT, SOURCE, HOLD, cost } from "./src/arms.js";
import { score } from "./src/score.js";
import { renderPage } from "./src/page.js";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const EXECUTE = args.includes("--execute") && !args.includes("--dry-run");
const PHASE = opt("--phase", "all"), ONLY = opt("--only", null), SRC_OVERRIDE = opt("--editor-source", null);
// --label gives a repeat pass its own directory and ledger-free result set: these models are stochastic, so one sample
// per cell distinguishes "usually" from "never" only when the gap is wide. A repeat re-asks the same question.
const LABEL = opt("--label", null);
const hasFfmpeg = (() => { try { execFileSync("ffprobe", ["-version"], { stdio: "ignore" }); return true; } catch { return false; } })();

const dir = join(REPO, "current/tests/sweeps", LABEL ? `run-001-${LABEL}` : "run-001");
mkdirSync(dir, { recursive: true });
const logPath = join(dir, "results.json");
const log = existsSync(logPath) ? JSON.parse(readFileSync(logPath, "utf8")) : { arms: [] };
const save = () => { writeFileSync(logPath, JSON.stringify(log, null, 2)); writeFileSync(join(dir, "index.html"), renderPage(log)); };

// ---- build the arm list. The source frame is arm 0: every editor arm edits its bytes, so it must exist first.
// --editor-source keeps the supplied file's extension: uploadFile() derives the content type from it, so copying a .jpg
// to source.png would upload a JPEG labelled PNG.
const SOURCE_FILE = SRC_OVERRIDE ? `source.${SRC_OVERRIDE.split(".").pop().toLowerCase()}` : "source.png";
const arms = [];
if (!SRC_OVERRIDE) arms.push({ id: "source", kind: "source", test: "editor source frame", model: SOURCE.model, prompt: SOURCE.prompt,
  criterion: "n/a — this frame is the fixed input the four editor arms share", file: SOURCE_FILE, estimate: cost(SOURCE.model) });
for (const p of Object.values(PROMPTS)) for (const m of GEN_MODELS)
  arms.push({ id: `${p.id}:${m}`, kind: p.id, test: p.test, model: m, prompt: p.prompt, criterion: p.criterion, file: `${p.id}-${m}.png`, estimate: cost(m) });
for (const m of EDIT_MODELS)
  arms.push({ id: `${EDIT.id}:${m}`, kind: EDIT.id, test: EDIT.test, model: m, prompt: EDIT.prompt, criterion: EDIT.criterion, file: `edit-${m}.png`, source: SOURCE_FILE, estimate: cost(m) });

const selected = ONLY ? arms.filter((a) => a.id === ONLY) : arms;
if (!selected.length) { console.error(`--only ${ONLY}: no such arm. Arms: ${arms.map((a) => a.id).join(", ")}`); process.exit(1); }

// Request body for an arm. Generator and editor differ only by the assets block; everything in HOLD is identical.
const bodyFor = (a, sourcePath) => ({
  name: `run-001 ${a.id}`, model: a.model, ...HOLD, style: { prompt: a.prompt },
  ...(a.kind === "edit" ? { assets: { image_file_paths: [sourcePath] } } : {}),
});

const optimistic = selected.reduce((n, a) => n + a.estimate, 0);
const pessimistic = selected.reduce((n, a) => n + cost(a.model, true), 0);

// ---------------- dry run ----------------
if (!EXECUTE) {
  console.log(`RUN-001 DRY RUN — nothing will be sent, nothing will be spent.\n`);
  console.log(`Held constant in every arm: ${Object.entries(HOLD).map(([k, v]) => `${k}=${v}`).join(", ")}`);
  console.log(`Varied: model only, within each group.\n`);
  let group = null;
  for (const a of selected) {
    if (a.kind !== group) { group = a.kind; console.log(`--- ${a.test} — ${a.kind} ${"-".repeat(Math.max(0, 48 - a.kind.length))}`); }
    const endpoint = a.kind === "edit" ? "/v1/ai-image-editor" : "/v1/ai-image-generator";
    console.log(`\n  ${a.id}  →  POST ${endpoint}   est ${a.estimate} cr`);
    console.log(`  ${JSON.stringify(bodyFor(a, a.kind === "edit" ? "<source.png uploaded at run time>" : undefined))}`);
  }
  const l = ledger();
  console.log(`\n${"=".repeat(70)}`);
  console.log(`arms:                 ${selected.length}`);
  console.log(`estimated (spec floor): ${optimistic} credits`);
  console.log(`worst case (nano-banana-pro at its observed 200): ${pessimistic} credits`);
  console.log(`sweep ledger:         ${l.spent} spent, cap ${CAP}`);
  console.log(`cap verdict:          ${l.spent + pessimistic <= CAP ? `OK — ${l.spent + pessimistic} <= ${CAP}` : `BLOCKED — needs MH_CAP >= ${l.spent + pessimistic}`}`);
  console.log(`ffprobe present:      ${hasFfmpeg} ${hasFfmpeg ? "" : "(scoring phase will be skipped; generation is unaffected)"}`);
  console.log(`\nTo spend: node current/prod/sweeps/run-001.mjs --execute --phase generate`);
  process.exit(0);
}

// ---------------- generate ----------------
async function generate() {
  let sourcePath = null;
  if (SRC_OVERRIDE) { copyFileSync(join(REPO, SRC_OVERRIDE), join(dir, SOURCE_FILE)); console.log(`source: ${SRC_OVERRIDE} → ${SOURCE_FILE} (copied, 0 credits)`); }
  for (const a of selected) {
    const prior = log.arms.find((x) => x.id === a.id);
    if (prior?.file && existsSync(join(dir, prior.file)) && prior.credits != null) { console.log(`  ${a.id}: already generated, skipping`); if (a.kind === "source") sourcePath = prior.uploaded; continue; }
    if (a.kind === "edit" && !sourcePath) {
      if (!existsSync(join(dir, SOURCE_FILE))) throw new Error(`editor arms need ${SOURCE_FILE} — run the \`source\` arm first, or pass --editor-source`);
      sourcePath = await uploadFile(join(dir, SOURCE_FILE), "image");
    }
    const endpoint = a.kind === "edit" ? "/v1/ai-image-editor" : "/v1/ai-image-generator";
    const body = bodyFor(a, sourcePath);
    const expect = cost(a.model, true);
    check(expect);
    let r;
    try { r = await runJob(endpoint, body, "image"); }
    catch (e) { release(expect); console.error(`  ${a.id}: FAILED — ${e.message}`); log.arms = [...log.arms.filter((x) => x.id !== a.id), { ...a, endpoint, request: body, error: String(e.message).slice(0, 300) }]; save(); continue; }
    release(expect);
    spend({ run: "run-001", endpoint, name: body.name, model: a.model, credits: r.credits || 0 });
    await download(r.downloads[0], join(dir, a.file));
    log.arms = [...log.arms.filter((x) => x.id !== a.id), { ...a, endpoint, request: body, credits: r.credits, seconds: r.seconds, uploaded: a.kind === "source" ? await uploadFile(join(dir, a.file), "image") : undefined }];
    if (a.kind === "source") sourcePath = log.arms.at(-1).uploaded;
    console.log(`  ${a.id}: ${r.credits} credits, ${r.seconds}s → ${a.file}`);
    save();
  }
}

// ---------------- score ----------------
async function doScore() {
  if (!hasFfmpeg) { console.log("score: ffprobe/ffmpeg not found — vision.js needs it to encode frames. Generation is untouched; re-run --phase score once ffmpeg is installed."); return; }
  for (const a of log.arms) {
    if (a.kind === "source" || a.error || !a.file || !existsSync(join(dir, a.file))) continue;
    if (a.result?.pass != null) continue;
    a.result = await score(a, dir);
    console.log(`  ${a.id}: ${a.result.pass === true ? "PASS" : a.result.pass === false ? "FAIL" : "not scored"}${a.result.problem ? ` — ${a.result.problem}` : ""}`);
    save();
  }
}

const t0 = Date.now();
Object.assign(log, { started_at: new Date().toISOString(), dry_run: false, hold: HOLD, cap: CAP, estimated_total: optimistic });
try {
  if (PHASE === "generate" || PHASE === "all") await generate();
  if (PHASE === "score" || PHASE === "all") await doScore();
} finally {
  log.charged_total = log.arms.reduce((n, a) => n + (a.credits || 0), 0);
  log.ledger_after = ledger().spent; log.llm = usage; log.elapsed_s = Math.round((Date.now() - t0) / 1000);
  save();
  console.log(`\ncharged ${log.charged_total} credits · ledger now ${log.ledger_after}/${CAP} · ${log.elapsed_s}s`);
  console.log(`page: ${join(dir, "index.html")}`);
}
