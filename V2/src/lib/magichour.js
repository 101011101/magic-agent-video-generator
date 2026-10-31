// Magic Hour REST client: create a job, poll it, download the output; upload a local file.
// A POST is never retried: the server may already have started (and charged) the job. onCreate(id) fires as soon as the
// job exists, so the caller can record the id before polling and account for it if the process dies (ticket T-007).
import { readFileSync, writeFileSync } from "node:fs";
import { key } from "./env.js";

const BASE = "https://api.magichour.ai";

// Retries: GETs and idempotent POSTs (asking for an upload URL creates no job and costs nothing) are retried on a network
// error, a 429 or a 5xx, three times with a growing wait; a POST that creates a job is never retried blindly, because a
// 502 after the server accepted it would post and pay twice (the pending record is the way back in). A 502 on upload-urls
// once ended a run at its first paint.
const IDEMPOTENT = new Set(["/v1/files/upload-urls"]);
async function request(method, path, body) {
  const retriable = method === "GET" || IDEMPOTENT.has(path), tries = 4;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${BASE}${path}`, { method, headers: { authorization: `Bearer ${key("MAGIC_HOUR_API_KEY")}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined })
      .catch((e) => { if (!retriable || attempt === tries) throw e; return null; });
    if (!res) { await new Promise((r) => setTimeout(r, 8000 * attempt)); continue; }
    const data = await res.json().catch(() => ({}));
    if (res.ok) return data;
    if (!retriable || !(res.status === 429 || res.status >= 500) || attempt === tries) throw new Error(`Magic Hour ${method} ${path} → HTTP ${res.status}: ${JSON.stringify(data).slice(0, 400)}`);
    await new Promise((r) => setTimeout(r, 5000 * attempt));
  }
}

// Returns { id, credits, url, seconds }. kind picks the status path: image-projects or video-projects.
export async function runJob(endpoint, body, { kind = "image", timeoutS = kind === "video" ? 2700 : 900, onCreate = null } = {}) {
  const { id, credits_charged } = await request("POST", endpoint, body);
  if (onCreate) await onCreate(id, credits_charged);
  return pollJob(id, { kind, timeoutS, credits: credits_charged });
}
// Poll a job that exists until it completes. Used by runJob, and to RESUME a job whose poll was interrupted (its id was
// recorded under pending): the job is never posted twice.
export async function pollJob(id, { kind = "image", timeoutS = kind === "video" ? 2700 : 900, credits = undefined } = {}) {
  const t0 = Date.now();
  for (;;) {
    const p = await request("GET", `/v1/${kind}-projects/${id}`);
    if (p.status === "complete") return { id, credits: p.credits_charged ?? credits, url: p.downloads?.[0]?.url, seconds: Math.round((Date.now() - t0) / 1000) };
    if (p.status === "error" || p.status === "canceled") throw new Error(`Magic Hour job ${id} ${p.status}: ${JSON.stringify(p.error).slice(0, 300)}`);
    if ((Date.now() - t0) / 1000 > timeoutS) throw new Error(`Magic Hour job ${id} timed out (${p.status})`);
    await new Promise((r) => setTimeout(r, kind === "video" ? 6000 : 3000));
  }
}
// One look at a job's state, no waiting.
export async function fetchJob(id, kind = "video") { const p = await request("GET", `/v1/${kind}-projects/${id}`); return { status: p.status, credits: p.credits_charged, url: p.downloads?.[0]?.url }; }

export async function download(url, file) {
  for (let a = 1; ; a++) {
    const res = await fetch(url).catch((e) => { if (a === 3) throw e; return null; });
    if (res?.ok) { writeFileSync(file, Buffer.from(await res.arrayBuffer())); return file; }
    if (a === 3) throw new Error(`download ${res?.status} ${url}`);
    await new Promise((r) => setTimeout(r, 5000 * a));
  }
}

const MEDIA = { mp3: ["audio", "audio/mpeg"], wav: ["audio", "audio/wav"], m4a: ["audio", "audio/mp4"], mp4: ["video", "video/mp4"], mov: ["video", "video/quicktime"] };
export async function upload(file) {
  const ext = file.split(".").pop().toLowerCase(), [type, mime] = MEDIA[ext] || ["image", `image/${ext === "jpg" ? "jpeg" : ext}`];
  const { items: [item] } = await request("POST", "/v1/files/upload-urls", { items: [{ type, extension: ext }] });
  const put = await fetch(item.upload_url, { method: "PUT", body: readFileSync(file), headers: { "content-type": mime } });
  if (!put.ok) throw new Error(`upload PUT ${put.status} for ${file}`);
  return item.file_path;
}
