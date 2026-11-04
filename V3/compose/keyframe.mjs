// A proper start frame for a seeded clip: a REAL place from Wikimedia Commons (search + VLM pick), each character generated on its
// own on a plain background (qwen text-to-image), then composited into the place one at a time (qwen edit, two inputs: the frame
// so far + the character), each step checked by a VLM. Usage:
// CLEANED_CAP=… node V3/compose/keyframe.mjs --plan V3/runs/<label>/sequence.json --label <label> --name bridge_real --place bridge --search "battleship bridge interior" --person captain_vale --person lookout --person helmsman --scene "at their stations, Vale left, lookout centre, helmsman right"
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { Jobs } from "../../V2/backend/lib/jobs.js";
import { jsonCall, S } from "../../V2/backend/lib/llm.js";
import { download } from "../../V2/backend/lib/magichour.js";
import { V3 } from "./paths.mjs";
const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d), all = (k) => args.flatMap((a, i) => (a === k ? [args[i + 1]] : []));
const plan = JSON.parse(readFileSync(resolve(opt("--plan")), "utf8")).plan, label = opt("--label"), NAME = opt("--name", "keyframe"), PLACE = opt("--place"), SEARCH = all("--search"), PEOPLE = all("--person"), SCENE = opt("--scene", "");
const bible = [...plan.bible.people, ...plan.bible.places, ...plan.bible.objects], look = (id) => bible.find((b) => b.id === id)?.look || id;
const STILL = { model: "qwen-image-2.1", resolution: "640px", aspect_ratio: "16:9" }, SHEET = { model: "qwen-image-2.1", resolution: "640px", aspect_ratio: "1:1" };
const dir = join(V3, "runs", label, "refs", NAME); mkdirSync(dir, { recursive: true });
const recFile = join(dir, "keyframe.json"), rec = existsSync(recFile) ? JSON.parse(readFileSync(recFile, "utf8")) : { label, name: NAME, jobs: {}, calls: [], pending: {}, steps: [] };
const run = { name: `v3-${label}-${NAME}`, path: (f) => join(dir, f), log: rec, save: () => writeFileSync(recFile, JSON.stringify(rec, null, 2)) };
const jobs = new Jobs(run), say = (m) => console.log(m);

// 1. the real place: Commons search, VLM pick against the bible's look
say("== the place (Wikimedia Commons)");
async function commons(q, n = 8) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrnamespace=6&gsrlimit=${n}&prop=imageinfo&iiprop=url|mime|extmetadata&iiurlwidth=1280`;
  const d = await fetch(url, { headers: { "user-agent": "magic-agent-v3/0.1 (research; contact: tanjiav@gmail.com)" } }).then((r) => r.json()).catch(() => ({}));
  return Object.values(d.query?.pages || {}).filter((p) => /image\/(jpeg|png)/.test(p.imageinfo?.[0]?.mime || "")).map((p) => ({ title: p.title, thumb: p.imageinfo[0].thumburl, page: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`, license: p.imageinfo[0].extmetadata?.LicenseShortName?.value || "" }));
}
let cands = []; for (const q of SEARCH) for (const c of await commons(q)) if (!cands.some((x) => x.title === c.title) && cands.length < 12) cands.push(c);
const files = []; for (const [i, c] of cands.entries()) { const f = `cand-${i}.jpg`; try { const r = await fetch(c.thumb, { headers: { "user-agent": "magic-agent-v3/0.1 (research; contact: tanjiav@gmail.com)" } }); if (!r.ok) throw new Error(String(r.status)); writeFileSync(run.path(f), Buffer.from(await r.arrayBuffer())); files.push({ ...c, file: f }); } catch (e) { say(`  skip ${c.title}: ${e.message}`); } }
say(`  ${cands.length} candidates, ${files.length} downloaded`);
const pick = await jsonCall({ name: "v3-place-pick-v2", effort: "medium", images: files.map((f) => run.path(f.file)), schema: S.obj({ index: S.int, why: S.str, usable: S.bool, people_present: S.bool }), prompt: `Pick the ONE photo (1–${files.length}) that best serves as the real location for this film's place: ${PLACE} = ${look(PLACE)}. It must be a photograph of the interior itself (not a diagram, model, exterior, document or plaque), framed so it could be a widescreen film frame. People already in the photo are acceptable (they will be removed by an image editor); say so in people_present. usable=false only if no photo is a real interior of this kind of place. The photos, in order: ${files.map((f, i) => `${i + 1} = ${f.title} (${f.license})`).join("; ")}.` });
let place = files[pick.index - 1]; rec.place = { ...place, why: pick.why, usable: pick.usable, people_present: pick.people_present, candidates: files.length, searches: SEARCH }; run.save();
say(`  ${place?.title} (${place?.license}) · people ${pick.people_present ? "present" : "none"} · ${pick.why}`);
if (!pick.usable) { say("no usable real place found; stopping"); process.exit(1); }
if (pick.people_present) {   // clear the room first, so the characters are placed into an empty real bridge
  const j = await jobs.image("place-cleared", "place-cleared.png", `Remove every person from this photograph of a ship's bridge, filling in the consoles, deck and windows behind them seamlessly; keep the room, its windows, instruments, light and perspective exactly as photographed; photorealistic, widescreen, no text.`, [place.file], STILL);
  const chk = await jsonCall({ name: "v3-clear-check-v1", effort: "low", images: [run.path(place.file), run.path("place-cleared.png")], schema: S.obj({ people_left: S.bool, room_kept: S.enum(["yes", "partly", "no"]), evidence: S.str }), prompt: "Image 1 = the photo; image 2 = the edit that should remove every person and keep the room. Any people left in image 2? Is the room (windows, consoles, perspective) kept? Evidence in a few words." });
  rec.cleared = { file: "place-cleared.png", credits: j.credits || 0, check: chk }; run.save(); say(`  cleared: ${j.credits || 0} credits · people left ${chk.people_left} · room kept ${chk.room_kept} (${chk.evidence})`);
  if (!chk.people_left) place = { ...place, file: "place-cleared.png" };
}

