// Tier 1 and 2 execution: the guide-shaped prompt, one call, a VLM review with one retry. Reuses V2's Magic Hour client and ledger.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { jsonCall, S } from "../../V2/backend/lib/llm.js";
import { runJob } from "../../V2/backend/lib/magichour.js";
import { duration } from "../../V2/backend/lib/media.js";
const frame = (video, at, out) => { execFileSync("ffmpeg", ["-v", "error", "-y", ...(at === "last" ? ["-sseof", "-0.15"] : ["-ss", String(at)]), "-i", video, "-frames:v", "1", "-update", "1", out]); return out; };   // V2's frame() ignores a numeric timestamp
import { key as envKey } from "../../V2/backend/lib/env.js";
import { FREE } from "./catalogue.js";
import { captionCard } from "../../V2/backend/lib/captions.js";
import { MCP_GUIDE, SHAPE } from "./guides.js";

const ff = (args) => execFileSync("ffmpeg", ["-v", "error", "-y", ...args]);
const hasAudio = (f) => /audio/.test(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type", "-of", "csv=p=0", f]).toString());
const LIMIT = 2000, RETRY = process.env.V4_RETRY === "1";   // one attempt by default: a failed review is reported, not retried

// ---- prompts --------------------------------------------------------------------------------------------------------------
async function prompt(kind, brief, extra = "") {
  const r = await jsonCall({ name: `v4-prompt-${kind}-v1`, effort: "medium", schema: S.obj({ prompt: S.str }), prompt: `Write the prompt for ONE ${kind.replace(/_/g, "-")} call from the request below, the way a careful director would.\nGUIDE: ${MCP_GUIDE[kind === "edit" || kind === "reflow" ? "image" : kind] || MCP_GUIDE.video}\nSHAPE: ${SHAPE[kind]}\n${extra}\nREQUEST:\n${brief}` });
  let p = r.prompt;
  if (p.length > LIMIT) { const c = await jsonCall({ name: "v4-prompt-shorten-v1", effort: "low", schema: S.obj({ prompt: S.str }), prompt: `Rewrite under ${LIMIT - 100} characters, keeping every quoted string, every beat and the order; cut adjectives and repetition.\n\n${p}` }); p = c.prompt; }
  return p;
}

// ---- stills ---------------------------------------------------------------------------------------------------------------
export async function makeStill({ key, description, aspect = "16:9", exactWords = [], inputs = [], kind: kindIn = null, run, jobs, say = console.log, DRY = false }) {
  const kind = kindIn || (inputs.length ? "edit" : "image");
  const p = await prompt(kind, description, exactWords.length ? `The words ${exactWords.map((w) => `'${w}'`).join(", ")} must appear exactly.` : "");
  const model = exactWords.length || inputs.length ? FREE.still : FREE.still;   // qwen for words and edits; qwen by default for quality
  const file = `${key}.png`;
  const j = await jobs.image(key, file, p, inputs, { model, resolution: FREE.stillRes, aspect_ratio: aspect });
  const out = { file, prompt: p, model, credits: j.credits || 0, estimated: j.estimated ? j.credits : undefined };
  if (DRY) return out;
  out.review = await jsonCall({ name: "v4-review-still-v1", effort: "medium", images: [...inputs.map((f) => run.path(f)), run.path(file)], schema: S.obj({ matches_request: S.enum(["yes", "partly", "no"]), lettering: S.str, artefacts: S.str, pass: S.bool, fix: S.str }), prompt: `${inputs.length ? `Image 1 is the input; the last image is the edit. ` : ""}Does the last image match this request: "${description.slice(0, 600)}"? If words were required (${exactWords.join(", ") || "none"}), transcribe what it shows. List artefacts. pass = request met and any required words exact. fix = one sentence to add to the prompt if not.` });
  say(`  ${key}: ${out.credits} credits · ${out.review.pass ? "PASS" : `FAIL: ${out.review.fix}`}`);
  if (RETRY && !out.review.pass && out.review.fix) { const p2 = `${p} ${out.review.fix}`; const j2 = await jobs.image(`${key}-retry`, `${key}-retry.png`, p2, inputs, { model, resolution: FREE.stillRes, aspect_ratio: aspect }).catch((e) => ({ skipped: String(e.message) })); if (!j2.skipped) { out.retry = { file: `${key}-retry.png`, prompt: p2, credits: j2.credits || 0 }; out.review2 = await jsonCall({ name: "v4-review-still-v1", effort: "medium", images: [run.path(out.retry.file)], schema: S.obj({ matches_request: S.enum(["yes", "partly", "no"]), lettering: S.str, artefacts: S.str, pass: S.bool, fix: S.str }), prompt: `Does this image match the request: "${description.slice(0, 600)}"? Required words: ${exactWords.join(", ") || "none"}; transcribe them. pass/fix as before.` }); if (out.review2.pass) out.file = out.retry.file; } }
  return out;
}

// ---- clips ----------------------------------------------------------------------------------------------------------------
export async function makeClip({ key, brief, seconds, aspect = "16:9", sound = "none", exactWords = [], startFrame = null, refs = [], run, jobs, say = console.log, DRY = false }) {
  const kind = startFrame ? "image_to_video" : "video", audio = sound !== "none", useRefs = refs.length > 0;
  const extra = `Duration ${seconds} seconds, aspect ${aspect}, audio ${audio ? "on (" + sound + ")" : "off"}.${exactWords.length ? ` The words ${exactWords.map((w) => `'${w}'`).join(", ")} appear on a sign or card, quoted once.` : ""}${startFrame ? " The start frame is supplied." : ""}${useRefs ? ` Reference pictures are attached by name and MUST be used as @name where that thing appears, as likenesses, not shots to paste: ${refs.map((r) => `@${r.name} = ${r.seen || r.role}`).join("; ")}. Say what from each reference to keep and what from its photo to drop (a show stand, a crowd, a studio).` : ""}`;
  const p = await prompt(kind, brief, extra), file = `${key}.mp4`, model = useRefs ? FREE.videoRef : FREE.video, VIDEO = { model, resolution: FREE.vres, audio, ...(startFrame ? {} : { aspect_ratio: aspect }) };
  if (useRefs) { const miss = refs.filter((r) => !p.includes(`@${r.name}`)); if (miss.length) throw new Error(`the prompt did not use ${miss.map((r) => "@" + r.name).join(", ")}`); if (seconds > 30) throw new Error("minimax-h3 makes at most 30 s"); }
  const j = startFrame ? await jobs.video(key, file, p, startFrame, null, seconds, VIDEO) : await jobs.tvideo(key, file, p, useRefs ? refs.map((r) => ({ name: r.name, file: r.file })) : [], seconds, VIDEO);
  const out = { file, prompt: p, model, kind: useRefs ? "text_to_video_with_references" : kind, start_frame: startFrame, references: useRefs ? refs.map((r) => ({ name: r.name, file: r.file })) : undefined, credits: j.credits || 0, estimated: j.estimated ? j.credits : undefined };
  if (DRY) return out;
  if (!audio && hasAudio(run.path(file))) { const keep = file.replace(/\.mp4$/, "-with-sound-bed.mp4"); execFileSync("mv", [run.path(file), run.path(keep)]); ff(["-i", run.path(keep), "-c:v", "copy", "-an", run.path(file)]); out.sound_bed_stripped = keep; }
  const dur = duration(run.path(file)), T = [1, Math.round(dur / 2), Math.max(1, Math.floor(dur - 1))];
  out.frames = T.map((t) => { const f = `${key}-t${t}.jpg`; frame(run.path(file), t, run.path(f)); return f; });
  out.review = await jsonCall({ name: "v4-review-clip-v1", effort: "medium", images: out.frames.map((f) => run.path(f)), schema: S.obj({ matches_request: S.enum(["yes", "partly", "no"]), subject_consistent: S.enum(["yes", "no", "unclear"]), lettering: S.str, artefacts: S.str, pass: S.bool, fix: S.str }), prompt: `Three frames of a ${seconds}-second clip at ${T.join(", ")} s. Request: "${brief.slice(-700)}". Does it match; is the subject the same across frames; transcribe any lettering (required: ${exactWords.join(", ") || "none"}); artefacts. pass = request met, subject consistent, required words exact. fix = one plain sentence to fold into the prompt if not.` });
  say(`  ${key}: ${out.credits} credits · ${out.review.pass ? "PASS" : `FAIL: ${out.review.fix}`}`);
  if (exactWords.length && !out.review.pass && !exactWords.every((w) => (out.review.lettering || "").includes(w))) {   // the sign did not render exactly: the words go on as an overlay, by code
    const ov = `${key}-lettered.mp4`; await textOverlay({ input: out.file, out: ov, words: exactWords, position: "bottom", run, say }); out.overlaid = { file: ov, words: exactWords, why: `review read "${out.review.lettering}"` }; out.file = ov; }
  if (RETRY && !out.review.pass && out.review.fix) { const p2 = (p.length + out.review.fix.length + 2 <= LIMIT ? `${p} ${out.review.fix}` : p); try { const j2 = startFrame ? await jobs.video(`${key}-retry`, `${key}-retry.mp4`, p2, startFrame, null, seconds, VIDEO) : await jobs.tvideo(`${key}-retry`, `${key}-retry.mp4`, p2, [], seconds, VIDEO); out.retry = { file: `${key}-retry.mp4`, prompt: p2, credits: j2.credits || 0 }; if (!audio && hasAudio(run.path(out.retry.file))) ff(["-i", run.path(out.retry.file), "-c:v", "copy", "-an", run.path(`${key}-retry-silent.mp4`)]) && (out.retry.file = `${key}-retry-silent.mp4`); const f2 = T.map((t) => { const f = `${key}-retry-t${t}.jpg`; frame(run.path(out.retry.file), t, run.path(f)); return f; }); out.review2 = await jsonCall({ name: "v4-review-clip-v1", effort: "medium", images: f2.map((f) => run.path(f)), schema: S.obj({ matches_request: S.enum(["yes", "partly", "no"]), subject_consistent: S.enum(["yes", "no", "unclear"]), lettering: S.str, artefacts: S.str, pass: S.bool, fix: S.str }), prompt: `Three frames of the retry. Same request and checks as before: "${brief.slice(-500)}". Required words: ${exactWords.join(", ") || "none"}.` }); if (out.review2.pass) out.file = out.retry.file; } catch (e) { out.retry_skipped = String(e.message).slice(0, 160); say(`  retry skipped: ${out.retry_skipped}`); } }
  return out;
}

// ---- the Magic Hour tools with fixed bodies -------------------------------------------------------------------------------
export async function magicTool({ key, tool, inputs, run, jobs, say = console.log, DRY = false, params = {} }) {
  const spec = {
    swap_face_in_photo: { endpoint: "/v1/face-swap-photo", cost: 10, ext: "png", body: (p) => ({ assets: { target_file_path: p[0], source_file_path: p[1] } }) },
    swap_head_in_photo: { endpoint: "/v1/head-swap", cost: 10, ext: "png", body: (p) => ({ assets: { body_file_path: p[0], head_file_path: p[1] } }) },
    upscale_image: { endpoint: "/v1/ai-image-upscaler", cost: 25, ext: "png", body: (p) => ({ assets: { image_file_path: p[0] }, scale_factor: 2, style: { mode: "preserve" } }) },
    remove_image_background: { endpoint: "/v1/image-background-remover", cost: 5, ext: "png", body: (p) => ({ assets: { image_file_path: p[0] } }) },
  }[tool];
  if (!spec) throw new Error(`${tool} is not wired`);
  const file = `${key}.${spec.ext}`;
  const r = await jobs.paid(key, file, { endpoint: spec.endpoint, model: tool, prompt: "", seconds: 0 }, inputs, spec.cost, (paths, onCreate) => runJob(spec.endpoint, { name: `${run.name} ${key}`, ...spec.body(paths) }, { kind: "image", onCreate }));
  say(`  ${key}: ${tool} · ${r.credits || 0} credits`);
  return { file, tool, credits: r.credits || 0, estimated: r.estimated ? r.credits : undefined };
}

// ---- the deterministic tools ---------------------------------------------------------------------------------------------
export const spokenOnly = (t) => String(t || "").replace(/^\s*\d+\s*[–-]\s*\d+\s*(seconds?|secs?|s)\b\s*:?\s*/gim, "").replace(/\(([^)]*)\)/g, "").replace(/[“”"]/g, "").replace(/\s+/g, " ").trim();   // timestamps, directions and quotes are not spoken
export async function voiceOver({ script, out, voice = "alloy", run, say = console.log }) {
  script = spokenOnly(script);
  const r = await fetch("https://api.openai.com/v1/audio/speech", { method: "POST", headers: { authorization: `Bearer ${envKey("OPENAI_API_KEY")}`, "content-type": "application/json" }, body: JSON.stringify({ model: "tts-1", voice, input: script, response_format: "mp3" }) });
  if (!r.ok) throw new Error(`tts ${r.status}`); writeFileSync(run.path(out), Buffer.from(await r.arrayBuffer()));
  const d = duration(run.path(out)); say(`  voice-over: ${Math.round(d)} s`); return { file: out, seconds: Math.round(d * 10) / 10, voice, script, credits: 0 };
}
export async function textOverlay({ input, out, words, position = "bottom", from = null, to = null, run, say = console.log }) {
  // this ffmpeg has no drawtext: V2 renders a transparent caption card through macOS (lib/captions.js) and composites it
  const isVideo = /\.(mp4|mov)$/i.test(input), text = words.join(" · ");
  const [W, H] = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", run.path(input)]).toString().trim().split(",").map(Number);
  const card = run.path(`${out}.card.png`); captionCard(text, card, { w: W, h: H, size: Math.round(H / 16), at: position === "center" ? "middle" : position, color: "ffffff", box: true, align: "center", margin: 0.08 });
  const win = isVideo && (from != null || to != null) ? `:enable='between(t,${from ?? 0},${to ?? 9999})'` : "";
  ff(["-i", run.path(input), "-i", card, "-filter_complex", `[1]format=rgba[c];[0][c]overlay=0:0${win}`, ...(isVideo ? ["-c:a", "copy"] : ["-frames:v", "1", "-update", "1"]), run.path(out)]);
  say(`  overlay: "${text}" at ${position}${win ? ` for ${from ?? 0}–${to ?? "end"} s` : ""}`); return { file: out, words, position, from, to, credits: 0 };
}
export async function adjustImage({ input, out, adjustment, run, say = console.log }) {
  const a = String(adjustment || "").toLowerCase(), f = [];
  // strength follows the user's words: "slightly / a bit / a touch / subtle" is a nudge, "much / a lot / very" is a push, else medium
  const k = /slight|a bit|a touch|subtle|little|gentl|tad/.test(a) ? 0 : /much|a lot|very|strong|heav|really/.test(a) ? 2 : 1;
  if (/warm/.test(a)) f.push(["colortemperature=temperature=5600:mix=0.6", "colortemperature=temperature=4800", "colortemperature=temperature=4300,eq=saturation=1.06"][k]); if (/cool/.test(a)) f.push(["colortemperature=temperature=7000:mix=0.6", "colortemperature=temperature=8000", "colortemperature=temperature=9500"][k]); if (/bright/.test(a)) f.push("eq=brightness=0.06"); if (/dark/.test(a)) f.push("eq=brightness=-0.06"); if (/contrast/.test(a)) f.push("eq=contrast=1.15"); if (/black and white|b&w|mono/.test(a)) f.push("hue=s=0"); if (/saturat|vivid|pop/.test(a)) f.push("eq=saturation=1.25");
  if (!f.length) f.push("colortemperature=temperature=4800");
  ff(["-i", run.path(input), "-vf", f.join(","), run.path(out)]); say(`  adjust: ${f.join(",")} → ${out}`); return { file: out, filter: f.join(","), credits: 0 };
}
// A start frame must already have the shape the clip is asked for: image-to-video follows the picture, not an aspect field.
// crop keeps the focus point centred; pad fills with the picture's own edge colour (white stays white, no black bars).
export function fitToAspect({ input, aspect, method = "pad", focus = [0.5, 0.5], out, run, say = console.log }) {
  const [aw, ah] = aspect.split(":").map(Number); let [w, h] = ["", ""];
  try { [w, h] = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", run.path(input)]).toString().trim().split(",").map(Number); } catch { return input; }
  if (Math.abs(w / h - aw / ah) / (aw / ah) < 0.03) return input;   // already that shape
  let W, H; if (w / h > aw / ah) { H = h; W = Math.round((h * aw) / ah); } else { W = w; H = Math.round((w * ah) / aw); }   // crop box inside
  if (method === "crop") { const fx = Math.min(1, Math.max(0, focus[0])), fy = Math.min(1, Math.max(0, focus[1])); ff(["-i", run.path(input), "-vf", `crop=${W}:${H}:(iw-ow)*${fx}:(ih-oh)*${fy}`, run.path(out)]); say(`  start frame: cropped ${w}×${h} → ${W}×${H} (${aspect}) around (${fx.toFixed(2)}, ${fy.toFixed(2)})`); return out; }
  if (w / h > aw / ah) { W = w; H = Math.round((w * ah) / aw); } else { H = h; W = Math.round((h * aw) / ah); }   // pad box outside
  let color = "white"; try { const px = execFileSync("ffmpeg", ["-v", "error", "-i", run.path(input), "-vf", "crop=iw:4:0:0,scale=1:1,format=rgb24", "-f", "rawvideo", "-"]); color = `0x${[...px.slice(0, 3)].map((b) => b.toString(16).padStart(2, "0")).join("")}`; } catch {}
  ff(["-i", run.path(input), "-vf", `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=${color}`, run.path(out)]); say(`  start frame: padded ${w}×${h} → ${W}×${H} (${aspect}) in the picture's edge colour ${color}`); return out;
}
export async function resizeImage({ input, targets, run, say = console.log }) {
  const dims = { "1:1": [1080, 1080], "9:16": [1080, 1920], "16:9": [1920, 1080], "4:5": [1080, 1350] }, files = [];
  for (const t of targets) { const [W, H] = dims[t] || dims["1:1"], out = `resize-${t.replace(":", "x")}.png`; ff(["-i", run.path(input), "-vf", `scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=white`, run.path(out)]); files.push({ aspect: t, file: out }); }
  say(`  resize: ${files.map((x) => x.aspect).join(", ")}`); return { file: files[0].file, files, credits: 0 };
}
export async function researchFacts({ brief, queries = [] }) {
  return jsonCall({ name: "v4-research-v1", effort: "medium", tools: [{ type: "web_search" }], schema: S.obj({ subject: S.str, as_of: S.str, facts: S.arr(S.obj({ fact: S.str, when: S.str, source: S.str })), looks: S.arr(S.obj({ thing: S.str, look: S.str, source: S.str })), caution: S.str }), prompt: `Research for a short video. Request: ${brief}\nSuggested searches: ${queries.join(" · ") || "(choose your own)"}\nUse web search. Return 5–8 verified facts with dates and source URLs (the most recent first), the documented look of any real place, person or object involved (with a source), as_of = today's date, and a one-line caution on anything uncertain. Only what the sources say.` });
}
export async function trimVideo({ input, out, from, to, run, say = console.log }) { ff(["-ss", String(from), "-to", String(to), "-i", run.path(input), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", run.path(out)]); say(`  trim: ${from}–${to} s`); return { file: out, from, to, credits: 0 }; }
export async function joinWithExtras({ files, out, transition = "cut", music = null, words = [], run, jobs, say = console.log }) {
  let film = await joinClips({ files, out: words.length || music ? "joined-raw.mp4" : out, transition, run, say });
  if (words.length) { const o = music ? "joined-titled.mp4" : out; await textOverlay({ input: film, out: o, words, position: "bottom", from: 0, to: 4, run, say }); film = o; }   // a title is for the opening, not the whole film
  if (music) { const dur = duration(run.path(film)), secs = Math.ceil(dur), j = await jobs.music("music", "music.mp3", music, secs); ff(["-i", run.path(film), "-i", run.path("music.mp3"), "-filter_complex", "[1:a]volume=0.35,afade=t=out:st=" + Math.max(0, dur - 2).toFixed(2) + ":d=2[m]", "-map", "0:v", "-map", "[m]", "-c:v", "copy", "-c:a", "aac", "-shortest", run.path(out)]); say(`  music under (${j.credits || 0} cr) → ${out}`); film = out; }
  return film;
}
export async function joinClips({ files, out, transition = "cut", run, say = console.log }) {
  // inputs may differ in size, fps or SAR (a 854×480 ltx clip next to a 858×480 minimax clip): normalise every one first, in the filter graph
  const [W, H] = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", run.path(files[0])]).toString().trim().split(",").map(Number);
  const norm = (i) => `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24,format=yuv420p[n${i}]`;
  if (transition === "dissolve" && files.length >= 2) {
    const ins = files.flatMap((f) => ["-i", run.path(f)]), durs = files.map((f) => duration(run.path(f))); let fc = files.map((_, i) => norm(i)).join(";") + ";", prev = "[n0]", off = 0;
    for (let i = 1; i < files.length; i++) { off += durs[i - 1] - 0.7; const o = i === files.length - 1 ? "[v]" : `[x${i}]`; fc += `${prev}[n${i}]xfade=transition=fade:duration=0.7:offset=${off.toFixed(2)}${o};`; prev = o; }
    ff([...ins, "-filter_complex", fc.replace(/;$/, ""), "-map", "[v]", "-an", run.path(out)]); say(`  join: ${files.length} clips with dissolves → ${out}`); return out;
  }
  { const ins = files.flatMap((f) => ["-i", run.path(f)]); const fc = files.map((_, i) => norm(i)).join(";") + ";" + files.map((_, i) => `[n${i}]`).join("") + `concat=n=${files.length}:v=1:a=0[v]`; ff([...ins, "-filter_complex", fc, "-map", "[v]", "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", run.path(out)]); say(`  join: ${files.length} clips → ${out}`); return out; }
  if (false) { const ins = files.flatMap((f) => ["-i", run.path(f)]), durs = files.map((f) => duration(run.path(f))); let fc = "", prev = "[0:v]", off = 0; for (let i = 1; i < files.length; i++) { off += durs[i - 1] - 0.7; const o = i === files.length - 1 ? "[v]" : `[x${i}]`; fc += `${prev}[${i}:v]xfade=transition=fade:duration=0.7:offset=${off.toFixed(2)}${i === files.length - 1 ? ",format=yuv420p" : ""}${o};`; prev = o; } ff([...ins, "-filter_complex", fc.replace(/;$/, ""), "-map", "[v]", "-an", run.path(out)]); }
  else { const list = run.path(`${out}.txt`); writeFileSync(list, files.map((f) => `file '${run.path(f)}'`).join("\n")); ff(["-f", "concat", "-safe", "0", "-i", list, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-movflags", "+faststart", run.path(out)]); }
  say(`  join: ${files.length} clips → ${out}`); return out;
}
export async function mixVoice({ video, voice, out, run, say = console.log }) {
  const hasA = hasAudio(run.path(video));
  ff(["-i", run.path(video), "-i", run.path(voice), "-filter_complex", hasA ? "[0:a]volume=0.25[a0];[a0][1:a]amix=inputs=2:duration=first:dropout_transition=2[a]" : "[1:a]apad[a]", "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-shortest", run.path(out)]);
  say(`  voice mixed → ${out}`); return out;
}
