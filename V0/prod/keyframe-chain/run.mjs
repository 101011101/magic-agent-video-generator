// Keyframe chain litmus: story → LLM keyframes (one per change) → each frame is an edit of the previous frame; a frame that
// refers back to an earlier one folds the references in pairwise (prev + ref1 → r1, r1 + ref2 → r2, …) → slideshow for
// approval → only when approved, a video (one start/end-frame clip per consecutive pair, concatenated).
// Each frame is checked against the previous one by a vision call; unplanned changes get one corrective re-edit.
// Usage: node current/prod/keyframe-chain/run.mjs --case f1-red-riding-hood-anime [--label v1] [--from v1] [plan|images|check|show|video]
//   no phase = plan + images + show. `check` only reports on the frames that exist. `video` refuses to run until approval.json says approved.
//   --from <label>: start from that run's raw plan, and copy any of its frames whose signature (prompt + input hashes) matches.
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { join, extname } from "node:path";
import { REPO } from "../state-manager/src/paths.js";
import { jsonCall } from "../state-manager/src/llm.js";
import { runJob, download, uploadFile } from "../state-manager/src/magichour.js";
import { loadCase, net } from "../pipeline-memory/src/common.js";
import { visionCallImages } from "../pipeline-v2/src/vision.js";
import { renderSlideshow } from "./page.js";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const caseId = opt("--case", "f1-red-riding-hood-anime"), label = opt("--label", "v1"), from = opt("--from", null);
const phase = args.find((a) => ["plan", "images", "check", "show", "video"].includes(a));
const RETRIES = Number(opt("--retries", 1));
const PORT = Number(process.env.PORT || 4481);
const DIR = join(REPO, "current/tests/keyframe-chain/runs", `${caseId}-${label}`);
const LEDGER = join(REPO, "current/tests/keyframe-chain/ledger.json");
const CAP = Number(process.env.KC_CAP || 8000);
const IMAGE = { model: "nano-banana-pro", resolution: "2k", aspect_ratio: "16:9" };
const VIDEO = { model: "wan-3.0", resolution: "720p", audio: false };
const COST = { image: 200, video_s: 96 };
mkdirSync(DIR, { recursive: true });
const p = (f) => join(DIR, f);
const FROM = from && join(REPO, "current/tests/keyframe-chain/runs", `${caseId}-${from}`);
const fromLog = FROM && existsSync(join(FROM, "run.json")) ? JSON.parse(readFileSync(join(FROM, "run.json"), "utf8")) : null;
const logPath = p("run.json");
const log = existsSync(logPath) ? JSON.parse(readFileSync(logPath, "utf8")) : {};
const save = () => writeFileSync(logPath, JSON.stringify(log, null, 2));

// Ledger with a hard cap, separate from the other pipelines'.
const ledger = () => (existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, "utf8")) : { spent: 0, jobs: [] });
async function mh(endpoint, body, kind, expect) {
  const l = ledger();
  if (l.spent + expect > CAP) throw new Error(`budget: ${l.spent} spent + ${expect} would pass the cap of ${CAP} (KC_CAP)`);
  const r = await runJob(endpoint, body, kind, { timeoutS: kind === "video" ? 2700 : 1200 });
  l.spent += r.credits || 0; l.jobs.push({ at: new Date().toISOString(), run: `${caseId}-${label}`, endpoint, name: body.name, credits: r.credits || 0 });
  writeFileSync(LEDGER, JSON.stringify(l, null, 2));
  return r;
}
const upCache = {};
const up = (f) => (upCache[f] ??= uploadFile(p(f)));

