// A stand-in Magic Hour on 127.0.0.1, for tests of the execution side (after Imagination Studio's dry studio): the
// same routes the client in lib/magichour.js calls, answered at once, with real small media files to download, so the
// executor, the paid gate, the ledger and the step checks all run as they would against the real service, in seconds
// and for nothing. Nothing here knows the executor: it is a server with a scriptable job table.
//
//   const fake = await startFake();           // fake.url → MAGIC_HOUR_BASE
//   fake.script.push({ match: /image-to-video/, error: "content filter" });    // the next job on that route errors
//   fake.script.push({ match: /image-generator/, polls: 2 });                  // complete on the third GET
//   fake.script.push({ match: /upscaler/, tiny: true });                       // a download under 1 KB (an empty file)
//   fake.script.push({ match: /upload-urls/, uploadStatus: 500 });             // the PUT of the next upload fails
//   fake.jobs, fake.uploads, fake.requests                                      // what happened
//   fake.seed({ endpoint, kind, credits })                                      // a finished job nobody polled (a crash to resume from)
import { createServer } from "node:http";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Credits as the real service charges them, where the test needs a figure (lib/models.js has the registry).
const CREDITS = [[/ai-image-generator|ai-image-editor/, 5], [/image-to-video|text-to-video/, 120], [/ai-music-generator/, (b) => Number(b.duration) || 30], [/auto-subtitle/, (b) => Math.round(4.8 * (Number(b.end_seconds) || 10))],
  [/image-upscaler/, 25], [/background-remover/, 5], [/face-swap-photo/, 10], [/face-swap$/, (b) => 30 * (Number(b.end_seconds) || 5)], [/lip-sync|talking-photo|character-replace/, (b) => 48 * (Number(b.end_seconds) || 5)]];
const creditsFor = (endpoint, body) => { const hit = CREDITS.find(([re]) => re.test(endpoint)); const c = hit ? hit[1] : 1; return typeof c === "function" ? c(body) : c; };

