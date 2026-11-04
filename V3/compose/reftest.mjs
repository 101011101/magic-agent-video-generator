// Reference-count test for the free still editors: 2 refs (room + teacher) and 3 refs (room + teacher + Evan), each model by the
// way it can take them: direct when it accepts the count, the 1+1 chain otherwise, and both for a model that accepts more.
// Same long per-input prompt style for every call. Output: V3/runs/reftest-1/{results.json,index.html}
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { Jobs } from "../../V2/backend/lib/jobs.js";
import { jsonCall, S } from "../../V2/backend/lib/llm.js";
import { stillCost } from "../../V2/backend/lib/models.js";
import { V3 } from "./paths.mjs";
const dir = join(V3, "runs", "reftest-1"); mkdirSync(dir, { recursive: true });
const R = join(V3, "runs/v3-student-1/refs");
const REF = { room: { file: "in-room.jpg", from: join(R, "classroom/cand-10.jpg"), role: "the CLASSROOM, the actual room, not inspiration: preserve its rows of brown wooden desks with dark metal frames, large grid windows along the back wall with trees outside, green chalkboard on the right wall, green lockers at left, ceiling fluorescents and fans, polished dark floor and the original perspective" },
  teacher: { file: "in-teacher.jpg", from: join(R, "person/cand-6.jpg"), role: "the TEACHER: preserve his precise face, short curly brown hair, mature features, grey long-sleeve shirt and jeans" },
  evan: { file: "in-evan.jpg", from: join(R, "web-students/evan.jpg"), role: "EVAN, a student: preserve his face, skin tone and short braids; he wears his black sweatshirt with thin white lines but WITHOUT any lettering or logo; no necklace" } };
