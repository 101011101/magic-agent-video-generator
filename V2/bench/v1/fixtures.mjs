// The benchmark's fixtures: the pictures and clips a user brings. Made once on the free tier (synthetic people, no real
// faces), derived variants by ffmpeg, then frozen; manifest.json says what each is and how it was made.
// Usage: CLEANED_CAP=70000 node V2/bench/v1/fixtures.mjs [--dry]
import { existsSync, writeFileSync, readFileSync, copyFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { Jobs } from "../../backend/lib/jobs.js";
import { duration } from "../../backend/lib/media.js";
import { captionCard } from "../../backend/lib/captions.js";
import { key } from "../../backend/lib/env.js";
const HERE = dirname(fileURLToPath(import.meta.url)), DIR = join(HERE, "fixtures"), V2 = join(HERE, "../..");
const dry = process.argv.includes("--dry");
const logFile = join(DIR, "exec.json");
const run = { name: "bench-v1-fixtures", path: (f) => join(DIR, f), log: existsSync(logFile) ? JSON.parse(readFileSync(logFile, "utf8")) : { jobs: {}, pending: {}, calls: [] }, save: () => writeFileSync(logFile, JSON.stringify(run.log, null, 2)) };
const jobs = new Jobs(run, { estimate: dry });
const ff = (args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args]);
const STILL = (aspect) => ({ model: "flux-2-klein", resolution: "640px", aspect_ratio: aspect });
const PHOTO = "Realistic smartphone photo, natural light, ordinary and unstaged, no text, no watermark.";

// what a user brings, generated
const images = [
  ["product-bottle.jpg", "1:1", "A matte black insulated water bottle standing on a plain wooden table, product photo taken at home."],
  ["product-sneaker.jpg", "16:9", "A white leather sneaker, side view, on a light grey floor, slightly cluttered background."],
  ["product-candle.jpg", "1:1", "A scented candle in a clear glass jar on a wooden shelf next to a small plant."],
  ["portrait-woman.jpg", "1:1", "Head and shoulders photo of a woman in her thirties with curly dark hair, casual sweater, outdoors in a park, looking at the camera."],
  ["portrait-man.jpg", "1:1", "Head and shoulders photo of a man in his forties with short grey hair and a T-shirt, standing in his kitchen, slightly harsh light."],
  ["two-friends.jpg", "16:9", "Two friends side by side smiling at the camera at a beach, a young man with a beard on the left and a young woman with short blonde hair on the right."],
  ["poster-astronaut.jpg", "9:16", "A retro movie-poster style picture of an astronaut in a white suit with the helmet visor up so the face is fully visible, stars behind."],
  ["kitchen-before.jpg", "16:9", "A dated small kitchen with brown wooden cabinets, beige tiles, a cluttered counter, before renovation."],
  ["kitchen-after.jpg", "16:9", "The same small kitchen layout renovated: white shaker cabinets, light oak counter, subway tiles, tidy."],
  ["car-red.jpg", "16:9", "A red compact hatchback parked on a quiet residential street on a sunny afternoon."],
  ["street-person.jpg", "16:9", "A city street with shops on a sunny morning, one pedestrian in a blue jacket walking in the background on the right."],
  ["desk-clutter.jpg", "16:9", "A home office desk with a laptop, coffee mug, tangled cables, papers and an empty takeaway cup."],
  ["lake.jpg", "16:9", "A calm mountain lake with pine trees, a few clouds, early evening."],
  ["dog.jpg", "1:1", "A golden retriever sitting on grass in a park, looking at the camera, tongue out."],
  ["family-1960s.jpg", "1:1", "A family of four standing in front of a house in the 1960s, parents and two children, formal clothes."],
  ["cafe-storefront.jpg", "16:9", "The front of a small neighbourhood café with a striped awning and tables outside."],
  ["cafe-latte.jpg", "1:1", "A latte with a leaf in the foam on a marble café table, top-down."],
  ["cafe-pastries.jpg", "9:16", "A glass counter full of croissants and pastries in a small café."],
  ["cafe-barista.jpg", "16:9", "A barista pouring milk into a cup behind an espresso machine, focused."],
  ["cafe-interior.jpg", "16:9", "Cosy café interior with wooden tables, plants and warm lights, a few customers."],
  ["mascot-fox.png", "1:1", "A friendly cartoon fox mascot in an orange hoodie, full body, flat colours, plain white background. Illustration, not a photo."],
  ["style-ref.jpg", "1:1", "A vaporwave poster: pink and teal gradient sky, a grid floor, a palm tree silhouette, sun with horizontal stripes. Illustration."],
  ["cat-surprised.jpg", "1:1", "A cat with wide eyes looking shocked at the camera on a sofa, funny."],
];
// clips: a person talking to camera (one speaker), two people talking; both 10 s with speech
const clips = [
  ["talk-one.mp4", 10, "A woman in her thirties sits at a kitchen table and talks to the camera, smartphone video, natural light. She says: \"Hi everyone, today I want to show you three easy ways to make your mornings less stressful.\""],
  ["talk-two.mp4", 10, "Two coworkers, a man and a woman, stand in an office and talk to each other, handheld video. The man says: \"Did you see the new schedule?\" The woman answers: \"Yes, we start at nine on Mondays now.\""],
];

