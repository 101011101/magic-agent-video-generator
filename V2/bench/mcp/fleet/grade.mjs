// Grades fleet chats (chat dirs written by chat.mjs): the same checklist grade.mjs makes for API runs, without the API key.
//   1. deterministic checks on the files made (made at all, the right kind, how many, aspect, length, sound, black frames, a file behind "delivered")
//   2. the item's must-haves, judged by a headless `claude -p` (your Claude Code login) that opens frames of the outputs and of the user's attachments
//   3. for items whose right outcome is words (a refusal, a quote, a "no speech"): the must-haves judged from the conversation alone
// Writes <chatdir>/grade.json: { checks:[{name,pass,got}], must:[{item,met,why}], faults, usable_as_is, score, summary }. A chat is skipped when grade.json exists.
// Usage: node V2/bench/mcp/fleet/grade.mjs --tag s1 [--concurrency 10] [--model sonnet] [--only chatId,chatId] [--force]
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join, dirname, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, execFileSync } from "node:child_process";
import { duration, size, hasAudio, peakDb } from "../../../backend/lib/media.js";

const HERE = dirname(fileURLToPath(import.meta.url)), V2 = join(HERE, "../../.."), FLEET = join(V2, "bench/v1/results/fleet"), ITEMS = join(V2, "bench/v1/items");
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const TAG = arg("--tag"), N = Number(arg("--concurrency", "10")), MODEL = arg("--model", "sonnet"), only = (arg("--only", "") || "").split(",").filter(Boolean), FORCE = process.argv.includes("--force");
const readJson = (f, d = null) => { try { return JSON.parse(readFileSync(f, "utf8")); } catch { return d; } };
const chats = readJson(join(FLEET, TAG, "chats.json")); if (!chats) throw new Error(`no chats.json for tag ${TAG}`);
const CLAUDE_BIN = readJson(join(FLEET, TAG, chats[0].chatId, "chat.json"))?.claude_bin || "claude";
const IMG = /\.(png|jpe?g|webp)$/i, VID = /\.(mp4|mov|webm)$/i, AUD = /\.(mp3|wav|m4a|aac)$/i;
const FREE = new Set(["get_workflow_guide", "ping", "wait_for_video_project", "wait_for_image_project", "wait_for_audio_project", "fetch_image_download", "fetch_audio_download", "fetch_video_download", "get_account_info", "list_saved_items", "get_upload_urls", "get_face_detection_results", "get_video_project", "get_image_project", "get_audio_project", "join_production_clips", "join_videos", "get_last_frame", "plan_request", "plan_video_production", "detect_faces", "upload_chatgpt_image", "upload_chatgpt_media", "voices_list"]);
const ratio = (a) => ({ "1:1": 1, "4:5": 0.8, "9:16": 9 / 16, "16:9": 16 / 9 }[a]);
const sh = (cmd, args) => { try { return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 26 }); } catch (e) { return `${e.stdout || ""}${e.stderr || ""}`; } };
const blackRuns = (f) => [...sh("ffmpeg", ["-hide_banner", "-i", f, "-vf", "blackdetect=d=0.5:pic_th=0.98", "-an", "-f", "null", "-"]).matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
function jpg(src, out, at = null) { execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...(at != null ? ["-ss", String(at)] : []), "-i", src, "-frames:v", "1", "-vf", "scale='min(1024,iw)':-2", "-q:v", "4", out]); return out; }

