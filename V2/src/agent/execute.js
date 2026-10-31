// The real executor (T-038, T-044): walks a plan in dependency order and calls Magic Hour through lib/jobs.js, so the
// credit cap, the ledger, the signature cache and resumption all apply. The session is the run: its folder holds the
// materials and the assets, exec.json is the job log the ledger books under "session-<id>". A film tree hands the six
// stage nodes to pipeline.mjs as one run under runs/<label>; the nodes follow the run's record as it fills.
// Tools without a wired endpoint fall back to a placeholder (simulate.js) and say so on the node.
import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";
import { spawn } from "node:child_process";
import { Jobs } from "../lib/jobs.js";
import { runJob } from "../lib/magichour.js";
import { STILLS, VIDEOS, stillCost, videoRate } from "../lib/models.js";
import { duration } from "../lib/media.js";
import { V2, RUNS } from "../lib/env.js";
import { order, placeholder } from "./simulate.js";

const WIRED = new Set(["image", "image-edit", "image-to-video", "text-to-video", "music", "face-swap-photo", "background-remove", "upscale-image", "captions", "story", "assets", "screenplay", "keyframes", "clips", "film"]);
const FILM = ["story", "assets", "screenplay", "keyframes", "clips", "film"];
const grid = (model, s) => { const g = VIDEOS[model]?.grid || [5]; return g.includes(s) ? s : g.reduce((a, b) => (Math.abs(b - s) < Math.abs(a - s) ? b : a)); };

