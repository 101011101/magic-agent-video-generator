// Diagnose each failed item's plan: does the tool chain make sense, are the tools the best fit, do the inputs make
// sense, and what is the main cause: type understanding, tool fit, state solving, the prompt, the model or the grader.
// A reviewer model sees the request, the catalogue, every step and the picture inputs and outputs. Writes
// <id>.diag.json and diagnoses.json. Usage: node V2/bench/v1/diagnose.mjs [--run real-1] [--only A06a,G35b] [--all]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { jsonCall, S } from "../../backend/lib/llm.js";
import { catalogueText } from "../../backend/agent/catalogue.js";
const HERE = dirname(fileURLToPath(import.meta.url)), V2 = join(HERE, "..", "..");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const DIR = join(HERE, "results", arg("--run", "real-1")), ONLY = (arg("--only", "") || "").split(",").filter(Boolean);
const grades = JSON.parse(readFileSync(join(DIR, "grades.json"), "utf8")).filter((g) => (ONLY.length ? ONLY.includes(g.id) : process.argv.includes("--all") || !g.pass));
const IMG = /\.(png|jpe?g|webp)$/i;
const CAUSES = ["type-understanding", "tool-fit", "state-solving", "prompt-or-params", "model-quality", "grader", "conversation"];
// What the free plan's models are known to do, beyond the catalogue's own notes (which the planner saw).
const MODELS = `Free-plan models behind the tools: image and image-edit run flux-2-klein (640px; follows prompts well, renders short
words and logotypes fairly well); qwen-image-2.1 (also free, 10 credits) is known for strong text rendering in pictures
(headlines, signs, posters, logos). image-to-video and text-to-video run minimax-h3 at 480p (adds its own sound and speech).
Code tools (0 credits): text-overlay types plain text onto a picture or clip (exact spelling, no design: one font, a band);
place puts a small logo or sticker on a corner; assemble joins pictures and clips with a sound; crop, trim, frame, voice
(text to speech), write (a text model writes a script or copy). NOTE: the catalogue the planner saw says image and
image-edit "CANNOT give legible text"; judge whether that steered it wrong.`;
const schema = S.obj({
  steps: S.arr(S.obj({ n: S.int, tool: S.str, verdict: S.enum(["ok", "wrong-tool", "bad-inputs", "bad-params", "unneeded"]), issue: S.str })),
  missing: S.str, chain_logic: S.enum(["sound", "flawed"]), best_tools: S.enum(["yes", "no"]), inputs: S.enum(["sound", "flawed"]),
  cause: S.enum(CAUSES), also: S.arr(S.enum(CAUSES)), explanation: S.str, better_chain: S.str,
});
async function one(g) {
  const r = JSON.parse(readFileSync(join(DIR, g.id + ".json"), "utf8")), pics = [], legend = [], lines = [];
  const add = (p, what) => { if (pics.length < 10 && p && IMG.test(p) && existsSync(join(V2, p))) { pics.push(join(V2, p)); legend.push(`image ${pics.length}: ${what}`); } };
  r.turns.forEach((t, ti) => {
    lines.push(`TURN ${ti + 1} user: ${t.text}${t.materials?.length ? ` [attached: ${t.materials.join(", ")}]` : ""}`);
    for (const d of t.dialog || []) lines.push(`  agent asked: ${d.agent}\n  user: ${d.user}`);
    lines.push(`  agent: ${t.agent}`);
    for (const m of t.materials || []) add(`${r.sessionDir}/materials/${m}`, `the user's attachment ${m}`);
    const out = Object.fromEntries((t.plan?.steps || []).map((s, i) => [s.produces, t.ran?.[i]?.output]));
    (t.plan?.steps || []).forEach((s, i) => {
      const ran = t.ran?.[i] || {};
      lines.push(`  step ${i + 1}: ${s.tool} (${s.model || "-"}) inputs [${s.inputs.join(", ")}] → ${s.produces}; prompt: ${s.params?.prompt_or_change || ""}${s.params?.extra ? `; extra: ${s.params.extra}` : ""}${s.params?.aspect ? `; aspect ${s.params.aspect}` : ""}${s.params?.seconds ? `; ${s.params.seconds}s` : ""}; why: ${s.why || ""}; result: ${ran.state || "not run"}${ran.note ? ` (${ran.note})` : ""}${ran.error ? ` ERROR ${ran.error}` : ""}`);
      if (ran.output) add(`${r.sessionDir}/${ran.output}`, `output of step ${i + 1} (${s.tool} → ${s.produces})`);
    });
  });
  const j = g.judge || g.reply || {};
  const prompt = `You audit the PLAN an AI media agent made for a request, not the art. Decide for each step whether it was the right tool with the right inputs and settings, whether the chain as a whole makes sense (order, wiring, every requirement covered, nothing lost between steps), and the MAIN reason the result failed.

Causes:
- type-understanding: misread what kind of thing was wanted (a logo is a designed mark with lettering, a meme is a known format, a carousel is a set of designed slides, an ad has a hook)
- tool-fit: the idea was right but a step used the wrong tool (e.g. text-overlay stamping text where the lettering is part of the design and an image model should letter it; place used for a side-by-side)
- state-solving: the chain from what exists to what is wanted is wrong: missing or extra steps, wrong order, wrong inputs wired, a step that undoes or loses earlier work, sizes or lengths not carried through
- prompt-or-params: right tools and wiring, but the prompt or settings given to a step were poor
- model-quality: the plan is sound; the model's output fell short
- grader: the output actually meets the request; the grade is wrong
- conversation: asked wrongly, refused wrongly, or answered wrongly

${MODELS}

THE CATALOGUE THE PLANNER SAW:
${catalogueText()}

THE ITEM (${g.id}, ${g.case_name}): ${g.tests}
Must-haves: ${(r.item.must_haves || []).join(" | ")}
${lines.join("\n")}

THE GRADER SAID: score ${g.score}, tags ${(g.tags || []).join(", ")}; ${j.summary || ""}
Missed: ${(j.must_haves || []).filter((m) => m.met !== "yes").map((m) => `${m.item} (${m.why})`).join(" | ")}
Faults: ${(j.faults || []).map((f) => `${f.severity}: ${f.what}`).join(" | ")}

Pictures: ${legend.join("; ") || "none"}.
Give: steps (one per step, n from 1 across turns), missing (a step or requirement the plan lacked, or ""), chain_logic, best_tools, inputs, cause, also (other causes that contributed), explanation (two or three plain sentences: what went wrong in the plan and why), better_chain (the chain you would plan, as "tool (what it does) → tool …").`;
  const d = await jsonCall({ name: "bench-v1-diagnose", effort: "medium", images: pics, schema, prompt });
  const res = { id: g.id, ...d };
  writeFileSync(join(DIR, `${g.id}.diag.json`), JSON.stringify(res, null, 2)); return res;
}
const out = [], queue = [...grades]; let done = 0;
await Promise.all(Array.from({ length: 6 }, async () => { for (let g; (g = queue.shift()); ) { try { out.push(await one(g)); } catch (e) { console.error(g.id, String(e.message || e).slice(0, 200)); } if (++done % 10 === 0) console.log(`${done}/${grades.length}`); } }));
const prev = existsSync(join(DIR, "diagnoses.json")) ? JSON.parse(readFileSync(join(DIR, "diagnoses.json"), "utf8")) : [];
const all = [...prev.filter((p) => !out.some((o) => o.id === p.id)), ...out].sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(join(DIR, "diagnoses.json"), JSON.stringify(all, null, 2));
const count = (f) => Object.entries(all.reduce((m, d) => { for (const k of [].concat(f(d))) m[k] = (m[k] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(" · ");
console.log(`diagnosed ${all.length}\nmain cause: ${count((d) => d.cause)}\nany cause: ${count((d) => [...new Set([d.cause, ...d.also])])}\nchain flawed ${all.filter((d) => d.chain_logic === "flawed").length} · tools not best ${all.filter((d) => d.best_tools === "no").length} · inputs flawed ${all.filter((d) => d.inputs === "flawed").length}\nwrong-tool steps: ${count((d) => d.steps.filter((s) => s.verdict === "wrong-tool").map((s) => s.tool))}`);