// 1. Plan.
const str = { type: "string" };
const obj = (props) => ({ type: "object", additionalProperties: false, required: Object.keys(props), properties: props });
const arr = (items) => ({ type: "array", items });
const SCHEMA = obj({
  style: str,
  characters: arr(obj({ name: str, look: str })),
  keyframes: arr(obj({
    id: str, change: str, description: str,
    refs: arr(obj({ id: str, take: str })),
  })),
});
const PROMPT = `Turn this story into a sequence of keyframes for a picture book that will later be animated. A keyframe marks a moment where something changes: a character enters or leaves, someone acts, the place, light or framing changes, an object changes hands or state. Make 8 to 12 keyframes that cover the whole story in order.

Every keyframe after the first is made by EDITING the previous keyframe's image, so write each one as a change from the previous image.

- style: one line on the look of a single frame (medium, palette, texture, light).
- characters: every character, with look = the traits that never change (face, age, hair, clothing, colours). Name them exactly the same everywhere.
- keyframes, in order:
  - id: "01", "02", …
  - change: what changes from the previous keyframe, as an edit instruction (for "01": "first frame").
  - description: the full still image at this keyframe: framing, who is where, what they hold, light, place. Present tense, only what is visible, using the character names.
  - refs: earlier keyframes (NOT the immediately previous one) that this frame must match on something the previous frame does not show: a character or object returning after being off-screen, a place revisited, a detail established earlier. Each: id and take = exactly what to copy from it ("Grandma's face, hair and nightgown", "the cottage exterior and flower beds"). Usually []. Never refer forward.

The original request was: {{request}}

Story:
{{story}}`;

const cleanRefs = (pl) => { const ids = pl.keyframes.map((k) => k.id); for (const [i, k] of pl.keyframes.entries()) k.refs = k.refs.filter((r) => ids.indexOf(r.id) >= 0 && ids.indexOf(r.id) < i - 1); return pl; };

// Plan audit: the keyframe list is read as a chain of edits and checked for breaks in logic before any image is bought.
const AUDIT = obj({ issues: arr(obj({ id: str, problem: str, fix: str })), plan: SCHEMA });
const AUDIT_PROMPT = `Below is a keyframe plan for a picture-book sequence. Each keyframe image is made by EDITING the previous keyframe's image with its "change" instruction, so the sequence must read as one continuous, physically logical world. Audit it for logical anomalies and return the corrected plan.

A hard limit of the image editor (measured): it cannot move the camera. "Widen the view", "move closer", "push in" leave the framing unchanged and the editor fakes it by inserting or erasing things in place. So within one place keep one fixed framing and change only the people and props in it. Going to a new place or a new framing is a cut: write that change as "New shot: <full description of the new framing>", which the editor redraws from scratch while keeping characters and style.

Look for:
- Camera moves inside a place (widen, zoom, push in, crop out): remove them (fixed framing) or turn them into a cut.
- Appearing out of nowhere: something (a building, a character, a prop) shows up in a place that the previous frame already showed without it, and nothing in the change brings it in (walking in from off-frame, a door opening, a camera move that reveals space that was off-screen). A camera "reveal" by widening is fragile for an image edit: prefer a version where the thing is not shown yet (a character points or looks off-frame toward it) and it is shown only after a cut to a new place.
- Teleporting or re-posing: a character or prop changes position, side of frame, scale or posture without the change saying so; a character's relation to others (who stands where) flips.
- State reverting: a prop put down that is held again later, a door that is opened twice, a costume item that comes and goes, something removed that comes back.
- Invisible changes: a change that the image cannot show because that state was already true (a door "bursting open" when it is already open).
- Continuity across a cut: a place revisited or a character returning must reference the earlier keyframe that showed it (refs), and must not contradict it.
- Story logic: who knows what, cause and effect, every story beat still covered.

For each problem: id = the keyframe, problem, fix. Then the full corrected plan in the same shape (same style and characters unless a character look is itself inconsistent; you may change change/description/refs and add, split or remove keyframes; renumber "01", "02", … in order; 8 to 12 keyframes). Each change must state explicitly what stays put ("Wolf stays where he is, same pose") whenever another element moves. If there is no problem, return issues [] and the plan unchanged.

Plan:
{{plan}}`;

