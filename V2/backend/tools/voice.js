// voice: speech from text with a neutral synthetic voice (OpenAI text-to-speech; Magic Hour's voice generator offers
// only celebrity and character imitations). Zero Magic Hour credits; a few cents. The words come from a .txt input (a
// "write" node's script) or params.prompt_or_change, verbatim. Lines "Name: words" are read by alternating voices, so
// a two-host script sounds like two people. extra "voice: female|male|warm|calm|..." and "tone: ...".
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { key } from "../lib/env.js";
import { duration } from "../lib/media.js";
import { ff } from "./video-util.js";
export const tool = {
  id: "voice", group: "make", custom: true, credits: 0,
  takes: ["text (or a written script)"], makes: "sound", endpoint: "tools/voice.js (OpenAI text-to-speech; not Magic Hour)", kind: "none",
  needs: ["the exact words", "the voice"], guarantees: ["the exact words spoken", "a neutral synthetic voice, not an imitation of anyone"],
  explain: "reads the words aloud; a script with speaker names gets one voice per speaker",
  ext: () => "mp3",
  async run({ inputs, params, out }) {
    const txt = inputs.find((x) => /\.(txt|md)$/i.test(x.file)); let words = (txt ? readFileSync(txt.file, "utf8") : params.prompt_or_change || "").trim();
    if (!words) throw new Error("voice needs the words");
    const extra = (params.extra || "").toLowerCase(), first = /female|woman|her\b/.test(extra) ? "coral" : /male|man|his\b/.test(extra) ? "onyx" : "alloy";
    const pool = [first, first === "onyx" ? "coral" : "onyx", "sage", "verse"], who = {};
    const lines = words.split(/\n+/).map((l) => l.trim()).filter(Boolean).map((l) => { const m = l.match(/^([A-Z][\w .'-]{0,24}):\s+(.+)/); return m ? { voice: (who[m[1]] ??= pool[Object.keys(who).length % pool.length]), text: m[2] } : { voice: first, text: l }; });
    const tmp = mkdtempSync(join(tmpdir(), "voice-")), parts = [];
    for (const [k, l] of lines.entries()) {
      const r = await fetch("https://api.openai.com/v1/audio/speech", { method: "POST", headers: { authorization: `Bearer ${key("OPENAI_API_KEY")}`, "content-type": "application/json" }, body: JSON.stringify({ model: "gpt-4o-mini-tts", voice: l.voice, input: l.text.slice(0, 4000), instructions: (params.extra || "Natural, clear, friendly.").slice(0, 300), response_format: "mp3" }) });
      if (!r.ok) throw new Error(`speech HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
      const p = join(tmp, `l${k}.mp3`); writeFileSync(p, Buffer.from(await r.arrayBuffer())); parts.push(p);
    }
    if (parts.length === 1) ff(["-i", parts[0], "-c", "copy", out]);
    else { const list = join(tmp, "list.txt"); writeFileSync(list, parts.map((p) => `file '${p}'`).join("\n")); ff(["-f", "concat", "-safe", "0", "-i", list, "-c:a", "libmp3lame", "-q:a", "3", out]); }
    return { file: out, text: `${lines.length} line(s), ${Math.round(duration(out))} s, voices ${[...new Set(lines.map((l) => l.voice))].join(", ")}` };
  },
};
