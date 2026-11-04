// The V4 agent loop. One turn: intent (sheet + questions) → if ready: guards → make. A conversation is a list of turns.
// Programmatic: `agentTurn({messages, attachments, previous})` and `execute({intent, attachments, run, jobs})`.
// CLI: node V4/agent/run.mjs --brief "…" [--materials a.jpg,b.png] [--label x] [--dry] [--answers '{"aspect":"TikTok"}'] [--cap 108000]
import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync } from "node:fs";
import { join, basename, extname, resolve, dirname } from "node:path";
import { execFileSync } from "node:child_process";
import { duration } from "../../V2/backend/lib/media.js";
import { fileURLToPath } from "node:url";
import { jsonCall, S } from "../../V2/backend/lib/llm.js";
import { Jobs } from "../../V2/backend/lib/jobs.js";
import { intent } from "./intent.js";
import { guards } from "./guards.js";
import { TOOLS } from "./catalogue.js";
import { makeStill, makeClip, fitToAspect, magicTool, voiceOver, textOverlay, trimVideo, joinClips, joinWithExtras, adjustImage, resizeImage, researchFacts } from "./make.js";
import { storyFor, produce } from "./video.js";
export const V4 = join(dirname(fileURLToPath(import.meta.url)), "..");

// what each attached file is, read once by a VLM (so the sheet can name its role and describe it when it is not the reference)
export async function describeAttachments(files, run) {
  const out = [];
  for (const f of files) { const kind = /\.(mp4|mov|webm)$/i.test(f) ? "video" : /\.(mp3|wav|m4a)$/i.test(f) ? "audio" : "image"; const name = basename(f), local = `in-${name}`; copyFileSync(f, run.path(local));
    const seen = kind === "image" ? (await jsonCall({ name: "v4-attachment-seen-v1", effort: "low", images: [f], schema: S.obj({ summary: S.str, role: S.enum(["person", "copy", "product", "environment", "other"]) }), prompt: "In one sentence, what does this picture show (a person: age, hair, clothing; a logo/label/sign with its exact words; a product: kind, colour; a place: what kind)? And which is it mainly: person, copy (logo/label/sign/poster), product, environment, other?" })) : { summary: `${kind} file`, role: "other" };
    let aspect = null, seconds = null; try { const [w, h] = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", f]).toString().trim().split(",").map(Number); const r = w / h; aspect = r > 1.4 ? "16:9" : r < 0.75 ? "9:16" : r > 0.9 && r < 1.1 ? "1:1" : r > 1 ? "16:9" : "9:16"; if (kind === "video") seconds = Math.round(duration(f)); } catch {}
    out.push({ name, file: local, kind, seen: seen.summary, role: seen.role, use: "reference", clean: true, aspect, seconds }); }
  return out;
}

export async function agentTurn({ messages, attachments, previous }) { return intent({ messages, attachments, previous }); }

// Before changing an existing picture, decide what must be preserved and pick the cheapest method that preserves it:
// filter (0 cr, every pixel kept) < crop / pad (0, pixels kept, framing changes) < upscale (5) < edit in place (10, the
// model redraws; identity and layout mostly kept) < reflow / regenerate (10 per shape, the layout is re-composed to fill a
// new shape; words kept, strokes not). Stretching is never an option. A designed layout that must fill a new shape is a reflow.
export async function planTransform({ picture, request, targets = [], run }) {
  const plan = await jsonCall({ name: "v4-transform-plan-v1", effort: "low", images: [run.path(picture.file)], schema: S.obj({ kind: S.enum(["photo", "designed-layout", "logo-or-mark", "screenshot-or-document"]), must_preserve: S.str, method: S.enum(["filter", "crop", "pad", "upscale", "edit", "reflow"]), why: S.str, focus_x: S.num, focus_y: S.num, words: S.arr(S.str), shapes: S.arr(S.enum(["16:9", "9:16", "1:1", "4:5"])) }), prompt: `A user wants this done to the attached picture: "${request}"${targets.length ? ` (target shapes: ${targets.join(", ")})` : ""}.
First say what kind of picture it is and what MUST be preserved for the result to count (identity of a person, a product's exact look, a layout's design and every word, nothing in particular beyond the subject).
Then choose the CHEAPEST method that preserves that, in this order: filter (tone/colour only, every pixel kept) · crop (a photo whose edges carry nothing that matters; give focus_x/focus_y 0–1 for the point to keep centred) · pad (the whole frame must survive and bars are acceptable, e.g. a screenshot) · upscale (sharper, same picture) · edit (the model redraws the picture with a stated change; identity kept) · reflow (a designed layout that must FILL a new shape: re-composed at that shape keeping every word; list the words). Stretching is never allowed. For a poster, card or graphic going to a new shape the answer is reflow, not pad. shapes = the target shapes the request actually asks for (a Facebook or Instagram feed post = 1:1, a story or reel = 9:16, a banner or YouTube = 16:9); only what was asked, never extra ones. One sentence why.` });
  run.log.transform_plans = [...(run.log.transform_plans || []), { picture: picture.name, request, ...plan }]; run.save();
  return plan;
}

export async function execute({ it, attachments, run, jobs, say = console.log, DRY = false, brief }) {
  brief = String(brief || "");
  const P = Object.fromEntries(it.params.map((p) => [p.name, p.value]));
  for (const a of it.attachments || []) { const m = attachments.find((x) => x.name === a.file || x.file === a.file); if (m) { m.role = a.role; m.use = a.use; } }
  const g = guards({ tool: it.tool, params: it.params, attachments, cap: { spent: jobs.spent(), limit: Number(process.env.CLEANED_CAP || 1e9) } });
  run.log.guards = g; run.save();
  if (!g.ok) { say(`blocked: ${g.blocks.join("; ")}`); return { blocked: g.blocks }; }
  if (it.needs_research && !run.log.research) { say("  research…"); run.log.research = await researchFacts({ brief, queries: it.research_queries || [] }); run.save(); say(`  ${run.log.research.facts.length} facts as of ${run.log.research.as_of}`); }
  const facts = run.log.research ? `\nFACTS (researched ${run.log.research.as_of}; use them, do not contradict them): ${run.log.research.facts.map((f) => `${f.fact} (${f.when})`).join(" · ")}${run.log.research.looks?.length ? ` LOOKS: ${run.log.research.looks.map((l) => `${l.thing}: ${l.look}`).join(" · ")}` : ""}` : "";
  brief = `${brief}${facts}`;
  if (it.deliverables?.length > 1 && !it._inCampaign) {
    run.log.campaign = []; const made = [];
    for (const [i, d] of it.deliverables.entries()) {
      const quoted = [...d.brief.matchAll(/[“"']([^”"']{2,80})[”"']/g)].map((m) => m[1]);
      const subParams = it.params.some((p) => p.name === "exact_words") || !quoted.length ? it.params : [...it.params, { name: "exact_words", value: JSON.stringify(quoted), source: "user", from: `quoted in the deliverable: ${quoted.join(" | ")}` }];
      const sub = { ...it, tool: d.tool, deliverables: [], _inCampaign: true, params: subParams };
      const atts = attachments.concat(made.filter(() => d.uses_previous).map((m) => ({ ...m, use: "reference" })));
      say(`== deliverable ${i + 1}/${it.deliverables.length}: ${d.tool} · ${d.brief}`);
      const subRun = { ...run, path: (f) => run.path(/^in-|^d\d+-|^seed-/.test(f) ? f : `d${i + 1}-${f}`) };   // inputs and earlier deliverables keep their names; only this step's outputs get the prefix
      const subJobs = new Jobs(subRun, { estimate: DRY });   // bound to the prefixed paths, sharing the same log and ledger
      const out = await execute({ it: sub, attachments: atts, run: subRun, jobs: subJobs, say, DRY, brief: `${d.brief}\n(Part of a campaign: ${brief.slice(0, 600)})` });
      const file = out?.file || out?.film; run.log.campaign.push({ n: i + 1, tool: d.tool, brief: d.brief, file: file ? `d${i + 1}-${file}` : null, credits: out?.credits ?? 0, uses_previous: d.uses_previous }); run.save();
      if (file) { const isVid = /\.mp4$/i.test(file); made.length = 0; made.push({ name: `deliverable-${i + 1}${isVid ? ".mp4" : ".png"}`, file: `d${i + 1}-${file}`, kind: isVid ? "video" : "image", role: isVid ? "other" : /logo|poster|card/i.test(d.brief) ? "copy" : "product", seen: d.brief, clean: true, aspect: null }); }   // the latest deliverable is what the next step may use
    }
    return { campaign: run.log.campaign, file: run.log.campaign.at(-1)?.file, credits: jobs.spent() };
  }
  const Pg = g.P, words = (() => { try { const v = JSON.parse(Pg.exact_words || "[]"); return Array.isArray(v) ? v : [String(v)]; } catch { return Pg.exact_words && Pg.exact_words !== "none" ? [Pg.exact_words] : []; } })();
  const ref = attachments.find((a) => a.use === "reference" && /^deliverable-/.test(a.name)) || attachments.find((a) => a.use === "reference"), described = attachments.filter((a) => a.use === "describe").map((a) => `${a.name}: ${a.seen}`).join("; ");
  const request = `${brief}${described ? `\n(Attached pictures described, not used as references: ${described})` : ""}`;
  const secs = Number(Pg.seconds) || 10, aspect = Pg.aspect || "16:9";
  switch (it.tool) {
    case "generate_image": return makeStill({ key: "image", description: `${request}\nSubject: ${Pg.subject || ""}. Look: ${Pg.look || "your call"}.`, aspect, exactWords: words, run, jobs, say, DRY });
    case "edit_image": {
      if (ref && !DRY) { const plan = await planTransform({ picture: ref, request: `${Pg.edit}. Keep: ${Pg.keep || "everything else"}`, run }); say(`  plan: ${plan.method} (${plan.kind}; preserve: ${plan.must_preserve})`);
        if (plan.method === "filter") return { ...(await adjustImage({ input: ref.file, out: `adjusted${extname(ref.file)}`, adjustment: Pg.edit, run, say })), plan };
        if (plan.method === "upscale") return { ...(await magicTool({ key: "upscale_image", tool: "upscale_image", inputs: [ref.file], run, jobs, say, DRY })), plan }; }
      return makeStill({ key: "edit", description: `${request}\nChange: ${Pg.edit}. Keep: ${Pg.keep || "everything else exactly"}.`, aspect, exactWords: words, inputs: ref ? [ref.file] : [], run, jobs, say, DRY }); }
    case "create_video_from_text": { const refList = attachments.filter((a) => a.use === "reference" && a.kind === "image").map((a) => ({ name: a.role === "other" ? a.name.replace(/\W.*$/, "") : a.role, file: a.file, seen: a.seen, role: a.role })); return makeClip({ key: "clip", brief: `${request}\nSubject: ${Pg.subject || ""}. Look: ${Pg.look || "your call"}.`, seconds: secs, aspect, sound: Pg.sound || "none", exactWords: words, refs: refList, run, jobs, say, DRY }); }
    case "create_video_from_image": if (Pg.route === "refs") { const refList = attachments.filter((a) => a.use === "reference" && a.kind === "image").map((a) => ({ name: a.role, file: a.file, seen: a.seen, role: a.role })); return makeClip({ key: "clip", brief: `${request}\nMotion: ${Pg.motion || ""}.`, seconds: secs, aspect, sound: Pg.sound || "none", exactWords: words, refs: refList, run, jobs, say, DRY }); } { let start = ref?.file || null;
      if (start && ref.kind === "image" && ref.aspect && ref.aspect !== aspect) { const plan = DRY ? { method: "pad", focus_x: 0.5, focus_y: 0.5, why: "dry run" } : await planTransform({ picture: ref, request: `fit this picture to a ${aspect} frame as the first frame of a video; ${Pg.keep || "the subject stays whole"}`, targets: [aspect], run }); const method = plan.method === "crop" ? "crop" : "pad"; say(`  plan: ${method} the start frame to ${aspect} (${plan.why})`); start = fitToAspect({ input: start, aspect, method, focus: [plan.focus_x ?? 0.5, plan.focus_y ?? 0.5], out: `start-${aspect.replace(":", "x")}${extname(start)}`, run, say }); }
      return makeClip({ key: "clip", brief: `${request}\nMotion: ${Pg.motion}. Keep: ${Pg.keep || "identity, framing and light as in the picture"}.`, seconds: secs, aspect, sound: Pg.sound || "none", exactWords: words, startFrame: start, run, jobs, say, DRY }); }
    case "generate_music": { const j = await jobs.music("music", "music.mp3", Pg.mood || "calm", secs); return { file: "music.mp3", credits: j.credits || 0, estimated: j.estimated ? j.credits : undefined }; }
    case "voice_over": return DRY ? { file: "voice.mp3", credits: 0, dry: true } : voiceOver({ script: Pg.script, out: "voice.mp3", run, say });
    case "text_overlay": return DRY ? { file: "overlay", credits: 0, dry: true } : textOverlay({ input: ref.file, out: `overlay${extname(ref.file)}`, words, position: Pg.position || "bottom", run, say });
    case "adjust_image": return DRY ? { file: "adjusted.png", credits: 0, dry: true } : adjustImage({ input: ref.file, out: `adjusted${extname(ref.file)}`, adjustment: Pg.adjustment, run, say });
    case "resize_image": {
      const targets = [...String(Pg.targets || "").matchAll(/\b(16:9|9:16|1:1|4:5)\b/g)].map((m) => m[1]); const t = targets.length ? targets : ["1:1", "9:16", "16:9"];
      if (DRY) return { file: "resize.png", targets: t, credits: 0, dry: true };
      // what kind of picture is it? a photo whose edges do not matter can be cropped; a layout with words must be re-laid out at the new shape
      const p0 = await planTransform({ picture: ref, request: `${Pg.targets ? `deliver it in these shapes: ${t.join(", ")}` : brief}`, targets: targets.length ? t : [], run }); if (!targets.length && p0.shapes?.length) { t.length = 0; t.push(...p0.shapes); } const look = { ...p0, strategy: p0.method === "crop" ? "crop" : p0.method === "reflow" || p0.method === "edit" ? "reflow" : "pad" };
      run.log.resize_plan = look; run.save(); say(`  plan: ${look.strategy} (${look.kind}; preserve: ${look.must_preserve}; ${look.why})`);
      if (look.strategy === "reflow") { const files = []; let credits = 0;
        for (const a of t) { const shape = { "16:9": "a wide 16:9 banner", "9:16": "a tall 9:16 story", "1:1": "a 1:1 square post", "4:5": "a 4:5 portrait post" }[a] || a; const r = await makeStill({ key: `reflow-${a.replace(":", "x")}`, kind: "reflow", description: `Deliver this design as ${shape}. Keep the words exactly, as one block: ${look.words.map((w) => `'${w}'`).join(", ")}. Extend the artwork in its own style to fill the ${shape} edge to edge (more scenery to the sides for a wide frame, more sky and foreground for a tall one); do not squeeze, stretch or add bars; the poster is the whole image, no mount or border around it.`, aspect: a, exactWords: look.words, inputs: [ref.file], run, jobs, say }); files.push({ aspect: a, file: r.file, credits: r.credits }); credits += r.credits || 0; }
        return { file: files[0].file, files, strategy: "reflow", why: look.why, credits }; }
      if (look.strategy === "crop") { const dims = { "1:1": [1080, 1080], "9:16": [1080, 1920], "16:9": [1920, 1080], "4:5": [1080, 1350] }, files = [];
        for (const a of t) { const [W, H] = dims[a], out = `crop-${a.replace(":", "x")}.png`; execFileSync("ffmpeg", ["-v", "error", "-y", "-i", run.path(ref.file), "-vf", `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}:(iw-ow)*${Math.min(1, Math.max(0, look.focus_x))}:(ih-oh)*${Math.min(1, Math.max(0, look.focus_y))}`, run.path(out)]); files.push({ aspect: a, file: out }); }
        say(`  crop: ${t.join(", ")} around (${look.focus_x.toFixed(2)}, ${look.focus_y.toFixed(2)})`); return { file: files[0].file, files, strategy: "crop", why: look.why, credits: 0 }; }
      return { ...(await resizeImage({ input: ref.file, targets: t, run, say })), strategy: "pad", why: look.why }; }
    case "extend_video": {
      const vid = attachments.find((a) => a.kind === "video"); if (!vid) throw new Error("extend_video needs a video");
      const last = "seed-last.jpg"; execFileSync("ffmpeg", ["-v", "error", "-y", "-sseof", "-0.15", "-i", run.path(vid.file), "-frames:v", "1", "-update", "1", run.path(last)]);
      const dur = duration(run.path(vid.file)), T = [0.5, Math.round(dur / 2), Math.max(0.5, Math.floor(dur - 0.5))], fr = T.map((t) => { const f = `seed-t${t}.jpg`; execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(t), "-i", run.path(vid.file), "-frames:v", "1", "-update", "1", run.path(f)]); return f; });
      const seen = await jsonCall({ name: "v4-clip-read-v1", effort: "medium", images: fr.map((f) => run.path(f)), schema: S.obj({ scene: S.str, people: S.arr(S.str), action_so_far: S.str, last_moment: S.str, natural_next: S.str }), prompt: `Three frames of a ${Math.round(dur)}-second clip at ${T.join(", ")} s, in order. Describe the scene (place, light, camera), each person (2–4 anchors), what has happened so far, the exact last moment (poses, where everyone is), and what would naturally happen in the next ${secs} seconds if the clip simply continued.` });
      run.log.clip_read = { frames: fr, last_frame: last, seen }; run.save();
      const given = Pg.continuation && !/continue naturally|your call|^$/i.test(Pg.continuation) ? Pg.continuation : null;
      const brief = `This clip continues directly from its last frame (supplied as the start frame). THE CLIP SO FAR: ${seen.scene} People: ${seen.people.join("; ")}. ${seen.action_so_far} Last moment: ${seen.last_moment}\nWHAT HAPPENS NEXT: ${given || seen.natural_next}${given ? "" : " (nobody told us; this is the natural continuation read from the clip)"}\nKeep the same place, light, camera style and people; no new characters unless named.`;
      let refClip = vid.file; if (dur > 15) { refClip = "seed-tail.mp4"; execFileSync("ffmpeg", ["-v", "error", "-y", "-sseof", "-15", "-i", run.path(vid.file), "-c", "copy", run.path(refClip)]); }
      try { return await makeClip({ key: "extend", brief: `${brief}\nThe previous clip is attached as @previous: continue from its final moment, do not replay it.`, seconds: Math.min(secs, 30), aspect: Pg.aspect || vid.aspect || "16:9", sound: Pg.sound || "none", exactWords: words, refs: [{ name: "previous", file: refClip, seen: "the previous clip", role: "other" }], run, jobs, say, DRY }); }
      catch (e) { say(`  video reference failed (${String(e.message).slice(0, 80)}); falling back to the last frame`); return makeClip({ key: "extend", brief, seconds: secs, aspect: Pg.aspect || vid.aspect || "16:9", sound: Pg.sound || "none", exactWords: words, startFrame: last, run, jobs, say, DRY }); }
    }
    case "trim_video": { const m = String(Pg.range || "").match(/(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)/); const [from, to] = m ? [Number(m[1]), Number(m[2])] : [0, 10]; return DRY ? { file: "trim.mp4", from, to, credits: 0, dry: true } : trimVideo({ input: ref.file, out: "trim.mp4", from, to, run, say }); }
    case "join_videos": { let vids = attachments.filter((a) => a.kind === "video"); const ord = String(Pg.order || ""); if (ord) { const named = ord.split(/[,;→>]+/).map((x) => x.trim()).filter(Boolean).map((n) => vids.find((v) => v.name.includes(n) || n.includes(v.name.replace(/\.\w+$/, "")))).filter(Boolean); if (named.length === vids.length) vids = named; }
      const music = Pg.music && !/none|no music|silent/i.test(Pg.music) ? Pg.music : null; return DRY ? { file: "joined.mp4", order: vids.map((v) => v.name), music, credits: music ? 60 : 0, dry: true } : { file: await joinWithExtras({ files: vids.map((v) => v.file), out: "joined.mp4", transition: /dissolve|fade/i.test(Pg.transition || "") ? "dissolve" : "cut", music, words, run, jobs, say }), order: vids.map((v) => v.name), credits: jobs.spent() }; }
    case "swap_face_in_photo": case "swap_head_in_photo": case "upscale_image": case "remove_image_background": {
      const imgs = attachments.filter((a) => a.kind === "image"); const target = imgs.find((a) => a.role === "environment" || a.role === "other" || a.role === "product") || imgs[0], face = imgs.find((a) => a !== target && a.role === "person") || imgs[1];
      const inputs = it.tool.startsWith("swap") ? [target.file, face.file] : [imgs[0].file];
      return magicTool({ key: it.tool, tool: it.tool, inputs, run, jobs, say, DRY });
    }
    case "video_production": {
      const story = run.log.story || await storyFor({ brief: request, P: { ...Pg, seconds: Number(Pg.seconds) || 45 }, attachments });
      run.log.story = story; run.save();
      if (story.questions?.length && !run.log.story_answered) return { questions: story.questions };
      return produce({ story, P: Pg, attachments, run, jobs, say, DRY });
    }
    default: throw new Error(`${it.tool} is not wired`);
  }
}

