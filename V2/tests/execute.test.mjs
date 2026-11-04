// The executor and the paid-call gate on their failure paths, with no network and no credits: a code tool that throws,
// a step whose input is missing, a tool with no wired endpoint, a paid step the cap refuses, a reservation released
// after the call fails, a signature-cache hit, estimate mode. Each "ok" line is a rule; each "note" line is what the
// executor did where the rule is still open (T-051: outcomes). Run: node V2/tests/execute.test.mjs
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

let fails = 0; const ok = (c, m) => { console.log(`${c ? "ok  " : "FAIL"} ${m}`); if (!c) fails++; };
const note = (m) => console.log(`note ${m}`);

// The cap is read once when jobs.js loads: set it from the real ledger so that a 1-credit call fits and a 5-credit one
// does not, whatever has been spent before. Nothing here reaches Magic Hour: every paid path stops at the cap or before.
const { RUNS } = await import("../backend/lib/env.js");
const LEDGER = join(RUNS, "ledger.json");
const ledgerNow = () => (existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, "utf8")) : { total: 0, runs: {}, inflight: {} });
const L0 = ledgerNow(); const others = Object.values(L0.runs).reduce((a, b) => a + b, 0) + Object.values(L0.inflight || {}).reduce((a, b) => a + b, 0);
process.env.CLEANED_CAP = String(others + 3);
const { Jobs, CAP } = await import("../backend/lib/jobs.js");
const { execute } = await import("../backend/agent/execute.js");
ok(CAP === others + 3, `cap set to the ledger's ${others} plus 3 headroom`);

// A session folder with one real picture.
const dir = mkdtempSync(join(tmpdir(), "exec-test-")); mkdirSync(join(dir, "materials"), { recursive: true });
execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "color=c=0x3366aa:s=640x360", "-frames:v", "1", join(dir, "materials", "photo.png")]);
ok(existsSync(join(dir, "materials", "photo.png")), "fixture: a 640x360 picture in materials/");

const step = (tool, inputs, produces, params = {}, group = "change-form") => ({ group, tool, inputs, produces, params: { seconds: 0, aspect: "", resolution: "", prompt_or_change: "", extra: "", ...params }, why: "test", state: "proposed" });
const run = async (steps, id) => { const said = [], trail = {}; const plan = { shape: "tree", steps, turn: 0, estimate_credits: 0 }; await execute(plan, dir, { id, say: (m) => said.push(m), onStep: (i, st) => (trail[i] ??= []).push(st.state) }); return { plan, said, trail }; };

// 1. A code tool that throws: the step fails with the reason, the run does not crash, and what ran before keeps its output.
//    Then: what happens to a step that does not depend on the failed one?
{
  const { plan, said, trail } = await run([
    step("crop", ["photo.png"], "square.png", { aspect: "1:1" }),
    step("check", ["nothing.png"], "verdict.json", { prompt_or_change: "is there a jet?" }, "inspect"),
    step("crop", ["photo.png"], "tall.png", { aspect: "9:16" }),
  ], "t1");
  const [a, b, c] = plan.steps;
  ok(a.state === "done" && existsSync(join(dir, a.output)), `a code tool before the failure finishes and its file exists (${a.output})`);
  ok(b.state === "failed" && /needs a picture/.test(b.error), `a code tool that throws is "failed" with the tool's own words (${b.error})`);
  ok(said.some((m) => /check failed/.test(m)), "the failure is said to the user");
  ok(c.state !== "done", `an independent step after a failure is not run (state "${c.state}")`);
  note(`independent step after a failure: state "${c.state}", trail ${JSON.stringify(trail[2] || [])} — the loop breaks on the first failure, so it is neither run nor marked; T-051 would call it "refused"`);
  ok(a.facts && a.facts.kind === "picture", "a finished step carries its measured facts (facts.js)");
}

// 2. A step whose input the failed step was to make: it is marked waiting first, and after the failure it stays there.
{
  const { plan, trail } = await run([
    step("check", ["nothing.png"], "verdict.json", { prompt_or_change: "anything" }, "inspect"),
    step("crop", ["verdict.json", "photo.png"], "after.png", { aspect: "1:1" }),
  ], "t2");
  ok(trail[1]?.[0] === "waiting", `a step whose input is not made yet is shown "waiting" (${JSON.stringify(trail[1])})`);
  ok(plan.steps[1].state !== "done", `it never runs when its input's step failed (state "${plan.steps[1].state}")`);
  note(`dependent of a failed step ends as "${plan.steps[1].state}" with no reason on it; T-051 would mark it refused: input never made`);
}

// 3. A tool the executor has no endpoint for: a placeholder, marked simulated.
{
  const { plan } = await run([step("colorize", ["photo.png"], "colour.png", {}, "change-form")], "t3");
  const s = plan.steps[0];
  ok(s.state === "done" && s.simulated === true && /\.svg$/.test(s.output) && existsSync(join(dir, s.output)), `an unwired tool writes a placeholder SVG and says simulated (${s.note})`);
  note(`the unwired step's state is "done" like a real one; only the flag "simulated" tells them apart (T-051: a "simulated" outcome)`);
}

// 4. A paid step whose input file does not exist: refused before any call, with the file named.
{
  const { plan } = await run([step("image-edit", ["gone.png"], "edited.png", { prompt_or_change: "make it warmer" }, "change-content")], "t4");
  const s = plan.steps[0];
  ok(s.state === "failed" && /missing input gone\.png/.test(s.error), `a missing input stops the step before the call and names the file (${s.error})`);
  note(`a missing input and a tool error are both "failed"; nothing was spent here, which the word does not say`);
}

