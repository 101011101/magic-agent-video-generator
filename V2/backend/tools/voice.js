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
  needs: ["the exact words", "the voice"], guarantees: ["the exact words spoken", "a neutral synthetic voice, not an imitation of anyone", "the length in params.seconds (slowed or sped up to 0.85-1.2x, then silence after)"],
  explain: "reads the words aloud; a script with speaker names gets one voice per speaker",
  ext: () => "mp3",
  async run({ inputs, params, out }) {
    const txt = inputs.find((x) => /\.(txt|md)$/i.test(x.file)); let words = (txt ? readFileSync(txt.file, "utf8") : params.prompt_or_change || "").trim();
    if (!words) throw new Error("voice needs the words");
    const extra = (params.extra || "").toLowerCase(), first = /\b(female|woman|her)\b/.test(extra) ? "coral" : /\b(male|man|his)\b/.test(extra) ? "onyx" : "alloy";
    const pool = [first, first === "onyx" ? "coral" : "onyx", "sage", "verse"], who = {};
    // "Name: words" is a speaker only in a script: two or more lines labelled so, names of at most three words (E28a: the one
    // line "Make mornings easier: …" lost its first words as a "speaker"); a hint per speaker in extra ("A lower, B higher",
    // "Maya: warm female") picks the voice (F31b came out reversed)
    const raw = words.split(/\n+/).map((l) => l.trim()).filter(Boolean), lab = (l) => l.match(/^([A-Z][\w.'-]*(?: [\w.'-]+){0,2}):\s+(.+)/), labelled = raw.filter(lab).length >= 2;
    const hint = (name) => { const m = String(params.extra || "").match(new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b[^;,.\\n]*?\\b(lower|deeper|deep|male|man|bass|baritone|higher|brighter|high|female|woman|light)\\b`, "i")); return !m ? null : /lower|deeper|deep|male|man|bass|baritone/i.test(m[1]) ? "onyx" : "coral"; };
    // in a labelled script, an unlabelled line is a direction, not speech (F31b read "Read only the dialogue lines:" aloud)
    const lines = raw.filter((l) => !labelled || lab(l)).map((l) => { const m = labelled && lab(l); return m ? { voice: (who[m[1]] ??= hint(m[1]) || pool[Object.keys(who).length % pool.length]), text: m[2] } : { voice: first, text: l }; });
    const tmp = mkdtempSync(join(tmpdir(), "voice-")), parts = [];
    for (const [k, l] of lines.entries()) {
      const r = await fetch("https://api.openai.com/v1/audio/speech", { method: "POST", headers: { authorization: `Bearer ${key("OPENAI_API_KEY")}`, "content-type": "application/json" }, body: JSON.stringify({ model: "gpt-4o-mini-tts", voice: l.voice, input: l.text.slice(0, 4000), instructions: (params.extra || "Natural, clear, friendly.").slice(0, 300), response_format: "mp3" }) });
      if (!r.ok) throw new Error(`speech HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
      const p = join(tmp, `l${k}.mp3`); writeFileSync(p, Buffer.from(await r.arrayBuffer())); parts.push(p);
    }
    if (parts.length === 1) ff(["-i", parts[0], "-c", "copy", out]);
    else { const list = join(tmp, "list.txt"); writeFileSync(list, parts.map((p) => `file '${p}'`).join("\n")); ff(["-f", "concat", "-safe", "0", "-i", list, "-c:a", "libmp3lame", "-q:a", "3", out]); }
    // params.seconds: the speech is fitted to the length asked: a gentle tempo change (0.85-1.2x), then silence after it
    // or a cut; the model ignores "pace it to 8 seconds" (C17a came out 5 s and the talking photo took that length)
    const want = Number(params.seconds) || 0, got = duration(out); let fit = "";
    if (want && Math.abs(got - want) > 0.3) { const t = Math.min(1.2, Math.max(0.85, got / want)), tmp2 = join(tmp, "fit.mp3");
      // never cut words: speech still longer than asked after the tempo change keeps its full length (and says so)
      const fitted = got / t; ff(["-i", out, "-af", `atempo=${t.toFixed(3)},apad=whole_dur=${want}`, ...(fitted <= want + 0.2 ? ["-t", String(want)] : []), "-c:a", "libmp3lame", "-q:a", "3", tmp2]); ff(["-i", tmp2, "-c", "copy", out]); fit = ` (fitted from ${got.toFixed(1)} s, tempo ${t.toFixed(2)})`; }
    return { file: out, text: `${lines.length} line(s), ${Math.round(duration(out))} s${fit}, voices ${[...new Set(lines.map((l) => l.voice))].join(", ")}` };
  },
};
