// Replay harness: drives the supervisor from an already-recorded run, so the approve/stop handshake can be exercised with
// no credits, no network and no ffmpeg. The steps and gates are issued through the same Supervisor API the real pipelines
// use, so what is verified here is the real handshake — only the work behind each gate is replayed instead of generated.
// Usage: node current/prod/test-machine/replay.mjs --pipeline a|b [--label v3]    (interactive, open the printed URL)
//        node current/prod/test-machine/replay.mjs --selftest                     (automated: asserts approve / stop / auto)
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { REPO } from "../state-manager/src/paths.js";
import { Supervisor, StopRun } from "./supervisor.js";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const RUNS = { a: "current/tests/pipeline-state-graph/runs", b: "current/tests/pipeline-memory/runs" };

// A recorded run → the step/gate sequence the live pipeline would have issued, in order.
export function planOf(which, dir) {
  const log = JSON.parse(readFileSync(join(dir, "run.json"), "utf8")), out = [];
  if (which === "a") {
    const beats = log.timeline?.beats ?? [];
    out.push({ kind: "step", name: "timeline", about: `${log.timeline?.entities?.length ?? 0} entities, ${beats.length} beats`,
      detail: { note: beats.map((b) => `b${b.n} [${b.link}] ${b.location}`).join("\n") } });
    for (const b of beats) {
      out.push({ kind: "step", name: `beat ${b.n}`, about: `[${b.link}] ${b.location}`, detail: { note: b.start?.description ?? "" } });
      for (const a of log.beats?.[b.n]?.attempts ?? [])
        out.push({ kind: "job", name: `frame:b${b.n}:a${a.k}`, file: a.file, cost: 200, spec: { prompt: a.prompt }, inputs: a.inputs ?? [] });
      const clip = log.jobs?.[`clip:b${b.n}`] ?? log.jobs?.[`b${b.n}`];
      if (clip) out.push({ kind: "job", name: `clip:b${b.n}`, file: clip.output, cost: 96 * (b.seconds ?? 5), spec: { prompt: clip.request?.style?.prompt }, inputs: [clip.start].filter(Boolean) });
    }
    out.push({ kind: "step", name: "stitch", about: "clips → picture.mp4", detail: {} });
    out.push({ kind: "step", name: "audio mix", about: "cue sheet → mix", detail: {} });
  } else {
    const shots = log.plan?.shots ?? [];
    out.push({ kind: "step", name: "storyboard", about: `${shots.length} shots, ${log.plan?.entities?.length ?? 0} entities`,
      detail: { note: shots.map((x) => `${x.id} [${x.link}] ${x.location}: ${x.action}`).join("\n") } });
    out.push({ kind: "step", name: "anchors", about: "identity, scale and location anchors", detail: {} });
    for (const [k, j] of Object.entries(log.jobs ?? {})) if (k.startsWith("anchor:"))
      out.push({ kind: "job", name: k, file: j.output, cost: 200, spec: { prompt: j.request?.style?.prompt }, inputs: j.inputs ?? [] });
    for (const sh of shots) {
      out.push({ kind: "step", name: `shot ${sh.id}`, about: `[${sh.link}] ${sh.location} · ${sh.action}`, detail: { note: sh.start?.description ?? "" } });
      const kf = log.keyframes?.[sh.id];
      if (kf) out.push({ kind: "job", name: `frame:${sh.id}`, file: kf.file, cost: 200, spec: { prompt: kf.prompt }, inputs: kf.inputs ?? [] });
      const clip = log.jobs?.[`clip:${sh.id}`];
      if (clip) out.push({ kind: "job", name: `clip:${sh.id}`, file: clip.output, cost: 96 * (sh.seconds ?? 5), spec: { prompt: clip.request?.style?.prompt }, inputs: [clip.start].filter(Boolean) });
    }
    for (const n of ["stitch", "audio", "judge"]) out.push({ kind: "step", name: n, about: "post", detail: {} });
  }
  return out;
}

// Issues the recorded sequence through the supervisor. Returns what actually ran, so a stop is observable.
export async function drive(sup, plan) {
  const ran = [];
  try {
    for (const s of plan) {
      if (s.kind === "step") { const done = await sup.step(s.name, s.about, s.detail); ran.push(s.name); done({ text: "replayed" }); }
      else { const done = await sup.gate({ key: s.name, file: s.file, spec: s.spec, inputs: s.inputs, cost: s.cost }); ran.push(s.name); done({ files: [s.file].filter(Boolean), credits: s.cost, seconds: 0 }); }
    }
    sup.finish({ replay: true, steps: ran.length });
  } catch (e) { if (!(e instanceof StopRun)) throw e; sup.finish({ replay: true, stopped: String(e.message), steps: ran.length }); }
  return ran;
}