export async function execute(plan, dir, { id, tier = "free", sheet = null, brief = "", say = () => {}, onStep = () => {}, only = null } = {}) {
  mkdirSync(join(dir, "assets"), { recursive: true });
  const logFile = join(dir, "exec.json");
  const run = { name: `session-${id}`, path: (f) => join(dir, f), log: existsSync(logFile) ? JSON.parse(readFileSync(logFile, "utf8")) : { jobs: {}, pending: {}, calls: [] }, save: () => writeFileSync(logFile, JSON.stringify(run.log, null, 2)) };
  run.log.jobs ??= {}; run.log.pending ??= {}; run.log.calls ??= [];
  const jobs = new Jobs(run);
  const by = {}; plan.steps.forEach((s, i) => (by[s.produces] = i));
  const file = (name) => { const i = by[name]; if (i !== undefined && plan.steps[i].output) return plan.steps[i].output; if (existsSync(join(dir, "materials", name))) return `materials/${name}`; if (plan.dir && existsSync(join(dir, "assets", plan.dir, name))) return `assets/${plan.dir}/${name}`; if (existsSync(join(dir, "assets", name))) return `assets/${name}`; return null; };
  const sub = plan.dir ? `assets/${plan.dir}` : "assets"; mkdirSync(join(dir, sub), { recursive: true });
  const out = (s, ext) => `${sub}/${s.produces.replace(/\.[a-z0-9]+$/i, "")}${s.attempt ? `-r${s.attempt}` : ""}.${ext}`;
  const set = (i, patch) => { Object.assign(plan.steps[i], patch); onStep(i, plan.steps[i]); };
  let filmStarted = false;
  // everything that will run and whose inputs are not made yet waits, visibly, until its turn
  const todo = order(plan.steps).filter((i) => (!only || only.includes(i)) && !["skipped", "paused", "done"].includes(plan.steps[i].state) || (only && only.includes(i) && plan.steps[i].state === "stale"));
  for (const i of todo) { const s = plan.steps[i]; const ready = s.inputs.every((n) => by[n] === undefined || plan.steps[by[n]].state === "done"); if (!ready) set(i, { state: "waiting" }); }
  for (const i of order(plan.steps)) {
    const s = plan.steps[i]; if (only && !only.includes(i)) continue; if (s.state === "skipped" || s.state === "paused") continue;
    const key = `t${plan.turn ?? 0}-s${i}-${s.tool}${s.attempt ? `-r${s.attempt}` : ""}`;
    try {
      if (FILM.includes(s.tool)) { if (!filmStarted) { filmStarted = true; await film(plan, dir, { id, tier, brief, sheet, set, say }); } continue; }
      set(i, { state: "running", started_at: Date.now() });
      if (!WIRED.has(s.tool)) { const f = out(s, "svg"); writeFileSync(join(dir, f), placeholder(s, i)); set(i, { state: "done", output: f, simulated: true, note: `${s.tool} has no wired endpoint yet; placeholder` }); continue; }
      const inputs = s.inputs.map((n) => ({ name: n, file: file(n) })).filter((x) => x.file);
      // an input that is not a file and not something a node made is text the planner misplaced: it goes into the prompt
      const missing = s.inputs.filter((n) => !file(n)); const words = missing.filter((n) => !/\.[a-z0-9]{2,4}$/i.test(n)); const lost = missing.filter((n) => /\.[a-z0-9]{2,4}$/i.test(n));
      if (words.length) { s.params.prompt_or_change = `${s.params.prompt_or_change} The text "${words.join('", "')}" appears in the picture.`; s.inputs = s.inputs.filter((n) => !words.includes(n)); set(i, { note: `text moved into the prompt: ${words.join(", ")}` }); }
      if (lost.length && !["image", "music", "text-to-video"].includes(s.tool)) throw new Error(`missing input ${lost.join(", ")}`);
      let r;
      if (s.tool === "image" || s.tool === "image-edit") {
        const f = out(s, "png"); const model = s.model || (tier === "paid" ? "nano-banana-pro" : "flux-2-klein"); const res = s.resolution || (STILLS[model]?.resolutions || ["640px"])[0];
        const gen = !inputs.length; const asp = s.params.aspect && (gen ? ["1:1", "16:9", "9:16"].includes(s.params.aspect) : true) ? s.params.aspect : gen ? (s.params.aspect === "4:5" || s.params.aspect === "4:3" ? "1:1" : "16:9") : null;
        r = await jobs.image(key, f, s.params.prompt_or_change, inputs.map((x) => x.file), { model, resolution: res, ...(asp ? { aspect_ratio: asp } : {}) });
        set(i, { state: "done", output: f, credits_spent: r.credits, cached: !!r.cached, error: null });
      } else if (s.tool === "image-to-video") {
        const f = out(s, "mp4"); const model = s.model || "minimax-h3"; const res = s.resolution || "480p"; const sec = grid(model, Number(s.params.seconds) || 5);
        const pics = inputs.filter((x) => /\.(png|jpe?g|webp)$/i.test(x.file)); if (!pics.length) throw new Error("image-to-video needs a picture");
        r = await jobs.video(key, f, s.params.prompt_or_change, pics[0].file, pics[1]?.file || null, sec, { model, resolution: res, audio: true });
        set(i, { state: "done", output: f, credits_spent: r.credits, cached: !!r.cached, error: null });
      } else if (s.tool === "text-to-video") {
        const f = out(s, "mp4"); const model = s.model || "minimax-h3"; const res = s.resolution || "480p"; const sec = grid(model, Number(s.params.seconds) || 5);
        const refs = inputs.slice(0, VIDEOS[model]?.maxRefs || 9).map((x) => { let n = x.name.replace(/\.[a-z0-9]+$/i, "").replace(/[^A-Za-z0-9_-]/g, "_"); if (!/^[A-Za-z]/.test(n)) n = "r_" + n; return { name: n, file: x.file }; });
        let prompt = s.params.prompt_or_change; for (const rf of refs) if (!prompt.includes(`@${rf.name}`)) prompt += ` @${rf.name}`;
        r = await jobs.tvideo(key, f, prompt, refs, sec, { model, resolution: res, audio: true, ...(s.params.aspect ? { aspect_ratio: s.params.aspect } : {}) });
        set(i, { state: "done", output: f, credits_spent: r.credits, cached: !!r.cached, error: null });
      } else if (s.tool === "music") {
        const f = out(s, "mp3"); const sec = Math.round(Math.max(15, Math.min(300, Number(s.params.seconds) || 30)));
        r = await jobs.music(key, f, s.params.prompt_or_change, sec); set(i, { state: "done", output: f, credits_spent: r.credits, cached: !!r.cached, error: null });
      } else {
        // generic endpoints through paid(): the body per the API sheet
        const spec = { "face-swap-photo": { endpoint: "/v1/face-swap-photo", cost: 10, ext: "png", body: (p) => ({ assets: { target_file_path: p[0], source_file_path: p[1], face_swap_mode: "all-faces" } }) },
          "background-remove": { endpoint: "/v1/image-background-remover", cost: 5, ext: "png", body: (p) => ({ assets: { image_file_path: p[0], ...(p[1] ? { background_image_file_path: p[1] } : {}) } }) },
          "upscale-image": { endpoint: "/v1/ai-image-upscaler", cost: 25, ext: "png", body: (p) => ({ assets: { image_file_path: p[0] }, scale_factor: 2, style: { mode: "preserve" } }) },
          captions: (() => { let len = Number(s.params.seconds) || 0; try { if (!len && inputs[0]) len = Math.ceil(duration(join(dir, inputs[0].file))); } catch {} len = len || 10; return { endpoint: "/v1/auto-subtitle-generator", cost: Math.round(4.8 * len), ext: "mp4", seconds: len, body: (p) => ({ assets: { video_file_path: p[0] }, start_seconds: 0, end_seconds: len, style: { template: "minimalist" } }) }; })() }[s.tool];
        if (s.tool === "face-swap-photo" && inputs.length < 2) throw new Error("a face swap needs the picture and the face");
        const f = out(s, spec.ext); const kind = spec.ext === "mp4" ? "video" : "image";
        // the target comes first for a swap: the picture, then the face
        const ordered = s.tool === "face-swap-photo" ? [...inputs].sort((a, b) => (/\b(face|me|self|selfie|portrait|headshot)\b/i.test(a.name.replace(/[._-]/g, " ")) ? 1 : 0) - (/\b(face|me|self|selfie|portrait|headshot)\b/i.test(b.name.replace(/[._-]/g, " ")) ? 1 : 0)) : inputs;
        r = await jobs.paid(key, f, { endpoint: spec.endpoint, prompt: s.params.prompt_or_change || "", model: s.tool, seconds: spec.seconds || 0 }, ordered.map((x) => x.file), spec.cost, (paths, onCreate) => runJob(spec.endpoint, { name: `${run.name} ${key}`, ...spec.body(paths) }, { kind, onCreate }));
        set(i, { state: "done", output: f, credits_spent: r.credits, cached: !!r.cached, error: null });
      }
      say(`${s.tool} → ${s.produces}${r?.cached ? " (cached)" : ` (${r?.credits ?? 0} credits)`}`);
    } catch (e) { set(i, { state: "failed", error: String(e.message || e).slice(0, 300) }); say(`${s.tool} failed: ${String(e.message || e).slice(0, 200)}`); break; }
  }
  return plan;
}

