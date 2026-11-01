// Every paid call goes through Jobs. A job is skipped when its signature (spec + input file hashes) matches the record and the
// output file exists. Credits are metered against CLEANED_CAP in runs/ledger.json (reserved before the call, so parallel
// jobs cannot overshoot). The job id is recorded under log.pending as soon as Magic Hour returns it, and removed on
// completion, so an interrupted poll leaves a trace that can be fetched or at least accounted for.
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync, rmSync, renameSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { runJob, pollJob, download, upload } from "./magichour.js";
import { RUNS } from "./env.js";
import { stillCost, videoCost, TIERS } from "./models.js";

export const IMAGE = { model: TIERS.paid.still, resolution: TIERS.paid.res, aspect_ratio: "16:9" };
export const VIDEO = { model: TIERS.paid.video, resolution: TIERS.paid.vres, audio: true };
// Credits per second of output at 720p (Magic Hour catalog; wan-3.0 measured: 480 for 5 s). Audio is free on wan-3.0.
export const VIDEO_RATE = { "wan-3.0": 96, "kling-3.0": 48, "seedance-1.5": 60, "seedance-2.5": 336, "veo3.1-lite": 48, "veo3.1": 96, "ltx-2.5": 48, "minimax-h3": 48 };
export const AUDIO_EXTRA = { "kling-3.0": 24, "veo3.1": 24, "veo3.1-lite": 24, "seedance-1.5": 60 };   // per second, when audio is on (the sheet: included on wan, ltx, minimax, seedance 2.x)
// Costs come from the model registry (lib/models.js): a still at a resolution, a clip at a resolution with or without audio.
// COST.image stays as the paid-tier still price for callers that only know the old constant.
export const COST = { image: stillCost(IMAGE.model, IMAGE.resolution), still: (model = IMAGE.model, res = IMAGE.resolution) => stillCost(model, res), video: (seconds, model = VIDEO.model, audio = true, res = VIDEO.resolution) => videoCost(seconds, model, res, audio), music: (seconds) => seconds };
export const CAP = Number(process.env.CLEANED_CAP || 8000);
if (!Number.isFinite(CAP) || CAP < 0) throw new Error(`CLEANED_CAP must be a non-negative number of credits (got "${process.env.CLEANED_CAP}")`);   // a typo must not remove the only spend guard
const LEDGER = join(RUNS, "ledger.json"), LOCK = join(RUNS, "ledger.lock");
// The ledger is shared by every run label, so reads and writes of it happen under a lock (an atomic mkdir, held for
// milliseconds; a lock older than a minute is taken over), and each process writes its in-flight reservations into it, so
// two labels running at once cannot jointly overshoot the cap.
function locked(fn) {
  const t0 = Date.now();
  for (;;) { try { mkdirSync(LOCK); break; } catch { try { if (Date.now() - statSync(LOCK).mtimeMs > 60000) rmSync(LOCK, { recursive: true, force: true }); } catch {} if (Date.now() - t0 > 15000) throw new Error("ledger lock held for 15 s; another run is stuck?"); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25); } }
  try { return fn(); } finally { rmSync(LOCK, { recursive: true, force: true }); }
}