// a whole conversation with a proxy that answers from a sheet (or a script), used by the CLI and the tests
export async function converse({ brief, materials = [], label, answers = {}, script = [], maxTurns = 4, DRY = true, say = console.log, cap }) {
  const dir = join(V4, "runs", label); mkdirSync(dir, { recursive: true });
  const recFile = join(dir, "run.json"), old = existsSync(recFile) ? JSON.parse(readFileSync(recFile, "utf8")) : {};   // a rerun of the same label keeps its paid jobs and its story
  const rec = { label, brief, dry: DRY, at: new Date().toISOString(), turns: [], jobs: old.jobs || {}, calls: old.calls || [], pending: old.pending || {}, story: old.story, earlier_run: old.at || null };
  const run = { name: `v4-${label}`, path: (f) => join(dir, f), log: rec, save: () => writeFileSync(recFile, JSON.stringify(rec, null, 2)) };
  const jobs = new Jobs(run, { estimate: DRY });
  const attachments = await describeAttachments(materials.map((m) => resolve(m)), run); rec.attachments = attachments;
  const messages = [{ role: "user", text: brief }]; let previous = null, result = null, scriptIdx = 0;
  for (let t = 1; t <= maxTurns; t++) {
    const it = await agentTurn({ messages, attachments, previous }); previous = it;
    const turn = { n: t, intent: it, asked: it.questions, say: it.say }; rec.turns.push(turn); run.save();
    say(`turn ${t}: ${it.tier} · ${it.tool}${it.direction_changed ? " · direction changed" : ""} · ${it.ready ? "READY" : `asks: ${it.questions.map((q) => q.question).join(" | ")}`}`);
    if (it.tier === "refuse") { turn.outcome = "refused"; break; }
    if (it.ready && script[scriptIdx]) { const next = script[scriptIdx++]; turn.user_reply = next; messages.push({ role: "assistant", text: it.say }, { role: "user", text: next }); run.save(); continue; }
    if (it.ready) {
      result = await execute({ it, attachments, run, jobs, say, DRY, brief: messages.filter((m) => m.role === "user").map((m) => m.text).join(" ") });
      if (result?.questions) { turn.story_questions = result.questions; const reply = await proxyReply({ questions: result.questions.map((q) => ({ param: "story", question: q })), answers, script, idx: scriptIdx++ , brief }); messages.push({ role: "assistant", text: result.questions.join(" ") }, { role: "user", text: reply }); rec.story_answers = reply; rec.story_answered = true; rec.story = await storyFor({ brief, P: Object.fromEntries(it.params.map((p) => [p.name, p.value])), attachments, previousStory: rec.story, answers: reply }); run.save(); result = await produce({ story: rec.story, P: Object.fromEntries(it.params.map((p) => [p.name, p.value])), attachments, run, jobs, say, DRY }); }
      turn.outcome = result?.blocked ? "blocked" : "made"; rec.result = result; break;
    }
    const reply = await proxyReply({ questions: it.questions, answers, script, idx: scriptIdx++, brief });
    messages.push({ role: "assistant", text: it.questions.map((q) => q.question).join(" ") }, { role: "user", text: reply });
    turn.user_reply = reply; run.save();
  }
  rec.messages = messages; rec.credits = jobs.spent(); rec.estimate = jobs.estimated?.reduce((n, x) => n + x.cost, 0) || 0; rec.finished = new Date().toISOString(); run.save();
  return rec;
}

// the proxy user: a scripted line if one is queued for this turn, else answers from the sheet, else "your call"
async function proxyReply({ questions, answers, script, idx, brief }) {
  if (script[idx]) return script[idx];
  const r = await jsonCall({ name: "v4-proxy-user", effort: "low", schema: S.obj({ reply: S.str }), prompt: `You are the USER of a media-making agent. You asked: "${brief}". The agent asks: ${questions.map((q) => q.question).join(" ")}. Answer in one short natural message using ONLY this answer sheet (say "your call" for anything it does not cover; do not add requests): ${JSON.stringify(answers)}` });
  return r.reply;
}

if (process.argv[1] && /agent\/run\.mjs$/.test(process.argv[1])) {
  const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
  const rec = await converse({ brief: opt("--brief"), materials: (opt("--materials", "") || "").split(",").filter(Boolean), label: opt("--label", `cli-${Date.now()}`), answers: JSON.parse(opt("--answers", "{}")), DRY: args.includes("--dry") });
  console.log(`${rec.dry ? "dry" : "done"} · ${rec.turns.length} turns · ${rec.dry ? `estimate ${rec.estimate}` : `${rec.credits} credits`} · ${rec.turns.at(-1)?.intent?.tool}`);
}
