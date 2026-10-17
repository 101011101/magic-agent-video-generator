// Magic Hour REST client: create a job, poll it, download the output; upload a local file.
// A POST is never retried: the server may already have started (and charged) the job.
import { readFileSync, writeFileSync } from "node:fs";
import { key } from "./env.js";

const BASE = "https://api.magichour.ai";

async function request(method, path, body) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${BASE}${path}`, { method, headers: { authorization: `Bearer ${key("MAGIC_HOUR_API_KEY")}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined })
      .catch((e) => { if (method !== "GET" || attempt === 3) throw e; return null; });
    if (!res) { await new Promise((r) => setTimeout(r, 8000 * attempt)); continue; }
    const data = await res.json().catch(() => ({}));
    if (res.ok) return data;
    if (method !== "GET" || !(res.status === 429 || res.status >= 500) || attempt === 3) throw new Error(`Magic Hour ${method} ${path} → HTTP ${res.status}: ${JSON.stringify(data).slice(0, 400)}`);
    await new Promise((r) => setTimeout(r, 5000 * attempt));
  }
}

// Returns { id, credits, url, seconds }. kind picks the status path: image-projects or video-projects.
export async function runJob(endpoint, body, { kind = "image", timeoutS = kind === "video" ? 2700 : 900 } = {}) {
  const t0 = Date.now();
  const { id, credits_charged } = await request("POST", endpoint, body);
  for (;;) {
    await new Promise((r) => setTimeout(r, kind === "video" ? 6000 : 3000));
    const p = await request("GET", `/v1/${kind}-projects/${id}`);
    if (p.status === "complete") return { id, credits: p.credits_charged ?? credits_charged, url: p.downloads?.[0]?.url, seconds: Math.round((Date.now() - t0) / 1000) };
    if (p.status === "error" || p.status === "canceled") throw new Error(`Magic Hour job ${id} ${p.status}: ${JSON.stringify(p.error).slice(0, 300)}`);
    if ((Date.now() - t0) / 1000 > timeoutS) throw new Error(`Magic Hour job ${id} timed out (${p.status})`);
  }
}

export async function download(url, file) {
  for (let a = 1; ; a++) {
    const res = await fetch(url).catch((e) => { if (a === 3) throw e; return null; });
    if (res?.ok) { writeFileSync(file, Buffer.from(await res.arrayBuffer())); return file; }
    if (a === 3) throw new Error(`download ${res?.status} ${url}`);
    await new Promise((r) => setTimeout(r, 5000 * a));
  }
}

export async function upload(file) {
  const ext = file.split(".").pop().toLowerCase();
  const { items: [item] } = await request("POST", "/v1/files/upload-urls", { items: [{ type: "image", extension: ext }] });
  const put = await fetch(item.upload_url, { method: "PUT", body: readFileSync(file), headers: { "content-type": `image/${ext === "jpg" ? "jpeg" : ext}` } });
  if (!put.ok) throw new Error(`upload PUT ${put.status} for ${file}`);
  return item.file_path;
}