function buildInputs(c, dir) {
  const chat = readJson(join(dir, "chat.json")), st = readJson(join(dir, "state.json"), { transcript: [] }), it = readJson(join(ITEMS, `${chat.item}.json`));
  const ev = existsSync(join(dir, "calls.jsonl")) ? readFileSync(join(dir, "calls.jsonl"), "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : [];
  const seen = new Set(), files = [];
  for (const e of ev) if (e.type === "call" && e.approve) for (const f of e.files || []) { const p = join(dir, f); if (!seen.has(p) && existsSync(p) && statSync(p).size > 500) { seen.add(p); files.push({ path: p, tool: e.tool }); } }
  const ran = ev.some((e) => e.type === "call" && e.approve && !FREE.has(e.tool)), lastKind = [...st.transcript].reverse().find((m) => m.role === "assistant")?.kind || null;
  return { chat, st, it, ev, files, ran, lastKind };
}
function deterministic({ it, files, lastKind, chat }, dir) {
  const det = [], real = files.filter((f) => !/\.svg$/i.test(f.path)), media = { images: real.filter((f) => IMG.test(f.path)), videos: real.filter((f) => VID.test(f.path)), audio: real.filter((f) => AUD.test(f.path)) };
  const add = (name, pass, got) => det.push({ name, pass: !!pass, got: typeof got === "string" ? got : JSON.stringify(got) });
  add("something was made", real.length > 0, real.length ? `${real.length} file(s)` : "no file");
  if (!real.length) return { det, media, real };
  const kindOk = { image: media.images.length > 0, images: media.images.length > 0, video: media.videos.length > 0, audio: media.audio.length > 0 || media.videos.some((v) => hasAudio(v.path)), text: true }[it.spec.kind] ?? true;
  add(`a ${it.spec.kind} was made`, kindOk, real.map((f) => extname(f.path)));
  if (it.spec.outputs > 1) add(`${it.spec.outputs} outputs`, real.length >= it.spec.outputs, real.length);
  const visual = [...media.images, ...media.videos];
  const inRatios = (chat.messages || []).flatMap((m) => m.materials || []).filter((m) => IMG.test(m) || VID.test(m)).map((m) => join(V2, "bench/v1/fixtures", m)).filter(existsSync).map((f) => { const [w, h] = size(f); return w / h; });
  if (ratio(it.spec.aspect) && visual.length) { const bad = visual.filter((f) => { const [w, h] = size(f.path); return Math.abs(w / h / ratio(it.spec.aspect) - 1) > 0.04 && !inRatios.some((r) => Math.abs(w / h / r - 1) < 0.02); }); add(`aspect ${it.spec.aspect}`, !bad.length, visual.map((f) => size(f.path).join("x"))); }
  const timed = [...media.videos, ...media.audio];
  if (it.spec.seconds && timed.length) { const d = duration(timed[0].path); add(`about ${it.spec.seconds} s`, Math.abs(d - it.spec.seconds) <= Math.max(1.5, it.spec.seconds * 0.2), `${Math.round(d * 10) / 10} s`); }
  if (it.spec.audio === "required") { const a = [...media.videos, ...media.audio].find((f) => hasAudio(f.path)); add("sound present and audible", a && (peakDb(a.path) ?? -99) > -45, a ? `peak ${peakDb(a.path)} dB` : "no audio track"); }
  for (const v of media.videos.slice(0, 2)) {
    const d = duration(v.path), black = blackRuns(v.path).filter(([s, e]) => s < d - 1.0 && e - s >= 0.5);
    add(`no black frames (${basename(v.path)})`, !black.length, black.length ? black.map(([s, e]) => `${s}–${e} s`) : "none");
    if (it.spec.kind === "video" && it.spec.audio === "none") add("silent as asked", !hasAudio(v.path) || (peakDb(v.path) ?? -99) <= -40, hasAudio(v.path) ? `audio track, peak ${peakDb(v.path)} dB` : "no audio track");
  }
  if (lastKind === "delivered") add("a file backs what it said it delivered", real.length > 0, real.length ? `${real.length} file(s)` : "said delivered, no file");
  return { det, media, real };
}
const dialogOf = (st) => st.transcript.map((m) => (m.role === "user" ? `USER: ${m.text}` : `ASSISTANT: ${m.text}`)).join("\n");

function llmJudge({ model, prompt, schema, cwd, readDir }) {
  return new Promise((resolve) => {
    const args = ["-p", prompt, "--model", model, "--output-format", "json", "--json-schema", JSON.stringify(schema), "--system-prompt", "You are a strict, fair grader of media-agent outputs. Open every image file you are given with the Read tool before judging. Answer only with the requested JSON.",
      "--tools", "Read", "--allowedTools", `Read(${readDir}/**)`, "--permission-mode", "dontAsk", "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}', "--disable-slash-commands", "--no-session-persistence", "--effort", "medium", "--setting-sources", "project"];
    const p = spawn(CLAUDE_BIN, args, { cwd, stdio: ["ignore", "pipe", "pipe"] }); let out = "", err = ""; p.stdout.on("data", (d) => (out += d)); p.stderr.on("data", (d) => (err += d));
    const timer = setTimeout(() => p.kill("SIGKILL"), 8 * 60000);
    p.on("close", () => { clearTimeout(timer); let j = null; try { j = JSON.parse(out.trim()); } catch {} resolve({ j, err: err.slice(-300) }); });
  });
}
const MH = { type: "array", items: { type: "object", properties: { item: { type: "string" }, met: { type: "string", enum: ["yes", "no", "cannot_tell"] }, why: { type: "string" } }, required: ["item", "met", "why"], additionalProperties: false } };
const SCHEMA_OUT = { type: "object", properties: { must_haves: MH, exact_text: { type: "array", items: { type: "object", properties: { text: { type: "string" }, seen: { type: "string", enum: ["exact", "wrong", "missing"] }, read_as: { type: "string" } }, required: ["text", "seen", "read_as"], additionalProperties: false } },
  faults: { type: "array", items: { type: "object", properties: { what: { type: "string" }, severity: { type: "string", enum: ["minor", "major"] } }, required: ["what", "severity"], additionalProperties: false } }, usable_as_is: { type: "boolean" }, score: { type: "integer" }, summary: { type: "string" } }, required: ["must_haves", "exact_text", "faults", "usable_as_is", "score", "summary"], additionalProperties: false };
const SCHEMA_REPLY = { type: "object", properties: { must_haves: MH, summary: { type: "string" } }, required: ["must_haves", "summary"], additionalProperties: false };

async function gradeChat(c) {
  const dir = join(FLEET, TAG, c.chatId), inp = buildInputs(c, dir), { it, st, chat } = inp, t0 = Date.now();
  const out = { chatId: c.chatId, item: chat.item, side: chat.side, persona: chat.persona.name, mode: chat.mode, judge_model: MODEL };
  const wants = it.spec.kind !== "none" && !it.expect.refuse && !(it.spec.kind === "text" && !inp.ran);
  const { det, media, real } = deterministic(inp, dir); out.wants = wants; out.checks = wants ? det : det.filter((d) => d.name === "a file backs what it said it delivered");
  try {
    if (wants && real.length) {
      const gdir = join(dir, "grade"); mkdirSync(gdir, { recursive: true }); const pics = [], legend = [];
      const atts = [...new Set((chat.messages || []).flatMap((m) => m.materials || []))].map((m) => join(V2, "bench/v1/fixtures", m)).filter(existsSync);
      for (const a of atts.slice(0, 3)) { const o = join(gdir, `in-${pics.length + 1}.jpg`); if (IMG.test(a)) jpg(a, o); else if (VID.test(a)) jpg(a, o, Math.max(0, duration(a) / 2)); else continue; pics.push(o); legend.push(`image ${pics.length} (${o}): the user's attachment ${basename(a)}`); }
      for (const f of media.images.slice(0, 5)) { const o = join(gdir, `out-${pics.length + 1}.jpg`); jpg(f.path, o); pics.push(o); legend.push(`image ${pics.length} (${o}): OUTPUT from ${f.tool} (${basename(f.path)})`); }
      for (const v of media.videos.slice(0, 2)) { const d = duration(v.path); for (const fr of [0.1, 0.4, 0.7, 0.95]) { const o = join(gdir, `out-${pics.length + 1}.jpg`); try { jpg(v.path, o, Math.max(0, d * fr)); } catch { continue; } pics.push(o); legend.push(`image ${pics.length} (${o}): OUTPUT clip ${basename(v.path)}, frame at ${Math.round(d * fr * 10) / 10} s of ${Math.round(d * 10) / 10} s`); } }
      const sound = [...media.audio, ...media.videos.filter((v) => hasAudio(v.path))].slice(0, 2).map((f) => { const pk = peakDb(f.path); return `${basename(f.path)}: ${Math.round(duration(f.path))} s, peak ${pk} dB, ${(pk ?? -99) < -40 ? "silent (no audible sound)" : "has sound (you cannot hear it and it was not transcribed: judge only what the picture and the numbers show; say cannot_tell for anything about the spoken words or the music)"}`; });
      const prompt = `You are grading the OUTPUT of an AI media agent for one benchmark item, strictly and fairly, as a demanding client would. Look at the images; do not assume anything you cannot see or read below.

THE CONVERSATION:
${dialogOf(st)}

THE IMAGES, in order (open each file with the Read tool):
${legend.join("\n")}
${sound.length ? `\nSOUND:\n${sound.join("\n")}` : ""}

MUST-HAVES for this item (judge each; "cannot_tell" only if it truly cannot be judged from what you have, e.g. the mood of music or the words spoken):
${it.must_haves.map((m) => `- ${m}`).join("\n")}
EXACT TEXT that must appear in the output: ${it.spec.exact_text?.length ? it.spec.exact_text.map((x) => `"${x}"`).join(", ") : "none"} (report each: exact, wrong = present but misspelled or altered, missing; read_as = what you actually read)
FAULTS: list visible problems: garbled or misspelled text, extra or missing fingers or limbs, warped faces or objects, a face that changed when it should not, things the user did not ask for, edits that changed what should stay, obvious AI artefacts, a clip that does not move or morphs. major = a client would reject it for this.
usable_as_is: would the user post or use this without asking for a redo?
score: 1 unusable, 2 poor, 3 acceptable with fixes, 4 good, 5 excellent.
summary: one plain sentence on what came out and its main problem, if any.`;
      const r = await llmJudge({ model: MODEL, prompt, schema: SCHEMA_OUT, cwd: gdir, readDir: gdir });
      if (!r.j?.structured_output) throw new Error(`judge returned nothing: ${(r.j?.result || r.err || "").toString().slice(0, 200)}`);
      Object.assign(out, { must: r.j.structured_output.must_haves, exact_text: r.j.structured_output.exact_text, faults: r.j.structured_output.faults, usable_as_is: r.j.structured_output.usable_as_is, score: r.j.structured_output.score, summary: r.j.structured_output.summary, judge_usd: r.j.total_cost_usd });
    } else if (!wants || !real.length) {
      const prompt = `Grade an AI media agent's handling of this conversation against each must-have, strictly, from the transcript only.\n\n${dialogOf(st)}\n\n${inp.ev.filter((e) => e.type === "call").length ? `[tool calls made: ${inp.ev.filter((e) => e.type === "call").map((e) => `${e.tool}${e.approve ? "" : " (refused)"}`).join(", ")}${real.length ? `; files made: ${real.length}` : "; nothing was made"}]\n\n` : ""}MUST-HAVES:\n${it.must_haves.map((m) => `- ${m}`).join("\n")}\nsummary: one plain sentence.`;
      const r = await llmJudge({ model: MODEL, prompt, schema: SCHEMA_REPLY, cwd: join(FLEET, "neutral"), readDir: join(FLEET, "neutral") });
      if (!r.j?.structured_output) throw new Error(`judge returned nothing: ${(r.j?.result || r.err || "").toString().slice(0, 200)}`);
      Object.assign(out, { must: r.j.structured_output.must_haves, summary: r.j.structured_output.summary, judge_usd: r.j.total_cost_usd });
    }
  } catch (e) { out.error = String(e.message || e).slice(0, 300); }
  out.seconds = Math.round((Date.now() - t0) / 1000); writeFileSync(join(dir, "grade.json"), JSON.stringify(out, null, 1));
  const met = (out.must || []).filter((m) => m.met === "yes").length;
  console.log(`${c.chatId.padEnd(34)} ${String(out.seconds).padStart(3)} s · checks ${out.checks.filter((x) => x.pass).length}/${out.checks.length} · must-haves ${met}/${(out.must || []).length}${out.score ? ` · score ${out.score}` : ""}${out.error ? ` · ERROR ${out.error.slice(0, 120)}` : ""}`);
}
const todo = chats.filter((c) => (!only.length || only.includes(c.chatId)) && existsSync(join(FLEET, TAG, c.chatId, "host.json")) && (FORCE || !existsSync(join(FLEET, TAG, c.chatId, "grade.json"))));
console.log(`${todo.length} chats to grade (tag ${TAG}, judge ${MODEL}, ${N} at a time)`);
const queue = [...todo];
await Promise.all(Array.from({ length: N }, async () => { while (queue.length) await gradeChat(queue.shift()); }));
console.log(`GRADE-DONE ${TAG}`);
