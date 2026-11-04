// The real executor (T-038, T-044): walks a plan in dependency order and calls Magic Hour through lib/jobs.js, so the
// credit cap, the ledger, the signature cache and resumption all apply. The session is the run: its folder holds the
// materials and the assets, exec.json is the job log the ledger books under "session-<id>". A film tree hands the six
// stage nodes to pipeline.mjs as one run under runs/<label>; the nodes follow the run's record as it fills.
// Tools without a wired endpoint fall back to a placeholder (simulate.js) and say so on the node.
import { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync, readdirSync, renameSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, basename } from "node:path";
import { spawn } from "node:child_process";
import { strayText, misread, fixText, letterModel, realStray } from "../composer/keyframes/buildable.js";
import { Jobs } from "../lib/jobs.js";
import { runJob, upload, detectFaces, download } from "../lib/magichour.js";
import { jsonCall, S } from "../lib/llm.js";
import { STILLS, VIDEOS, TIERS, stillCost, videoRate } from "../lib/models.js";
import { duration, size as imgSize } from "../lib/media.js";
import { V2, RUNS } from "../lib/env.js";
import { order, placeholder } from "./simulate.js";
import { customTool } from "../tools/index.js";
import { WIRED } from "./catalogue.js";
import { stepCheck, goalCheck } from "./facts.js";

// WIRED: the Magic Hour tools the executor can call (catalogue.js; the planner is only offered these and the code tools)
const FILM = ["story", "assets", "screenplay", "keyframes", "clips", "film"];
const grid = (model, s) => { const g = VIDEOS[model]?.grid || [5]; return g.includes(s) ? s : g.reduce((a, b) => (Math.abs(b - s) < Math.abs(a - s) ? b : a)); };

