// Voices: OpenAI text-to-speech (gpt-4o-mini-tts) with neutral voices steered by an instruction, so no character imitates a real
// person. One voice per character for the whole film (cast once by an LLM, then fixed). Lines are cached on disk by their input.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { key, CACHE } from "./env.js";
import { jsonCall, S } from "./llm.js";

export const VOICES = ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse"];

// characters: [{ id, name, spec }] → { id: { voice, instructions } }
export async function castVoices(characters, story) {
  const r = await jsonCall({ name: "voice-cast", effort: "low",
    schema: S.obj({ cast: S.obj(Object.fromEntries(characters.map((c) => [c.id, S.obj({ voice: S.enum(VOICES), instructions: S.str })]))) }),
    prompt: `Cast a voice for each speaking character of this animated storybook film. voice: one of the neutral TTS voices
(${VOICES.join(", ")}); instructions: one sentence describing how this character sounds (age, tone, pace, accent if any), never an
imitation of a real person. Give different characters clearly different voices.
${characters.map((c) => `- ${c.id}: ${c.name}. ${c.spec || ""}`).join("\n")}\n\nStory:\n${story}` });
  return r.cast;
}

// One line of speech → mp3 file (cached by voice, instructions and text).
export async function speak(text, { voice, instructions }, out) {
  mkdirSync(CACHE, { recursive: true });
  const h = createHash("sha256").update(JSON.stringify({ text, voice, instructions })).digest("hex").slice(0, 24), cached = join(CACHE, `voice-${h}.mp3`);
  if (!existsSync(cached)) {
    const res = await fetch("https://api.openai.com/v1/audio/speech", { method: "POST", headers: { authorization: `Bearer ${key("OPENAI_API_KEY")}`, "content-type": "application/json" },
      body: JSON.stringify({ model: "gpt-4o-mini-tts", voice, instructions, input: text, response_format: "mp3" }) });
    if (!res.ok) throw new Error(`OpenAI speech HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
    writeFileSync(cached, Buffer.from(await res.arrayBuffer()));
  }
  writeFileSync(out, readFileSync(cached));
  return out;
}