async function plan() {
  if (log.plan) return log.plan;
  const c = loadCase(caseId);
  log.case = { id: c.id, title: c.title, request: c.request };
  let raw = fromLog?.plan_raw || fromLog?.plan;
  if (!raw) {
    console.log(`plan: ${c.title}…`);
    raw = cleanRefs(await jsonCall({ name: "keyframechain", schema: SCHEMA, effort: "medium", prompt: PROMPT.replace("{{request}}", () => c.request).replace("{{story}}", () => c.story) }));
  }
  console.log("plan audit…");
  const a = await jsonCall({ name: "keyframeaudit", schema: AUDIT, effort: "high", prompt: AUDIT_PROMPT.replace("{{plan}}", () => JSON.stringify(raw, null, 2)) });
  log.plan_raw = raw; log.audit = a.issues; log.plan = cleanRefs(a.plan); save();
  for (const i of a.issues) console.log(`  ${i.id}: ${i.problem} → ${i.fix}`);
  return log.plan;
}

// 2. Images. Each step in a frame's lineage is { inputs, prompt, out }.
const castLine = (pl) => pl.characters.map((c) => `${c.name}: ${c.look}`).join("; ");
const keep = (pl) => `Keep the exact art style (${pl.style}) and every character's exact face, hair, clothing and colours (${castLine(pl)}). One single image, no panels, no text.`;
const hash = (f) => (existsSync(f) ? createHash("sha256").update(readFileSync(f)).digest("hex").slice(0, 16) : "missing");
const sigOf = (spec, inputs, dir = DIR) => createHash("sha256").update(JSON.stringify({ spec, IMAGE, inputs: inputs.map((f) => hash(join(dir, f))) })).digest("hex").slice(0, 16);
// A --from run made before calls were signed: sign its recorded steps against its own files.
if (fromLog && !fromLog.calls) fromLog.calls = Object.fromEntries(Object.values(fromLog.frames || {}).flatMap((f) => f.steps).map((st) => [st.out, { ...st, sig: sigOf(st.prompt, st.inputs, FROM) }]));
// One paid image call, skipped when this run already has the output with the same signature, or --from has it (copied).
async function call(name, inputs, prompt, out) {
  const sig = sigOf(prompt, inputs);
  const mine = log.calls?.[out];
  if (mine?.sig === sig && existsSync(p(out))) return { ...mine, cached: true };
  const theirs = fromLog?.calls?.[out];
  if (theirs?.sig === sig && existsSync(join(FROM, out))) { copyFileSync(join(FROM, out), p(out)); delete upCache[out]; (log.calls ??= {})[out] = { ...theirs, copied_from: from }; save(); return { ...theirs, copied_from: from }; }
  const body = { name, image_count: 1, ...IMAGE, style: { prompt }, ...(inputs.length ? { assets: { image_file_paths: await Promise.all(inputs.map(up)) } } : {}) };
  const endpoint = inputs.length ? "/v1/ai-image-editor" : "/v1/ai-image-generator";
  const r = await mh(endpoint, body, "image", COST.image);
  await download(r.downloads[0], p(out)); delete upCache[out];
  const rec = { endpoint, inputs, prompt, out, credits: r.credits, seconds: r.seconds, sig };
  (log.calls ??= {})[out] = rec; save();
  return rec;
}