for (const [f, asp, p] of images) if (!existsSync(join(DIR, f.replace(/\.jpg$/, ".png")))) await jobs.image(`fx-${f}`, f.replace(/\.jpg$/, ".png"), `${p} ${/Illustration/.test(p) ? "" : PHOTO}`, [], STILL(asp));
for (const [f, sec, p] of clips) if (!existsSync(join(DIR, f))) await jobs.tvideo(`fx-${f}`, f, p, [], sec, { model: "minimax-h3", resolution: "480p", audio: true });
if (dry) { console.log("estimate", jobs.estimated.reduce((a, x) => a + x.cost, 0), "credits"); process.exit(0); }

// everything as .jpg the way a phone gives it; then derived variants by code
for (const [f] of images) if (f.endsWith(".jpg") && !existsSync(join(DIR, f))) ff(["-i", join(DIR, f.replace(/\.jpg$/, ".png")), "-q:v", "3", join(DIR, f)]);
const d = (f, args) => { if (!existsSync(join(DIR, f))) ff(args); };
d("old-photo.jpg", ["-i", join(DIR, "family-1960s.jpg"), "-vf", "scale=320:-2,hue=s=0,colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131,noise=alls=28:allf=t,gblur=sigma=1.2,eq=contrast=0.8:brightness=0.06", "-q:v", "8", join(DIR, "old-photo.jpg")]);
d("blurry-dog.jpg", ["-i", join(DIR, "dog.jpg"), "-vf", "scale=240:-2,gblur=sigma=2.5", "-q:v", "9", join(DIR, "blurry-dog.jpg")]);
d("lake-small.jpg", ["-i", join(DIR, "lake.jpg"), "-vf", "scale=320:-2", "-q:v", "6", join(DIR, "lake-small.jpg")]);
// the 16:9 product photo with the subject off centre
d("sneaker-offcentre.jpg", ["-i", join(DIR, "product-sneaker.jpg"), "-vf", "pad=iw*1.6:ih:0:0:color=0xd8d8d8,scale=1024:-2", join(DIR, "sneaker-offcentre.jpg")]);
// two app screens drawn by code (a made-up fitness app), 9:16
// each row a text card from the overlay tool's renderer (this ffmpeg has no drawtext), laid on a drawn screen
const screen = (f, title, lines, color) => { if (existsSync(join(DIR, f))) return; const cards = [title, ...lines].map((t, k) => captionCard(t, join(DIR, `.card-${k}.png`), { w: 640, h: k ? 150 : 180, size: k ? 40 : 60, at: "middle" }));
  const ov = cards.map((c, k) => `[${k + 1}:v]`).map((l, k) => `${k ? `[s${k}]` : "[bg]"}${l}overlay=40:${k ? 230 + (k - 1) * 180 : 10}[s${k + 1}]`).join(";");
  ff(["-f", "lavfi", "-i", "color=c=white:s=720x1280", ...cards.flatMap((c) => ["-i", c]), "-frames:v", "1", "-filter_complex", `[0:v]drawbox=x=0:y=0:w=720:h=200:color=${color}:t=fill[bg];${ov}`, "-map", `[s${cards.length}]`, join(DIR, f)]); };
