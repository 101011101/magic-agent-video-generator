// Magic Hour playground: local server that runs any Magic Hour tool, stores every call as a node,
// and records which node outputs feed which later calls (lineage).
// Run: node current/research/playground/server.mjs  →  http://localhost:4477
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, createReadStream } from "node:fs";
import { join, dirname, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SESSIONS = join(ROOT, "sessions");
const DEFAULTS = join(ROOT, "defaults.json");
const ENV_FILE = join(ROOT, "../../tests/state-manager/.env");
const BASE = "https://api.magichour.ai";
const PORT = Number(process.env.PORT || 4477);
mkdirSync(SESSIONS, { recursive: true });

// ---------- tools (from the OpenAPI spec) ----------
const SPEC = JSON.parse(readFileSync(join(ROOT, "openapi.json"), "utf8"));
const KIND_BY_TAG = { "Video Projects": "video", "Image Projects": "image", "Audio Projects": "audio", Files: "faces" };
const STATUS_PATH = { video: "/v1/video-projects/", image: "/v1/image-projects/", audio: "/v1/audio-projects/", faces: "/v1/face-detection/" };
const TOOLS = {};
for (const [path, ops] of Object.entries(SPEC.paths)) {
  const op = ops.post;
  if (!op || path === "/v1/files/upload-urls") continue;
  const id = path.slice(4);
  TOOLS[id] = { id, path, title: op.summary, kind: KIND_BY_TAG[op.tags[0]], description: op.description || "", schema: op.requestBody.content["application/json"].schema };
}

// ---------- Magic Hour client ----------
function apiKey() {
  if (process.env.MAGIC_HOUR_API_KEY) return process.env.MAGIC_HOUR_API_KEY.trim();
  const m = existsSync(ENV_FILE) && readFileSync(ENV_FILE, "utf8").match(/^MAGIC_HOUR_API_KEY=(.+)$/m);
  if (m) return m[1].trim();
  throw new Error("MAGIC_HOUR_API_KEY not set (env or current/tests/state-manager/.env)");
}
async function mh(method, path, body) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    // GET is retried on network errors; POST is not, since it may have created a paid job.
    const res = await fetch(BASE + path, { method, headers: { authorization: `Bearer ${apiKey()}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined })
      .catch((e) => { if (method !== "GET" || attempt === 3) throw e; return null; });
    if (!res) { await sleep(5000 * attempt); continue; }
    const data = await res.json().catch(() => ({}));
    if (res.ok) return data;
    if (!(res.status === 429 || res.status >= 500) || attempt === 3) throw new Error(`HTTP ${res.status} ${method} ${path}: ${JSON.stringify(data).slice(0, 800)}`);
    await sleep(5000 * attempt);
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MIME = { mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", aac: "audio/aac", ogg: "audio/ogg", json: "application/json", html: "text/html; charset=utf-8" };
const extOf = (f) => extname(f).slice(1).toLowerCase();
const kindOf = (f) => (MIME[extOf(f)] || "").split("/")[0] || "file";

async function uploadToMH(file) {
  const ext = extOf(file), type = kindOf(file);
  const res = await mh("POST", "/v1/files/upload-urls", { items: [{ type, extension: ext }] });
  const item = res.items[0];
  const put = await fetch(item.upload_url, { method: "PUT", body: readFileSync(file), headers: { "content-type": MIME[ext] || "application/octet-stream" } });
  if (!put.ok) throw new Error(`upload PUT ${put.status} for ${basename(file)}`);
  return item.file_path;
}

// ---------- sessions ----------
const cache = {};
function load(sid) {
  if (!cache[sid]) {
    const f = join(SESSIONS, sid, "session.json");
    if (!existsSync(f)) throw Object.assign(new Error("no session " + sid), { code: 404 });
    cache[sid] = JSON.parse(readFileSync(f, "utf8"));
  }
  return cache[sid];
}
function save(s) { writeFileSync(join(SESSIONS, s.id, "session.json"), JSON.stringify(s, null, 2)); }
function newSession(label) {
  const id = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "").replace(/^(\d{8})/, "$1-") + (label ? "-" + label.replace(/[^a-z0-9]+/gi, "-").toLowerCase() : "");
  mkdirSync(join(SESSIONS, id, "media"), { recursive: true });
  const s = { id, created: new Date().toISOString(), final: null, nodes: [] };
  cache[id] = s; save(s); return s;
}
const mediaPath = (s, f) => join(SESSIONS, s.id, "media", f);
const nextId = (s) => "n" + (s.nodes.length + 1);

// ---------- refs: "@n3", "@n3.1", "@n3:first", "@n3.1:last" ----------
const REF = /^@(n\d+)(?:\.(\d+))?(?::(first|last))?$/;
function parseRef(v) { const m = typeof v === "string" && v.trim().match(REF); return m && { node: m[1], out: Number(m[2] || 0), mode: m[3] || "full" }; }
function collectRefs(value, field = "", acc = []) {
  if (Array.isArray(value)) value.forEach((v, i) => collectRefs(v, `${field}[${i}]`, acc));
  else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) collectRefs(v, field ? `${field}.${k}` : k, acc);
  else { const r = parseRef(value); if (r) acc.push({ field, ref: value.trim(), ...r }); }
  return acc;
}
function refOutput(s, r) {
  const n = s.nodes.find((x) => x.id === r.node);
  const o = n?.outputs?.[r.out];
  if (!o) throw new Error(`ref @${r.node}.${r.out} has no output`);
  return o;
}
// Local file for a ref: the output itself, or its first/last frame (extracted once with ffmpeg).
function refFile(s, r) {
  const o = refOutput(s, r);
  if (r.mode === "full") return o.file;
  const frame = `${r.node}-${r.out}-${r.mode}.png`;
  if (!existsSync(mediaPath(s, frame))) {
    const src = mediaPath(s, o.file);
    const args = r.mode === "first" ? ["-y", "-i", src, "-frames:v", "1", mediaPath(s, frame)] : ["-y", "-sseof", "-1", "-i", src, "-update", "1", "-q:v", "1", mediaPath(s, frame)];
    execFileSync("ffmpeg", ["-loglevel", "error", ...args]);
  }
  return frame;
}
async function refToMH(s, r) {
  const o = refOutput(s, r);
  o.mh = o.mh || {};
  if (r.mode === "full" && o.mhPath) return o.mhPath; // face-detection outputs already live on Magic Hour
  const cached = o.mh[r.mode];
  if (cached && Date.now() - cached.at < 6 * 86400e3) return cached.path; // uploads expire after 7 days
  const path = await uploadToMH(mediaPath(s, refFile(s, r)));
  o.mh[r.mode] = { path, at: Date.now() }; save(s);
  return path;
}
async function resolve(s, value) {
  if (Array.isArray(value)) return Promise.all(value.map((v) => resolve(s, v)));
  if (value && typeof value === "object") { const o = {}; for (const [k, v] of Object.entries(value)) o[k] = await resolve(s, v); return o; }
  const r = parseRef(value);
  return r ? refToMH(s, r) : value;
}
// A filled file path implies the matching *_source enum is "file".
function fixSources(body) {
  const a = body.assets;
  if (!a) return;
  if (a.video_file_path && !a.video_source) a.video_source = "file";
  if (a.audio_file_path && (!a.audio_source || a.audio_source === "none")) a.audio_source = "file";
  if (a.youtube_url && !a.video_file_path && !a.video_source) a.video_source = "youtube";
}

// ---------- run a tool ----------
async function execute(s, node) {
  const tool = TOOLS[node.tool];
  try {
    if (!node.mhId) {
      node.status = "uploading"; save(s);
      const body = await resolve(s, node.body);
      fixSources(body);
      node.request = body;
      const created = await mh("POST", tool.path, body);
      Object.assign(node, { mhId: created.id, credits: created.credits_charged, status: "running" }); save(s);
    }
    for (;;) {
      await sleep(tool.kind === "video" ? 6000 : 3000);
      const p = await mh("GET", STATUS_PATH[tool.kind] + node.mhId);
      node.mhStatus = p.status;
      if (p.status === "complete") {
        node.response = p;
        node.credits = p.credits_charged ?? node.credits;
        const items = tool.kind === "faces" ? p.faces.map((f) => ({ url: f.url, mhPath: f.path })) : (p.downloads || []).map((d) => ({ url: d.url }));
        node.outputs = [];
        for (const [i, it] of items.entries()) {
          const ext = extOf(new URL(it.url).pathname) || (tool.kind === "audio" ? "mp3" : tool.kind === "video" ? "mp4" : "png");
          const file = `${node.id}-${i}.${ext}`;
          const res = await fetch(it.url);
          if (!res.ok) throw new Error(`download ${res.status} ${it.url}`);
          writeFileSync(mediaPath(s, file), Buffer.from(await res.arrayBuffer()));
          node.outputs.push({ file, kind: kindOf(file), url: it.url, ...(it.mhPath && { mhPath: it.mhPath }) });
        }
        node.status = "complete"; break;
      }
      if (p.status === "error" || p.status === "canceled") { node.response = p; throw new Error(`job ${p.status}: ${JSON.stringify(p.error)}`); }
      save(s);
    }
  } catch (e) {
    node.status = "error"; node.error = String(e.message || e);
  }
  node.finishedAt = new Date().toISOString();
  node.seconds = Math.round((Date.parse(node.finishedAt) - Date.parse(node.createdAt)) / 1000);
  save(s);
}

// Resume polling for jobs that were running when the server stopped.
for (const sid of readdirSync(SESSIONS)) {
  try { const s = load(sid); for (const n of s.nodes) if (n.mhId && !["complete", "error"].includes(n.status)) execute(s, n); } catch {}
}

// ---------- HTTP ----------
const json = (res, code, data) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(data)); };
const readBody = (req) => new Promise((ok, bad) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => ok(Buffer.concat(c))); req.on("error", bad); });
function sendFile(req, res, file) {
  if (!existsSync(file)) return json(res, 404, { error: "not found" });
  const size = statSync(file).size, type = MIME[extOf(file)] || "application/octet-stream";
  const m = (req.headers.range || "").match(/bytes=(\d*)-(\d*)/);
  if (m) { // range support so <video> can seek
    const start = m[1] ? Number(m[1]) : 0, end = m[2] ? Number(m[2]) : size - 1;
    res.writeHead(206, { "content-type": type, "content-range": `bytes ${start}-${end}/${size}`, "accept-ranges": "bytes", "content-length": end - start + 1 });
    return createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { "content-type": type, "content-length": size, "accept-ranges": "bytes" });
  createReadStream(file).pipe(res);
}
const readDefaults = () => (existsSync(DEFAULTS) ? JSON.parse(readFileSync(DEFAULTS, "utf8")) : {});

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    const p = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
    if (req.method === "GET" && p.length === 0) return sendFile(req, res, join(ROOT, "index.html"));
    if (p[0] === "media") return sendFile(req, res, join(SESSIONS, basename(p[1]), "media", basename(p[2])));
    if (p[0] !== "api") return json(res, 404, { error: "not found" });

    if (p[1] === "tools") return json(res, 200, Object.values(TOOLS));
    if (p[1] === "account") return json(res, 200, await mh("GET", "/v1/account"));
    if (p[1] === "defaults") return json(res, 200, readDefaults());
    if (p[1] === "sessions" && p.length === 2) {
      if (req.method === "POST") return json(res, 200, newSession(JSON.parse((await readBody(req)).toString() || "{}").label));
      return json(res, 200, readdirSync(SESSIONS).filter((d) => existsSync(join(SESSIONS, d, "session.json"))).sort().reverse());
    }
    const s = load(p[2]);
    if (p.length === 3) return json(res, 200, s);
    if (p[3] === "run" && req.method === "POST") {
      const { tool, body } = JSON.parse((await readBody(req)).toString());
      if (!TOOLS[tool]) return json(res, 400, { error: "unknown tool " + tool });
      for (const r of collectRefs(body)) refOutput(s, r); // fail fast on a bad ref
      const node = { id: nextId(s), tool, title: TOOLS[tool].title, kind: TOOLS[tool].kind, body, inputs: collectRefs(body), status: "queued", createdAt: new Date().toISOString(), outputs: [] };
      s.nodes.push(node); save(s);
      const d = readDefaults(); d[tool] = body; d._lastTool = tool; writeFileSync(DEFAULTS, JSON.stringify(d, null, 2));
      execute(s, node);
      return json(res, 200, node);
    }
    if (p[3] === "upload" && req.method === "POST") {
      const name = basename(url.searchParams.get("name") || "upload.bin");
      const node = { id: nextId(s), tool: "upload", title: "Upload", kind: kindOf(name), body: { name }, inputs: [], status: "complete", createdAt: new Date().toISOString(), outputs: [] };
      const file = `${node.id}-0.${extOf(name)}`;
      writeFileSync(mediaPath(s, file), await readBody(req));
      node.outputs.push({ file, kind: kindOf(file) });
      s.nodes.push(node); save(s);
      return json(res, 200, node);
    }
    if (p[3] === "frame") { // local preview for a ref (frames extracted on demand)
      const r = parseRef(url.searchParams.get("ref"));
      if (!r) return json(res, 400, { error: "bad ref" });
      return json(res, 200, { file: refFile(s, r), kind: r.mode === "full" ? refOutput(s, r).kind : "image" });
    }
    if (p[3] === "final" && req.method === "PUT") {
      s.final = JSON.parse((await readBody(req)).toString()).node || null; save(s);
      return json(res, 200, s);
    }
    json(res, 404, { error: "not found" });
  } catch (e) {
    json(res, e.code === 404 ? 404 : 500, { error: String(e.message || e) });
  }
}).listen(PORT, () => console.log(`playground → http://localhost:${PORT}`));