// Who is in each keyframe and where: decides the edit base (same place → previous frame; a place seen before → its last
// frame, so a return does not redraw the room) and which character sheets go in.
const TAGS = obj({ keyframes: arr(obj({ id: str, place: str, cast: arr(str) })) });
async function tags(pl) {
  if (log.tags) return log.tags;
  const r = await jsonCall({ name: "keyframetags", schema: TAGS, effort: "low", prompt: `For each keyframe, give place = a short fixed name for the location and framing (the same name every time the same place with the same framing is shown, e.g. "forest path", "cottage exterior", "bedroom") and cast = the names of the characters visible in it, spelled exactly as in the characters list.\n\n${JSON.stringify(pl, null, 2)}` });
  log.tags = Object.fromEntries(r.keyframes.map((t) => [t.id, t])); save();
  return log.tags;
}
const slug = (n) => n.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const sheetOf = (name) => `sheet-${slug(name)}.png`;
async function sheets(pl) {
  for (const c of pl.characters)
    await call(`${caseId} sheet ${c.name}`, [], `Character reference sheet of ${c.name}: ${c.look}. One full-body figure, three-quarter front view, standing in a neutral pose, the whole body visible head to feet, on a plain warm paper background with nothing else. Style: ${pl.style}. No text, no panels.`, sheetOf(c.name));
}

// The images that go into a frame's edit, each with the role the prompt gives it.
function inputsFor(pl, T, i) {
  const k = pl.keyframes[i], t = T[k.id] || { place: "", cast: [] };
  const prevK = pl.keyframes[i - 1], prev = `${prevK.id}.png`;
  let base = prev, mode = "same place";
  if (T[prevK.id]?.place !== t.place) {
    const back = pl.keyframes.slice(0, i - 1).filter((x) => T[x.id]?.place === t.place).at(-1);
    if (back) { base = `${back.id}.png`; mode = `return to ${t.place}`; } else mode = "new place";
  }
  const list = [[base, mode === "same place" ? "the current scene (edit this image)" : mode === "new place" ? "the previous scene; the new shot continues the story from it" : `the last time we were in ${t.place}: keep this exact room, furniture, framing and light (edit this image)`]];
  if (base !== prev) list.push([prev, "the moment just before, in another place: use it only for what the characters wear and hold now"]);
  for (const r of k.refs) if (!list.some(([f]) => f === `${r.id}.png`)) list.push([`${r.id}.png`, `earlier keyframe ${r.id}: copy ${r.take}`]);
  for (const n of t.cast) if (pl.characters.some((c) => c.name === n)) list.push([sheetOf(n), `character sheet of ${n}: copy ${n}'s exact body type, proportions, face and costume`]);
  return { list, mode };
}

// Frame check: what changed that the plan did not ask for, against the previous frame, the place frame and the sheets.
const CHECK = obj({ ok: { type: "boolean" }, anomalies: arr(obj({ what: str, kind: { type: "string", enum: ["appeared", "disappeared", "moved", "reposed", "restyled", "off_model", "state_reverted", "change_missing", "other"] } })), fix: str });
async function check(pl, i, file = `${pl.keyframes[i].id}.png`) {
  const k = pl.keyframes[i], prev = pl.keyframes[i - 1];
  const { list } = inputsFor(pl, log.tags || {}, i);
  const imgs = [[`the previous keyframe ${prev.id}`, `${prev.id}.png`], [`the new keyframe ${k.id}`, file], ...list.filter(([f]) => f !== `${prev.id}.png`).map(([f, d]) => [d, f])];
  const text = `Consecutive keyframes of a picture-book sequence. Images: ${imgs.map(([d], j) => `image ${j + 1} = ${d}`).join("; ")}.
The new keyframe should differ from what came before only by this change: "${k.change}"
It should show: ${k.description}
Characters: ${castLine(pl)}

Find logical anomalies in the new keyframe: anything that differs from the previous keyframe (or, after a cut back to a place, from that place's earlier frame) that the change does not explain. Check each character's position in the frame, side, scale, posture and facing; each prop's position, holder, count and state; the setting (buildings, trees, furniture, doors, windows) and the framing. Something that newly appears must be explained by the change. Flag a character who departs from their character sheet (body type, proportions, costume, colours) as off_model. Also flag a planned change that is not visible.
Ignore small redraw noise (leaf patterns, line wobble). Report only what a viewer flipping between the frames would notice.
ok = no anomalies. fix = one edit instruction that would correct all anomalies while keeping the planned change ("" if ok).`;
  return net(() => visionCallImages("keyframecheck", CHECK, text, imgs.map(([, f]) => p(f))));
}

