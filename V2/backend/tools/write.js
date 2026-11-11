// write: a text from a prompt, by the text model, zero Magic Hour credits. The LLM call as a node: post copy, a caption,
// a headline, a research note, a shot list. Takes optional text files as context (their contents are quoted into the
// prompt). params: prompt_or_change (what to write), extra (constraints: length, tone, language).
import { readFileSync, writeFileSync } from "node:fs";
import { jsonCall, S } from "../lib/llm.js";

export const tool = {
  id: "write", group: "make", custom: true, credits: 0, async: true,
  takes: ["optional text files as context"], makes: "text", endpoint: "tools/write.js (OpenAI)", kind: "none",
  needs: ["what to write"], guarantees: ["exact words on request", "a length limit", "a language"],
  explain: "the text model writes words into a file; what other nodes then overlay, speak or post",
  async run({ inputs, params, out }) {
    const ctx = inputs.filter((x) => /\.(txt|md|json)$/i.test(x.file)).map((x) => `--- ${x.name} ---\n${readFileSync(x.file, "utf8").slice(0, 4000)}`).join("\n\n");
    const r = await jsonCall({ name: "tool-write", effort: "low", schema: S.obj({ text: S.str }), prompt: `Write exactly what is asked, nothing else: no preamble, no options, no quotes around it.\nASK: ${params.prompt_or_change || params.text || ""}\n${params.extra ? `CONSTRAINTS: ${params.extra}\n` : ""}${ctx ? `CONTEXT:\n${ctx}` : ""}` });
    writeFileSync(out, r.text.trim()); return { file: out, text: r.text.trim() };
  },
};
