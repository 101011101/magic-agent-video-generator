// check: a verdict on a picture or clip frame, by the vision model, zero Magic Hour credits. The gate as a node: does
// the output show what was asked, is the text legible, is the face the same. params: prompt_or_change (the question).
import { writeFileSync, mkdtempSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { duration } from "../lib/media.js";
import { jsonCall, S } from "../lib/llm.js";

export const tool = {
  id: "check", group: "inspect", custom: true, credits: 0, async: true,
  takes: ["picture or clip"], makes: "verdict", endpoint: "tools/check.js (OpenAI vision)", kind: "none",
  needs: ["picture", "one specific question"], guarantees: ["a yes or no with the reason and what is seen, from looking; as an input to a later step, the answer goes into that step's prompt"],
  explain: "looks at the picture and answers the question; a failing verdict is a flag, never a remake",
  async run({ inputs, params, out }) {
    const pics = inputs.filter((x) => /\.(png|jpe?g|webp)$/i.test(x.file)).map((x) => x.file);
    for (const c of inputs.filter((x) => /\.(mp4|mov|webm)$/i.test(x.file))) { const d = duration(c.file); for (const k of [0.2, 0.5, 0.8]) { const f = join(mkdtempSync(join(tmpdir(), "chk-")), "f.jpg"); execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-ss", String(d * k), "-i", c.file, "-frames:v", "1", f]); pics.push(f); } }
    if (!pics.length) throw new Error("check needs a picture or a clip");
    const r = await jsonCall({ name: "tool-check", effort: "low", images: pics.slice(0, 4), schema: S.obj({ pass: S.bool, why: S.str, seen: S.str }), prompt: `Look at the image(s) and answer the question strictly from what is visible.\nQUESTION: ${params.prompt_or_change || params.text || "does it look right?"}\npass: true only if the answer is clearly yes; why: one line; seen: one line of what the image shows.` });
    writeFileSync(out, JSON.stringify(r, null, 2)); return { file: out, ...r };
  },
};
