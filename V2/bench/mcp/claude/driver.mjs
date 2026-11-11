// The host model's loop with Claude: the same job as converseLocal in run.mjs (function tools, each call made from here, every
// non-read-only call through the gate) with the Anthropic Messages API. The API keeps no conversation, so the driver keeps it:
// `prev` is the id of the last message of the earlier turns, and the history behind it is replayed. The history only grows
// (assistant content is appended as returned, thinking blocks included), which the API requires of a conversation with tools and thinking.
// Both sides (the hosted old server and a local build) use this client-side path, so the gate and the trace are the same for both.
import { claudeMessage } from "./client.mjs";

// What run.mjs hands over is OpenAI-shaped (a string, or [{role, content:[{type:"input_text"}, {type:"input_image"}]}]).
function contentOf(input) {
  if (typeof input === "string") return [{ type: "text", text: input }];
  const out = [];
  for (const m of input) for (const c of m.content || []) {
    if (c.type === "input_text") out.push({ type: "text", text: c.text });
    else if (c.type === "input_image") {
      const d = /^data:(image\/[a-z]+);base64,(.*)$/s.exec(c.image_url || "");
      if (d) out.push({ type: "image", source: { type: "base64", media_type: d[1], data: d[2] } });
    }
  }
  return out;
}
// The new input of a hop as plain text, for the trace.
const describe = (blocks) => blocks.map((b) => b.type === "text" ? b.text : b.type === "image" ? "[picture]"
  : b.type === "tool_result" ? `[tool_result ${b.tool_use_id}${b.is_error ? " error or refused" : ""}] ${String(b.content).slice(0, 3000)}` : `[${b.type}]`).join("\n");

export function makeDriver({ model, system, toolDefs, effort, thoughts, decide, callTool, isReadOnly, parseJson }) {
  const tools = toolDefs.map((t) => ({ name: t.name, description: t.description || "", input_schema: t.inputSchema || { type: "object", properties: {} } }));
  const history = new Map();   // message id -> the messages up to and including that reply
  return async function converse(input, prev, budget) {
    if (prev && !history.has(prev)) throw new Error(`Claude driver: no history for ${prev}`);
    const messages = prev ? [...history.get(prev)] : [];
    let sent = contentOf(input), before = prev ?? null, last = null, text = "";
    messages.push({ role: "user", content: sent });
    const calls = [], approvals = [], timeline = [];
    for (let hop = 0; hop < 30; hop++) {
      const res = await claudeMessage({ model, system, tools, messages, effort, thoughts }); last = res;
      const u = res._usage, b = budget.usage; b.responses++; b.input += u.input; b.output += u.output; b.cached += u.cached;
      budget.emit("llm", { id: res.id, previous: before, status: res.stop_reason, ms: res._ms, attempts: res._attempts, usage: { input: u.input, output: u.output, reasoning: 0, cached: u.cached, cache_write: u.cache_write }, input: describe(sent).slice(0, 20000), items: res.content.map((c) => c.type) });
      messages.push({ role: "assistant", content: res.content.length ? res.content : [{ type: "text", text: "(no reply)" }] });   // as returned: the API wants the thinking blocks back unchanged
      let said = "";
      for (const c of res.content) {
        if (c.type === "thinking" && c.thinking) { budget.emit("thought", { text: c.thinking }); timeline.push({ type: "thought", text: c.thinking }); }
        else if (c.type === "text" && c.text) { said += (said ? "\n" : "") + c.text; }
      }
      if (said) { budget.emit("said", { text: said }); timeline.push({ type: "said", text: said }); text = said; }
      if (res.stop_reason === "refusal") { budget.emit("refusal", { category: res.stop_details?.category ?? null, explanation: res.stop_details?.explanation ?? null }); break; }
      const uses = res.content.filter((c) => c.type === "tool_use");
      if (res.stop_reason !== "tool_use" || !uses.length) break;
      const results = [];
      for (const f of uses) {
        const a = f.input || {}, args = JSON.stringify(a); let d = { approve: true, reason: "", est: null }, c = null, ms = null;
        if (!isReadOnly(f.name)) { d = decide(f.name, a, budget.left()); approvals.push({ name: f.name, args: a, approve: d.approve, reason: d.reason, est: d.est ?? null }); budget.emit("gate", { name: f.name, arguments: args, approve: d.approve, reason: d.reason, est: d.est ?? null }); }
        if (d.approve) {
          budget.reserve(d.est || 0); const tc = Date.now(), r = await callTool(f.name, a); ms = Date.now() - tc;
          c = { name: f.name, arguments: args, output: r.output, error: r.error }; calls.push(c);
          budget.settle(d.est || 0, r.error || isReadOnly(f.name) ? 0 : Number(parseJson(r.output || "")?.credits_charged ?? 0));   // a read-only call (a wait) repeats the job's charge in its output: not counted again
        }
        budget.emit("call", { name: f.name, arguments: args, output: d.approve ? c.output : null, error: d.approve ? c.error : null, ...(d.approve ? {} : { refused: d.reason }), ms });
        const result = d.approve ? (c.error ? `Error: ${c.error}` : c.output || "(no output)") : `The Magic Hour account refused this call: ${d.reason}`;
        results.push({ type: "tool_result", tool_use_id: f.id, content: result, ...(!d.approve || c?.error ? { is_error: true } : {}) });
        timeline.push({ type: "call", name: f.name, arguments: args, result: (d.approve ? result : `Refused by the account: ${d.reason}`).slice(0, 30000) });
      }
      messages.push({ role: "user", content: results }); sent = results; before = res.id;
    }
    history.set(last.id, messages);
    return { id: last.id, text, calls, approvals, timeline };
  };
}