// The free models' "16:9" is 640x384 (5:3) for stills and 788x480 for clips; a made picture or clip is cut to the exact
// aspect asked, by code. A generated clip's own sound is invented (random speech in any language), so it is dropped
// unless the step says "sound: keep" (dialogue or ambience the user asked for in the clip itself).
// A lettered design is PADDED to the size instead of cut (a 4:5 flyer cut from a square lost the ends of its headline):
// the canvas grows in the colour of the picture's edge.
const RATIO = { "1:1": 1, "4:5": 0.8, "5:4": 1.25, "3:4": 0.75, "4:3": 4 / 3, "2:3": 2 / 3, "3:2": 1.5, "9:16": 9 / 16, "16:9": 16 / 9 };
const edgeColor = (file, side) => { const strip = side === "tb" ? "crop=iw:4:0:0" : "crop=4:ih:0:0"; const b = execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", file, "-vf", `${strip},scale=1:1`, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]); return `0x${[...b.subarray(0, 3)].map((x) => x.toString(16).padStart(2, "0")).join("")}`; };
function finish(file, aspect, { video = false, keepSound = true, pad = false } = {}) {
  const r = RATIO[aspect]; let vf = null;
  if (r) { const [W, H] = imgSize(file); if (Math.abs(W / H / r - 1) > 0.01) {
    if (pad && !video) { let w = W, h = H; if (W / H > r) h = Math.round(W / r); else w = Math.round(H * r); w += w % 2; h += h % 2; vf = `pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=${edgeColor(file, h > H ? "tb" : "lr")}`; }
    else { let w = W, h = H; if (W / H > r) w = Math.round(H * r); else h = Math.round(W / r); w -= w % 2; h -= h % 2; vf = `crop=${w}:${h}`; } } }
  if (!vf && (!video || keepSound)) return;
  const tmp = file.replace(/(\.[a-z0-9]+)$/i, "-fit$1");
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", file, ...(vf ? ["-vf", vf] : []), ...(video ? ["-c:v", "libx264", "-crf", "19", "-pix_fmt", "yuv420p", ...(keepSound ? ["-c:a", "copy"] : ["-an"])] : ["-frames:v", "1"]), tmp]);
  renameSync(tmp, file);
}

// One face among several (C14b, C15c): the target's faces are found (free), the vision model is asked one question per
// face picture: which detected face it replaces, from the step's words ("the woman on the right"); the swap then runs in
// individual-faces mode. One face in the target, or no clear answer: null, and the swap stays all-faces.
// Which person a character replace acts on, when the clip has more than one: the vision model answers one question on
// the first frame (how many people; where is the one the step names), and the point goes to the tool (selection_mode
// point). One person, or no clear answer: null, and the tool picks the main person itself.
export async function personPoint(clip, words, dir, key) {
  const f = join(dir, "assets", `${key}-frame0.jpg`); execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-ss", "0.2", "-i", clip, "-frames:v", "1", f]);
  const [W, H] = imgSize(f);
  const r = await jsonCall({ name: "person-point", effort: "low", images: [f], schema: S.obj({ people: S.int, found: S.bool, x: S.num, y: S.num, who: S.str }),
    prompt: `This is the first frame of a clip, ${W}x${H} pixels. THE INSTRUCTION: ${words}\npeople: how many people are visible. found: whether one of them is clearly the person the instruction wants replaced. x, y: the centre of that person's face as fractions of the width and height (0-1, from the top left). who: a few words describing them.` });
  if (r.people < 2 || !r.found) return null;
  return { points: [{ position_x: Math.round(r.x * W), position_y: Math.round(r.y * H), time_seconds: 0 }], who: r.who, people: r.people };
}

export async function faceMappings(target, faces, words, dir, key) {
  const up = await upload(target); const found = await detectFaces(up); if (found.length < 2) return null;
  const crops = []; for (const [k, f] of found.slice(0, 6).entries()) { const c = join(dir, "assets", `${key}-face${k + 1}.jpg`); await download(f.url, c); crops.push(c); }
  const pics = [target, ...crops, ...faces.map((x) => x.file)];
  const r = await jsonCall({ name: "face-mapping", effort: "low", images: pics, schema: S.obj({ pairs: S.arr(S.obj({ face_picture: S.int, detected_face: S.int, why: S.str })) }),
    prompt: `Image 1 is the target. Images 2-${crops.length + 1} are the faces detected in it (detected face 1 = image 2, and so on). Images ${crops.length + 2}-${pics.length} are the new face pictures (face picture 1 = image ${crops.length + 2}, and so on).\nTHE INSTRUCTION: ${words}\nFor each new face picture, which detected face does it replace? Follow the instruction (position, who it names); if it does not say, match by who looks most alike (sex, age). Each detected face at most once; leave a face picture out if it replaces none.` });
  const maps = r.pairs.filter((p) => found[p.detected_face - 1] && faces[p.face_picture - 1]).map((p) => ({ original_face: found[p.detected_face - 1].path, k: p.face_picture - 1, why: p.why }));
  return maps.length ? { maps, found: found.length } : null;
}

export async function execute(plan, dir, { id, tier = "free", sheet = null, brief = "", say = () => {}, onStep = () => {}, only = null, assets = [] } = {}) {
  mkdirSync(join(dir, "assets"), { recursive: true });
  const logFile = join(dir, "exec.json");
  const run = { name: `session-${id}`, path: (f) => join(dir, f), log: existsSync(logFile) ? JSON.parse(readFileSync(logFile, "utf8")) : { jobs: {}, pending: {}, calls: [] }, save: () => writeFileSync(logFile, JSON.stringify(run.log, null, 2)) };
  run.log.jobs ??= {}; run.log.pending ??= {}; run.log.calls ??= [];
  const jobs = new Jobs(run);
  const by = {}; plan.steps.forEach((s, i) => (by[s.produces] = i));
  const stem = (n) => n.replace(/\.[a-z0-9]+$/i, "");
  const variants = (n) => [n, ...["png", "jpg", "jpeg", "mp4", "mp3", "txt", "json", "svg"].map((e) => `${stem(n)}.${e}`)];
  const file = (name) => {
    const i = by[name]; if (i !== undefined && plan.steps[i].output) return plan.steps[i].output;
    const known = (assets || []).find((a) => a.label === name && a.file && existsSync(join(dir, a.file))); if (known) return known.file;   // what the session says was made
    for (const v of variants(name)) { if (existsSync(join(dir, "materials", v))) return `materials/${v}`; if (plan.dir && existsSync(join(dir, "assets", plan.dir, v))) return `assets/${plan.dir}/${v}`; if (existsSync(join(dir, "assets", v))) return `assets/${v}`; }
    try { for (const d of readdirSync(join(dir, "assets"))) for (const v of variants(name)) { const cand = join(dir, "assets", d, v); if (existsSync(cand)) return `assets/${d}/${v}`; } } catch {}
    return null;
  };
  const sub = plan.dir ? `assets/${plan.dir}` : "assets"; mkdirSync(join(dir, sub), { recursive: true });
  const out = (s, ext) => `${sub}/${s.produces.replace(/\.[a-z0-9]+$/i, "")}${s.attempt ? `-r${s.attempt}` : ""}.${ext}`;
  // a finished step's output is measured against what the step was for (facts.js: kind, size, length, sound, transparency,
  // "nothing was done"); a mismatch flags the node with the reason and the run goes on: a flag shows where it broke, it never stops it
  const set = (i, patch) => { if (["done", "failed", "flagged"].includes(patch.state)) patch.ran_at = Date.now();
    if (patch.state === "done" && patch.output && !patch.simulated) { try { const c = stepCheck(plan.steps[i], join(dir, patch.output), plan.steps[i].inputs.map((n) => file(n)).filter(Boolean).map((f) => join(dir, f))); patch.facts = c.facts; if (c.problems.length) { patch.state = "flagged"; patch.note = [patch.note || plan.steps[i].note, `check: ${c.problems.join("; ")}`].filter(Boolean).join(" · "); } } catch {} }
    Object.assign(plan.steps[i], patch); onStep(i, plan.steps[i]); };
  let filmStarted = false;
  // everything that will run and whose inputs are not made yet waits, visibly, until its turn
  const todo = order(plan.steps).filter((i) => (!only || only.includes(i)) && !["skipped", "paused", "done"].includes(plan.steps[i].state) || (only && only.includes(i) && plan.steps[i].state === "stale"));
  for (const i of todo) { const s = plan.steps[i]; const ready = s.inputs.every((n) => by[n] === undefined || ["done", "flagged"].includes(plan.steps[by[n]].state)); if (!ready) set(i, { state: "waiting" }); }
  for (const i of order(plan.steps)) {
    const s = plan.steps[i]; if (only && !only.includes(i)) continue; if (s.state === "skipped" || s.state === "paused") continue;
    const key = `t${plan.turn ?? 0}-s${i}-${s.tool}${s.attempt ? `-r${s.attempt}` : ""}`;
    try {
      if (FILM.includes(s.tool)) { if (!filmStarted) { filmStarted = true; await film(plan, dir, { id, tier, brief, sheet, set, say }); } continue; }
      set(i, { state: "running", started_at: Date.now() });
      const custom = customTool(s.tool);
      if (custom) {
        const ins = s.inputs.map((n) => ({ name: n, file: file(n) })).filter((x) => x.file).map((x) => ({ ...x, file: join(dir, x.file) }));
        const words = s.inputs.filter((n) => !file(n) && !/\.[a-z0-9]{2,4}$/i.test(n)); const f = out(s, custom.ext ? custom.ext(ins) : custom.makes === "text" ? "txt" : custom.makes === "verdict" ? "json" : "png");
        const at = (s.params.extra || "").match(/at:\s*(top|middle|bottom)/i)?.[1]?.toLowerCase();
        const written = ins.find((x) => /\.(txt|md)$/i.test(x.file)); const quoted = [...(s.params.prompt_or_change || "").matchAll(/["“]([^"”]{1,200})["”]/g)].map((m) => m[1]);
        const text = s.params.text || (written && custom.id !== "voice" && custom.id !== "write" ? readFileSync(written.file, "utf8").trim().replace(/^["“]|["”]$/g, "") : null) || (words.length ? words.join(" ") : null) || (quoted.length ? quoted.join("\n") : null) || s.params.prompt_or_change;
        const res = await custom.run({ inputs: ins, params: { ...s.params, text, at }, out: join(dir, f) });
        run.log.jobs[key] = { endpoint: custom.endpoint, file: f, inputs: ins.map((x) => x.name), prompt: text, model: "code", credits: 0, at: new Date().toISOString() }; run.save();
        set(i, { state: (res && res.pass === false) || /^ignored:/.test(res?.text || "") ? "flagged" : "done", output: f, credits_spent: 0, error: null, note: res?.text ? res.text.slice(0, 160) : res?.why ? `${res.pass ? "pass" : "flag"}: ${res.why}` : `by code: ${custom.id}` }); say(`${s.tool} → ${s.produces} (0 credits, by code)`); continue;
      }
      // a tool with no endpoint fails the step (J50b shipped a placeholder as the result); nothing after it runs on a stand-in
      if (!WIRED.has(s.tool)) throw new Error(`${s.tool} is not available (no endpoint wired); the plan must use another tool`);
      const given = s.inputs.map((n) => ({ name: n, file: file(n) })).filter((x) => x.file);
      // a written text (write's .txt) fed to a model is words for its prompt, not a file to upload (the upload refuses .txt):
      // with designed lettering on the image model, write → image is the path for a headline the user did not supply
      const texts = given.filter((x) => /\.(txt|md)$/i.test(x.file)), verdicts = given.filter((x) => /\.json$/i.test(x.file)), inputs = given.filter((x) => !texts.includes(x) && !verdicts.includes(x));
      // a check's answer feeds the step that asked for it: the question and what was seen go into the prompt
      for (const v of verdicts) { try { const a = JSON.parse(readFileSync(join(dir, v.file), "utf8")); const q = plan.steps[by[v.name]]?.params?.prompt_or_change || ""; s.params.prompt_or_change = `${s.params.prompt_or_change} (Checked first — ${q}: ${a.pass ? "yes" : "no"}; ${a.why}; seen: ${a.seen}.)`; } catch {} }
      if (texts.length) { const said = texts.map((x) => readFileSync(join(dir, x.file), "utf8").trim()).filter(Boolean); if (said.length) s.params.prompt_or_change = `${s.params.prompt_or_change} The exact words: "${said.join('" / "')}".`; }
      // an input that is not a file and not something a node made is text the planner misplaced: it goes into the prompt
      const missing = s.inputs.filter((n) => !file(n)); const words = missing.filter((n) => !/\.[a-z0-9]{2,4}$/i.test(n)); const lost = missing.filter((n) => /\.[a-z0-9]{2,4}$/i.test(n));
      if (words.length) { s.params.prompt_or_change = `${s.params.prompt_or_change} The text "${words.join('", "')}" appears in the picture.`; s.inputs = s.inputs.filter((n) => !words.includes(n)); set(i, { note: `text moved into the prompt: ${words.join(", ")}` }); }
      if (lost.length && !["image", "music", "text-to-video"].includes(s.tool)) throw new Error(`missing input ${lost.join(", ")}`);
      let r;
      if (s.tool === "image" || s.tool === "image-edit") {
        const f = out(s, "png"); const model = s.model || (tier === "paid" ? "nano-banana-pro" : "flux-2-klein"); const res = s.resolution || (STILLS[model]?.resolutions || ["640px"])[0];
        const gen = !inputs.length; const asp = s.params.aspect && (gen ? ["1:1", "16:9", "9:16"].includes(s.params.aspect) : true) ? s.params.aspect : gen ? (s.params.aspect === "4:5" || s.params.aspect === "4:3" ? "1:1" : "16:9") : null;
        r = await jobs.image(key, f, s.params.prompt_or_change, inputs.map((x) => x.file), { model, resolution: res, ...(asp ? { aspect_ratio: asp } : {}) });
        // the size asked, for an edit too (the editor keeps its input's shape: a square headshot came out 16:9)
        if (s.params.aspect) finish(join(dir, f), s.params.aspect, { pad: !!s.params.lettering });
        // lettering is read back; a word not spelled exactly (spaces and punctuation count: "KT12AB" for "KT1 2AB") or stray
        // lettering gets one fix on the lettering model (composer/keyframes/buildable.js, the same step as a keyframe)
        if (s.params.lettering && !r.estimated) { const words = [...s.params.prompt_or_change.matchAll(/"([^"]+)"|“([^”]+)”/g)].map((m) => ({ text: (m[1] ?? m[2]).trim(), where: "" })).filter((w) => w.text);   // pairs in order: a one-letter "1" must not shift them
          // read back, fix, read again: up to two fixes; the reading with the fewest wrong lines is kept, and a design still
          // misread is flagged (it used to say "lettering fixed" after one blind fix)
          if (words.length) { const L = letterModel(model, tier); let st = await strayText({ run, file: f, words }), wrong = misread(words, st.seen, { strict: true }), stray = realStray(st.stray, words);
            let best = { n: wrong.length + stray.length, file: null }; const tried = [];
            for (let k = 1; L && k <= 2 && (wrong.length || stray.length); k++) {
              const keepF = f.replace(/\.png$/, `-best.png`); copyFileSync(join(dir, f), join(dir, keepF)); best.file = keepF;
              await fixText({ jobs, run, key: `${key}-text-fix`, file: f, words, wrong, stray, model: L, res: s.resolution || "640px", design: true, round: k }); if (s.params.aspect) finish(join(dir, f), s.params.aspect, { pad: true });
              tried.push(wrong.map((w) => w.text).concat(stray.map((x) => `removed ${x.text}`)).join("; "));
              st = await strayText({ run, file: f, words }); wrong = misread(words, st.seen, { strict: true }); stray = realStray(st.stray, words);
              if (wrong.length + stray.length > best.n) { copyFileSync(join(dir, keepF), join(dir, f)); st = null; break; }   // the fix made it worse: the earlier version stays
              best = { n: wrong.length + stray.length, file: keepF };
            }
            const left = st ? wrong : misread(words, (await strayText({ run, file: f, words })).seen, { strict: true });
            if (tried.length || left.length) set(i, { note: `${tried.length ? `lettering fixed ${tried.length}x: ${tried.join(" | ")}` : ""}${left.length ? `${tried.length ? " · " : ""}still misread: ${left.map((w) => w.text).join("; ")}` : ""}`, lettering_left: left.map((w) => w.text) }); } }
        set(i, { state: s.lettering_left?.length ? "flagged" : "done", output: f, credits_spent: r.credits, cached: !!r.cached, error: null });
      } else if (s.tool === "image-to-video") {
        const f = out(s, "mp4"); const model = s.model || "minimax-h3"; const res = s.resolution || "480p"; const sec = grid(model, Number(s.params.seconds) || 5);
        const pics = inputs.filter((x) => /\.(png|jpe?g|webp)$/i.test(x.file)); if (!pics.length) throw new Error("image-to-video needs a picture");
        r = await jobs.video(key, f, s.params.prompt_or_change, pics[0].file, pics[1]?.file || null, sec, { model, resolution: res, audio: true });
        { const keep = /sound:\s*keep/i.test(s.params.extra || ""); finish(join(dir, f), s.params.aspect, { video: true, keepSound: keep }); }
        set(i, { state: "done", output: f, credits_spent: r.credits, cached: !!r.cached, error: null });
      } else if (s.tool === "text-to-video") {
        const f = out(s, "mp4"); const model = s.model || "minimax-h3"; const res = s.resolution || "480p"; const sec = grid(model, Number(s.params.seconds) || 5);
        const refs = inputs.slice(0, VIDEOS[model]?.maxRefs || 9).map((x) => { let n = x.name.replace(/\.[a-z0-9]+$/i, "").replace(/[^A-Za-z0-9_-]/g, "_"); if (!/^[A-Za-z]/.test(n)) n = "r_" + n; return { name: n, file: x.file }; });
        let prompt = s.params.prompt_or_change; for (const rf of refs) if (!prompt.includes(`@${rf.name}`)) prompt += ` @${rf.name}`;
        r = await jobs.tvideo(key, f, prompt, refs, sec, { model, resolution: res, audio: true, ...(s.params.aspect ? { aspect_ratio: s.params.aspect } : {}) });
        { const keep = /sound:\s*keep/i.test(s.params.extra || ""); finish(join(dir, f), s.params.aspect, { video: true, keepSound: keep }); }
        set(i, { state: "done", output: f, credits_spent: r.credits, cached: !!r.cached, error: null });
      } else if (s.tool === "music") {
        const f = out(s, "mp3"); const want = Number(s.params.seconds) || 30, sec = Math.round(Math.max(15, Math.min(300, want)));
        r = await jobs.music(key, f, `${s.params.prompt_or_change}. Instrumental only: no vocals, no singing, no speech.`, sec);
        if (want < sec) { const full = join(dir, f), tmp = full.replace(/\.mp3$/, "-cut.mp3"); execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", full, "-t", String(want), "-af", `afade=t=out:st=${Math.max(0, want - 1)}:d=1`, tmp]); renameSync(tmp, full); } set(i, { state: "done", output: f, credits_spent: r.credits, cached: !!r.cached, error: null });
      } else {
        // generic endpoints through paid(): the body per the API sheet
        const spec = { "face-swap-photo": { endpoint: "/v1/face-swap-photo", cost: 10, ext: "png", body: (p) => (s.faceMap ? { assets: { target_file_path: p[0], face_swap_mode: "individual-faces", face_mappings: s.faceMap.maps.map((m) => ({ original_face: m.original_face, new_face: p[1 + m.k] })) } } : { assets: { target_file_path: p[0], source_file_path: p[1], face_swap_mode: "all-faces" } }) },
          "background-remove": { endpoint: "/v1/image-background-remover", cost: 5, ext: "png", body: (p) => ({ assets: { image_file_path: p[0], ...(p[1] ? { background_image_file_path: p[1] } : {}) } }) },
          // the whole head (face and hair) from the second picture onto the person in the first; clothes and scene stay
          "head-swap": { endpoint: "/v1/head-swap", cost: 10, ext: "png", body: (p) => ({ assets: { body_file_path: p[0], head_file_path: p[1] } }) },
          "upscale-image": { endpoint: "/v1/ai-image-upscaler", cost: 25, ext: "png", body: (p) => ({ assets: { image_file_path: p[0] }, scale_factor: 2, style: { mode: "preserve" } }) },
          captions: (() => { let len = Number(s.params.seconds) || 0; try { if (!len && inputs[0]) len = Math.ceil(duration(join(dir, inputs[0].file))); } catch {} len = len || 10; return { endpoint: "/v1/auto-subtitle-generator", cost: Math.round(4.8 * len), ext: "mp4", seconds: len, body: (p) => ({ assets: { video_file_path: p[0] }, start_seconds: 0, end_seconds: len, style: { template: "minimalist" } }) }; })() }[s.tool];
        // video face swap, lip sync, talking photo: a clip or picture plus a face or a sound; paid per frame (about 30 a second)
        const clipIn = inputs.find((x) => /\.(mp4|mov)$/i.test(x.file)), picIn = inputs.find((x) => /\.(png|jpe?g|webp)$/i.test(x.file)), sndIn = inputs.find((x) => /\.(mp3|wav|m4a)$/i.test(x.file));
        const lenOf = (x) => { try { return Math.min(60, Math.ceil(duration(join(dir, x.file)) * 10) / 10); } catch { return 10; } };
        const MORE = {
          // style.version v2: the API sheet's "stronger identity"; the default left the original face mostly in place (C15a, C15c)
          "face-swap-video": () => { if (!clipIn || !picIn) throw new Error("a video face swap needs the clip and a picture of the face"); const len = lenOf(clipIn), pics = inputs.filter((x) => /\.(png|jpe?g|webp)$/i.test(x.file)); return { endpoint: "/v1/face-swap", cost: Math.ceil(30 * len), ext: "mp4", seconds: len, ordered: [clipIn, ...pics], body: (p) => ({ start_seconds: 0, end_seconds: len, style: { version: "v2" }, assets: s.faceMap ? { face_swap_mode: "individual-faces", video_source: "file", video_file_path: p[0], face_mappings: s.faceMap.maps.map((m) => ({ original_face: m.original_face, new_face: p[1 + m.k] })) } : { face_swap_mode: "all-faces", video_source: "file", video_file_path: p[0], image_file_path: p[1] } }) }; },
          // the whole look (face, hair, head) from a picture onto the person in a clip; face swap changes only the inner face.
          // Costs as charged on 2026-11-01 (the cap is checked against these before posting): character-replace 49/s, talking-photo 48/s
          "character-replace": () => { if (!clipIn || !picIn) throw new Error("character replace needs the clip and the picture of the person"); const len = lenOf(clipIn); return { endpoint: "/v1/character-replace", cost: Math.ceil(49 * len), ext: "mp4", seconds: len, ordered: [clipIn, picIn], body: (p) => ({ start_seconds: 0, end_seconds: len, model: "wan-animate", resolution: "480p", style: { mode: "replace", ...(s.point ? { selection_mode: "point", points: s.point.points } : {}) }, assets: { video_file_path: p[0], image_file_path: p[1] } }) }; },
          "lip-sync": () => { if (!clipIn || !sndIn) throw new Error("lip sync needs the clip and the sound"); const len = Math.min(lenOf(clipIn), lenOf(sndIn)); return { endpoint: "/v1/lip-sync", cost: Math.ceil(30 * len), ext: "mp4", seconds: len, ordered: [clipIn, sndIn], body: (p) => ({ start_seconds: 0, end_seconds: len, style: { generation_mode: "lite" }, assets: { video_source: "file", video_file_path: p[0], audio_file_path: p[1] } }) }; },
          "talking-photo": () => { if (!picIn || !sndIn) throw new Error("a talking photo needs the picture and the sound"); const len = lenOf(sndIn); return { endpoint: "/v1/ai-talking-photo", cost: Math.ceil(48 * len), ext: "mp4", seconds: len, ordered: [picIn, sndIn], body: (p) => ({ start_seconds: 0, end_seconds: len, resolution: "480p", style: { generation_mode: "realistic" }, assets: { image_file_path: p[0], audio_file_path: p[1] } }) }; },
        };
        if (s.tool === "face-swap-photo" || s.tool === "face-swap-video") { const target = s.tool === "face-swap-video" ? clipIn : null; const ordT = s.tool === "face-swap-photo" ? [...inputs].sort((a, b) => (/\b(face|me|self|selfie|portrait|headshot)\b/i.test(a.name.replace(/[._-]/g, " ")) ? 1 : 0) - (/\b(face|me|self|selfie|portrait|headshot)\b/i.test(b.name.replace(/[._-]/g, " ")) ? 1 : 0)) : null;
          const tgt = target || ordT?.[0], faces = (s.tool === "face-swap-video" ? inputs.filter((x) => /\.(png|jpe?g|webp)$/i.test(x.file)) : ordT.slice(1)).map((x) => ({ ...x, file: join(dir, x.file) }));
          try { s.faceMap = tgt && !r ? await faceMappings(join(dir, tgt.file), faces, `${s.params.prompt_or_change || ""} ${s.params.extra || ""}`, dir, key) : null; } catch (e) { s.faceMap = null; set(i, { note: `face detection: ${String(e.message).slice(0, 120)}` }); }
          if (s.faceMap) { s.params.prompt_or_change = `${s.params.prompt_or_change || ""} [individual faces: ${s.faceMap.maps.map((m) => `picture ${m.k + 1} → face ${m.original_face}`).join(", ")}]`; set(i, { note: `${s.faceMap.found} faces found; ${s.faceMap.maps.map((m) => `face picture ${m.k + 1}: ${m.why}`).join("; ")}` }); } }
        if (s.tool === "character-replace" && clipIn && !r) { try { s.point = await personPoint(join(dir, clipIn.file), `${s.params.prompt_or_change || ""} ${s.params.extra || ""}`, dir, key); if (s.point) { s.params.prompt_or_change = `${s.params.prompt_or_change || ""} [point ${s.point.points[0].position_x},${s.point.points[0].position_y}]`; set(i, { note: `${s.point.people} people; replacing ${s.point.who} at ${s.point.points[0].position_x},${s.point.points[0].position_y}` }); } } catch (e) { s.point = null; } }
        if (MORE[s.tool]) { const m = MORE[s.tool](); const f = out(s, m.ext); r = await jobs.paid(key, f, { endpoint: m.endpoint, prompt: s.params.prompt_or_change || "", model: s.tool, seconds: m.seconds }, m.ordered.map((x) => x.file), m.cost, (paths, onCreate) => runJob(m.endpoint, { name: `${run.name} ${key}`, ...m.body(paths) }, { kind: "video", onCreate }));
          // the size asked (H43a's talking photo kept its picture's 0.62:1 for a 9:16 ad)
          if (s.params.aspect) finish(join(dir, f), s.params.aspect, { video: true, keepSound: true }); set(i, { state: "done", output: f, credits_spent: r.credits, cached: !!r.cached, error: null }); say(`${s.tool} → ${s.produces} (${r.credits ?? 0} credits)`); continue; }
        if (s.tool === "face-swap-photo" && inputs.length < 2) throw new Error("a face swap needs the picture and the face");
        const f = out(s, spec.ext); const kind = spec.ext === "mp4" ? "video" : "image";
        // the target comes first for a swap: the picture, then the face
        const ordered = s.tool === "face-swap-photo" || s.tool === "head-swap" ? [...inputs].sort((a, b) => (/\b(face|me|self|selfie|portrait|headshot)\b/i.test(a.name.replace(/[._-]/g, " ")) ? 1 : 0) - (/\b(face|me|self|selfie|portrait|headshot)\b/i.test(b.name.replace(/[._-]/g, " ")) ? 1 : 0)) : inputs;
        r = await jobs.paid(key, f, { endpoint: spec.endpoint, prompt: s.params.prompt_or_change || "", model: s.tool, seconds: spec.seconds || 0 }, ordered.map((x) => x.file), spec.cost, (paths, onCreate) => runJob(spec.endpoint, { name: `${run.name} ${key}`, ...spec.body(paths) }, { kind, onCreate }));
        // head swap redraws the whole photo, so the other people drift (C14b: the man's face and hair changed). Their
        // original faces are put back with a one-face-each swap: faces found in the original, matched to the output by the
        // vision model (same person, same place), the swapped person left out
        if (s.tool === "head-swap") { let extra = 0, note = "";
          try { const orig = join(dir, ordered[0].file), up = await upload(orig), found = await detectFaces(up);
            if (found.length > 1) { const crops = []; for (const [k, fc] of found.slice(0, 6).entries()) { const c = join(dir, "assets", `${key}-orig-face${k + 1}.jpg`); await download(fc.url, c); crops.push({ name: `original face ${k + 1}`, file: c }); }
              const fm = await faceMappings(join(dir, f), crops, `Put each original face back on the same person in the same place. Leave out the person whose head was replaced to look like the portrait (${s.params.prompt_or_change || ""}); that person keeps the new head.`, dir, `${key}-restore`);
              if (fm) { const f2 = f.replace(/\.png$/, "-restored.png"); const ins2 = [{ file: f }, ...fm.maps.map((m) => ({ file: crops[m.k].file.replace(dir + "/", "") }))];
                const r2 = await jobs.paid(`${key}-restore`, f2, { endpoint: "/v1/face-swap-photo", prompt: `restore ${fm.maps.length} face(s)`, model: "face-swap-photo", seconds: 0 }, ins2.map((x) => x.file), 10, (paths, onCreate) => runJob("/v1/face-swap-photo", { name: `${run.name} ${key}-restore`, assets: { target_file_path: paths[0], face_swap_mode: "individual-faces", face_mappings: fm.maps.map((m, j) => ({ original_face: m.original_face, new_face: paths[1 + j] })) } }, { kind: "image", onCreate }));
                copyFileSync(join(dir, f2), join(dir, f)); extra = r2.credits || 0; note = `the other ${fm.maps.length} face(s) put back from the original`; } } } catch (e) { note = `restoring the others failed: ${String(e.message).slice(0, 100)}`; }
          set(i, { state: "done", output: f, credits_spent: (r.credits || 0) + extra, cached: !!r.cached, error: null, note }); }
        else set(i, { state: "done", output: f, credits_spent: r.credits, cached: !!r.cached, error: null });
      }
      say(`${s.tool} → ${s.produces}${r?.cached ? " (cached)" : ` (${r?.credits ?? 0} credits)`}`);
    } catch (e) { set(i, { state: "failed", error: String(e.message || e).slice(0, 300) }); say(`${s.tool} failed: ${String(e.message || e).slice(0, 200)}`); break; }
  }
  // the finished result against the request (the sheet's length and size), by code
  const made = plan.steps.filter((s) => s.output && !plan.steps.some((t) => t.inputs.includes(s.produces))).map((s) => join(dir, s.output));
  if (sheet && made.length) { const g = goalCheck(sheet, made); plan.goal_check = g.length ? g : ["matches the request's length and size"]; }
  return plan;
}

// The film tree: one pipeline run. The six nodes follow the run record (story → screenplay → stills → film).
async function film(plan, dir, { id, tier, brief, sheet, set, say }) {
  const idx = Object.fromEntries(plan.steps.map((s, i) => [s.tool, i]));
  const label = plan.steps.find((s) => FILM.includes(s.tool) && s.run)?.run || `session-${id}-${Date.now().toString(36)}`; const rdir = join(RUNS, label);
  const field = (k) => sheet?.fields?.find((f) => f.field === k)?.value || "";
  const secs = Number(plan.steps[idx.clips]?.params?.seconds || plan.steps[idx.film]?.params?.seconds) || Number((field("length_s") || "").match(/\d+/)?.[0]) || 15;
  const prof = TIERS[tier] || TIERS.free;   // the pipeline's --still default is the paid model, so the tier's models are passed explicitly
  const args = [join(V2, "backend", "composer", "pipeline.mjs"), "--brief", brief, "--label", label, "--tier", tier, "--still", prof.still, "--res", prof.res, "--model", prof.video, "--vres", prof.vres, "--until", "film", "--total", String(secs), "--max", "10"];
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
