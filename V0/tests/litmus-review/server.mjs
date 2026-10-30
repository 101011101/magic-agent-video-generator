// Litmus verdict server: serves the ledger page and persists the user's ruling on every change.
// Each finding gets TRUE / FALSE / NOT SURE plus a note; a POST per keystroke-debounced change rewrites verdicts.json.
// Run: node current/tests/litmus-review/server.mjs  →  http://localhost:4479
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync, createReadStream } from "node:fs";
import { join, dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const STORE = join(ROOT, "verdicts.json");
const PORT = Number(process.env.PORT || 4479);
// Static assets under /media/<repo-relative-path>: the page shows real frames and clips, which live in the run and
// sweep directories, not here. Resolved against the repo root and refused if it escapes it.
const REPO = resolve(ROOT, "../../..");
const TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".mp4": "video/mp4", ".webm": "video/webm" };
const read = () => (existsSync(STORE) ? JSON.parse(readFileSync(STORE, "utf8")) : { verdicts: {}, updated_at: null });

createServer(async (req, res) => {
  const send = (code, type, body) => { res.writeHead(code, { "content-type": type, "cache-control": "no-store" }); res.end(body); };
  if (req.method === "GET" && (req.url === "/" || req.url.startsWith("/?"))) return send(200, "text/html; charset=utf-8", readFileSync(join(ROOT, "index.html")));
  if (req.method === "GET" && req.url.startsWith("/media/")) {
    const rel = decodeURIComponent(req.url.slice("/media/".length).split("?")[0]);
    const file = resolve(REPO, rel);
    if (!file.startsWith(REPO + "/") || !existsSync(file)) return send(404, "text/plain", "no such asset");
    const type = TYPES[extname(file).toLowerCase()];
    if (!type) return send(415, "text/plain", "unsupported asset type");
    res.writeHead(200, { "content-type": type, "cache-control": "no-store" });
    return createReadStream(file).pipe(res);
  }
  if (req.method === "GET" && req.url === "/api/verdicts") return send(200, "application/json", JSON.stringify(read()));
  if (req.method === "POST" && req.url === "/api/verdicts") {
    let raw = ""; for await (const c of req) raw += c;
    try {
      const { id, verdict, note } = JSON.parse(raw);
      const store = read();
      const prev = store.verdicts[id] || {};
      store.verdicts[id] = { verdict: verdict ?? prev.verdict ?? null, note: note ?? prev.note ?? "", at: new Date().toISOString() };
      store.updated_at = new Date().toISOString();
      writeFileSync(STORE, JSON.stringify(store, null, 2));
      return send(200, "application/json", JSON.stringify({ ok: true, saved: store.verdicts[id] }));
    } catch (e) { return send(400, "application/json", JSON.stringify({ error: String(e.message) })); }
  }
  send(404, "text/plain", "not found");
}).listen(PORT, () => console.log(`litmus review → http://localhost:${PORT}\nverdicts → ${STORE}`));
