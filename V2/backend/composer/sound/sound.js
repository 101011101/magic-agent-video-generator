// SOUND. Built: the voices (a descriptor per character from the cast stage, performed by the video model inside each clip),
// NARRATION (the screenplay's vo lines spoken by one fixed TTS voice, mixed under the stitched film at their film seconds,
// so the narrator is the same voice in every shot), the subtitles (made by code from the lines) and the captions (overlay
// cards). Design only, see the tickets: the voice bank (one fixed sample per character), voice conversion or TTS plus lip
// sync for the dialogue, room tone per scene, a music bed, loudness normalisation, the voice gate.
import { existsSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { key } from "../../lib/env.js";
import { hasAudio } from "../../lib/media.js";
import { subtitlesFromScript, captionCard, burnCaptions } from "../../lib/captions.js";
export { subtitlesFromScript, captionCard, burnCaptions };

export const voiceOf = (voices, id) => voices?.[id] || "a natural voice of the period";

// One TTS call per narration line (OpenAI gpt-4o-mini-tts, one voice for the whole film), cached by file.
export async function narrationTrack({ script, run, bank = {}, voice = bank.narrator?.voice?.preset || "onyx", instructions = bank.narrator?.voice?.instructions || "A calm documentary narrator: measured, clear, unhurried, no theatrics." }) {
  const items = script.scenes.flatMap((sc) => sc.shots.flatMap((h) => (h.vo || []).map((v) => ({ at: v.at, text: v.text }))));
  for (const it of items) {
    it.file = `sound/vo-${createHash("sha256").update(JSON.stringify([it.text, voice, instructions])).digest("hex").slice(0, 12)}.mp3`;   // by content, never by position
    if (existsSync(run.path(it.file))) continue;
    const res = await fetch("https://api.openai.com/v1/audio/speech", { method: "POST", headers: { authorization: `Bearer ${key("OPENAI_API_KEY")}`, "content-type": "application/json" }, body: JSON.stringify({ model: "gpt-4o-mini-tts", voice, input: it.text, instructions, response_format: "mp3" }) });
    if (!res.ok) throw new Error(`TTS HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    writeFileSync(run.path(it.file), Buffer.from(await res.arrayBuffer()));
  }
  return items;
}
// The narration under the film: each line delayed to its film second, the film's own sound lowered beneath it.
export function mixNarration(film, items, out) {
  if (!items.length) return film;
  const silent = !hasAudio(film), inputs = [...(silent ? ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"] : []), ...items.flatMap((it) => ["-i", it.file])], base = silent ? 1 : 0;
  const chain = `[${base}:a]volume=0.55[a0];${items.map((it, i) => `[${base + i + 1}:a]adelay=${Math.round(it.at * 1000)}|${Math.round(it.at * 1000)},volume=1.0[n${i}]`).join(";")};[a0]${items.map((_, i) => `[n${i}]`).join("")}amix=inputs=${items.length + 1}:duration=first:normalize=0[a]`;
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", film, ...inputs, "-filter_complex", chain, "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", out]);
  return out;
}
// The music bed: ONE instrumental track for the whole film from the screenplay's film-level cue, generated once
// (15–300 s, 1 credit per second), cached by the job record like every paid call. Returns the job result ({ file } or
// { estimated, credits } in a dry run).
export async function musicBed({ script, run, jobs, seconds }) {
  const secs = Math.max(15, Math.min(300, Math.round(seconds)));
  return jobs.music("music-bed", "sound/music-bed.mp3", `${String(script.music?.cue || "").trim().replace(/[.;,\s]+$/, "")}. Instrumental only, no vocals, ${secs} seconds, a continuous piece with a clear start.`, secs);
}
// The bed under the film: at `level` beneath everything, dipped to `duck` while a line is spoken (0.3 s either side),
// and cut to silence from the first arc moment that says cut, stop, silence or out. The film's own sound is untouched.
export function mixMusic(film, bed, { lines = [], arc = [], total, level = 0.3, duck = 0.12 } = {}, out) {
  const cut = (arc || []).find((m) => /\b(all music|the music|music)\b[^.]*\b(cuts?|stops?|ends?|drops? out|out)\b|\bto silence\b|\bsilence\b|\bsilent\b/i.test(String(m.text || "")) && !/\b(guitar|drums?|bass|strings|piano|synth|melody|riff)\b[^.]*\b(cuts?|drops?|stops?)\b/i.test(String(m.text || "").replace(/\b(all|the) music\b.*$/i, "")));   // a partial change (one instrument out) is not a cut
  const windows = lines.map((l) => `between(t,${Math.max(0, l.from - 0.3).toFixed(2)},${(l.to + 0.3).toFixed(2)})`);
  const expr = `${cut ? `if(gte(t,${cut.at}),0,` : ""}if(${windows.length ? windows.join("+") : "0"},${duck},${level})${cut ? ")" : ""}`;
  const silent = !hasAudio(film), inputs = [...(silent ? ["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo"] : []), "-i", bed], base = silent ? 1 : 0, bedIdx = silent ? 2 : 1;
  const chain = `[${bedIdx}:a]atrim=0:${total},aresample=48000,volume='${expr}':eval=frame[m];[${base}:a]aresample=48000[f];[f][m]amix=inputs=2:duration=first:normalize=0[a]`;
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", film, ...inputs, "-filter_complex", chain, "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-shortest", out]);
  return out;
}
