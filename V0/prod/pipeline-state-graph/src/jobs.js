// Jobs: every paid Magic Hour call goes through here. A job re-runs only when its signature (spec + input file hashes) changes.
// Credits are metered against a hard cap shared by all runs (tests/pipeline-state-graph/credits.json); HTTP 402 or the cap stops the run.
// Estimate mode lists the jobs that would run and their credits and spends nothing.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { runJob, download, uploadFile } from "../../state-manager/src/magichour.js";
import { REPO } from "../../state-manager/src/paths.js";
import { chooseImageTool, chooseVideoModel } from "../../state-manager/src/choose.js";

export const COST = { image: 200, video_per_s: 96 }; // nano-banana-pro 2k; wan-3.0 720p
// Lifetime credit guard. The default stays the granted figure; MH_CAP raises it for a run the user has approved,
// so the guard is never loosened in source. 10160 = ledger after v2; 9000 = the grant for v3.
export const CAP = Number(process.env.MH_CAP || 10160 + 9000);
const LEDGER = join(REPO, "current/tests/pipeline-state-graph/credits.json");

export class StopError extends Error {}

export class Jobs {
  constructor(runDir, log, { estimate = false, sup = null } = {}) {
    this.runDir = runDir; this.log = log; this.estimate = estimate; this.sup = sup;
    this.hashes = {}; this.dirty = new Set(); this.estimated = 0; this.calls = [];
    this.upCache = {};
    log.jobs ??= {}; log.calls ??= [];
  }
  save() { writeFileSync(join(this.runDir, "run.json"), JSON.stringify(this.log, null, 2)); }
  fileHash(f) { return (this.hashes[f] ??= existsSync(join(this.runDir, f)) ? createHash("sha256").update(readFileSync(join(this.runDir, f))).digest("hex").slice(0, 16) : "missing"); }
  sigOf(spec, inputs) { return createHash("sha256").update(JSON.stringify({ spec, inputs: inputs.map((f) => this.fileHash(f)) })).digest("hex").slice(0, 16); }
  forget(f) { delete this.hashes[f]; }
  ledger() { return existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, "utf8")) : { total: 0, runs: {} }; }
  spent() { return this.log.calls.reduce((n, c) => n + (c.credits || 0), 0); } // calls are append-only across re-runs
  // Credits spent by every run so far (this run counted from its log, so re-runs do not double count).
  charge(credits, key) {
    const led = this.ledger(); led.runs[this.log.run] = this.spent(); led.total = Object.values(led.runs).reduce((a, b) => a + b, 0);
    writeFileSync(LEDGER, JSON.stringify(led, null, 2));
    if (led.total > CAP) throw new StopError(`credit cap ${CAP} reached after ${key} (total ${led.total})`);
  }
  // key: job name; file: output relative to runDir; spec: everything that defines the job; inputs: relative input files.
  // fn(): runs the job, writes the file, returns { endpoint, request, credits, seconds, ... }.
  async run(key, file, spec, inputs, cost, fn) {
    const sig = this.sigOf(spec, inputs), fresh = !inputs.some((f) => this.dirty.has(f));
    const j = this.log.jobs[key];
    if (fresh && existsSync(join(this.runDir, file)) && j?.sig === sig) return { file, cached: true, ...j };
    if (this.estimate) { this.estimated += cost; this.dirty.add(file); this.calls.push({ key, cost }); console.log(`  would run ${key} (${cost})`); return { file, estimated: true, credits: cost }; }
    const led = this.ledger();
    if (led.total - (led.runs[this.log.run] || 0) + this.spent() + cost > CAP) throw new StopError(`credit cap ${CAP}: ${key} (${cost}) would exceed it`);
    // Supervised run: the operator approves this call before it is made, so a stop here spends nothing.
    const done = this.sup ? await this.sup.gate({ key, file, spec, inputs, cost }) : null;
    const t0 = Date.now();
    let t;
    try { t = await fn(); } catch (e) {
      this.log.calls.push({ key, error: String(e), at: new Date().toISOString() }); this.save();
      if (/HTTP 402/.test(String(e))) throw new StopError(`HTTP 402 (out of credits) on ${key}`);
      throw e;
    }
    this.forget(file);
    this.log.jobs[key] = { ...t, output: file, sig, at: new Date().toISOString(), wall_s: Math.round((Date.now() - t0) / 1000) };
    this.log.calls.push({ key, endpoint: t.endpoint, credits: t.credits, seconds: t.seconds, at: this.log.jobs[key].at });
    this.save(); this.charge(t.credits, key);
    done?.({ files: [file], credits: t.credits, seconds: t.seconds });
    console.log(`  ${key}: ${t.credits} credits, ${t.seconds}s`);
    return { file, ...this.log.jobs[key] };
  }
  async upload(file) { return (this.upCache[file] ??= uploadFile(join(this.runDir, file), "image").catch((e) => { delete this.upCache[file]; throw e; })); }
  // One image call. The endpoint comes from the selector (SM-100), not from a ternary: with no stated need it returns
  // what the ternary returned, and `need.preserve` makes it a function of the state. The decision goes on the record.
  async image(name, prompt, inputs, file, IMAGE, need = null) {
    const chosen = chooseImageTool({ inputs, need });
    const body = { name, image_count: 1, ...IMAGE, style: { prompt }, ...(inputs.length ? { assets: { image_file_paths: await Promise.all(inputs.map((f) => this.upload(f))) } } : {}) };
    const r = await runJob(chosen.endpoint, body, "image");
    await download(r.downloads[0], join(this.runDir, file));
    return { endpoint: chosen.endpoint, request: body, inputs, credits: r.credits, seconds: r.seconds, choice: chosen.decision };
  }
  // The model follows the step's stated needs. VIDEO.model stays the preference and is kept whenever it qualifies; it is
  // replaced only when the step needs something that model cannot do, and the swap is recorded with its reason.
  async video(name, prompt, start, seconds, file, VIDEO, need = null) {
    const chosen = chooseVideoModel(VIDEO, { seconds, endFrame: false, need });
    if (chosen.overridden) console.log(`  model: ${chosen.reason}`);
    const body = { name, ...VIDEO, model: chosen.model, end_seconds: seconds, style: { prompt }, assets: { image_file_path: await this.upload(start) } };
    const r = await runJob("/v1/image-to-video", body, "video", { timeoutS: 2700 });
    await download(r.downloads[0], join(this.runDir, file));
    return { endpoint: "/v1/image-to-video", request: body, start, credits: r.credits, seconds: r.seconds, choice: chosen.decision };
  }
}