async function images(pl) {
  const T = await tags(pl);
  await sheets(pl);
  log.frames = {};
  for (const [i, k] of pl.keyframes.entries()) {
    const file = `${k.id}.png`, steps = [];
    const t = T[k.id] || { cast: [] };
    if (i === 0) {
      const ins = t.cast.filter((n) => pl.characters.some((c) => c.name === n)).map(sheetOf);
      steps.push(await call(`${caseId} ${k.id}`, ins, `${ins.length ? `${ins.map((f, j) => `Image ${j + 1} is a character sheet; copy that character exactly.`).join(" ")} Create a new scene: ` : ""}${k.description} Style: ${pl.style}. Characters: ${castLine(pl)}. One single image, no panels, no text.`, file));
      log.frames[k.id] = { mode: "first" };
    } else {
      // One multi-image call (the editor takes up to 10 images); when a model takes only two, fold them 1 + 1.
      const { list, mode } = inputsFor(pl, T, i);
      const how = mode === "new place" ? `New shot: ${k.description}` : `Edit image 1: ${k.change}. The result shows: ${k.description} Everything not named in the edit stays exactly where and how it is in image 1.`;
      const prompt = (extra) => `${list.map(([, d], j) => `Image ${j + 1} is ${d}.`).join(" ")} ${how} Output one image${mode === "new place" ? "" : " framed exactly like image 1"}. ${keep(pl)}${extra}`;
      const first = await call(`${caseId} ${k.id}`, list.map(([f]) => f), prompt(""), file);
      steps.push(first);
      const checks = [await check(pl, i)];
      // Repair once with the anomalies named; keep whichever attempt has fewer anomalies.
      for (let t2 = 1; t2 <= RETRIES && !checks.at(-1).ok; t2++) {
        const c = checks.at(-1);
        console.log(`  ${k.id}: ${c.anomalies.map((a) => `${a.kind}: ${a.what}`).join(" | ")} → re-edit`);
        const out = `${k.id}-fix${t2}.png`;
        steps.push(await call(`${caseId} ${k.id} fix ${t2}`, list.map(([f]) => f), prompt(` Correct these problems seen in a previous attempt: ${c.anomalies.map((a) => a.what).join("; ")}. ${c.fix}`), out));
        const c2 = await check(pl, i, out); c2.file = out; checks.push(c2);
        const best = checks.reduce((x, y) => (y.anomalies.length < x.anomalies.length ? y : x));
        if (best === c2) { copyFileSync(p(out), p(file)); delete upCache[file]; }
      }
      const best = checks.reduce((x, y) => (y.anomalies.length < x.anomalies.length ? y : x));
      log.frames[k.id] = { mode, inputs: list.map(([f, d]) => ({ file: f, role: d })), checks, kept: best.file || file };
    }
    const credits = steps.filter((s) => !s.cached && !s.copied_from).reduce((n, s) => n + (s.credits || 0), 0);
    log.frames[k.id] = { ...log.frames[k.id], done: true, file, steps, credits };
    save(); writeFileSync(p("index.html"), renderSlideshow(log));
    const ch = log.frames[k.id].checks, kept = ch && ch.reduce((x, y) => (y.anomalies.length < x.anomalies.length ? y : x));
    console.log(`  ${k.id}: [${log.frames[k.id].mode}] ${steps.length} call(s), ${credits} new credits${kept ? ` · ${kept.ok ? "check ok" : `kept ${log.frames[k.id].kept} with: ${kept.anomalies.map((a) => a.what).join(" | ")}`}` : ""}`);
  }
  log.total_credits = Object.values(log.calls || {}).filter((c) => !c.copied_from).reduce((n, c) => n + (c.credits || 0), 0); save();
}

