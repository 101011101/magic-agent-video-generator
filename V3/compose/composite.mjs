// One start image from several references: a place photo plus people photos, composited one person at a time with the free image
// editor (two inputs a call), each step checked; optionally one single-shot composite with flux-2-klein (five inputs, 5 credits).
// Usage: CLEANED_CAP=… node V3/compose/composite.mjs --out <dir> --scene "…" --base classroom=<photo> --add teacher=<photo> --add evan=<photo> … [--klein]
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { join, resolve, extname } from "node:path";
import { Jobs } from "../../V2/backend/lib/jobs.js";
import { jsonCall, S } from "../../V2/backend/lib/llm.js";
import { stillCost } from "../../V2/backend/lib/models.js";
const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d), all = (k) => args.flatMap((a, i) => (a === k ? [args[i + 1]] : []));
const dir = resolve(opt("--out")), SCENE = opt("--scene", ""), KLEIN = args.includes("--klein"); mkdirSync(dir, { recursive: true });
const kv = (p) => { const i = p.indexOf("="); return [p.slice(0, i), resolve(p.slice(i + 1))]; };
const [baseName, baseFile] = kv(opt("--base")), adds = all("--add").map(kv);
const recFile = join(dir, "composite.json"), rec = existsSync(recFile) ? JSON.parse(readFileSync(recFile, "utf8")) : { jobs: {}, calls: [], pending: {}, steps: [] };
const run = { name: `v3-composite-${dir.split("/").slice(-2).join("-")}`, path: (f) => join(dir, f), log: rec, save: () => writeFileSync(recFile, JSON.stringify(rec, null, 2)) };
const jobs = new Jobs(run), QWEN = { model: "qwen-image-2.1", resolution: "640px", aspect_ratio: "16:9" }, FLUX = { model: "flux-2-klein", resolution: "640px", aspect_ratio: "16:9" };
const local = (name, file) => { const f = `in-${name}${extname(file)}`; copyFileSync(file, run.path(f)); return f; };
const base = local(baseName, baseFile), people = adds.map(([n, f]) => ({ name: n, file: local(n, f) }));
// what each reference shows, so the edit prompt can name what to keep (and what to drop: props, monochrome)
for (const p of people) { p.seen = (await jsonCall({ name: "v3-ref-seen-v1", effort: "low", images: [run.path(p.file)], schema: S.obj({ summary: S.str }), prompt: `In one sentence: this person's hair, face type, clothing and anything in the photo that is a prop or a photo artefact (umbrella, monochrome, frame) rather than the person.` })).summary; }
rec.inputs = { base: { name: baseName, file: base }, people }; run.save();
let frame = base; rec.steps = [];
for (const [k, p] of people.entries()) {
  const out = `step-${k + 1}-${p.name}.png`;
  const sp = await jsonCall({ name: "v3-composite-prompt-v2", effort: "low", schema: S.obj({ prompt: S.str }), prompt: `Write ONE image-edit prompt (≤ 450 characters). Input image 1 = the scene so far (${k ? `a classroom already containing ${people.slice(0, k).map((x) => x.name).join(", ")}` : "an empty real classroom photo"}). Input image 2 = a photo of "${p.name}": ${p.seen}. Place that exact person (same face, hair, build) into the scene of image 1 as ${SCENE.includes(p.name) ? SCENE : "a person in the scene"}, in colour, in present-day casual clothes if the photo's clothes do not fit a classroom, dropping any props or photo artefacts; match the room's light and perspective; keep everything already in image 1 unchanged, including people already placed. Photorealistic widescreen film frame, no text.` });
  const j = await jobs.image(`step-${k + 1}`, out, sp.prompt, [frame, p.file], QWEN);
  const chk = await jsonCall({ name: "v3-composite-check-v1", effort: "medium", images: [run.path(frame), run.path(p.file), run.path(out)], schema: S.obj({ person_present: S.enum(["yes", "no"]), looks_like_reference: S.enum(["yes", "partly", "no"]), scene_kept: S.enum(["yes", "partly", "no"]), earlier_people_kept: S.enum(["yes", "partly", "no", "n/a"]), evidence: S.str }), prompt: `Image 1 = the scene before; image 2 = the person's reference photo; image 3 = the result. Is the person present in image 3, does their face and hair look like image 2, is the scene of image 1 kept, and are people already present in image 1 still there and unchanged (n/a if none)? Evidence in a few words.` });
  rec.steps.push({ step: k + 1, name: p.name, input: frame, file: out, prompt: sp.prompt, credits: j.credits || 0, cost: stillCost(QWEN.model, QWEN.resolution), check: chk }); run.save();
  console.log(`step ${k + 1} +${p.name}: ${j.credits || 0} credits · present ${chk.person_present}, like ref ${chk.looks_like_reference}, scene ${chk.scene_kept}, earlier ${chk.earlier_people_kept} (${chk.evidence})`);
  frame = out;
}
rec.final = frame;
if (KLEIN) {
  const sp = await jsonCall({ name: "v3-composite-oneshot-v1", effort: "low", schema: S.obj({ prompt: S.str }), prompt: `Write ONE image-edit prompt (≤ 500 characters) for an editor that receives ${1 + people.length} input images: image 1 = a real empty classroom photo (the scene); ${people.map((p, i) => `image ${i + 2} = "${p.name}": ${p.seen}`).join("; ")}. Compose one photorealistic widescreen film frame in the room of image 1 with each person placed as: ${SCENE}. Keep each person's exact face and hair, in colour, present-day casual clothes, no props or photo artefacts, no text.` });
  const j = await jobs.image("oneshot-klein", "oneshot-klein.png", sp.prompt, [base, ...people.map((p) => p.file)], FLUX);
  const chk = await jsonCall({ name: "v3-composite-check-oneshot-v1", effort: "medium", images: [run.path(base), ...people.map((p) => run.path(p.file)), run.path("oneshot-klein.png")], schema: S.obj({ per_person: S.arr(S.obj({ name: S.str, present: S.enum(["yes", "no"]), looks_like_reference: S.enum(["yes", "partly", "no"]) })), scene_kept: S.enum(["yes", "partly", "no"]), evidence: S.str }), prompt: `Image 1 = the room photo; images 2–${1 + people.length} = ${people.map((p, i) => `image ${i + 2} = ${p.name}`).join(", ")}; the last image = the result. For each named person: present in the result, and does their face and hair look like their photo? Is the room kept? Evidence in a few words.` });
  rec.oneshot = { model: FLUX.model, file: "oneshot-klein.png", prompt: sp.prompt, credits: j.credits || 0, cost: stillCost(FLUX.model, FLUX.resolution), check: chk }; run.save();
  console.log(`one-shot flux-2-klein: ${j.credits || 0} credits · ${chk.per_person.map((x) => `${x.name} ${x.present}/${x.looks_like_reference}`).join(", ")} · room ${chk.scene_kept} (${chk.evidence})`);
}
rec.credits = rec.steps.reduce((n, s) => n + s.credits, 0) + (rec.oneshot?.credits || 0); run.save();
console.log(`== start image: ${run.path(frame)} · sequential qwen ${rec.steps.reduce((n, s) => n + s.credits, 0)} credits${rec.oneshot ? ` · one-shot klein ${rec.oneshot.credits} credits` : ""}`);
