// Shared run context: paths, models, a job runner with signature cache and estimate mode, a credit ledger with a hard cap.
// A job = { key, file, spec, inputs }. It re-runs only when the spec or an input file's content hash changes.
// Every Magic Hour job goes through `mh()`, which checks the ledger (all pipeline-memory runs together) before spending.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { REPO } from "../../state-manager/src/paths.js";
import { runJob, download, uploadFile } from "../../state-manager/src/magichour.js";
import { chooseImageTool, chooseVideoModel } from "../../state-manager/src/choose.js";

export { REPO, download };
export const RUNS = join(REPO, "current/tests/pipeline-memory/runs");
export const LEDGER = join(REPO, "current/tests/pipeline-memory/ledger.json");
export const CAP = Number(process.env.MH_CAP || 15000);
export const IMAGE = { model: "nano-banana-pro", resolution: "2k", aspect_ratio: "16:9" };
export const VIDEO = { model: "wan-3.0", resolution: "720p", audio: true };
export const COST = { image: 200, video_s: 96, tts_char: 0.1 };

// Network retry for LLM/vision calls: undici "fetch failed", resets and timeouts are retried; HTTP errors are not.
export async function net(fn, tries = 3) {
  for (let a = 1; ; a++) {
    try { return await fn(); }
    catch (e) { const s = `${e?.message} ${e?.cause?.code ?? e?.cause?.message ?? ""}`; if (a === tries || !/fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN|UND_ERR|socket hang up/i.test(s)) throw e; await new Promise((r) => setTimeout(r, 8000 * a)); }
  }
}
export function ledger() { return existsSync(LEDGER) ? JSON.parse(readFileSync(LEDGER, "utf8")) : { spent: 0, jobs: [] }; }
// Credits promised to calls that are in flight but have not reached spend() yet. The ledger on disk only moves when a job
// finishes, so concurrent callers (anchors run under Promise.all) would each read the same spent figure, each see room under
// the cap, and each spend — overshooting it. Reserving before the call and releasing after makes the cap hold: the
// check-and-reserve below has no await between the two statements, so no other task can interleave inside it.
let reserved = 0;
export function reservedCredits() { return reserved; }
export function spend(entry) {
  const l = ledger(); l.spent += entry.credits || 0; l.jobs.push({ at: new Date().toISOString(), ...entry });
  mkdirSync(join(LEDGER, ".."), { recursive: true }); writeFileSync(LEDGER, JSON.stringify(l, null, 2));
  return l.spent;
}

