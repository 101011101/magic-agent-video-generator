// Re-extract real frames (the earlier ones were all frame 0) and re-run the clip reviews on every full run. LLM only, no credits.
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { jsonCall, S } from "../../V2/backend/lib/llm.js";
import { duration } from "../../V2/backend/lib/media.js";
import { V4 } from "../agent/run.mjs";
const RUNS = join(V4, "runs");
const grab = (v, t, out) => { execFileSync("ffmpeg", ["-v", "error", "-y", ...(t === "last" ? ["-sseof", "-0.15"] : ["-ss", String(t)]), "-i", v, "-frames:v", "1", "-update", "1", out]); return out; };
const REVIEW = S.obj({ matches_request: S.enum(["yes", "partly", "no"]), subject_consistent: S.enum(["yes", "no", "unclear"]), motion_seen: S.enum(["yes", "slight", "none"]), lettering: S.str, artefacts: S.str, pass: S.bool, fix: S.str });
async function review(dir, clip, brief, seconds, words = []) {
  const file = join(dir, clip.file); if (!existsSync(file)) return;
  const dur = duration(file), T = [0.5, Math.round(dur / 2), Math.max(1, Math.floor(dur - 0.5))], base = clip.file.replace(/\.mp4$/, "");
  clip.frames = T.map((t) => { const f = `${base}-t${t}.jpg`; grab(file, t, join(dir, f)); return f; });
  clip.review_old = clip.review;
  clip.review = await jsonCall({ name: "v4-review-clip-v2", effort: "medium", images: clip.frames.map((f) => join(dir, f)), schema: REVIEW, prompt: `Three frames of a ${Math.round(dur)}-second clip at ${T.join(", ")} s. Request: "${String(brief).slice(-700)}". Does it match; is the subject the same across the frames; is motion visible between the frames (yes/slight/none); transcribe any lettering (required: ${words.join(", ") || "none"}); artefacts. pass = request met, subject consistent, required words exact. fix = one plain sentence if not.` });
  return clip.review;
}
for (const d of readdirSync(RUNS).filter((x) => x.startsWith("full-") && existsSync(join(RUNS, x, "run.json")))) {
  const dir = join(RUNS, d), r = JSON.parse(readFileSync(join(dir, "run.json"), "utf8")), res = r.result; if (!res) continue;
  const words = (() => { try { return JSON.parse(r.turns.at(-1).intent.params.find((p) => p.name === "exact_words")?.value || "[]"); } catch { return []; } })();
  if (res.file && /\.mp4$/.test(res.file) && res.prompt) { const v = await review(dir, res, r.brief, 0, words); if (v) console.log(`${d}: ${v.pass ? "PASS" : "FAIL"} · motion ${v.motion_seen} · ${v.fix || ""}`); }
  for (const c of res.clips || []) if (c?.file) { const sc = r.story?.clips?.find((x) => x.n === c.n); const v = await review(dir, c, sc?.paragraph || r.brief, c.seconds, sc?.exact_words || []); if (v) console.log(`${d} clip ${c.n}: ${v.pass ? "PASS" : "FAIL"} · motion ${v.motion_seen} · ${v.fix || ""}`); }
  writeFileSync(join(dir, "run.json"), JSON.stringify(r, null, 2));
}
