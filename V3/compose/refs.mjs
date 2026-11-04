// Premade references from a bible: one key still per request (a person, a place with its people, an object), made with the free
// still model and checked against the bible's words by a VLM. The state manager later hands these to case 3; for now by hand.
// Usage: CLEANED_CAP=… node V3/compose/refs.mjs --plan V3/runs/<label>/sequence.json --label <label> --make "bridge_crew: Captain Vale, the lookout and the helmsman at their stations on the bridge, medium three-shot, faces visible" [--make …]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { Jobs } from "../../V2/backend/lib/jobs.js";
import { jsonCall, S } from "../../V2/backend/lib/llm.js";
import { stillCost } from "../../V2/backend/lib/models.js";
import { V3 } from "./paths.mjs";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d), all = (k) => args.flatMap((a, i) => (a === k ? [args[i + 1]] : []));
const plan = JSON.parse(readFileSync(resolve(opt("--plan")), "utf8")).plan, label = opt("--label"), DRY = args.includes("--dry");
const STILL = { model: "qwen-image-2.1", resolution: "640px", aspect_ratio: "16:9" };
const dir = join(V3, "runs", label, "refs"); mkdirSync(dir, { recursive: true });
const recFile = join(dir, "refs.json"), rec = existsSync(recFile) ? JSON.parse(readFileSync(recFile, "utf8")) : { label, made: {}, jobs: {}, calls: [], pending: {} };
const run = { name: `v3-${label}-refs`, path: (f) => join(dir, f), log: rec, save: () => writeFileSync(recFile, JSON.stringify(rec, null, 2)) };
const jobs = new Jobs(run, { estimate: DRY });
const bible = [...plan.bible.people, ...plan.bible.places, ...plan.bible.objects];
for (const m of all("--make")) {
  const [name, what] = m.split(/:\s*/, 2);
  const looks = bible.filter((b) => what.toLowerCase().includes(b.id.replace(/_/g, " ")) || what.toLowerCase().includes(b.id)).map((b) => `${b.id} = ${b.look}`);
  const sp = await jsonCall({ name: "v3-ref-prompt-v1", effort: "low", schema: S.obj({ prompt: S.str }), prompt: `Write ONE text-to-image prompt (≤ 500 characters) for a photorealistic reference still, widescreen 16:9 film frame, that will be used to keep identities consistent across video clips: ${what}. Use these looks verbatim for the named things: ${looks.join("; ") || "(none matched; describe from the request)"}. Light and grade: ${plan.bible.light_and_grade}. Faces clearly visible and lit, eye level, no text, no watermark, no collage.` });
  const file = `${name}.png`, cost = stillCost(STILL.model, STILL.resolution);
  const j = await jobs.image(name, file, sp.prompt, [], STILL);
  const entry = { name, what, prompt: sp.prompt, file, credits: j.credits || 0, cost };
  if (!DRY) {
    entry.check = await jsonCall({ name: "v3-ref-check-v1", effort: "low", images: [run.path(file)], schema: S.obj({ matches: S.arr(S.obj({ id: S.str, met: S.enum(["yes", "partly", "no"]), evidence: S.str })), faces_clear: S.enum(["yes", "no"]), usable: S.bool }), prompt: `Check this reference still against the looks it must show: ${looks.join("; ")}. For each id: yes/partly/no with evidence. faces_clear: are the people's faces clearly visible? usable: true if every id is at least partly met and faces are clear.` });
    console.log(`${name}: ${entry.credits} credits · ${entry.check.matches.map((x) => `${x.id} ${x.met}`).join(", ")} · faces ${entry.check.faces_clear} · ${entry.check.usable ? "USABLE" : "NOT USABLE"}`);
  } else console.log(`${name}: would cost ${cost} · ${sp.prompt}`);
  rec.made[name] = entry; run.save();
}
console.log(`refs in ${dir}`);