// Report-only check of the frames that exist (no spend).
async function checkAll(pl) {
  for (const i of pl.keyframes.keys()) {
    if (i === 0 || !existsSync(p(`${pl.keyframes[i].id}.png`))) continue;
    const c = await check(pl, i);
    console.log(`${pl.keyframes[i - 1].id}→${pl.keyframes[i].id}: ${c.ok ? "ok" : c.anomalies.map((a) => `[${a.kind}] ${a.what}`).join("\n        ")}`);
  }
}

// 3. Slideshow with approval; POST /approval writes approval.json.
function show() {
  writeFileSync(p("index.html"), renderSlideshow(log));
  const types = { ".png": "image/png", ".jpg": "image/jpeg", ".mp4": "video/mp4", ".json": "application/json", ".html": "text/html; charset=utf-8" };
  createServer((req, res) => {
    if (req.method === "POST" && req.url === "/approval") {
      let b = ""; req.on("data", (d) => (b += d)); req.on("end", () => {
        const a = { ...JSON.parse(b || "{}"), at: new Date().toISOString() };
        writeFileSync(p("approval.json"), JSON.stringify(a, null, 2));
        console.log(`approval: ${a.approved ? "APPROVED" : "REJECTED"}${a.note ? ` — ${a.note}` : ""}`);
        res.writeHead(200, { "content-type": "application/json" }); res.end("{}");
      }); return;
    }
    const f = p(decodeURIComponent(req.url.split("?")[0]).replace(/^\/+/, "").replace(/\.\./g, "") || "index.html");
    if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": types[extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
  }).listen(PORT, () => console.log(`slideshow: http://localhost:${PORT}  (ctrl-c to stop)`));
}

// 4. Video, only after approval: clip i goes from keyframe i to keyframe i+1 (start + end frame), then concat.
async function video(pl) {
  const a = existsSync(p("approval.json")) ? JSON.parse(readFileSync(p("approval.json"), "utf8")) : null;
  if (!a?.approved) throw new Error("not approved: open the slideshow and approve first (approval.json)");
  log.clips ??= {};
  const ks = pl.keyframes, seconds = 5;
  for (let i = 0; i < ks.length - 1; i++) {
    const a1 = ks[i], b1 = ks[i + 1], out = `clip-${a1.id}-${b1.id}.mp4`;
    if (log.clips[out] && existsSync(p(out))) continue;
    const prompt = `${b1.change}. ${pl.style} Smooth continuous motion from the first frame to the last frame.`;
    const body = { name: `${caseId} ${a1.id}→${b1.id}`, ...VIDEO, end_seconds: seconds, style: { prompt }, assets: { image_file_path: await up(`${a1.id}.png`), end_image_file_path: await up(`${b1.id}.png`) } };
    const r = await mh("/v1/image-to-video", body, "video", COST.video_s * seconds);
    await download(r.downloads[0], p(out));
    log.clips[out] = { prompt, credits: r.credits, seconds: r.seconds }; save();
    console.log(`  ${out}: ${r.credits} credits`);
  }
  const list = ks.slice(0, -1).map((k, i) => `file '${p(`clip-${k.id}-${ks[i + 1].id}.mp4`)}'`).join("\n");
  writeFileSync(p("concat.txt"), list);
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", p("concat.txt"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-an", p("final.mp4")]);
  log.video = { file: "final.mp4", clips: ks.length - 1 }; save(); writeFileSync(p("index.html"), renderSlideshow(log));
  console.log(`video: ${p("final.mp4")}`);
}

const pl = await plan();
if (phase === "plan") { console.log(pl.keyframes.map((k) => `${k.id}${k.refs.length ? ` [refs ${k.refs.map((r) => r.id).join(",")}]` : ""}: ${k.change}`).join("\n")); process.exit(0); }
if (!phase || phase === "images") await images(pl);
if (phase === "check") { await checkAll(pl); process.exit(0); }
if (phase === "video") await video(pl);
if (!phase || phase === "show") show();