// The film tree: one pipeline run. The six nodes follow the run record (story → screenplay → stills → film).
async function film(plan, dir, { id, tier, brief, sheet, set, say }) {
  const idx = Object.fromEntries(plan.steps.map((s, i) => [s.tool, i]));
  const label = plan.steps.find((s) => FILM.includes(s.tool) && s.run)?.run || `session-${id}-${Date.now().toString(36)}`; const rdir = join(RUNS, label);
  const field = (k) => sheet?.fields?.find((f) => f.field === k)?.value || "";
  const secs = Number(plan.steps[idx.clips]?.params?.seconds || plan.steps[idx.film]?.params?.seconds) || Number((field("length_s") || "").match(/\d+/)?.[0]) || 15;
  const args = [join(V2, "src", "pipeline.mjs"), "--brief", brief, "--label", label, "--tier", tier, "--until", "film", "--total", String(secs), "--max", "10"];
  for (const k of FILM) if (idx[k] !== undefined) set(idx[k], { state: "running", run: label });
  say(`film run ${label}: ${secs} s on the ${tier} tier`);
  const child = spawn(process.execPath, args, { cwd: join(V2, ".."), env: { ...process.env, CLEANED_CAP: process.env.CLEANED_CAP || "8000" }, stdio: ["ignore", "pipe", "pipe"] });
  let log = ""; child.stdout.on("data", (d) => { log += d; }); child.stderr.on("data", (d) => { log += d; }); child.on("error", (e) => { log += `\nspawn error: ${e.message}`; });
  const tick = setInterval(() => {
    try {
      const f = join(rdir, "run.json"); if (!existsSync(f)) return; const L = JSON.parse(readFileSync(f, "utf8"));
      const done = (k, cond, output) => { if (idx[k] !== undefined && cond && plan.steps[idx[k]].state !== "done") set(idx[k], { state: "done", output, run: label }); };
      done("story", !!L.story, `../../runs/${label}/run.json#story`); done("assets", !!L.bank && Object.keys(L.bank).length, `../../runs/${label}/roots`); done("screenplay", !!L.script, `../../runs/${label}/screenplay.txt`);
      const painted = Object.values(L.stills || {}).filter((s) => s.file).length, planned = (L.build?.plan || []).length; if (painted && idx.keyframes !== undefined && plan.steps[idx.keyframes].state !== "done") set(idx.keyframes, { state: "running", note: `${painted}${planned ? `/${planned}` : ""} stills painted`, run: label });
      const clipsStarted = (L.build?.made && Object.keys(L.build.made).length) || (L.build?.sequences && Object.keys(L.build.sequences).length);
      done("keyframes", planned && painted >= planned && clipsStarted, `../../runs/${label}/stills`);
      if (clipsStarted && idx.clips !== undefined && plan.steps[idx.clips].state !== "done") set(idx.clips, { state: "running", note: `${Object.keys(L.build.made || L.build.sequences || {}).length} clips`, run: label });
      writeFileSync(join(dir, "exec-film.log"), log);
    } catch {}
  }, 4000);
  await new Promise((ok) => child.on("close", ok)); clearInterval(tick); writeFileSync(join(dir, "exec-film.log"), log);
  const filmFile = ["film-narrated.mp4", "film-music.mp4", "film.mp4", "film-raw.mp4"].map((f) => join(rdir, "clips", f)).find(existsSync);
  if (filmFile) { const f = `assets/${plan.dir ? plan.dir + "/" : ""}${plan.steps[idx.film]?.produces?.replace(/\.[a-z0-9]+$/i, "") || "film"}.mp4`; mkdirSync(join(dir, "assets", plan.dir || ""), { recursive: true }); copyFileSync(filmFile, join(dir, f)); const pages = { keyframes: `../../results/${label}/index.html`, clips: `../../runs/${label}/clips` }; for (const k of FILM) if (idx[k] !== undefined && plan.steps[idx[k]].state !== "done") set(idx[k], { state: "done", run: label, output: pages[k] || `../../runs/${label}/run.json#${k}` }); set(idx.film, { state: "done", output: f, run: label, page: `/results/${label}-film/` }); say(`film done: ${basename(filmFile)}`); }
  else { for (const k of FILM) if (idx[k] !== undefined && plan.steps[idx[k]].state !== "done") set(idx[k], { state: "failed", run: label, error: log.split("\n").filter(Boolean).slice(-3).join(" | ").slice(0, 300) }); say(`film run ${label} stopped before the stitch; see exec-film.log`); }
}
