// Direct generation (T-058): the video model composes the piece from the brief and the story, in one generation when the
// piece fits the model's grid, else in a few played back to back, each later one continuing from the previous one's last
// frame (the state's reference, attached as "previous") plus any supplied references. No assets, no screenplay, no
// keyframes: the chain runs only when a constraint forces it (pipeline.mjs decides). The records are the chain's
// (L.build.made, L.build.film, L.calls), so the results page, the film record and the comparison page read a direct
// run like any other.
import { existsSync, copyFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, basename, extname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { jsonCall, S } from "../../lib/llm.js";
import { video as videoModel } from "../../lib/models.js";
import { frame, duration } from "../../lib/media.js";

export const PROMPT_LIMIT = 2000, PROMPT_TARGET = 1700;   // Magic Hour refuses style.prompt over 2000 characters (the MCP baseline's first podcast call)

// As few generations as the model's grid allows: one when the piece fits; else near-equal parts, each snapped to the grid.
export function segmentsFor(total, model, maxSeg = null) {
  const g = videoModel(model).grid, top = Math.min(Math.max(...g), maxSeg || Infinity), n = Math.max(1, Math.ceil(total / top)), snap = (w) => (g.includes(w) ? w : g.reduce((b, x) => (Math.abs(x - w) < Math.abs(b - w) ? x : b), g[0]));
  const out = []; let left = total; for (let k = 0; k < n; k++) { const s = snap(k === n - 1 ? left : Math.round(total / n)); out.push(s); left -= s; } return out;
}

// The plan: one prose prompt per segment. The BRIEF is the contract (its medium, its exact words, its order of events);
// the research's facts serve it where the subject is real; the story stage's rewrite is flavour only, never the spine.
export async function planDirect({ brief, L, segments, model, resolution, aspect, refs, say }) {
  const story = L.story || {}, facts = L.research?.facts || [], looks = L.research?.looks || [], n = segments.length;
  const schema = S.obj({ title: S.str, requirements: S.arr(S.str), look: S.str, voice: S.str, segments: S.arr(S.obj({ seconds: S.num, prompt: S.str, narration: S.str, words_on_screen: S.arr(S.str), refs: S.arr(S.str), anchors: S.arr(S.obj({ name: S.str, what: S.str, lettering: S.bool, why: S.str })), continuity: S.str })) });
  const plan = await jsonCall({ name: "direct-plan-v3", effort: "medium", schema, prompt: `You write the prompt(s) for a text-to-video model that makes a whole short piece on its own, picture and sound: it composes the scene, animates it, letters short words on screen when asked, and generates the audio, including spoken narration and dialogue, from the words you give it. The client reads the result against their brief, word by word.

THE BRIEF (the contract; every explicit ask in it is a requirement: the medium and look, the length, the events in order, the exact spoken words, the exact on-screen words, what must not appear):
${brief}

SUPPORTING MATERIAL (serves the brief; never overrides it):
${story.title ? `a working title: ${story.title}` : ""}${story.style ? `; a suggested style: ${story.style}` : ""}
${facts.length ? `Facts about the real subject (use only those the picture or the narration shows; no dates, places or names the brief does not ask for):\n${facts.map((x, i) => `${i + 1}. ${typeof x === "string" ? x : x.fact || JSON.stringify(x)}`).join("\n")}` : ""}${looks.length ? `\nHow real things in it look:\n${looks.map((l) => `- ${l.thing}: ${l.look}`).join("\n")}` : ""}

THE MODEL: ${model} at ${resolution}, ${aspect}. It makes the piece in ${n} generation${n === 1 ? "" : "s"} of ${segments.join(", ")} seconds, played back to back${n > 1 ? ". Each generation after the first continues from the previous one's LAST FRAME, attached to it as a reference image named \"previous\": the same scene, the same style, the same people and objects, picked up mid-action; it must not re-introduce them" : ""}.${refs.length ? ` Reference images available by name, to attach to a segment when it should match them: ${refs.join(", ")}; a segment that attaches one names it in its prompt as @name ("the mug matches @plaid-mug").` : " No reference image is attached: never mention a reference, a photograph to match, or a product image; describe what is seen instead."}

FIRST list the requirements: every explicit ask in the brief, one line each, in the brief's own words (the medium, e.g. "simple animation"; each exact on-screen string; each exact spoken line; each event in order; the length; every "no …"). Then write the segments so that every requirement is met by some beat, and check the list against them before answering.

For each segment in order (seconds exactly as given):
- prompt: prose, no headings, between 1100 and ${PROMPT_TARGET} characters (the API refuses more than ${PROMPT_LIMIT}; use the room for what is seen). One opening sentence fixes the medium and the look in the brief's own words, the same sentence in every segment. Then timed beats from the segment's start ("0–3 s: …", "3–7 s: …") saying what is seen, what moves, and what is heard, in the brief's order. The exact spoken words in quotes, with the voice described once in the first segment and named the same way after ("a calm adult English narrator says exactly: '…'"; a character's line: who, then the words); the whole of each required line, nothing added. The exact on-screen words in quotes, each with where it appears, when, how (size, colour, backing) and for how long; keep each string short and the set small, the model letters short words well and garbles long ones; a title or end card is a beat of its own with the words held still to the end. Every named person, object and place described the same way in every segment. End with what must not happen: no other text, no cuts when the piece is one continuous shot, no music unless the brief asks for it, no subtitles.${n > 1 ? ` A segment after the first opens with: "Continue directly from @previous: the same scene, style, people and objects, mid-action." (the model binds a reference by its @name in the prompt) and introduces nothing again.` : ""}
- narration: every spoken word of the segment, exactly as quoted in the prompt, in order (empty if nothing is spoken). Speech runs about 2.3 words a second: a segment's narration must fit its seconds with room to breathe; a line the brief gives verbatim is kept whole.
- words_on_screen: the exact on-screen strings of the segment, in order; every on-screen string the brief asks for appears here in some segment.
- refs: the names of the reference images this segment should attach (from the list above; none if none).
- anchors: stills to paint first and attach to this segment as references, for what a video model gets wrong on its own: a diagram, chart or map; more than a couple of exact words on screen; a specific product, logo or layout that must be right. Each: name (one lowercase word; the prompt refers to it as @name), what (the complete description to paint, every exact word in quotes, the layout, the colours; the picture stands on its own), lettering (true when words must be spelled exactly), why (the hard constraint). The segment's prompt then says what the picture does with it ("the diagram matches @diagram exactly; the highlight moves clockwise from label to label"). At most two per segment; none for live action the model composes well; a later segment reuses an earlier anchor by naming it again.
- continuity: one line: what the next segment must keep (who is where, what is on screen, the look).
Also: title (the piece), look (the one opening sentence used in every prompt), voice (the narrator or voices, as described).` });
  // the API's limit: a prompt over the target is compressed, every quoted string kept
  for (const seg of plan.segments) if (seg.prompt.length > PROMPT_TARGET + 200) { say(`  prompt of ${seg.prompt.length} characters: compressing`); const c = await jsonCall({ name: "direct-shorten", effort: "low", schema: S.obj({ prompt: S.str }), prompt: `Rewrite this video prompt under ${PROMPT_TARGET} characters. Keep every string in quotes exactly (spoken words and on-screen words), the timed beats, the opening sentence and the closing constraints; cut adjectives and repetition.\n\n${seg.prompt}` }); seg.prompt = c.prompt; }
  for (const seg of plan.segments) if (seg.prompt.length > PROMPT_LIMIT) seg.prompt = seg.prompt.slice(0, PROMPT_LIMIT - 1);
  return plan;
}

// The run: plan (kept in the record), then each segment in order, the last frame extracted and fed to the next, then the film.
export async function runDirect({ brief, L, run, jobs, say = console.log, seconds, video, still = null, aspect = "16:9", refFiles = [], maxSeg = null, dry = false }) {
  const model = video.model, prof = videoModel(model), maxRefs = prof.maxRefs || 10, segs = segmentsFor(seconds, model, maxSeg);
  const K = (L.build ??= {}); K.mode = "direct"; K.made ??= {}; K.painted ??= {}; K.variants ??= {}; K.anchors ??= {};   // the plan lives under K.direct: K.plan is the chain's keyframe plan, which the results page maps over
  // supplied references, copied into the run so the record points at them
  const available = {}; mkdirSync(run.path("refs"), { recursive: true });
  for (const f of refFiles) { const src = resolve(f); if (!existsSync(src)) { say(`  reference ${f}: not found, skipped`); continue; } const name = basename(f, extname(f)).replace(/[^a-z0-9_-]+/gi, "-"), rel = `refs/${name}${extname(f).toLowerCase()}`; if (!existsSync(run.path(rel))) copyFileSync(src, run.path(rel)); available[name] = rel; }
  const same = K.direct?.mode === "direct" && K.direct.model === model && K.direct.seconds === seconds && JSON.stringify(K.direct.segments.map((s) => s.seconds)) === JSON.stringify(segs);
  if (!same) { const p = await planDirect({ brief, L, segments: segs, model, resolution: video.resolution, aspect, refs: Object.keys(available), say }); p.segments.forEach((s, k) => { s.seconds = segs[k]; }); K.direct = { mode: "direct", model, seconds, aspect, title: p.title, requirements: p.requirements || [], look: p.look, voice: p.voice, segments: p.segments.slice(0, segs.length) }; K.made = {}; run.save(); }
  say(`plan: "${K.direct.title}" · ${segs.length} generation${segs.length === 1 ? "" : "s"} (${segs.join(" + ")} s) on ${model} ${video.resolution} ${aspect}, audio by the model · ${K.direct.segments.map((s) => `${s.prompt.length} chars`).join(", ")}`);
  if (dry) { say(`requirements:\n${(K.direct.requirements || []).map((r) => `  - ${r}`).join("\n")}`); for (const [k, seg] of K.direct.segments.entries()) say(`--- segment ${k + 1} (${seg.seconds} s, ${seg.prompt.length} chars) on screen: ${JSON.stringify(seg.words_on_screen)}${seg.anchors?.length ? `\nANCHORS: ${seg.anchors.map((a) => `@${a.name} (${a.lettering ? "lettered" : "picture"}): ${a.what}`).join("\n  ")}` : ""}\n${seg.prompt}\nNARRATION: ${seg.narration}`); }
  const parts = []; let ok = true;
  for (const [k, seg] of K.direct.segments.entries()) {
    const n = k + 1, key = `clip-${n}`, file = `clips/direct-${n}.mp4`, prev = k > 0 ? `clips/direct-${k}-last.png` : null;
    // the anchors: the hard constraints of this segment painted as stills (exact lettering on the model that spells), once per name, attached as @name
    const anchors = []; for (const a of seg.anchors || []) { const name = String(a.name || "").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || `anchor${anchors.length + 1}`; if (name === "previous") continue;
      if (!K.anchors[name]) { const m = still ? (a.lettering && still.model === "flux-2-klein" ? "qwen-image-2.1" : still.model) : null; if (!m) { say(`  anchor @${name}: no still model given, skipped`); continue; }
        const file = `refs/anchor-${name}.png`; if (!dry) { const j = await jobs.image(`anchor-${name}`, file, a.what, [], { model: m, resolution: still.resolution, aspect_ratio: aspect }); say(`  anchor @${name}: painted on ${m}${j?.cached ? " (cached)" : ` · ${j?.credits ?? "?"} credits`} · ${a.why || ""}`); } else say(`  anchor @${name}: would be painted on ${m} (dry run) · ${a.why || ""}`);
        K.anchors[name] = { file, prompt: a.what, model: m, lettering: !!a.lettering, why: a.why || "" }; run.save(); }
      anchors.push({ name, file: K.anchors[name].file }); }
    for (const [name, a] of Object.entries(K.anchors)) if (!anchors.some((x) => x.name === name) && new RegExp(`@${name}\\b`).test(seg.prompt)) anchors.push({ name, file: a.file });   // an earlier anchor named in this prompt is attached again
    const refs = [...(prev ? [{ name: "previous", file: prev }] : []), ...anchors, ...(seg.refs || []).filter((r) => available[r]).map((r) => ({ name: r, file: available[r] }))].slice(0, maxRefs);
    if (prev && !dry && !existsSync(run.path(prev))) { say(`  ${key}: the previous segment's last frame is missing; stopping`); ok = false; break; }
    if (dry) { K.made[n] = { clip: file, mode: "direct", model, seconds: seg.seconds, prompt: seg.prompt, refs: refs.map((x) => `${x.name}=${x.file}`), anchors, start: prev, dry: true }; say(`  ${key}: ${seg.seconds} s${refs.length ? ` with ${refs.map((x) => "@" + x.name).join(", ")}` : ""} (dry run: estimated)`); continue; }
    let r, note = "", prompt = seg.prompt;
    for (const x of refs) if (!prompt.includes(`@${x.name}`)) prompt = (x.name === "previous" ? `Continue directly from @previous, the last frame of the previous segment: the same scene, style, people and objects, mid-action. ` : `Match @${x.name}. `) + prompt;   // the API binds a reference by its @name in the prompt
    if (prompt.length > PROMPT_LIMIT) prompt = prompt.slice(0, PROMPT_LIMIT - 1);
    try { r = await jobs.tvideo(key, file, prompt, refs, seg.seconds, { ...video, aspect_ratio: aspect }); }
    catch (e) { if (refs.length && /reference|400|invalid/i.test(String(e))) { note = `references refused by the model (${String(e).slice(0, 140)}); generated without them`; say(`  ${key}: ${note}`); r = await jobs.tvideo(key, file, seg.prompt, [], seg.seconds, { ...video, aspect_ratio: aspect }); } else throw e; }
    if (!dry && existsSync(run.path(file))) frame(run.path(file), "last", run.path(`clips/direct-${n}-last.png`));
    K.made[n] = { clip: file, mode: "direct", model, seconds: seg.seconds, rendered: !dry && existsSync(run.path(file)) ? Math.round(duration(run.path(file)) * 10) / 10 : null, prompt, narration: seg.narration, words: seg.words_on_screen, refs: refs.map((x) => `${x.name}=${x.file}`), anchors, start: prev, note: note || null, credits: r?.credits ?? null, cached: !!r?.cached, qa: { seconds: seg.seconds } };
    run.save(); say(`  ${key}: ${seg.seconds} s${refs.length ? ` with ${refs.map((x) => x.name).join(", ")}` : ""}${r?.cached ? " (cached)" : dry ? " (dry run: estimated)" : ` · ${r?.credits ?? "?"} credits`}`);
    parts.push(run.path(file));
  }
  if (!ok || dry) { K.film = null; return { ok: false, film: null, seconds, segments: segs.length }; }
  // the film: the one generation as it is, or the segments re-encoded back to back
  const film = "clips/film.mp4";
  if (parts.length === 1) copyFileSync(parts[0], run.path(film));
  else { const list = run.path("clips/concat.txt"); writeFileSync(list, parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n") + "\n"); execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", list, "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", run.path(film)]); }
  K.film = film; L.direct = { model, resolution: video.resolution, aspect, segments: segs, title: K.direct.title }; run.save();
  return { ok: true, film, seconds: Math.round(duration(run.path(film)) * 10) / 10, segments: segs.length };
}
