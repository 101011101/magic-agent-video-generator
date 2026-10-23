// Kaizen: approve each keyframe before it is generated. A local page shows, for the next panel, the screenplay beats, the panel's
// action, every reference (the base frame and each entering element's source, each clickable to see that frame), the elements
// added and removed, and the exact prompt (editable). Approve generates one attempt; the result and its checks are shown; accept
// it, retry (with an edited prompt), or go to the next panel. Nothing is generated without a click.
// Usage: CLEANED_CAP=… node cleaned/kaizen.mjs --from custom-rrh4 --label rrh6 [--port 4870]
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { PanelRun } from "./src/panels.js";

const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const run = new PanelRun(opt("--from", "custom-rrh4"), opt("--label", "rrh6")), port = Number(opt("--port", 4870));
console.log(`${run.name}: storyboard…`);
const { slides, violations, perScene } = await run.storyboard();
console.log(`  ${slides.length} panels in ${perScene.length} scenes (${perScene.join(", ")}) · hard rule: ${violations.length ? violations.join("; ") : "every element has a source"}`);
const next = () => (slides.find((s) => !run.tracker.bySlide(s.n))?.n ?? slides.length);

const page = readFileSync(new URL("./src/kaizen.html", import.meta.url), "utf8"), studio = readFileSync(new URL("./src/studio.html", import.meta.url), "utf8");
const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".html": "text/html; charset=utf-8", ".json": "application/json" };
const json = (res, code, body) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
const body = (req) => new Promise((r) => { let s = ""; req.on("data", (d) => (s += d)); req.on("end", () => r(s ? JSON.parse(s) : {})); });
let busy = false;

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`), p = url.pathname;
  try {
    if (p === "/") { res.writeHead(200, { "content-type": MIME[".html"] }); return res.end(page); }
    if (p === "/studio") { res.writeHead(200, { "content-type": MIME[".html"] }); return res.end(studio); }
    if (p.startsWith("/files/")) { const f = run.run.path(decodeURIComponent(p.slice(7))); if (!existsSync(f)) return json(res, 404, { error: "no file" }); res.writeHead(200, { "content-type": MIME[extname(f)] || "application/octet-stream" }); return res.end(readFileSync(f)); }
    if (p === "/api/state") return json(res, 200, { name: run.name, total: slides.length, next: next(), spent: run.spent(), violations, done: slides.filter((s) => run.tracker.bySlide(s.n)).map((s) => ({ n: s.n, file: run.tracker.bySlide(s.n).file, forced: run.tracker.bySlide(s.n).forced })), scenes: run.sp.scenes.map((sc, i) => ({ n: i + 1, place: sc.place, panels: slides.filter((s) => s.scene === i + 1).map((s) => s.n) })) });
    const m = p.match(/^\/api\/(preview|generate|accept)\/(\d+)$/);
    if (m) {
      const n = Number(m[2]);
      if (m[1] === "preview") return json(res, 200, run.preview(n));
      if (busy) return json(res, 409, { error: "a generation is already running" });
      busy = true;
      try {
        if (m[1] === "generate") { const b = await body(req); return json(res, 200, await run.generate(n, { prompt: b.prompt || null })); }
        if (m[1] === "accept") { const b = await body(req); return json(res, 200, { accepted: run.accept(n, b.a) }); }
      } finally { busy = false; }
    }
    const st = p.match(/^\/api\/studio\/(\d+)(?:\/(run|pick|frame))?$/);
    if (st) {
      const k = Number(st[1]);
      if (!st[2]) return json(res, 200, run.studioScene(k));
      const b = await body(req);
      if (st[2] === "pick") { run.studioPick(k, b.v); return json(res, 200, { ok: true }); }
      if (busy) return json(res, 409, { error: "a generation is already running" });
      busy = true;
      try {
        if (st[2] === "run") return json(res, 200, await run.studioRun(k, b.instruction || null));
        if (st[2] === "frame") return json(res, 200, await run.studioFrame(k, b.v, b.panel, b.prompt || null));
      } finally { busy = false; }
    }
    json(res, 404, { error: "not found" });
  } catch (e) { busy = false; json(res, 500, { error: String(e.message || e) }); }
}).listen(port, () => console.log(`kaizen: open http://localhost:${port}  (next panel: ${next()} of ${slides.length})`));
