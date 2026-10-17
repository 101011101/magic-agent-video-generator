// Test machine supervisor: the real pipeline runs with its real logic, but every major step and every paid call stops here
// first and waits for the operator to approve it in a browser page. Nothing is mocked — the gate only decides whether the
// next call happens. The gate sits before the paid call, so "stop" actually saves the credits.
// In-process: the pipeline starts the server with --supervised, prints the URL, and blocks on each gate.
import { createServer } from "node:http";
import { existsSync, statSync, createReadStream } from "node:fs";
import { join, extname, normalize } from "node:path";
import { renderPage } from "./page.js";

const MIME = { mp4: "video/mp4", webm: "video/webm", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", wav: "audio/wav", mp3: "audio/mpeg", json: "application/json", html: "text/html; charset=utf-8" };
const extOf = (f) => extname(f).slice(1).toLowerCase();
const json = (res, code, data) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(data)); };
const readBody = (req) => new Promise((ok, bad) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => ok(Buffer.concat(c))); req.on("error", bad); });

export class StopRun extends Error {}

export class Supervisor {
  // runDir: where the run writes its media (served to the page). auto: approve everything (used by the replay harness).
  constructor({ runDir, title, port = Number(process.env.TM_PORT || 4478), auto = false }) {
    this.runDir = runDir; this.auto = auto; this.port = port; this.pending = null; this.seq = 0; this.server = null;
    this.state = { title, runDir, started_at: new Date().toISOString(), finished: null, auto, steps: [], credits: { approved: 0, spent: 0 } };
  }
  async start() {
    this.server = createServer(async (req, res) => {
      try {
        const url = new URL(req.url, "http://x"), p = url.pathname;
        if (req.method === "GET" && (p === "/" || p === "/index.html")) { res.writeHead(200, { "content-type": MIME.html }); return res.end(renderPage(this.state)); }
        if (req.method === "GET" && p === "/api/state") return json(res, 200, this.state);
        if (req.method === "POST" && p === "/api/decide") {
          const { id, action } = JSON.parse((await readBody(req)).toString() || "{}");
          if (!this.pending || this.pending.id !== id) return json(res, 409, { error: "no such pending step" });
          const r = this.pending.resolve; this.pending = null; r(action);
          return json(res, 200, { ok: true });
        }
        if (req.method === "GET" && p.startsWith("/media/")) { // run media, confined to runDir
          const rel = normalize(decodeURIComponent(p.slice(7))).replace(/^(\.\.[/\\])+/, "");
          const file = join(this.runDir, rel);
          if (!file.startsWith(this.runDir) || !existsSync(file)) return json(res, 404, { error: "not found" });
          const size = statSync(file).size, type = MIME[extOf(file)] || "application/octet-stream";
          const m = (req.headers.range || "").match(/bytes=(\d*)-(\d*)/);
          if (m) { const start = m[1] ? Number(m[1]) : 0, end = m[2] ? Number(m[2]) : size - 1;
            res.writeHead(206, { "content-type": type, "content-range": `bytes ${start}-${end}/${size}`, "accept-ranges": "bytes", "content-length": end - start + 1 });
            return createReadStream(file, { start, end }).pipe(res); }
          res.writeHead(200, { "content-type": type, "content-length": size, "accept-ranges": "bytes" });
          return createReadStream(file).pipe(res);
        }
        return json(res, 404, { error: "not found" });
      } catch (e) { json(res, 500, { error: String(e.message) }); }
    });
    await new Promise((ok, bad) => { this.server.on("error", bad); this.server.listen(this.port, ok); });
    const url = `http://localhost:${this.server.address().port}`;
    console.log(`\n  test machine → ${url}   (approve each step there)\n`);
    return url;
  }
  close() { this.server?.close(); }

  // The blocking gate. Returns "approve" or "stop"; "auto" approves this one and everything after it.
  async #ask(entry) {
    entry.id = `s${++this.seq}`; entry.at = new Date().toISOString();
    this.state.steps.push(entry);
    if (this.auto) { entry.status = "running"; entry.decided = "auto"; return "approve"; }
    entry.status = "pending";
    const d = await new Promise((resolve) => { this.pending = { id: entry.id, resolve }; });
    entry.decided = d;
    if (d === "auto") { this.auto = true; this.state.auto = true; entry.status = "running"; return "approve"; }
    entry.status = d === "approve" ? "running" : "stopped";
    return d;
  }
  // A major pipeline step (may be free). about: one line on what it is about to do. detail: anything worth seeing.
  async step(name, about, detail = {}) {
    const e = { kind: "step", name, about, detail, cost: 0 };
    if ((await this.#ask(e)) === "stop") throw new StopRun(`stopped before step "${name}"`);
    return (result) => this.#done(e, result);
  }
  // A paid call. key/spec/inputs/cost come straight from the job runner, so the page shows the prompt and the price.
  async gate({ key, file, spec = {}, inputs = [], cost = 0, kind = "job" }) {
    const e = { kind, name: key, about: `${cost} credits → ${file}`, cost,
      detail: { file, inputs, cost, prompt: spec.prompt ?? null, spec: { ...spec, prompt: undefined } } };
    if ((await this.#ask(e)) === "stop") throw new StopRun(`stopped before ${key} (${cost} credits unspent)`);
    this.state.credits.approved += cost;
    return (result) => this.#done(e, result);
  }
  #done(entry, result = {}) {
    entry.status = "done"; entry.result = result; entry.done_at = new Date().toISOString();
    if (result.credits) this.state.credits.spent += result.credits;
    return result;
  }
  finish(summary) { this.state.finished = { at: new Date().toISOString(), ...summary }; }
}

// Convenience: build a supervisor only when --supervised is passed, else null (the pipelines stay unchanged without it).
export async function maybeSupervisor(args, { runDir, title }) {
  if (!args.includes("--supervised")) return null;
  const sup = new Supervisor({ runDir, title, auto: args.includes("--auto") });
  await sup.start();
  return sup;
}
