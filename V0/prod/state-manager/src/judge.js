// Soft credit: a cheap LLM reads a tool's `nature` field and judges whether the tool can make one condition true.
// The solver is synchronous, so it records questions; run() answers them in a batch and the solver re-runs.
import { jsonCall } from "./llm.js";
import { condText } from "./solver.js";

const SCHEMA = {
  type: "object", additionalProperties: false, required: ["can", "confidence", "reason"],
  properties: { can: { type: "boolean" }, confidence: { type: "string", enum: ["low", "medium", "high"] }, reason: { type: "string" } },
};

export function makeJudge() {
  const answers = new Map(); const asked = new Map(); const log = [];
  const k = (tool, c) => `${tool.name}|${c.atom}|${c.subject}|${c.value}|${c.from ?? ""}`;
  return {
    log,
    lookup(tool, c) { return answers.get(k(tool, c)) || null; },
    request(tool, c) { const key = k(tool, c); if (!answers.has(key)) asked.set(key, { tool, c }); },
    pending() { return asked.size; },
    async run() {
      const jobs = [...asked.entries()]; asked.clear();
      await Promise.all(jobs.map(async ([key, { tool, c }]) => {
        const prompt = `A planning system asks whether a video tool can make one condition true. Judge from the tool's nature only. Answer can = true only if the tool can plausibly do it with a suitable prompt or settings.

Tool: ${tool.name}
Nature: ${tool.nature}

Condition: ${condText(c)} (atom "${c.atom}")`;
        const ans = await jsonCall({ name: "judge", schema: SCHEMA, prompt, effort: "low" });
        answers.set(key, ans);
        log.push({ tool: tool.name, condition: condText(c), ...ans });
      }));
      return jobs.length;
    },
  };
}
