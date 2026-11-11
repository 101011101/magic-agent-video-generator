// Continuation mechanisms, head to head, same seed, same informed story: (A) last frame as start frame on ltx-2.5; (B) the seed VIDEO as a
// named reference (@previous) on minimax-h3 with the last moment in words. Seeds: the barber clip, the zoo lions clip, the classroom caretaker.
// Usage: CLEANED_CAP=… node V4/tests/continuation-test.mjs [--only barber,lions,caretaker] [--dry]  → V4/runs/cont-<seed>-{frame,video}/
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { Jobs } from "../../V2/backend/lib/jobs.js";
import { duration } from "../../V2/backend/lib/media.js";
import { makeClip } from "../agent/make.js";
import { V4 } from "../agent/run.mjs";
const args = process.argv.slice(2), DRY = args.includes("--dry"), only = args.includes("--only") ? args[args.indexOf("--only") + 1].split(",") : null;
const story = JSON.parse(readFileSync(join(V4, "tests/barber-story.json"), "utf8"));
const SEEDS = {
  barber: { file: join(V4, "runs/full-B01/clip.mp4"), setting: story.setting, next: story.clip2 },
  lions: { file: join(V4, "runs/full-V03/clip-1.mp4"), setting: "Dawn Meadow at Ridgeview Zoo: sandstone ledges, long grass, low sunrise light. Leo, a tawny lion with a dark mane and amber eyes.", next: "Leo rises to his feet on the ledge, shakes out his mane, and walks slowly left along the ledge toward a second lion resting in the grass; they touch heads briefly; end on both of them lying down in the sun." },
  caretaker: { file: join(V4, "runs/v3-classroom-wipe/clip-2.mp4").replace("/V4/", "/V3/"), setting: "The classroom in the photo: rows of wooden desks, big windows with trees, green board. A caretaker in a dark work shirt with a green cloth.", next: "The caretaker finishes the last desk in the front row, straightens, walks to the green board and wipes it clean from left to right with the same cloth, then turns off the lights by the door; end on the dim empty room." },
};
for (const [name, s] of Object.entries(SEEDS)) {
  if (only && !only.includes(name)) continue; if (!existsSync(s.file)) { console.log(`${name}: seed missing ${s.file}`); continue; }
  const dur = duration(s.file), secs = 10;
  for (const mech of ["frame", "video"]) {
    const dir = join(V4, "runs", `cont-${name}-${mech}`); mkdirSync(dir, { recursive: true });
    const recFile = join(dir, "run.json"), old = existsSync(recFile) ? JSON.parse(readFileSync(recFile, "utf8")) : {};
    const rec = { label: `cont-${name}-${mech}`, seed: s.file, mechanism: mech, at: new Date().toISOString(), jobs: old.jobs || {}, calls: old.calls || [], pending: old.pending || {} };
    const run = { name: `v4-cont-${name}-${mech}`, path: (f) => join(dir, f), log: rec, save: () => writeFileSync(recFile, JSON.stringify(rec, null, 2)) }, jobs = new Jobs(run, { estimate: DRY });
    copyFileSync(s.file, run.path("seed.mp4")); execFileSync("ffmpeg", ["-v", "error", "-y", "-sseof", "-0.15", "-i", s.file, "-frames:v", "1", "-update", "1", run.path("seed-last.jpg")]);
    const brief = `This clip continues directly from the end of the previous clip. SETTING: ${s.setting}\nWHAT HAPPENS NEXT (${secs} seconds): ${s.next}\nKeep the same place, light, camera style and people; no new characters unless named.`;
    const out = mech === "frame"
      ? await makeClip({ key: "cont", brief, seconds: secs, aspect: "16:9", sound: "none", startFrame: "seed-last.jpg", run, jobs, say: console.log, DRY })
      : await makeClip({ key: "cont", brief: `${brief}\nThe previous clip is attached as @previous (${Math.round(dur)} s): continue from its final moment, do not replay it.`, seconds: secs, aspect: "16:9", sound: "none", refs: [{ name: "previous", file: "seed.mp4", seen: "the previous clip, in full", role: "other" }], run, jobs, say: console.log, DRY });
    rec.result = out; rec.credits = jobs.spent(); rec.finished = new Date().toISOString(); run.save();
    console.log(`${name} · ${mech}: ${DRY ? `estimate ${out.estimated ?? ""}` : `${out.credits} credits · review ${out.review?.pass ? "PASS" : "FAIL"} · ${out.review?.fix || ""}`}`);
  }
}
