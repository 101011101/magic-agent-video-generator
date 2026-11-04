// The bench audit pages: http://localhost:4748/<run>/ shows results/<run>/index.html (built by view.mjs), media come
// from V2/sessions and V2/runs (a film run's intermediates), and the notes typed on the page are kept in results/<run>/notes.json. Separate from the agent
// server so it can be started and stopped while a run is going. Usage: node V2/bench/v1/serve.mjs [--port 4748]
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { join, dirname, normalize, extname } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url)), V2 = join(HERE, "..", ".."), RES = join(HERE, "results");
const PORT = Number(process.argv[process.argv.indexOf("--port") + 1]) || 4748;
const MIME = { ".html": "text/html; charset=utf-8", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".mp4": "video/mp4", ".mov": "video/mp4", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".txt": "text/plain; charset=utf-8", ".srt": "text/plain; charset=utf-8" };
const send = (res, code, body, type = "application/json") => { res.writeHead(code, { "content-type": type }); res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body)); };
// a file with Range support, so videos seek
function file(req, res, f) {
  const size = statSync(f).size, type = MIME[extname(f).toLowerCase()] || "application/octet-stream", m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
  if (!m) return send(res, 200, readFileSync(f), type);
  const a = m[1] ? Number(m[1]) : 0, b = m[2] ? Number(m[2]) : size - 1;
  res.writeHead(206, { "content-type": type, "content-range": `bytes ${a}-${b}/${size}`, "accept-ranges": "bytes", "content-length": b - a + 1 }); res.end(readFileSync(f).subarray(a, b + 1));
}
createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p === "/") { res.writeHead(302, { location: "/real-1/" }); return res.end(); }
  if (p.startsWith("/runs/") && !p.endsWith("ledger.json")) { const rel = normalize(p.slice(1)); if (rel.startsWith("..") || !existsSync(join(V2, rel)) || statSync(join(V2, rel)).isDirectory()) return send(res, 404, {}); return file(req, res, join(V2, rel)); }   // a film run's intermediates
  if (p.startsWith("/sessions/")) { const rel = normalize(p.slice(1)); if (rel.startsWith("..") || !existsSync(join(V2, rel))) return send(res, 404, {}); return file(req, res, join(V2, rel)); }
  const m = /^\/([\w.-]+)\/(notes)?$/.exec(p); if (!m) return send(res, 404, {});
  const dir = join(RES, m[1]), notes = join(dir, "notes.json"); if (!existsSync(dir)) return send(res, 404, {});
  if (!m[2]) return existsSync(join(dir, "index.html")) ? send(res, 200, readFileSync(join(dir, "index.html")), MIME[".html"]) : send(res, 404, { error: "run view.mjs first" });
  const all = existsSync(notes) ? JSON.parse(readFileSync(notes, "utf8")) : {};
  if (req.method !== "POST") return send(res, 200, all);
  let b = ""; for await (const c of req) b += c; const { id, text, tags, at, explain } = JSON.parse(b || "{}"); if (!/^[A-J]\d\d[a-z]$/.test(id || "")) return send(res, 400, { error: "bad id" });
  if (!text && !tags?.length && !explain) delete all[id]; else all[id] = { text, tags, at, ...(explain ? { explain: true } : {}) };   // explain: the user wants this item explained
  writeFileSync(notes, JSON.stringify(all, null, 2)); send(res, 200, { ok: true });
}).listen(PORT, () => console.log(`bench pages: http://localhost:${PORT}/real-1/`));
