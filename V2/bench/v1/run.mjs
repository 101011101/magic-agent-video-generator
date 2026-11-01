// Bench v1 runner: every item through the agent (our pipeline only), through the running server, on the free tier.
// One fresh session per item; the item's fixtures imported; each message sent; a proxy user answers the agent's
// questions from the item's answer sheet (up to three rounds); the plan executed for real (or simulated with --simulate).
// No retries, except once for a step that produced nothing at all. A plan with the film chain is recorded, not run.
// Everything is kept for audit: the dialog, the agent's sheet, the full plan with prompts and models, each step's
// state, output, credits and error, and the time it took. Grading is separate (grade.mjs).
// Usage: node V2/bench/v1/run.mjs [--simulate] [--only A01a,B07c] [--groups A,B] [--concurrency 4] [--out dir] [--server url]
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { proxyUser } from "../../backend/agent/agent.mjs";
const HERE = dirname(fileURLToPath(import.meta.url)), V2 = join(HERE, "../..");
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const U = arg("--server", "http://localhost:4747"), SIM = process.argv.includes("--simulate"), N = Number(arg("--concurrency", "4"));
const only = (arg("--only", "") || "").split(",").filter(Boolean), groups = (arg("--groups", "") || "").split(",").filter(Boolean);
const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "").replace(/(\d{8})(\d{4})/, "$1-$2");
const OUT = arg("--out", join(HERE, "results", `${stamp}${SIM ? "-sim" : ""}`)); mkdirSync(OUT, { recursive: true });
const FILM = ["story", "assets", "screenplay", "keyframes", "clips", "film"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const api = async (p, b) => { for (let k = 0; ; k++) { try { const r = await fetch(U + p, b ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) } : undefined); return await r.json(); } catch (e) { if (k >= 3) throw e; await sleep(3000 * (k + 1)); } } };
const ledger = () => JSON.parse(readFileSync(join(V2, "runs", "ledger.json"), "utf8"));
const spentBy = (sid) => ledger().runs[`session-${sid}`] || 0;

const items = readdirSync(join(HERE, "items")).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(HERE, "items", f), "utf8")))
  .filter((it) => (!only.length || only.includes(it.id)) && (groups.length ? groups.includes(it.group) : it.group !== "I"))   // group I is the film pipeline: run one at a time, by name.sort((a, b) => a.id.localeCompare(b.id));
console.log(`${items.length} items · ${SIM ? "simulated" : "REAL, free tier"} · ${N} at a time · ${relative(V2, OUT)}`);