export async function startFake() {
  const dir = mkdtempSync(join(tmpdir(), "fake-mh-"));
  // the media the jobs hand back: a picture, a clip with a sound track, a music file
  const media = { png: join(dir, "out.png"), mp4: join(dir, "out.mp4"), mp3: join(dir, "out.mp3") };
  const ff = (args) => execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args]);
  ff(["-f", "lavfi", "-i", "color=c=0x8844aa:s=640x384", "-frames:v", "1", media.png]);
  ff(["-f", "lavfi", "-i", "testsrc=s=788x480:r=24:d=5", "-f", "lavfi", "-i", "sine=f=440:d=5", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", media.mp4]);
  ff(["-f", "lavfi", "-i", "sine=f=220:d=15", "-c:a", "libmp3lame", "-q:a", "6", media.mp3]);
  // what a test hands in as the user's materials: different bytes from what the jobs return, so an output that merely
  // copies its input is caught by the step check, and two inputs never share one upload (uploads are deduplicated by hash)
  const fixtures = { photo: join(dir, "photo.png"), face: join(dir, "face.png"), clip: join(dir, "clip.mp4") };
  ff(["-f", "lavfi", "-i", "color=c=0xdd7733:s=640x360", "-frames:v", "1", fixtures.photo]);
  ff(["-f", "lavfi", "-i", "color=c=0x33aa55:s=512x512", "-frames:v", "1", fixtures.face]);
  ff(["-f", "lavfi", "-i", "smptebars=s=640x360:r=24:d=5", "-f", "lavfi", "-i", "sine=f=880:d=5", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-shortest", fixtures.clip]);
  const state = { jobs: [], uploads: {}, requests: [], script: [], faces: 1 };
  let n = 0; const id = (p) => `${p}_${(++n).toString(36).padStart(4, "0")}`;
  const take = (re) => { const k = state.script.findIndex((s) => s.match.test(re)); return k < 0 ? {} : state.script.splice(k, 1)[0]; };
  const kindOf = (endpoint) => (/video|face-swap$|lip-sync|talking|character|subtitle/.test(endpoint) ? "video" : /music|voice|audio/.test(endpoint) ? "audio" : "image");
  const extOf = (kind) => (kind === "video" ? "mp4" : kind === "audio" ? "mp3" : "png");

  const server = createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c); const raw = Buffer.concat(chunks); let body = {}; try { body = raw.length ? JSON.parse(raw.toString()) : {}; } catch {}
    const url = new URL(req.url, "http://x"); const p = url.pathname; state.requests.push({ method: req.method, path: p, body });
    const json = (code, data) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(data)); };
    // uploads: a URL to PUT to, then the bytes kept under the file_path handed back
    if (req.method === "POST" && p === "/v1/files/upload-urls") { const sc = take(p); const items = (body.items || []).map((it) => { const k = id("up"); state.uploads[k] = { type: it.type, extension: it.extension, bytes: null, status: sc.uploadStatus || 200 }; return { upload_url: `${state.url}/upload/${k}`, file_path: `api-assets/${k}.${it.extension}` }; }); return json(200, { items }); }
    if (req.method === "PUT" && p.startsWith("/upload/")) { const k = p.split("/")[2]; const u = state.uploads[k]; if (!u) return json(404, {}); if (u.status !== 200) return json(u.status, { error: "upload refused by the test script" }); u.bytes = raw.length; return json(200, {}); }
    // face detection: a job that completes at once with `faces` faces
    if (req.method === "POST" && p === "/v1/face-detection") { const j = { id: id("fd"), endpoint: p, body, status: "complete", faces: Array.from({ length: state.faces }, (_, k) => ({ path: `api-assets/face${k + 1}.png`, url: `${state.url}/download/png` })) }; state.jobs.push(j); return json(200, { id: j.id }); }
    if (req.method === "GET" && p.startsWith("/v1/face-detection/")) { const j = state.jobs.find((x) => x.id === p.split("/")[3]); return j ? json(200, { status: j.status, faces: j.faces }) : json(404, {}); }
    // a job's state: queued for `polls` looks, then complete (or error)
    const m = p.match(/^\/v1\/(image|video|audio)-projects\/([^/]+)$/);
    if (req.method === "GET" && m) { const j = state.jobs.find((x) => x.id === m[2]); if (!j) return json(404, { message: "no such project" }); j.looks++; if (j.looks <= j.polls) return json(200, { status: "rendering", credits_charged: j.credits }); if (j.error) return json(200, { status: "error", error: { message: j.error }, credits_charged: 0 }); return json(200, { status: "complete", credits_charged: j.credits, downloads: [{ url: `${state.url}/download/${j.tiny ? "tiny" : extOf(j.kind)}` }] }); }
    // the media
    if (req.method === "GET" && p.startsWith("/download/")) { const what = p.split("/")[2]; if (what === "tiny") { res.writeHead(200, { "content-type": "application/octet-stream" }); return res.end(Buffer.alloc(100)); } const f = media[what]; if (!f) return json(404, {}); res.writeHead(200, { "content-type": what === "png" ? "image/png" : what === "mp4" ? "video/mp4" : "audio/mpeg" }); return res.end(readFileSync(f)); }
    // any other POST under /v1 creates a job
    if (req.method === "POST" && p.startsWith("/v1/")) { const sc = take(p); if (sc.status && sc.status !== 200) return json(sc.status, { message: sc.message || "refused by the test script" }); const kind = kindOf(p); const j = { id: id("job"), endpoint: p, body, kind, credits: sc.credits ?? creditsFor(p, body), polls: sc.polls || 0, looks: 0, error: sc.error || null, tiny: !!sc.tiny, at: Date.now() }; state.jobs.push(j); return json(200, { id: j.id, credits_charged: j.credits }); }
    json(404, { message: `the fake knows no ${req.method} ${p}` });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  state.url = `http://127.0.0.1:${server.address().port}`;
  state.close = () => new Promise((r) => server.close(r));
  state.seed = ({ endpoint = "/v1/image-to-video", kind = "video", credits = 120 } = {}) => { const j = { id: id("job"), endpoint, body: {}, kind, credits, polls: 0, looks: 0, error: null, tiny: false, seeded: true, at: Date.now() }; state.jobs.push(j); return j.id; };
  state.media = media; state.fixtures = fixtures; state.dir = dir;
  return state;
}

// Standalone, for a look by hand: node V2/tests/fake-magichour.mjs → prints the URL and serves until Ctrl-C.
if (process.argv[1] && process.argv[1].endsWith("fake-magichour.mjs")) { const f = await startFake(); console.log(`fake Magic Hour at ${f.url} (MAGIC_HOUR_BASE=${f.url} MAGIC_HOUR_API_KEY=test)`); }
