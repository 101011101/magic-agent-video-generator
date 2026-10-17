// Every paid call goes through Jobs.image(). A job is skipped when its signature (spec + input file hashes) matches the record.
// Credits are metered against CLEANED_CAP in runs/ledger.json (reserved before the call, so parallel jobs cannot overshoot).
// Estimate mode spends nothing: it records the job and returns a placeholder.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { imageJob, download, upload } from "./magichour.js";
import { RUNS } from "./env.js";

export const IMAGE = { model: "nano-banana-pro", resolution: "2k", aspect_ratio: "16:9" };
export const COST = { image: 200 };
export const CAP = Number(process.env.CLEANED_CAP || 8000);
const LEDGER = join(RUNS, "ledger.json");

export class Jobs {
  constructor(run, { estimate = false } = {}) {
    this.run = run; this.estimate = estimate; this.reserved = 0; this.estimated = []; this.uploads = {};
    run.log.jobs ??= {}; run.log.calls ??= [];
  }
  hash(f) { return existsSync(this.run.path(f)) ? createHash("sha256").update(readFileSync(this.run.path(f))).digest("hex").slice(0, 16) : `missing:${f}`; }
  ledger() { return existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, "utf8")) : { total: 0, runs: {} }; }
  spent() { return this.run.log.calls.reduce((n, c) => n + (c.credits || 0), 0); }
  book() {
    const l = this.ledger(); l.runs[this.run.name] = this.spent(); l.total = Object.values(l.runs).reduce((a, b) => a + b, 0);
    writeFileSync(LEDGER, JSON.stringify(l, null, 2));
  }

  // One image job. inputs: run-relative image files (empty → generator, else editor). Returns { file, cached, credits }.
  async image(key, file, prompt, inputs = []) {
    const endpoint = inputs.length ? "/v1/ai-image-editor" : "/v1/ai-image-generator";
    const spec = { endpoint, ...IMAGE, prompt };
    const sig = createHash("sha256").update(JSON.stringify({ spec, inputs: inputs.map((f) => this.hash(f)) })).digest("hex").slice(0, 16);
    const rec = this.run.log.jobs[key];
    if (rec?.sig === sig && existsSync(this.run.path(file))) return { file, cached: true, credits: 0 };
    if (this.estimate) { this.estimated.push({ key, cost: COST.image }); return { file, estimated: true, credits: COST.image }; }
    const l = this.ledger(), others = l.total - (l.runs[this.run.name] || 0);
    if (others + this.spent() + this.reserved + COST.image > CAP) throw new Error(`credit cap ${CAP}: ${key} would exceed it (ledger ${others + this.spent()}, in flight ${this.reserved})`);
    this.reserved += COST.image;
    try {
      const paths = await Promise.all(inputs.map((f) => (this.uploads[this.hash(f)] ??= upload(this.run.path(f)))));
      const body = { name: `${this.run.name} ${key}`, image_count: 1, ...IMAGE, style: { prompt }, ...(paths.length ? { assets: { image_file_paths: paths } } : {}) };
      const r = await imageJob(endpoint, body);
      await download(r.url, this.run.path(file));
      this.run.log.jobs[key] = { sig, endpoint, file, inputs, prompt, credits: r.credits, seconds: r.seconds, at: new Date().toISOString() };
      this.run.log.calls.push({ key, credits: r.credits, seconds: r.seconds, at: new Date().toISOString() });
      this.run.save(); this.book();
      console.log(`  ${key}: ${r.credits} credits, ${r.seconds}s`);
      return { file, credits: r.credits };
    } catch (e) {
      this.run.log.calls.push({ key, error: String(e).slice(0, 400), at: new Date().toISOString() }); this.run.save();
      throw e;
    } finally { this.reserved -= COST.image; }
  }
}