screen("app-home.png", "FitTrack", ["Today  6,240 steps", "Workout  32 min", "Sleep  7 h 10 min", "Water  5 of 8 glasses"], "0x2f80ed");
screen("app-workout.png", "Workout", ["Warm-up  5 min", "Squats  3 x 12", "Push-ups  3 x 10", "Plank  60 s"], "0x27ae60");
// clips: a silent version, and a 30 s clip from the earlier film (no faces needed)
d("talk-one-silent.mp4", ["-i", join(DIR, "talk-one.mp4"), "-an", "-c:v", "copy", join(DIR, "talk-one-silent.mp4")]);
const film = join(V2, "runs", "topgun2", "clips", "film-music.mp4"); d("jet-30s.mp4", ["-i", film, "-t", "30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-c:a", "aac", join(DIR, "jet-30s.mp4")]);
// an article for the podcast case
if (!existsSync(join(DIR, "article.txt"))) writeFileSync(join(DIR, "article.txt"), `Why cities are planting tiny forests

Across Europe and Asia, cities are turning empty lots the size of a tennis court into dense "tiny forests". The method, developed by Japanese botanist Akira Miyawaki, plants three to five native saplings per square metre in enriched soil. The trees compete for light and grow quickly; supporters say a tiny forest can become self-sustaining in about three years.

Advocates point to cooler streets, more insects and birds, and a place for schoolchildren to learn. Critics say the evidence is still thin: many projects are too young to measure, and dense planting can mean many saplings die. Urban ecologists agree on one thing: a tiny forest is not a substitute for protecting existing large trees, which store far more carbon.
`);

// transcripts of the speech clips, for subtitle accuracy (OpenAI speech to text)
async function transcribe(f) {
  const out = join(DIR, f.replace(/\.mp4$/, ".transcript.txt")); if (existsSync(out)) return;
  const wav = join(DIR, f.replace(/\.mp4$/, ".wav")); ff(["-i", join(DIR, f), "-vn", "-ac", "1", "-ar", "16000", wav]);
  const form = new FormData(); form.append("model", "gpt-4o-transcribe"); form.append("file", new Blob([readFileSync(wav)]), "a.wav");
  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { authorization: `Bearer ${key("OPENAI_API_KEY")}` }, body: form }); const j = await r.json(); writeFileSync(out, j.text || `ERROR ${JSON.stringify(j).slice(0, 200)}`);
}
for (const f of ["talk-one.mp4", "talk-two.mp4", "jet-30s.mp4"]) await transcribe(f);
copyFileSync(join(V2, "bench", "fixtures", "radio-lines.mp4"), join(DIR, "radio-lines.mp4")); await transcribe("radio-lines.mp4");

const describe = Object.fromEntries([...images.map(([f, a, p]) => [f, { what: p, aspect: a, made: "flux-2-klein 640px, free tier" }]), ...clips.map(([f, s, p]) => [f, { what: p, seconds: s, made: "minimax-h3 480p with audio, free tier" }]),
  ["old-photo.jpg", { what: "a faded, noisy, low-resolution sepia scan of a 1960s family photo", made: "ffmpeg from family-1960s.jpg" }], ["blurry-dog.jpg", { what: "a small, blurry photo of a golden retriever", made: "ffmpeg from dog.jpg" }],
  ["lake-small.jpg", { what: "a small 320 px photo of a mountain lake", made: "ffmpeg from lake.jpg" }], ["sneaker-offcentre.jpg", { what: "a wide product photo with the sneaker at the far left", made: "ffmpeg from product-sneaker.jpg" }],
  ["app-home.png", { what: "a phone screenshot of a made-up fitness app, FitTrack, home screen", made: "ffmpeg drawtext" }], ["app-workout.png", { what: "a phone screenshot of the FitTrack workout screen", made: "ffmpeg drawtext" }],
  ["talk-one-silent.mp4", { what: "talk-one.mp4 with the sound removed", made: "ffmpeg" }], ["jet-30s.mp4", { what: "30 s of a fighter-jet film with music", made: "from runs/topgun2" }],
  ["radio-lines.mp4", { what: "7 s cockpit clip with a pilot speaking radio calls", made: "from runs/topgun3" }], ["article.txt", { what: "a 180-word article about tiny urban forests", made: "written" }]]);
for (const [f, v] of Object.entries(describe)) { const t = join(DIR, f.replace(/\.mp4$/, ".transcript.txt")); if (existsSync(t)) v.transcript = readFileSync(t, "utf8").trim(); if (f.endsWith(".mp4") && existsSync(join(DIR, f))) v.seconds = Math.round(duration(join(DIR, f))); }
writeFileSync(join(DIR, "manifest.json"), JSON.stringify(describe, null, 2));
console.log(`fixtures: ${Object.keys(describe).length} · credits ${run.log.calls.reduce((a, c) => a + (c.credits || 0), 0)}`);
