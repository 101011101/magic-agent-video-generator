// Every paid call goes through Jobs.image(). A job is skipped when its signature (spec + input file hashes) matches the record.
// Credits are metered against CLEANED_CAP in runs/ledger.json (reserved before the call, so parallel jobs cannot overshoot).
// Estimate mode spends nothing: it records the job and returns a placeholder.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { runJob, download, upload } from "./magichour.js";
import { RUNS } from "./env.js";

export const IMAGE = { model: "nano-banana-pro", resolution: "2k", aspect_ratio: "16:9" };
export const VIDEO = { model: "wan-3.0", resolution: "720p", audio: false };
// Credits per second of output at 720p (Magic Hour catalog; wan-3.0 measured: 480 for 5 s). Audio is free on wan-3.0.
export const VIDEO_RATE = { "wan-3.0": 96, "kling-3.0": 48, "seedance-1.5": 60, "veo3.1-lite": 48, "veo3.1": 96, "ltx-2.5": 48, "minimax-h3": 48 };
export const COST = { image: 200, video: (seconds, model = VIDEO.model) => seconds * (VIDEO_RATE[model] ?? 96) };
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
    return this.paid(key, file, { endpoint, ...IMAGE, prompt }, inputs, COST.image, async (paths) => {
      const body = { name: `${this.run.name} ${key}`, image_count: 1, ...IMAGE, style: { prompt }, ...(paths.length ? { assets: { image_file_paths: paths } } : {}) };
      return runJob(endpoint, body, { kind: "image" });
    });
  }

  // One image-to-video job: start frame, optional end frame (first-last-frame interpolation).
  async video(key, file, prompt, start, end, seconds, video = VIDEO) {
    const inputs = end ? [start, end] : [start];
    return this.paid(key, file, { endpoint: "/v1/image-to-video", ...video, prompt, seconds }, inputs, COST.video(seconds, video.model), async ([s, e]) => {
      const body = { name: `${this.run.name} ${key}`, ...video, end_seconds: seconds, style: { prompt }, assets: { image_file_path: s, ...(e ? { end_image_file_path: e } : {}) } };
      return runJob("/v1/image-to-video", body, { kind: "video" });
    });
  }

  // Lip sync (Magic Hour): a clip and a voice track → the clip with the mouth moving to the voice. 1 credit per frame (lite).
  async lipsync(key, file, video, audio, seconds, mode = "lite") {
    return this.paid(key, file, { endpoint: "/v1/lip-sync", mode, seconds }, [video, audio], Math.ceil(seconds * 30), async ([v, a]) => {
      const body = { name: `${this.run.name} ${key}`, start_seconds: 0, end_seconds: seconds, max_fps_limit: 30, style: { generation_mode: mode }, assets: { video_source: "file", video_file_path: v, audio_file_path: a } };
      return runJob("/v1/lip-sync", body, { kind: "video" });
    });
  }

  // Shared gate: signature cache → estimate → cap check (reserved) → upload inputs → job → download → record.
  async paid(key, file, spec, inputs, cost, call) {
    const sig = createHash("sha256").update(JSON.stringify({ spec, inputs: inputs.map((f) => this.hash(f)) })).digest("hex").slice(0, 16);
    const rec = this.run.log.jobs[key];
    if (rec?.sig === sig && existsSync(this.run.path(file))) return { file, cached: true, credits: 0 };
    if (this.estimate) { this.estimated.push({ key, cost }); return { file, estimated: true, credits: cost }; }
    const l = this.ledger(), others = l.total - (l.runs[this.run.name] || 0);
    if (others + this.spent() + this.reserved + cost > CAP) throw new Error(`credit cap ${CAP}: ${key} (${cost}) would exceed it (ledger ${others + this.spent()}, in flight ${this.reserved})`);
    this.reserved += cost;
    try {
      const paths = await Promise.all(inputs.map((f) => (this.uploads[this.hash(f)] ??= upload(this.run.path(f)))));
      const r = await call(paths);
      await download(r.url, this.run.path(file));
      this.run.log.jobs[key] = { sig, endpoint: spec.endpoint, file, inputs, prompt: spec.prompt, model: spec.model, credits: r.credits, seconds: r.seconds, at: new Date().toISOString() };
      this.run.log.calls.push({ key, credits: r.credits, seconds: r.seconds, at: new Date().toISOString() });
      this.run.save(); this.book();
      console.log(`  ${key}: ${r.credits} credits, ${r.seconds}s`);
      return { file, credits: r.credits };
    } catch (e) {
      this.run.log.calls.push({ key, error: String(e).slice(0, 400), at: new Date().toISOString() }); this.run.save();
      throw e;
    } finally { this.reserved -= cost; }
  }
}
