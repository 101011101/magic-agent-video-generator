// Facts about every file in a session, so the state says what is in what. By code (free, every file): the kind, the
// size and shape, the length, whether there is sound and whether it is silent, whether a picture is transparent and how
// much of it is kept. By one vision call per material (once, cached): who and what is in it, any words, the background,
// answered as fixed questions, never a free review. The planner reads materials as "name: facts" instead of a bare name;
// each step's output gets its code facts, and stepCheck compares them with what the step was for (no model calls).
import { existsSync, readFileSync, writeFileSync, statSync, mkdtempSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { jsonCall, S } from "../lib/llm.js";

const PIC = /\.(png|jpe?g|webp|gif)$/i, CLIP = /\.(mp4|mov|webm)$/i, SOUND = /\.(mp3|wav|m4a|aac)$/i, TEXT = /\.(txt|md|srt|vtt)$/i;
export const kindOf = (f) => (PIC.test(f) ? "picture" : CLIP.test(f) ? "clip" : SOUND.test(f) ? "sound" : TEXT.test(f) ? "text" : /\.json$/i.test(f) ? "verdict" : "other");
const RATIOS = [["1:1", 1], ["4:5", 0.8], ["5:4", 1.25], ["3:4", 0.75], ["4:3", 4 / 3], ["2:3", 2 / 3], ["3:2", 1.5], ["9:16", 9 / 16], ["16:9", 16 / 9], ["5:3", 5 / 3]];
const ratioName = (w, h) => { const r = w / h, m = RATIOS.find(([, v]) => Math.abs(r / v - 1) < 0.02); return m ? m[0] : `${(r).toFixed(2)}:1`; };
const probe = (f) => JSON.parse(execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type,width,height,pix_fmt:format=duration", "-of", "json", f]).toString());
const loud = (f) => { const r = spawnSync("ffmpeg", ["-hide_banner", "-i", f, "-vn", "-af", "volumedetect", "-f", "null", "-"]); const m = r.stderr.toString().match(/mean_volume:\s*(-?[\d.]+)/); return m ? Number(m[1]) : null; };
const gray = (f, vf) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", f, "-vf", `${vf},scale=96:96`, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "gray", "-"], { maxBuffer: 1 << 24 });
// the share of a picture's pixels that differ from its edge colour: the marks on a plain ground (a logo's crescent AND its name)
export function ink(f) { const b = gray(f, "format=rgb24,format=gray"); const edge = [...b.subarray(0, 96)].reduce((a, x) => a + x, 0) / 96; return [...b].filter((x) => Math.abs(x - edge) > 40).length / b.length; }
const kept = (f) => { const b = gray(f, "alphaextract"); return [...b].filter((x) => x > 128).length / b.length; };
export const hash = (f) => createHash("md5").update(readFileSync(f)).digest("hex");

// code facts for one file
export function facts(f) {
  if (!existsSync(f) || !statSync(f).size) return { exists: false };
  const k = kindOf(f), o = { exists: true, kind: k, bytes: statSync(f).size };
  if (k === "text") { o.words = readFileSync(f, "utf8").trim().split(/\s+/).length; return o; }
  if (k === "other" || k === "verdict") return o;
  try {
    const p = probe(f), v = p.streams.find((s) => s.codec_type === "video"), a = p.streams.find((s) => s.codec_type === "audio");
    if (v) { o.w = v.width; o.h = v.height; o.aspect = ratioName(v.width, v.height); }
    if (k !== "picture") { o.seconds = Math.round(Number(p.format.duration || 0) * 10) / 10; o.sound = !a ? "none" : (loud(f) ?? -99) < -50 ? "silent" : "present"; }
    if (k === "picture") { o.alpha = /a/.test(v?.pix_fmt || "") && /rgba|yuva|gbrap|ya|pal/.test(v.pix_fmt); if (o.alpha) o.kept = Math.round(kept(f) * 100) / 100; }
  } catch (e) { o.error = String(e.message).slice(0, 120); }
  return o;
}
export const factsText = (o) => !o?.exists ? "missing" : [o.kind, o.w && `${o.w}x${o.h} (${o.aspect})`, o.seconds != null && `${o.seconds} s`, o.sound && `sound ${o.sound}`, o.alpha && `transparent, ${Math.round(o.kept * 100)}% kept`, o.words && `${o.words} words`].filter(Boolean).join(", ");

// what is in a material: fixed questions to the vision model, once per file (a clip: its middle frame)
const SEEN = S.obj({ people: S.str, main_subject: S.str, words: S.str, background: S.str });
async function seen(f, k) {
  let pic = f; if (k === "clip") { pic = join(mkdtempSync(join(tmpdir(), "facts-")), "mid.jpg"); const d = Number(probe(f).format.duration || 0); execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-ss", String(d / 2), "-i", f, "-frames:v", "1", pic]); }
  return jsonCall({ name: "facts-seen", effort: "low", images: [pic], schema: SEEN, prompt: `Answer each question in one short line, strictly from what is visible${k === "clip" ? " (this is the middle frame of a clip)" : ""}.\npeople: how many people, and for each one where they are (left, right, centre, back) and a few words to tell them apart; "none" if none.\nmain_subject: the main thing shown.\nwords: any visible text, verbatim; "none" if none.\nbackground: the setting or ground (plain white, transparent, a street…).` });
}

// all materials of a session, cached in materials/.facts.json by content hash
export async function materialFacts(dir, names = []) {
  const cf = join(dir, "materials", ".facts.json"), cache = existsSync(cf) ? JSON.parse(readFileSync(cf, "utf8")) : {}, out = {};
  for (const n of names) { const f = join(dir, "materials", n); if (!existsSync(f)) continue; const h = hash(f);
    if (cache[n]?.hash !== h) { const o = facts(f); if (["picture", "clip"].includes(o.kind)) { try { o.seen = await seen(f, o.kind); } catch {} } cache[n] = { hash: h, ...o }; }
    out[n] = cache[n]; }
  if (names.length) writeFileSync(cf, JSON.stringify(cache, null, 2));
  return out;
}
export const materialLine = (n, o) => !o ? n : `${n} — ${factsText(o)}${o.seen ? `; people: ${o.seen.people}; shows: ${o.seen.main_subject}; words: ${o.seen.words}; background: ${o.seen.background}` : ""}`;

// a step's output against what the step was for: plain checks, no model. Returns the problems found (empty when fine).
const MAKES = { assemble: "clip", "text-overlay": null, compose: "picture", image: "picture", "image-edit": "picture", "image-to-video": "clip", "text-to-video": "clip", music: "sound", voice: "sound", "talking-photo": "clip", "lip-sync": "clip", "face-swap-photo": "picture", "face-swap-video": "clip", "background-remove": "picture", "upscale-image": "picture", captions: "clip", crop: null, trim: "clip", filter: null, compose: "picture", write: "text", check: "verdict" };
export function stepCheck(s, outFile, inFiles = []) {
  const o = facts(outFile), bad = [];
  if (!o.exists) return { facts: o, problems: ["no output file"] };
  const want = MAKES[s.tool] ?? (inFiles[0] ? kindOf(inFiles[0]) : null); if (want && o.kind !== want) bad.push(`made a ${o.kind}, the step makes a ${want}`);
  const same = inFiles.find((f) => existsSync(f) && kindOf(f) === o.kind && hash(f) === hash(outFile)); if (same) bad.push("output is identical to its input: nothing was done");
  const asp = s.params?.aspect; if (asp && o.aspect && o.kind !== "sound" && o.aspect !== asp) bad.push(`aspect ${o.aspect}, asked ${asp}`);
  const sec = Number(s.params?.seconds) || 0; if (sec && o.seconds != null && Math.abs(o.seconds - sec) > Math.max(0.7, sec * 0.15)) bad.push(`${o.seconds} s, asked ${sec} s`);
  if (/transparent/i.test(`${s.produces} ${s.params?.extra || ""}`) && o.kind === "picture") { if (!o.alpha) bad.push("not transparent"); else { const src = inFiles.find((f) => PIC.test(f)); if (src) { const i = ink(src); if (i > 0.02 && o.kept < i * 0.6) bad.push(`the cut-out kept ${Math.round(o.kept * 100)}% of the picture but its marks covered ${Math.round(i * 100)}%: parts (often the lettering) were removed`); } } }
  if (o.kind === "clip" && /\bkeep (the |their |its |both )?(original )?(sound|voices?|audio|speech)\b|sound:\s*keep/i.test(`${s.params?.prompt_or_change || ""} ${s.params?.extra || ""}`) && !/silent|no (audio|sound)|discard/i.test(`${s.params?.extra || ""}`) && o.sound !== "present") bad.push(`sound ${o.sound}, asked to keep it`);
  return { facts: o, problems: bad };
}

// the finished result against the request: the deliverables' facts against the sheet's length and size
export function goalCheck(sheet, files) {
  const f = Object.fromEntries((sheet?.fields || []).map((x) => [x.field, x.value])), bad = [];
  const len = Number(String(f.length_s || "").match(/[\d.]+/)?.[0]) || 0, size = String(f.size || f.platform || "").match(/\b(1:1|4:5|9:16|16:9|3:4|4:3|2:3|3:2)\b/)?.[1];
  const outs = files.map((x) => ({ x, o: facts(x) }));
  if (!outs.some(({ o }) => o.exists)) bad.push("nothing was made");
  for (const { x, o } of outs) { const n = x.split("/").pop();
    if (len && o.seconds != null && Math.abs(o.seconds - len) > Math.max(1, len * 0.15)) bad.push(`${n}: ${o.seconds} s, the request says ${len} s`);
    if (size && o.aspect && o.kind !== "sound" && files.length === 1 && o.aspect !== size) bad.push(`${n}: ${o.aspect}, the request says ${size}`); }
  return bad;
}
