// Minimal Magic Hour REST client: create a job, poll it, download the outputs.
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { TESTS } from "./paths.js";

const BASE = "https://api.magichour.ai";

function apiKey() {
  if (process.env.MAGIC_HOUR_API_KEY) return process.env.MAGIC_HOUR_API_KEY.trim();
  const f = join(TESTS, ".env");
  if (existsSync(f)) { const m = readFileSync(f, "utf8").match(/^MAGIC_HOUR_API_KEY=(.+)$/m); if (m) return m[1].trim(); }
  throw new Error("MAGIC_HOUR_API_KEY not set (env or current/tests/state-manager/.env)");
}

async function request(method, path, body) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    // A network error on a GET (polling) is retried; a POST is not, since it may have created a paid job.
    const res = await fetch(`${BASE}${path}`, {
      method, headers: { authorization: `Bearer ${apiKey()}`, "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    }).catch((e) => { if (method !== "GET" || attempt === 3) throw e; return null; });
    if (!res) { await new Promise((r) => setTimeout(r, 10000 * attempt)); continue; }
    const data = await res.json().catch(() => ({}));
    if (res.ok) return data;
    if (!(res.status === 429 || res.status >= 500) || attempt === 3) throw new Error(`Magic Hour ${method} ${path} → HTTP ${res.status}: ${JSON.stringify(data).slice(0, 500)}`);
    await new Promise((r) => setTimeout(r, 5000 * attempt));
  }
}

// kind: "image" | "video". Returns { id, credits, downloads: [url], seconds }.
export async function runJob(endpoint, body, kind, { timeoutS = 1200 } = {}) {
  const t0 = Date.now();
  const created = await request("POST", endpoint, body);
  const id = created.id;
  const statusPath = kind === "image" ? `/v1/image-projects/${id}` : `/v1/video-projects/${id}`;
  for (;;) {
    await new Promise((r) => setTimeout(r, kind === "image" ? 3000 : 6000));
    const p = await request("GET", statusPath);
    if (p.status === "complete") return { id, credits: p.credits_charged ?? created.credits_charged, downloads: (p.downloads || []).map((d) => d.url), seconds: Math.round((Date.now() - t0) / 1000) };
    if (p.status === "error" || p.status === "canceled") throw new Error(`Magic Hour job ${id} ${p.status}: ${JSON.stringify(p.error).slice(0, 400)}`);
    if ((Date.now() - t0) / 1000 > timeoutS) throw new Error(`Magic Hour job ${id} timed out (last status ${p.status})`);
  }
}

export async function download(url, file) {
  let res; for (let a = 1; ; a++) { try { res = await fetch(url); break; } catch (e) { if (a === 3) throw e; await new Promise((r) => setTimeout(r, 10000 * a)); } }
  if (!res.ok) throw new Error(`download ${res.status} ${url}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return file;
}

// Uploads a local file to Magic Hour storage and returns its file_path (usable wherever an asset URL is accepted).
export async function uploadFile(file, type = "image") {
  const ext = file.split(".").pop().toLowerCase();
  const res = await request("POST", "/v1/files/upload-urls", { items: [{ type, extension: ext }] });
  const item = res.items[0];
  const put = await fetch(item.upload_url, { method: "PUT", body: readFileSync(file), headers: { "content-type": type === "image" ? `image/${ext === "jpg" ? "jpeg" : ext}` : `${type}/${ext}` } });
  if (!put.ok) throw new Error(`upload PUT ${put.status} for ${file}`);
  return item.file_path;
}