export class Run {
  constructor({ caseId, label, estimate = false, sup = null }) {
    this.caseId = caseId; this.label = label; this.estimate = estimate; this.sup = sup; this.gated = 0;
    this.dir = join(RUNS, `${caseId}-${label}`); mkdirSync(this.dir, { recursive: true });
    this.logPath = join(this.dir, "run.json");
    this.log = existsSync(this.logPath) ? JSON.parse(readFileSync(this.logPath, "utf8")) : { jobs: {} };
    this.log.jobs ??= {};
    // Per-run, despite living in the log: the keyframe gate blocks a fault class that a retry failed to fix, and that
    // judgement must not outlive the run that made it. Loaded from run.json it would persist across --resume and every
    // re-run of the same label, blocking the class permanently. Jobs are cached by signature; this is not.
    this.log.retried_classes = {};
    this.hashes = {}; this.dirty = new Set(); this.estimated = []; this.upCache = {};
  }
  path(f) { return join(this.dir, f); }
  has(f) { return existsSync(this.path(f)); }
  save() { writeFileSync(this.logPath, JSON.stringify(this.log, null, 2)); }
  fileHash(f) { return (this.hashes[f] ??= this.has(f) ? createHash("sha256").update(readFileSync(this.path(f))).digest("hex").slice(0, 16) : "missing"); }
  touch(f) { delete this.hashes[f]; delete this.upCache[f]; }
  sig(spec, inputs) { return createHash("sha256").update(JSON.stringify({ spec, inputs: inputs.map((f) => this.fileHash(f)) })).digest("hex").slice(0, 16); }
  // Runs fn() unless the output exists with the same signature. cost = credits the job would spend (estimate mode).
  async job(key, file, spec, inputs, cost, fn) {
    const fresh = !inputs.some((f) => this.dirty.has(f));
    const sig = this.sig(spec, inputs);
    if (fresh && this.has(file) && this.log.jobs[key]?.sig === sig) return file;
    if (this.estimate) { this.estimated.push({ key, cost }); this.dirty.add(file); return file; }
    // Supervised run: the operator approves this call before it is made, so a stop here spends nothing.
    const done = this.sup ? await this.sup.gate({ key, file, spec, inputs, cost }) : null;
    let t;
    this.gated++;
    try { t = await fn(); } finally { this.gated--; }
    this.touch(file);
    this.log.jobs[key] = { ...t, output: file, sig: this.sig(spec, inputs) }; this.save();
    done?.({ files: [file], credits: t.credits, seconds: t.seconds });
    console.log(`  ${key}: ${t.credits ?? 0} credits, ${t.seconds ?? 0}s`);
    return file;
  }
  // Magic Hour call with the ledger cap. kind: image | video | audio.
  async mh(endpoint, body, kind, expect) {
    // Backstop: every paid call currently goes through job(), which already gated. This catches any future one that does not.
    if (this.sup && !this.gated) await this.sup.gate({ key: endpoint, file: body.name || endpoint, spec: { prompt: body.style?.prompt ?? null }, inputs: [], cost: expect, kind: "mh" });
    const l = ledger();
    if (l.spent + reserved + expect > CAP) throw new Error(`budget: ${l.spent} spent + ${reserved} in flight + ${expect} would pass the cap of ${CAP}`);
    reserved += expect;
    let r;
    try { r = kind === "audio" ? await audioJob(endpoint, body) : await runJob(endpoint, body, kind, { timeoutS: kind === "video" ? 2700 : 1200 }); }
    catch (e) { if (/HTTP 402/.test(String(e))) { spend({ run: `${this.caseId}-${this.label}`, endpoint, credits: 0, error: "402" }); throw new Error(`402 out of credits: ${e.message}`); } throw e; }
    finally { reserved -= expect; }
    spend({ run: `${this.caseId}-${this.label}`, endpoint, name: body.name, credits: r.credits || 0 });
    return r;
  }
  async up(file, type = "image") { return (this.upCache[file] ??= uploadFile(this.path(file), type)); }
  // Image generation (no inputs) or edit (inputs = run-relative files). Returns the job record.
  // Endpoint from the selector (SM-100) rather than a ternary. With no `need` the answer is the one the ternary gave;
  // passing `need.preserve` (the reference-only atoms of the entities in frame) makes it a function of the state.
  async image(name, prompt, inputs, outFile, need = null) {
    const chosen = chooseImageTool({ inputs, need });
    const body = { name, image_count: 1, ...IMAGE, style: { prompt }, ...(inputs.length ? { assets: { image_file_paths: await Promise.all(inputs.map((f) => this.up(f))) } } : {}) };
    const r = await this.mh(chosen.endpoint, body, "image", COST.image);
    await download(r.downloads[0], this.path(outFile)); this.touch(outFile);
    return { endpoint: chosen.endpoint, request: body, inputs, credits: r.credits, seconds: r.seconds, choice: chosen.decision };
  }
  async video(name, prompt, startFile, seconds, outFile, need = null) {
    const chosen = chooseVideoModel(VIDEO, { seconds, endFrame: false, need });
    if (chosen.overridden) console.log(`  model: ${chosen.reason}`);
    const body = { name, ...VIDEO, model: chosen.model, end_seconds: seconds, style: { prompt }, assets: { image_file_path: await this.up(startFile) } };
    const r = await this.mh("/v1/image-to-video", body, "video", COST.video_s * seconds);
    await download(r.downloads[0], this.path(outFile)); this.touch(outFile);
    return { endpoint: "/v1/image-to-video", request: body, start: startFile, credits: r.credits, seconds: r.seconds, choice: chosen.decision };
  }
  totalCredits() { return Object.values(this.log.jobs).reduce((n, j) => n + (j.credits || 0), 0); }
}

// Audio jobs poll /v1/audio-projects (the shared runJob only knows image and video projects).
function mhKey() {
  if (process.env.MAGIC_HOUR_API_KEY) return process.env.MAGIC_HOUR_API_KEY.trim();
  const m = readFileSync(join(REPO, "current/tests/state-manager/.env"), "utf8").match(/^MAGIC_HOUR_API_KEY=(.+)$/m);
  if (!m) throw new Error("MAGIC_HOUR_API_KEY not set"); return m[1].trim();
}
async function audioJob(endpoint, body) {
  const t0 = Date.now(), headers = { authorization: `Bearer ${mhKey()}`, "content-type": "application/json" };
  const req = async (method, path, b) => { const res = await fetch(`https://api.magichour.ai${path}`, { method, headers, body: b ? JSON.stringify(b) : undefined });
    const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(`Magic Hour ${method} ${path} → HTTP ${res.status}: ${JSON.stringify(data).slice(0, 300)}`); return data; };
  const { id } = await req("POST", endpoint, body);
  for (;;) {
    await new Promise((r) => setTimeout(r, 3000));
    const p = await req("GET", `/v1/audio-projects/${id}`);
    if (p.status === "complete") return { id, credits: p.credits_charged, downloads: (p.downloads || []).map((d) => d.url), seconds: Math.round((Date.now() - t0) / 1000) };
    if (p.status === "error" || p.status === "canceled") throw new Error(`Magic Hour audio job ${id} ${p.status}: ${JSON.stringify(p.error).slice(0, 300)}`);
    if ((Date.now() - t0) / 1000 > 600) throw new Error(`Magic Hour audio job ${id} timed out`);
  }
}

// Case loading.
export function loadCase(caseId) {
  const c = JSON.parse(readFileSync(join(REPO, "current/tests/state-manager/cases.json"), "utf8")).cases.find((x) => x.id === caseId);
  if (!c) throw new Error(`no case ${caseId}`);
  const read = (p) => readFileSync(join(REPO, p), "utf8");
  return { ...c, story: read(c.story_path), chunks: read(c.chunks_path), uploadDir: join(REPO, "current/tests/pipeline-v2/uploads", caseId) };
}