// ---------- self test: a fake page drives the handshake over HTTP ----------
async function selftest() {
  const results = [];
  const dir = join(REPO, RUNS.a, "p4-lighthouse-v3");
  if (!existsSync(join(dir, "run.json"))) throw new Error(`no recorded run at ${dir}`);
  const plan = planOf("a", dir);
  const check = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); results.push({ name, ok, got, want }); };

  // 1. plan derived from a real recorded run
  check("plan non-empty", plan.length > 10, true);
  check("first step is the timeline", plan[0].name, "timeline");
  check("a paid job carries a cost", plan.some((s) => s.kind === "job" && s.cost > 0), true);

  // 2. approve everything
  let sup = new Supervisor({ runDir: dir, title: "selftest approve", port: 4491 });
  await sup.start();
  const press = async (action) => { // acts as the page: poll for the pending step, then POST a decision
    for (let i = 0; i < 200; i++) {
      const st = await (await fetch("http://localhost:4491/api/state")).json();
      const p = st.steps.find((x) => x.status === "pending");
      if (p) return (await fetch("http://localhost:4491/api/decide", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: p.id, action }) })).status;
      if (st.finished) return "finished";
      await new Promise((r) => setTimeout(r, 20));
    }
    return "timeout";
  };
  const run1 = drive(sup, plan.slice(0, 4));
  for (let i = 0; i < 4; i++) await press("approve");
  const ran1 = await run1;
  check("approve runs every step", ran1.length, 4);
  check("credits counted", sup.state.credits.spent > 0, true);
  sup.close();

  // 3. stop at the second step: nothing after it runs, and its cost is never approved
  sup = new Supervisor({ runDir: dir, title: "selftest stop", port: 4492 });
  await sup.start();
  const press2 = async (action, port = 4492) => { for (let i = 0; i < 200; i++) {
      const st = await (await fetch(`http://localhost:${port}/api/state`)).json();
      const p = st.steps.find((x) => x.status === "pending");
      if (p) return (await fetch(`http://localhost:${port}/api/decide`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: p.id, action }) })).status;
      if (st.finished) return "finished";
      await new Promise((r) => setTimeout(r, 20)); } return "timeout"; };
  const run2 = drive(sup, plan.slice(0, 6));
  await press2("approve"); await press2("stop");
  const ran2 = await run2;
  // The stopped step throws before it is recorded as run, so one step ran and the second is marked stopped.
  check("stop halts the run", ran2.length, 1);
  check("the stopped step is marked stopped", sup.state.steps.filter((x) => x.status === "stopped").length, 1);
  check("nothing was issued after the stop", sup.state.steps.length, 2);
  check("stop is recorded", !!sup.state.finished.stopped, true);
  const approvedAfterStop = sup.state.steps.filter((x) => x.status === "done" && x.kind === "job").length;
  check("no paid job ran after the stop", approvedAfterStop, 0);
  sup.close();

  // 4. approve-all: one click finishes the rest
  sup = new Supervisor({ runDir: dir, title: "selftest auto", port: 4493 });
  await sup.start();
  const run3 = drive(sup, plan.slice(0, 8));
  await press2("auto", 4493);
  const ran3 = await run3;
  check("approve-all finishes the rest", ran3.length, 8);
  check("auto flag is set", sup.state.auto, true);
  sup.close();

  const bad = results.filter((r) => !r.ok);
  for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.name}${r.ok ? "" : `  got ${JSON.stringify(r.got)} want ${JSON.stringify(r.want)}`}`);
  console.log(`\n${results.length - bad.length}/${results.length} checks passed`);
  process.exit(bad.length ? 1 : 0);
}

if (args.includes("--selftest")) await selftest();
else {
  const which = (opt("--pipeline", "a") || "a").toLowerCase();
  const label = opt("--label", which === "a" ? "v3" : "v1");
  const dir = join(REPO, RUNS[which], `p4-lighthouse-${label}`);
  if (!existsSync(join(dir, "run.json"))) throw new Error(`no recorded run at ${dir}`);
  const sup = new Supervisor({ runDir: dir, title: `REPLAY ${which.toUpperCase()} · p4-lighthouse-${label} (no credits)` });
  await sup.start();
  const ran = await drive(sup, planOf(which, dir));
  console.log(`replayed ${ran.length} steps; ctrl-c to close.`);
}