async function runItem(it) {
  const sid = `b1-${it.id}`, t0 = Date.now(), c0 = spentBy(sid);
  await api("/session/reset", { session: sid, mode: it.mode || "ask" });
  const all = [...new Set(it.turns.flatMap((t) => t.materials || []))];
  for (const m of all) { const r = await api("/import", { session: sid, from: `bench/v1/fixtures/${m}`, name: m }); if (r.error) throw new Error(`fixture ${m}: ${r.error}`); }
  const rec = { id: it.id, item: it, session: sid, simulated: SIM, turns: [], started: new Date(t0).toISOString() };
  for (const [k, msg] of it.turns.entries()) {
    const T = { text: msg.text, materials: msg.materials || [], dialog: [], agent: null };
    let r = await api("/turn", { session: sid, text: msg.text, materials: msg.materials || [], tier: "free", mode: it.mode || "ask" });
    if (r.error) { T.error = r.error; rec.turns.push(T); break; }
    T.agent = r.text; T.firstQuestions = (r.turn.questions || []).map((q) => ({ field: q.field, question: q.question }));
    for (let round = 0; r.turn.questions && round < 3; round++) {
      const reply = await proxyUser({ answerSheet: it.answer_sheet, questions: r.turn.questions, brief: msg.text });
      T.dialog.push({ agent: r.text, asked: r.turn.questions.map((q) => q.field), user: reply });
      r = await api("/turn", { session: sid, text: reply, materials: [], tier: "free", mode: it.mode || "ask" }); if (r.error) { T.error = r.error; break; }
      T.agent = r.text;
    }
    if (r.turn?.questions) T.stillAsking = r.turn.questions.map((q) => q.question);
    T.turnIndex = r.turnIndex; T.sheet = r.turn?.sheet || null;
    const plan = r.turn?.plan; T.plan = plan ? { shape: plan.shape, say: plan.say, refuse: plan.refuse || "", tier_move: plan.tier_move || null, estimate: plan.estimate_credits, guarantees: plan.guarantees || null, cannot: plan.cannot || null,
      steps: plan.steps.map((s) => ({ tool: s.tool, model: s.model || null, resolution: s.resolution || null, inputs: s.inputs, produces: s.produces, params: s.params, credits: s.credits, why: s.why || null })) } : null;
    if (plan && plan.steps.length && !plan.refuse) {
      if (plan.steps.some((s) => FILM.includes(s.tool))) T.notRun = "the plan uses the film chain; film is run one at a time, not in this pass";
      else {
        const c1 = spentBy(sid), s1 = Date.now();
        const go = async (indices) => { if (SIM) return api(`/session/${sid}/simulate`, { turn: r.turnIndex, ...(indices ? { indices } : {}) }); const e = await api(`/session/${sid}/execute`, { turn: r.turnIndex, ...(indices ? { indices } : {}) }); if (e.error) return e; for (let i = 0; i < 600; i++) { await sleep(3000); const run = await api("/running"); if (!run[sid]) break; } };
        await go(null);
        let S = await api(`/session/${sid}`); let steps = S.turns[r.turnIndex].plan.steps;
        // one retry, only for steps that produced nothing (failed with no output) and not for a spend-cap stop
        const empty = steps.map((s, i) => (s.state === "failed" && !s.output && !/credit cap/.test(s.error || "") ? i : -1)).filter((i) => i >= 0);
        if (empty.length && !SIM) { T.retried = empty.map((i) => ({ tool: steps[i].tool, error: steps[i].error })); await go(null); S = await api(`/session/${sid}`); steps = S.turns[r.turnIndex].plan.steps; }
        T.ran = steps.map((s) => ({ tool: s.tool, state: s.state, output: s.output || null, credits: s.credits_spent ?? null, cached: !!s.cached, simulated: !!s.simulated, note: s.note || null, error: s.error || null, seconds: s.started_at && s.ran_at ? Math.round((s.ran_at - s.started_at) / 1000) : null }));
        T.spent = spentBy(sid) - c1; T.seconds = Math.round((Date.now() - s1) / 1000);
      }
    }
    rec.turns.push(T);
  }
  rec.spent = spentBy(sid) - c0; rec.seconds = Math.round((Date.now() - t0) / 1000);
  rec.sessionDir = `sessions/${sid}`;
  writeFileSync(join(OUT, `${it.id}.json`), JSON.stringify(rec, null, 2));
  const last = rec.turns.at(-1) || {};
  console.log(`${it.id.padEnd(6)} ${String(rec.spent).padStart(4)} cr ${String(rec.seconds).padStart(4)} s · ${rec.turns.map((t) => `${t.dialog.length ? `asked×${t.dialog.length} ` : ""}${t.plan ? (t.plan.refuse ? "refused" : t.plan.steps.map((s) => s.tool).join("→")) : t.stillAsking ? "still asking" : "no plan"}${t.notRun ? " [film, not run]" : ""}${t.ran ? ` [${t.ran.map((s) => s.state).join(",")}]` : ""}`).join(" | ")}`);
  return rec;
}

const queue = [...items], done = [];
await Promise.all(Array.from({ length: N }, async () => { while (queue.length) { const it = queue.shift(); try { done.push(await runItem(it)); } catch (e) { console.log(`${it.id} ERROR ${e.message}`); writeFileSync(join(OUT, `${it.id}.json`), JSON.stringify({ id: it.id, item: it, error: String(e.message || e) }, null, 2)); } } }));
writeFileSync(join(OUT, "run.json"), JSON.stringify({ at: stamp, simulated: SIM, items: items.length, spent: done.reduce((a, r) => a + (r.spent || 0), 0) }, null, 2));
console.log(`\n${done.length}/${items.length} items · ${done.reduce((a, r) => a + (r.spent || 0), 0)} credits · ${relative(V2, OUT)}`);