export class Jobs {
  constructor(run, { estimate = false } = {}) {
    this.run = run; this.estimate = estimate; this.reserved = 0; this.estimated = []; this.uploads = {};
    run.log.jobs ??= {}; run.log.calls ??= []; run.log.pending ??= {};
  }
  hash(f) { return existsSync(this.run.path(f)) ? createHash("sha256").update(readFileSync(this.run.path(f))).digest("hex").slice(0, 16) : `missing:${f}`; }
  ledger() { try { return existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, "utf8")) : { total: 0, runs: {} }; } catch { return JSON.parse(readFileSync(`${LEDGER}.bak`, "utf8")); } }
  spent() { return this.run.log.calls.reduce((n, c) => n + (c.credits || 0), 0); }
  write(l) { l.total = Object.values(l.runs).reduce((a, b) => a + b, 0); if (existsSync(LEDGER)) renameSync(LEDGER, `${LEDGER}.bak`); writeFileSync(`${LEDGER}.tmp`, JSON.stringify(l, null, 2)); renameSync(`${LEDGER}.tmp`, LEDGER); }
  book() { locked(() => { const l = this.ledger(); l.runs[this.run.name] = this.spent(); (l.inflight ??= {})[this.run.name] = this.reserved; this.write(l); }); }
  // Reserve a cost against the cap, seeing every other process's spend and reservations; throws when it would overshoot.
  reserve(key, cost) {
    locked(() => {
      const l = this.ledger(), others = Object.entries(l.runs).filter(([k]) => k !== this.run.name).reduce((n, [, v]) => n + v, 0) + Object.entries(l.inflight || {}).filter(([k]) => k !== this.run.name).reduce((n, [, v]) => n + v, 0);
      if (others + this.spent() + this.reserved + cost > CAP) throw new Error(`credit cap ${CAP}: ${key} (${cost}) would exceed it (ledger ${others + this.spent()}, in flight ${this.reserved}${Object.keys(l.inflight || {}).some((k) => k !== this.run.name && l.inflight[k]) ? " here, more in other runs" : ""})`);
      this.reserved += cost; (l.inflight ??= {})[this.run.name] = this.reserved; this.write(l);
    });
  }
  release(cost) { this.reserved -= cost; locked(() => { const l = this.ledger(); (l.inflight ??= {})[this.run.name] = this.reserved; this.write(l); }); }

  // One image job. inputs: run-relative image files (empty → generator, else editor).
  async image(key, file, prompt, inputs = [], image = IMAGE) {
    const endpoint = inputs.length ? "/v1/ai-image-editor" : "/v1/ai-image-generator";
    return this.paid(key, file, { endpoint, ...image, prompt }, inputs, stillCost(image.model, image.resolution), async (paths, onCreate) => {
      const body = { name: `${this.run.name} ${key}`, image_count: 1, ...image, style: { prompt }, ...(paths.length ? { assets: { image_file_paths: paths } } : {}) };
      return runJob(endpoint, body, { kind: "image", onCreate });
    });
  }
  // One image-to-video job: start frame, optional end frame.
  async video(key, file, prompt, start, end, seconds, video = VIDEO) {
    const inputs = end ? [start, end] : [start];
    return this.paid(key, file, { endpoint: "/v1/image-to-video", ...video, prompt, seconds }, inputs, COST.video(seconds, video.model, video.audio, video.resolution), async ([s, e], onCreate) => {
      const body = { name: `${this.run.name} ${key}`, ...video, end_seconds: seconds, style: { prompt }, assets: { image_file_path: s, ...(e ? { end_image_file_path: e } : {}) } };
      return runJob("/v1/image-to-video", body, { kind: "video", onCreate });
    });
  }
  // Text-to-video with named references (@name in the prompt), no pinned frame. refs: [{ name, file }].
  async tvideo(key, file, prompt, refs, seconds, video = VIDEO) {
    return this.paid(key, file, { endpoint: "/v1/text-to-video", ...video, prompt, seconds, names: refs.map((r) => r.name) }, refs.map((r) => r.file), COST.video(seconds, video.model, video.audio, video.resolution), async (paths, onCreate) => {
      const body = { name: `${this.run.name} ${key}`, aspect_ratio: "16:9", ...video, end_seconds: seconds, style: { prompt }, ...(refs.length ? { references: refs.map((r, i) => ({ name: r.name, file_path: paths[i] })) } : {}) };   // an empty references list is refused (HTTP 400)
      return runJob("/v1/text-to-video", body, { kind: "video", onCreate });
    });
  }
  // One music job: an instrumental bed of `seconds` seconds from a cue (/v1/ai-music-generator, 1 credit per second).
  async music(key, file, prompt, seconds) {
    return this.paid(key, file, { endpoint: "/v1/ai-music-generator", prompt, seconds }, [], COST.music(seconds), async (paths, onCreate) => runJob("/v1/ai-music-generator", { name: `${this.run.name} ${key}`, duration: seconds, style: { prompt, instrumental: true } }, { kind: "audio", onCreate }));
  }
  // Shared gate: signature cache → pending job resumed → estimate → cap check (reserved) → upload inputs → job → download → record.
  async paid(key, file, spec, inputs, cost, call) {
    const sig = createHash("sha256").update(JSON.stringify({ spec, inputs: inputs.map((f) => this.hash(f)) })).digest("hex").slice(0, 16);
    const rec = this.run.log.jobs[key];
    if (rec?.sig === sig && existsSync(this.run.path(file))) return { file, cached: true, credits: 0 };
    const kind = /video/.test(spec.endpoint) ? "video" : /music|voice|audio/.test(spec.endpoint) ? "audio" : "image", record = (r) => {
      this.run.log.jobs[key] = { sig, id: r.id, endpoint: spec.endpoint, file, inputs, prompt: spec.prompt, model: spec.model, credits: r.credits, seconds: r.seconds, at: new Date().toISOString() };
      delete this.run.log.pending[key]; this.run.save();
    };
    // A job posted by an earlier process for this key and never collected (its poll died) is resumed, not posted again:
    // the charge was taken when it ran. Only a job that errored on the server side is forgotten and posted anew.
    const pend = this.run.log.pending[key];
    if (pend?.id && !this.estimate) {
      try {
        const r = await pollJob(pend.id, { kind, credits: pend.credits });
        if (!this.run.log.calls.some((c) => c.id === r.id && c.credits)) { this.run.log.calls.push({ key, credits: r.credits, seconds: r.seconds, id: r.id, resumed: true, at: new Date().toISOString() }); this.run.save(); this.book(); }
        await download(r.url, this.run.path(file));
        if (!existsSync(this.run.path(file)) || statSync(this.run.path(file)).size < 1024) throw new Error(`${key}: empty download (${r.url})`);
        record(r); console.log(`  ${key}: resumed job ${r.id} (${r.credits} credits, posted earlier)`);
        return { file, credits: 0, resumed: true };
      } catch (e) { if (!/ error| canceled/.test(String(e))) throw e; console.log(`  ${key}: the earlier job ${pend.id} ${String(e).slice(0, 120)}; posting anew`); delete this.run.log.pending[key]; this.run.save(); }
    }
    if (this.estimate) { this.estimated.push({ key, cost }); return { file, estimated: true, credits: cost }; }
    this.reserve(key, cost);
    try {
      const paths = await Promise.all(inputs.map((f) => { const h = this.hash(f); return (this.uploads[h] ??= upload(this.run.path(f)).catch((e) => { delete this.uploads[h]; throw e; })); }));   // a failed upload is not remembered as failed
      const r = await call(paths, (id, credits) => { this.run.log.pending[key] = { id, kind, credits, at: new Date().toISOString(), endpoint: spec.endpoint }; this.run.save(); });
      // The charge is booked as soon as the job completes, before the download: a failed download must not hide a charge.
      this.run.log.calls.push({ key, credits: r.credits, seconds: r.seconds, id: r.id, at: new Date().toISOString() }); this.run.save(); this.book();
      await download(r.url, this.run.path(file));
      if (!existsSync(this.run.path(file)) || statSync(this.run.path(file)).size < 1024) throw new Error(`${key}: empty download (${r.url})`);
      record(r);
      console.log(`  ${key}: ${r.credits} credits, ${r.seconds}s`);
      return { file, credits: r.credits };
    } catch (e) {
      if (!this.run.log.calls.some((c) => c.key === key && c.credits && !c.error && c.at > new Date(Date.now() - 600000).toISOString())) this.run.log.calls.push({ key, error: String(e).slice(0, 400), at: new Date().toISOString() });
      this.run.save();
      throw e;
    } finally { this.release(cost); }
  }
}