// 2. each character on its own: a clean three-quarter view on a plain background
say("== characters");
rec.characters = rec.characters || {};
for (const id of PEOPLE) {
  const f = `char-${id}.png`;
  const sp = await jsonCall({ name: "v3-char-prompt-v1", effort: "low", schema: S.obj({ prompt: S.str }), prompt: `Write ONE text-to-image prompt (≤ 300 characters) for a photorealistic character reference: ${look(id)}; three-quarter view from the waist up, face clearly lit and visible, neutral expression, plain mid-grey studio background, no props beyond those named, no text. Light: ${plan.bible.light_and_grade}.` });
  const j = await jobs.image(`char-${id}`, f, sp.prompt, [], SHEET);
  const chk = await jsonCall({ name: "v3-char-check-v1", effort: "low", images: [run.path(f)], schema: S.obj({ met: S.enum(["yes", "partly", "no"]), evidence: S.str }), prompt: `Does this picture show exactly: ${look(id)}? yes/partly/no with evidence (hair, garment, the named detail).` });
  rec.characters[id] = { file: f, prompt: sp.prompt, credits: j.credits || 0, check: chk }; run.save();
  say(`  ${id}: ${j.credits || 0} credits · ${chk.met} (${chk.evidence})`);
}

// 3. composite one character at a time into the real place (two inputs each), checking after each step
say("== composite");
let frame = place.file; rec.composites = [];
for (const [k, id] of PEOPLE.entries()) {
  const out = `frame-${k + 1}-${id}.png`, pos = SCENE || "at a station";
  const sp = await jsonCall({ name: "v3-composite-prompt-v1", effort: "low", schema: S.obj({ prompt: S.str }), prompt: `Write ONE image-edit prompt (≤ 450 characters). Input image 1 is the scene so far (a real ${PLACE}: ${look(PLACE)}${k ? `, already containing ${PEOPLE.slice(0, k).map(look).join(" and ")}` : ""}). Input image 2 is a character reference: ${look(id)}. Place that exact person from image 2 into the scene of image 1, standing at a station, matching the scene's light and perspective, keeping everything already in image 1 unchanged (${k ? "including the people already placed" : "the room, windows and consoles"}). Scene note: ${pos}. Photorealistic, widescreen film frame, no text.` });
  const j = await jobs.image(`frame-${k + 1}`, out, sp.prompt, [frame, rec.characters[id].file], STILL);
  const chk = await jsonCall({ name: "v3-composite-check-v1", effort: "medium", images: [run.path(frame), run.path(rec.characters[id].file), run.path(out)], schema: S.obj({ person_present: S.enum(["yes", "no"]), looks_like_reference: S.enum(["yes", "partly", "no"]), scene_kept: S.enum(["yes", "partly", "no"]), earlier_people_kept: S.enum(["yes", "partly", "no", "n/a"]), evidence: S.str }), prompt: `Image 1 = the scene before; image 2 = the character reference; image 3 = the result. Is the character present in image 3, does it look like image 2 (hair, garment, detail), is the scene of image 1 kept (room, windows, consoles), and are people already present in image 1 still there and unchanged (n/a if none)? Evidence in a few words.` });
  rec.composites.push({ step: k + 1, id, input: frame, file: out, prompt: sp.prompt, credits: j.credits || 0, check: chk }); run.save();
  say(`  +${id}: ${j.credits || 0} credits · present ${chk.person_present}, like ref ${chk.looks_like_reference}, scene kept ${chk.scene_kept}, earlier kept ${chk.earlier_people_kept} (${chk.evidence})`);
  frame = out;
}
rec.final = frame; rec.credits = Object.values(rec.characters).reduce((n, c) => n + c.credits, 0) + rec.composites.reduce((n, c) => n + c.credits, 0); run.save();
say(`== key frame: ${run.path(frame)} · ${rec.credits} credits`);