for (const r of Object.values(REF)) copyFileSync(r.from, join(dir, r.file));
const recFile = join(dir, "results.json"), rec = existsSync(recFile) ? JSON.parse(readFileSync(recFile, "utf8")) : { jobs: {}, calls: [], pending: {}, tests: [] };
const run = { name: "v3-reftest-1", path: (f) => join(dir, f), log: rec, save: () => writeFileSync(recFile, JSON.stringify(rec, null, 2)) };
const jobs = new Jobs(run);
const M = { "qwen-image-2.1": 2, "qwen-edit": 2, "flux-2-klein": 5 };
const still = (model) => ({ model, resolution: "640px", aspect_ratio: "16:9" });
// the long per-input prompt: inputs by number and role, the staging, what to drop
const STAGE2 = "The teacher stands in the aisle beside a front-row desk holding a single white test sheet face down, blank side to camera, as if about to hand it to a seated student; the desk nearest him is empty. Morning sunlight through these windows.";
const STAGE3 = "The teacher stands in the aisle beside Evan's aisle desk, reaching out to hand Evan a single white test sheet face down, blank side to camera, the moment before Evan takes it; Evan sits at that desk looking up at the paper and the teacher. Morning sunlight through these windows.";
const prompt = (inputs, stage, already = []) => `Create ONE photorealistic widescreen 16:9 still, the first frame of a classroom scene. ${inputs.map((k, i) => `Reference image ${i + 1} is ${k === "room" ? REF.room.role : REF[k].role}${k !== "room" && already.includes(k) ? " (already in the scene of image 1; keep exactly as there)" : ""}.`).join(" ")} ${already.length ? `Image 1 already contains ${already.map((k) => k.toUpperCase()).join(" and ")} in place; keep them, their positions and the room unchanged, and add only the new person.` : "Add the people into the room naturally, at a size where faces are clearly visible; the room's light, perspective and floor stay as photographed."} ${stage} Each person must be recognisably the person in their reference, in colour, no props from the reference photos, no text, no watermark, no collage or split frame; one coherent photograph.`;
const CHECK = S.obj({ room_kept: S.enum(["yes", "partly", "no"]), people: S.arr(S.obj({ name: S.str, present: S.enum(["yes", "no"]), looks_like_reference: S.enum(["yes", "partly", "no"]) })), staging_right: S.enum(["yes", "partly", "no"]), one_coherent_photo: S.enum(["yes", "no"]), evidence: S.str });
async function check(out, people, stage) {
  const imgs = [join(dir, REF.room.file), ...people.map((p) => join(dir, REF[p].file)), join(dir, out)];
  return jsonCall({ name: "v3-reftest-check-v1", effort: "medium", images: imgs, schema: CHECK, prompt: `Image 1 = the room photo; ${people.map((p, i) => `image ${i + 2} = ${p}'s photo`).join("; ")}; the last image = the result. Is the room kept (desks, windows, lockers, board, perspective)? For each person: present, and does the face and hair look like their photo? Is the staging right: ${stage}? Is it one coherent photograph (not a collage, no duplicated or floating people)? Evidence in a few words.` });
}
async function edit(key, model, inputs, stage, already = []) {
  const out = `${key}.png`, p = prompt(inputs, stage, already);
  const j = await jobs.image(key, out, p, inputs.map((k) => (k.endsWith(".png") ? k : REF[k].file)), still(model));
  return { file: out, prompt: p, credits: j.credits || 0, cost: stillCost(model, "640px") };
}
const tests = [];
async function test(name, model, refs, method) {
  const t = { name, model, refs, method, steps: [], credits: 0 }; tests.push(t);
  const people = refs.filter((r) => r !== "room"), stage = people.length === 1 ? STAGE2 : STAGE3;
  if (method === "direct") { const e = await edit(`${name}`, model, refs, stage); t.steps.push(e); t.final = e.file; }
  else { // 1+1 chain: room + first person, then result + next person
    let cur = null;
    for (const [i, p] of people.entries()) {
      const key = `${name}-step${i + 1}`;
      const inputs = i === 0 ? ["room", p] : [cur, p];
      const e = i === 0 ? await edit(key, model, inputs, people.length === 1 ? stage : STAGE2) : await (async () => { const out = `${key}.png`, pr = prompt(["room", p], stage, people.slice(0, i)).replace("Reference image 1 is the CLASSROOM, the actual room, not inspiration:", "Reference image 1 is the scene so far (the classroom with the people already placed):"); const j = await jobs.image(key, out, pr, [cur, REF[p].file], still(model)); return { file: out, prompt: pr, credits: j.credits || 0, cost: stillCost(model, "640px") }; })();
      t.steps.push(e); cur = e.file;
    }
    t.final = cur;
  }
  t.credits = t.steps.reduce((n, s) => n + s.credits, 0);
  t.check = await check(t.final, people, stage);
  console.log(`${name}: ${t.credits} credits · room ${t.check.room_kept} · ${t.check.people.map((p) => `${p.name} ${p.present}/${p.looks_like_reference}`).join(", ")} · staging ${t.check.staging_right} · coherent ${t.check.one_coherent_photo} · ${t.check.evidence}`);
  rec.tests = tests; run.save();
}
// 2 references: direct on all three
await test("2ref-qwen21", "qwen-image-2.1", ["room", "teacher"], "direct");
await test("2ref-qwenedit", "qwen-edit", ["room", "teacher"], "direct");
await test("2ref-klein", "flux-2-klein", ["room", "teacher"], "direct");
// 3 references: chain on the two-input models; klein both ways
await test("3ref-qwen21-chain", "qwen-image-2.1", ["room", "teacher", "evan"], "chain");
await test("3ref-qwenedit-chain", "qwen-edit", ["room", "teacher", "evan"], "chain");
await test("3ref-klein-direct", "flux-2-klein", ["room", "teacher", "evan"], "direct");
await test("3ref-klein-chain", "flux-2-klein", ["room", "teacher", "evan"], "chain");
rec.total = tests.reduce((n, t) => n + t.credits, 0); run.save();
console.log(`== total ${rec.total} credits · ${recFile}`);
