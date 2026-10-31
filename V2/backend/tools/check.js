// check: a verdict on a picture or clip frame, by the vision model, zero Magic Hour credits. The gate as a node: does
// the output show what was asked, is the text legible, is the face the same. params: prompt_or_change (the question).
import { writeFileSync } from "node:fs";
import { jsonCall, S } from "../lib/llm.js";

export const tool = {
  id: "check", group: "inspect", custom: true, credits: 0, async: true,
  takes: ["picture"], makes: "verdict", endpoint: "tools/check.js (OpenAI vision)", kind: "none",
  needs: ["picture", "what to check"], guarantees: ["a yes or no with the reason, from looking"],
  explain: "looks at the picture and answers the question; a failing verdict is a flag, never a remake",
  async run({ inputs, params, out }) {
    const pics = inputs.filter((x) => /\.(png|jpe?g|webp)$/i.test(x.file)).map((x) => x.file); if (!pics.length) throw new Error("check needs a picture");
    const r = await jsonCall({ name: "tool-check", effort: "low", images: pics.slice(0, 4), schema: S.obj({ pass: S.bool, why: S.str, seen: S.str }), prompt: `Look at the image(s) and answer the question strictly from what is visible.\nQUESTION: ${params.prompt_or_change || params.text || "does it look right?"}\npass: true only if the answer is clearly yes; why: one line; seen: one line of what the image shows.` });
    writeFileSync(out, JSON.stringify(r, null, 2)); return { file: out, ...r };
  },
};