// 5. A paid step the cap refuses: no call is made, the step says so with the figures.
{
  const { plan, said } = await run([step("image-to-video", ["photo.png"], "moving.mp4", { seconds: 5, prompt_or_change: "slow push in" }, "animate")], "t5");
  const s = plan.steps[0];
  ok(s.state === "failed" && /credit cap/.test(s.error), `the cap refuses a 120-credit clip under 3 credits of headroom (${s.error.slice(0, 90)}…)`);
  ok(said.some((m) => /credit cap/.test(m)), "the refusal reaches the user's messages");
  ok(!existsSync(join(dir, "exec.json")) || !Object.keys(JSON.parse(readFileSync(join(dir, "exec.json"), "utf8")).pending || {}).length, "no job is left pending: nothing was posted");
  note(`the cap's refusal is also "failed"; T-051 would say "refused: cap" and keep "failed" for a job that ran and broke`);
}

// 6. A text the planner put in `inputs` is moved into the prompt and noted, before the call is attempted.
{
  const { plan } = await run([step("image", ["Open Daily"], "sign.png", { prompt_or_change: "a shop sign", aspect: "1:1" }, "make")], "t6");
  const s = plan.steps[0];
  ok(!s.inputs.includes("Open Daily") && /Open Daily/.test(s.params.prompt_or_change) && /text moved into the prompt/.test(s.note || ""), "a bare text in inputs becomes part of the prompt, and the node says so");
  ok(s.state === "failed" && /credit cap/.test(s.error), "…and the 5-credit call is then refused by the cap (no network)");
}

// 7. The paid gate on its own: a fake run folder, no executor.
const fakeRun = (name) => { const d = mkdtempSync(join(tmpdir(), "jobs-test-")); const log = { jobs: {}, pending: {}, calls: [] }; return { name, path: (f) => join(d, f), log, save: () => {}, dir: d }; };
{
  // 7a. The cap refuses a 1000-credit call: nothing reserved, nothing recorded, the call never invoked.
  const r = fakeRun("test-cap"); const jobs = new Jobs(r); let called = 0;
  let err = null; try { await jobs.paid("k", "out.png", { endpoint: "/v1/x", prompt: "p" }, [], 1000, async () => { called++; return { id: "j", credits: 1000, url: "http://x" }; }); } catch (e) { err = e; }
  ok(err && /credit cap/.test(err.message) && called === 0 && jobs.reserved === 0 && r.log.calls.length === 0, "the cap refuses before the call: nothing reserved, nothing recorded, the call not made");
}
{
  // 7b. The call fails after a reservation: the reservation is released, the error is recorded, the error propagates.
  const r = fakeRun("test-release"); const jobs = new Jobs(r);
  let err = null; try { await jobs.paid("k", "out.png", { endpoint: "/v1/x", prompt: "p" }, [], 1, async () => { throw new Error("boom from the provider"); }); } catch (e) { err = e; }
  const L = ledgerNow();
  ok(err && /boom/.test(err.message), "the provider's error propagates");
  ok(jobs.reserved === 0 && (L.inflight?.["test-release"] ?? 0) === 0, "the reservation is released in memory and in the ledger");
  ok(r.log.calls.length === 1 && /boom/.test(r.log.calls[0].error) && !r.log.calls[0].credits, "the failed call is recorded with its error and no credits");
  ok(!("test-release" in (L.runs || {})), "a failed call books nothing against the cap");
  // tidy the zero in-flight entry the release wrote
  try { const l = ledgerNow(); if (l.inflight) delete l.inflight["test-release"]; writeFileSync(LEDGER, JSON.stringify(l, null, 2)); } catch {}
}
{
  // 7c. A signature-cache hit: the record matches and the file exists, so nothing is called and nothing is paid.
  const r = fakeRun("test-cache"); const jobs = new Jobs(r); const spec = { endpoint: "/v1/x", prompt: "p" };
  writeFileSync(r.path("out.png"), "x".repeat(2048));
  const sig = createHash("sha256").update(JSON.stringify({ spec, inputs: [] })).digest("hex").slice(0, 16);
  r.log.jobs["k"] = { sig, id: "old", endpoint: spec.endpoint, file: "out.png", credits: 5 };
  let called = 0; const res = await jobs.paid("k", "out.png", spec, [], 1000, async () => { called++; return {}; });
  ok(res.cached === true && res.credits === 0 && called === 0, "a matching signature with the file on disk returns cached, 0 credits, no call");
  r.log.jobs["k"].sig = "different"; let err = null; try { await jobs.paid("k", "out.png", spec, [], 1000, async () => ({})); } catch (e) { err = e; }
  ok(err && /credit cap/.test(err.message), "a changed signature is a new call (here refused by the cap)");
}
{
  // 7d. Estimate mode: the cost is listed, nothing reserved, nothing called.
  const r = fakeRun("test-estimate"); const jobs = new Jobs(r, { estimate: true }); let called = 0;
  const res = await jobs.paid("k", "out.png", { endpoint: "/v1/x", prompt: "p" }, [], 77, async () => { called++; return {}; });
  ok(res.estimated === true && res.credits === 77 && called === 0 && jobs.estimated[0].cost === 77 && jobs.reserved === 0, "estimate mode lists the cost and calls nothing");
}

console.log(fails ? `\n${fails} FAILED` : "\nall ok");
process.exit(fails ? 1 : 0);
