// flux-2-klein, all inputs in one call, at 3, 4 and 5 references with different elements. Output: V3/runs/reftest-2/
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { Jobs } from "../../V2/backend/lib/jobs.js";
import { jsonCall, S } from "../../V2/backend/lib/llm.js";
import { V3 } from "./paths.mjs";
const dir = join(V3, "runs", "reftest-2"); mkdirSync(dir, { recursive: true });
const R = join(V3, "runs/v3-student-1/refs");
const REF = {
  room: { file: "in-room.jpg", from: join(R, "classroom/cand-10.jpg"), role: "the CLASSROOM, the actual room, not inspiration: preserve its rows of brown wooden desks with dark metal frames, large grid windows along the back wall with trees outside, green chalkboard on the right wall, green lockers at left, ceiling fluorescents and fans, polished dark floor and the original perspective" },
  teacher: { file: "in-teacher.jpg", from: join(R, "person/cand-6.jpg"), role: "the TEACHER: preserve his precise face, short curly brown hair, mature features, grey long-sleeve shirt and jeans" },
  evan: { file: "in-evan.jpg", from: join(R, "web-students/evan.jpg"), role: "EVAN, a student: preserve his face, skin tone and short braids; black sweatshirt with thin white lines, no lettering, no necklace" },
  maya: { file: "in-maya.jpg", from: join(R, "web-students/maya.jpg"), role: "MAYA, a student: preserve her precise face and brown hair with a blunt fringe; white blouse and dark vest; NO umbrella, no studio props, no fishnets; seated at a desk like an ordinary student" },
  leo: { file: "in-leo.jpg", from: join(R, "web-students/leo-approved.jpg"), role: "LEO, a student: the young man in the old black-and-white portrait; preserve his facial features and swept-back hair but render him in full colour in present-day casual clothes, no bow tie, no suit, no frame" },
};
for (const r of Object.values(REF)) copyFileSync(r.from, join(dir, r.file));
const recFile = join(dir, "results.json"), rec = existsSync(recFile) ? JSON.parse(readFileSync(recFile, "utf8")) : { jobs: {}, calls: [], pending: {}, tests: [] };
const run = { name: "v3-reftest-2", path: (f) => join(dir, f), log: rec, save: () => writeFileSync(recFile, JSON.stringify(rec, null, 2)) };
const jobs = new Jobs(run), KLEIN = { model: "flux-2-klein", resolution: "640px", aspect_ratio: "16:9" };
const TESTS = [
  { name: "3ref-room-maya-leo", refs: ["room", "maya", "leo"], stage: "Maya and Leo sit at two neighbouring desks in the front row, turned slightly toward each other as if talking; the rest of the room is empty. Morning sunlight through these windows." },
  { name: "4ref-room-teacher-evan-maya", refs: ["room", "teacher", "evan", "maya"], stage: "The teacher stands in the aisle beside Evan's aisle desk handing him a single white test sheet face down; Evan sits there looking up at it; Maya sits at the next desk looking across at the paper. Morning sunlight through these windows." },
  { name: "5ref-room-teacher-evan-maya-leo", refs: ["room", "teacher", "evan", "maya", "leo"], stage: "The teacher stands in the aisle beside Evan's aisle desk handing him a single white test sheet face down; Evan sits there looking up at it; Maya sits at the next desk looking across at the paper; Leo sits beside Maya, leaning in. Exactly four people. Morning sunlight through these windows." },
];
const prompt = (refs, stage) => `Create ONE photorealistic widescreen 16:9 still, the first frame of a classroom scene. ${refs.map((k, i) => `Reference image ${i + 1} is ${REF[k].role}.`).join(" ")} Add the people into the room naturally, at a size where faces are clearly visible; the room's light, perspective and floor stay as photographed. ${stage} Each person must be recognisably the person in their reference, in colour, no props from the reference photos, no other people, no text, no watermark, no collage or split frame; one coherent photograph.`;
const CHECK = S.obj({ room_kept: S.enum(["yes", "partly", "no"]), people: S.arr(S.obj({ name: S.str, present: S.enum(["yes", "no"]), looks_like_reference: S.enum(["yes", "partly", "no"]) })), extra_people: S.int, staging_right: S.enum(["yes", "partly", "no"]), one_coherent_photo: S.enum(["yes", "no"]), evidence: S.str });
for (const t of TESTS) {
  const people = t.refs.filter((r) => r !== "room"), p = prompt(t.refs, t.stage), out = `${t.name}.png`;
  const j = await jobs.image(t.name, out, p, t.refs.map((k) => REF[k].file), KLEIN);
  const chk = await jsonCall({ name: "v3-reftest-check-v2", effort: "medium", images: [join(dir, REF.room.file), ...people.map((k) => join(dir, REF[k].file)), join(dir, out)], schema: CHECK, prompt: `Image 1 = the room photo; ${people.map((k, i) => `image ${i + 2} = ${k}'s photo`).join("; ")}; the last image = the result. Is the room kept (desks, windows, lockers, board, perspective)? For each named person: present, and does the face and hair look like their photo? How many people are in the result beyond the ${people.length} named (extra_people)? Is the staging right: ${t.stage}? One coherent photograph? Evidence in a few words.` });
  const rr = { ...t, model: KLEIN.model, method: "all at once", prompt: p, file: out, credits: j.credits || 0, check: chk };
  rec.tests = rec.tests.filter((x) => x.name !== t.name).concat(rr); run.save();
  console.log(`${t.name}: ${rr.credits} cr · room ${chk.room_kept} · ${chk.people.map((x) => `${x.name} ${x.present}/${x.looks_like_reference}`).join(", ")} · extra ${chk.extra_people} · staging ${chk.staging_right} · coherent ${chk.one_coherent_photo} · ${chk.evidence}`);
}
rec.total = rec.tests.reduce((n, t) => n + t.credits, 0); run.save(); console.log(`== total ${rec.total} credits`);
