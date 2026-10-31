// EDIT: the clips and the film. The clip prompt is a transcription of the shot (FRAMES, CAST with the feature lines, MOMENT
// with the end-of-shot intention, BEATS with seconds relative to the clip, PEOPLE, SOUND); each clip is image-to-video pinned
// on its two stills, then checked by the clip gate (frames at two per second: count, order, identity drift) and transcribed.
// One attempt per run; the only automatic resubmission is for a content-filter rejection (a policy-safe prompt, once).
// The stitch normalises the clips, concatenates them, and burns the captions (top) and subtitles (bottom) as overlay cards.
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { key } from "../lib/env.js";
import { VIDEO } from "../lib/jobs.js";
import { video as videoProfile } from "../lib/models.js";
import { frames, clipEnds, stitch, hasAudio } from "../lib/media.js";
import { captionCard, burnCaptions, subtitlesFromScript } from "../lib/captions.js";
import { inFrame, norm } from "../screenplay/screenplay.js";

const strip = (s) => String(s ?? "").trim().replace(/[.;,\s]+$/, ""), t = (s) => strip(s).replace(/^[A-Z]/, (c) => c.toLowerCase()), cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function clipPrompt({ shot, scene, state, voices }) {
  const name = (id) => state.name(id), els = state.els, named = (text) => els.filter((e) => e.kind === "character" || e.kind === "prop").reduce((s, e) => s.replace(new RegExp(`\\b${e.id}\\b`, "gi"), e.name), String(text ?? ""));
  const rel = (at) => Math.max(0, at - shot.start), ids = [...new Set([...shot.first.people, ...shot.last.people].filter(inFrame).map((p) => p.id))];
  const cast = ids.map((id) => { const f = shot.first.people.find((p) => p.id === id), l = shot.last.people.find((p) => p.id === id); return `- ${name(id)}: ${strip(state.features[id] || "as in the frames")}; ${f && inFrame(f) ? `${f.third} third at the start` : "enters during the shot"}${l && inFrame(l) && f && l.third !== f.third ? `, ${l.third} third at the end` : ""}.`; });
  const arc = shot.last.people.filter(inFrame).map((p) => ({ p, q: shot.first.people.find((x) => x.id === p.id) })).filter(({ p, q }) => q && norm(p.doing) !== norm(q.doing)).map(({ p }) => `${name(p.id)}: ${named(t(p.doing))}`);
  const beats = [...shot.action.map((a) => ({ at: a.at, text: `${cap(named(t(a.text)))}.` })), ...shot.lines.map((l) => ({ at: l.at, text: `${name(l.who)} (${t(voices?.[l.who]) || "a natural voice of the period"}) says: "${l.text}"` })), ...shot.sfx.map((x) => ({ at: x.at, text: `SFX: ${named(t(x.text))}.` }))].sort((a, b) => a.at - b.at);
  return [`FRAMES\nImage 1 is the first frame and image 2 the last frame of one continuous ${shot.seconds}-second shot; the camera holds still. ${PACE[shot.pace] || PACE.natural}${shot.treatment ? ` ${cap(named(t(shot.treatment)))}.` : ""}${shot.motion?.length && shot.motion[0] !== "none" ? ` Motion cues: ${shot.motion.join(", ")}.` : ""}${scene.synopsis ? `\nScene: ${named(t(scene.synopsis))}.` : ""}`,
    ...(cast.length ? [`CAST (each keeps his own face, hair, beard and glasses in every frame)\n${cast.join("\n")}`] : []),
    `MOMENT\n${named(cap(t(shot.moment)))}.\nTone: ${t(scene.tone)}.${arc.length ? `\nBy the end: ${arc.join("; ")}.` : ""}`,
    `BEATS (seconds from the start of the clip)\n${beats.map((b) => `- ${rel(b.at)} s: ${b.text}`).join("\n") || "- none: a held moment."}${shot.lines.length ? "\nLips move with the words." : ""}`,
    `PEOPLE\n${ids.length} ${ids.length === 1 ? "person" : "people"} and nobody else; they move naturally and end exactly as in image 2; nothing appears that is not in the frames.`,
    `SOUND\nAmbient noise: ${t(scene.ambience)}${shot.lines.length ? "; the voices clearly" : ""}; no music of any kind (the film's music is added afterwards); no narration; no subtitles.`].join("\n\n");
}
// The TEXT-TO-VIDEO form of the same shot: the scene is text and the keyframes are named references (@start, @end), with
// the portraits as @id references, so the video model is guided by the frames rather than pinned to them (the user's
// reading of the first film: a pinned end frame fights the physics of a fast shot). Up to 10 references on wan-3.0.
export const PACE = { still: "Nothing moves but the people's small natural motion.", slow: "Slow, deliberate motion.", natural: "Natural pace.", fast: "FAST: everything that moves crosses the frame quickly, with motion blur; the air and the camera shake with speed.", frantic: "FRANTIC: whip-fast motion, heavy motion blur, hard shake; nothing is calm." };
export function t2vPrompt({ shot, scene, state, voices, refs, script }) {
  const name = (id) => state.name(id), els = state.els, named = (text) => els.filter((e) => e.kind === "character" || e.kind === "prop").reduce((s, e) => s.replace(new RegExp(`\\b${e.id}\\b`, "gi"), e.name), String(text ?? ""));
  const rel = (at) => Math.max(0, at - shot.start), ids = [...new Set([...shot.first.people, ...shot.last.people].filter(inFrame).map((p) => p.id))], has = (n) => refs.some((r) => r.name === n);
  const cast = ids.map((id) => { const f = shot.first.people.find((p) => p.id === id), l = shot.last.people.find((p) => p.id === id); return `- ${has(id) ? `@${id}, ` : ""}${name(id)}: ${strip(state.features[id] || "as in the frames")}; ${f && inFrame(f) ? `${f.third} third at the start` : "enters during the shot"}${l && inFrame(l) && f && l.third !== f.third ? `, ${l.third} third at the end` : ""}.`; });
  const beats = [...shot.action.map((a) => ({ at: a.at, text: `${cap(named(t(a.text)))}.` })), ...shot.lines.map((l) => ({ at: l.at, text: `${name(l.who)} (${has(`${l.who}_voice`) ? `in the voice of @${l.who}_voice` : t(voices?.[l.who]) || "a natural voice"}) says: "${l.text}"` })), ...shot.sfx.map((x) => ({ at: x.at, text: `SFX: ${named(t(x.text))}.` }))].sort((a, b) => a.at - b.at);
  const n = script ? script.scenes.length : 0;
  return [`SHOT\nOne continuous ${shot.seconds}-second ${shot.size} shot from one still camera. It begins as @start and ends as @end: the same place, the same people and things in the same positions as those two frames, with the action below happening between them. ${PACE[shot.pace] || PACE.natural}`,
    `CONTEXT\n${scene.inside ? "INT." : "EXT."} ${name(scene.place)}, ${String(scene.time || "").toLowerCase()}${n ? `; scene ${scene.n} of ${n}` : ""}. ${cap(named(t(shot.moment)))}. Tone: ${t(scene.tone)}.`,
    ...(cast.length ? [`CAST (each keeps the face, hair and build of the portrait reference in every frame)\n${cast.join("\n")}`] : []),
    `BEATS (seconds from the start of the clip)\n${beats.map((b) => `- ${rel(b.at)} s: ${b.text}`).join("\n") || "- none: a held moment."}${shot.lines.length ? "\nLips move with the words." : ""}`,
    `PEOPLE\n${ids.length} ${ids.length === 1 ? "person" : "people"} and nobody else; nothing appears that is not in @start or @end.`,
    `SOUND\nAmbient noise: ${t(scene.ambience)}${shot.lines.length ? "; the voices clearly" : ""}; no music of any kind (the film's music is added afterwards); no narration; no subtitles.`].join("\n\n");
}
// A clip prompt the content filter rejected, made plainer by rule: names and positions only in CAST, no lip-sync sentence.
export const policySafe = (prompt) => prompt.split("\n\n").map((block) => block.startsWith("CAST") ? block.replace(/^CAST \(.*\)$/m, "CAST").replace(/^- ([^:\n]+): .*?; ((?:enters during the shot|(?:left|centre|right) third at the start).*)$/gm, "- $1: $2") : block).join("\n\n").replace("Lips move with the words.", "They speak the lines.");

async function transcribe(run, file) {
  if (!hasAudio(run.path(file))) return "";   // a clip without a sound track has nothing to transcribe
  const mp3 = run.path(file.replace(/\.mp4$/, ".mp3")); execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", run.path(file), "-vn", "-acodec", "libmp3lame", "-q:a", "4", mp3]);
  const form = new FormData(); form.append("model", "gpt-4o-mini-transcribe"); form.append("file", new Blob([readFileSync(mp3)], { type: "audio/mpeg" }), "clip.mp3");
  return fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { authorization: `Bearer ${key("OPENAI_API_KEY")}` }, body: form }).then((r) => r.json()).then((x) => x.text || "").catch(() => "");
}

// mode: pinned (image-to-video on the first and last still, as built) | start (image-to-video on the first still only; the
// end still is painted but not pinned) | t2v (text-to-video with the two stills and the portraits as named references).
// Every rendered variant is kept under K.variants[n][mode]; K.made[n] is the variant of the mode last asked for.
export async function makeClips({ state, jobs, K, run, say = console.log, only = null, video = VIDEO, model = video.model, parallel = 3, mode = "pinned", voiceRefs = false }) {
  K.made ??= {}; K.attempts ??= {}; K.variants ??= {};
  const variant = model === "wan-3.0" ? mode : `${mode}@${model}`;   // a variant is a mode on a model
  const scene = (n) => state.script.scenes.find((x) => x.n === n), todo = state.clips.filter((c) => !only || only.has(`clip-${c.n}`));
  const chainBad = (id) => { for (let e = state.still(id); e; e = state.still(e.env)) { if (!K.painted[e.id] || K.painted[e.id].bad) return e.id; } return null; };   // a still, or anything it was built on, missing or flagged
  const pool = async (items, n, fn) => { const q = [...items], width = Number(n) > 0 ? Math.min(Math.round(Number(n)), q.length) : q.length; await Promise.all(Array.from({ length: Math.max(1, width) }, async () => { while (q.length) await fn(q.shift()); })); };   // n ≤ 0: all at once
  await pool(todo, parallel, async (c) => {
    if (K.made[c.n]?.clip && !K.made[c.n].error && (K.made[c.n].variant || K.made[c.n].mode || "pinned") === variant && K.made[c.n].start === K.painted[c.start]?.file && K.made[c.n].end === K.painted[c.end]?.file) return;
    const prior = K.variants[c.n]?.[variant], fresh = prior?.clip && !prior.error && prior.start === K.painted[c.start]?.file && prior.end === K.painted[c.end]?.file;   // rendered earlier in this mode on this model FROM THESE STILLS; a repainted still or a failed render means a new render (or a resumed job)
    if (fresh) { K.made[c.n] = prior; run.save(); return; }
    const start = K.painted[c.start]?.file, end = K.painted[c.end]?.file, blocker = chainBad(c.start) || chainBad(c.end);
    if (!start || !end || blocker) { say(`  clip ${c.n}: waiting on ${blocker || "its stills"}`); return; }
    if (K.painted[c.start].card && K.painted[c.end].card) { const file = `clips/s${c.n}.mp4`; execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-loop", "1", "-i", run.path(start), "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", String(c.seconds), "-vf", "scale=1280:720,format=yuv420p", "-r", "24", "-c:v", "libx264", "-c:a", "aac", "-shortest", run.path(file)]); K.made[c.n] = { clip: file, start, end, card: true, qa: { first_vs_start: 1, last_vs_end: 1, seconds: c.seconds }, identity: { ok: true, note: "title card" }, heard: "", attempt: 1 }; run.save(); say(`  clip ${c.n}: title card, ${c.seconds} s, by code`); return; }
    if (K.painted[c.start].card !== K.painted[c.end].card) { K.made[c.n] = { error: "one frame is a title card and the other is not; a card is a whole shot", start, end }; run.save(); say(`  clip ${c.n}: FAILED ${K.made[c.n].error}`); return; }
    const sc = scene(c.scene), shot = sc.shots.find((h) => h.n === c.n), tag = (mode === "pinned" ? "" : `-${mode}`) + (model === "wan-3.0" ? "" : `-${model.replace(/[^a-z0-9]/gi, "")}`), k = (K.attempts[`clip-${c.n}${tag}`] || []).length, base = `${tag}${k ? `-r${k}` : ""}`;
    const speakers = [...new Set(shot.lines.map((l) => l.who))].filter((id) => state.bank[id]?.voice?.sample);   // the bank's voice samples as audio references, so the clip speaks in the chosen voice
    const refs = mode === "t2v" ? [{ name: "start", file: start }, { name: "end", file: end }, ...[...new Set([...shot.first.people, ...shot.last.people].filter(inFrame).map((p) => p.id))].filter((id) => state.bank[id]?.file).map((id) => ({ name: id, file: state.bank[id].file })), ...(voiceRefs ? speakers.map((id) => ({ name: `${id}_voice`, file: state.bank[id].voice.sample, voice: true })) : [])].slice(0, 10) : null;
    let made, prompt = mode === "t2v" ? t2vPrompt({ shot, scene: sc, state, voices: state.voices, refs, script: state.script }) : clipPrompt({ shot, scene: sc, state, voices: state.voices }), suffix = base;
    // The whole body is guarded: a failure of the render OR of the checks after it is recorded for this clip alone, and the
    // other workers finish their clips (a crash here once orphaned a render in flight).
    for (let a = 1; a <= 2; a++) {
      const file = `clips/s${c.n}${suffix}.mp4`;
      try {
        const job = mode === "t2v" ? await jobs.tvideo(`clip-${c.n}${suffix}`, file, prompt, refs, c.seconds, { ...VIDEO, ...video, model, audio: true }) : await jobs.video(`clip-${c.n}${suffix}`, file, prompt, start, mode === "start" ? null : end, c.seconds, { ...VIDEO, ...video, model, audio: true });
        if (job.estimated) { say(`  clip ${c.n}: would be made (${c.seconds} s, ${job.credits} credits); dry run, nothing sent`); return; }
        const ends = clipEnds(run.path(file), { start: run.path(start), end: run.path(end), path: (f) => run.path(`clips/${f}`), key: `s${c.n}${suffix}` });
        frames(run.path(file), run.path(`clips/s${c.n}${suffix}`), 2);
        const ff = []; for (let i = 1; existsSync(run.path(`clips/s${c.n}${suffix}-f${String(i).padStart(2, "0")}.jpg`)); i++) ff.push(`clips/s${c.n}${suffix}-f${String(i).padStart(2, "0")}.jpg`);
        const identity = await state.clipCheck(ff, shot, c.seconds), heard = shot.lines.length ? await transcribe(run, file) : "";
        say(`  clip ${c.n}${suffix}: first≈start ${ends.first_vs_start} last≈end ${ends.last_vs_end} · identity ${identity.ok ? "ok" : `FLAGGED${identity.drift ? " (drift)" : ""}${identity.badFrames?.length ? ` frames ${identity.badFrames.join(",")}` : ""}`} · ${identity.note}${heard ? ` · heard: ${heard}` : ""}`);
        made = { clip: file, mode, model, variant, start, end, qa: ends, identity, heard, prompt, refs: refs?.map((r) => `${r.name}=${r.file}`), attempt: k + 1 }; break;
      } catch (e) {
        const msg = String(e).slice(0, 300);
        if (msg.includes('"code":"nsfw"') && !suffix.endsWith("-p")) { prompt = policySafe(prompt); suffix = `${base}-p`; say(`  clip ${c.n}: rejected by the content filter; resubmitting once with the policy-safe prompt`); continue; }
        say(`  clip ${c.n}: FAILED ${msg}`); made = { error: msg, mode, model, variant, prompt, start, end, ...(existsSync(run.path(file)) ? { clip: file, unchecked: true } : {}) }; break;
      }
    }
    K.made[c.n] = made; (K.variants[c.n] ??= {})[variant] = made; run.save();
  });
  return { failed: todo.filter((c) => K.made[c.n] && (!K.made[c.n].clip || K.made[c.n].error)), flagged: todo.filter((c) => K.made[c.n]?.clip && !K.made[c.n].error && !K.made[c.n].identity?.ok), waiting: todo.filter((c) => !K.made[c.n]) };
}

// SEQUENCES (--clips seq): the user's reading after the first two films: a clip pinned between two stills fights the physics
// of a fast shot, and a 3-second clip has no room to move. A sequence is ONE text-to-video clip for a run of consecutive
// shots of a scene (up to maxSeq seconds, rendered at the smallest grid length that holds them and trimmed at the stitch),
// with every keyframe of those shots as an ordered named reference (@f1 … ; frames before portraits, ten at most) and the
// cuts stated in the text; nothing is pinned, so the model keeps its own motion between the frames it is shown.
export function seqPrompt({ group, state, voices, refs, script }) {
  const name = (id) => state.name(id), els = state.els, named = (text) => els.filter((e) => e.kind === "character" || e.kind === "prop").reduce((s, e) => s.replace(new RegExp(`\\b${e.id}\\b`, "gi"), e.name), String(text ?? ""));
  const t0 = group[0].c.start_at, total = group.reduce((n, g) => n + g.c.seconds, 0), has = (n) => refs.some((r) => r.name === n);
  const scene = group[0].sc, cuts = [], multi = group.some((g) => g.sc.n !== scene.n); let at = 0; for (const g of group.slice(0, -1)) { at += g.c.seconds; cuts.push(at); }
  const ids = [...new Set(group.flatMap((g) => [...g.shot.first.people, ...g.shot.last.people].filter(inFrame).map((p) => p.id)))];
  const shots = group.map((g, i) => {
    const h = g.shot, from = g.c.start_at - t0, beats = [...h.action.map((a) => ({ at: a.at, text: `${cap(named(t(a.text)))}.` })), ...h.lines.map((l) => ({ at: l.at, text: `${name(l.who)} (${has(`${l.who}_voice`) ? `in the voice of @${l.who}_voice` : t(voices?.[l.who]) || "a natural voice"}) says: "${l.text}"` })), ...h.sfx.map((x) => ({ at: x.at, text: `SFX: ${named(t(x.text))}.` }))].sort((a, b) => a.at - b.at);
    const mv = h.camera?.move && h.camera.move !== "static" ? ` Camera: ${h.camera.move} during the shot.` : " The camera holds still.";
    return `SHOT ${h.n} (${from}–${from + h.seconds} s of the clip)${multi ? `, ${g.sc.inside ? "INT." : "EXT."} ${name(g.sc.place)}` : ""}, ${h.size} shot, ${PACE[h.pace] || PACE.natural}${h.treatment ? ` ${cap(named(t(h.treatment)))}.` : ""}${h.motion?.length && h.motion[0] !== "none" ? ` Motion cues: ${h.motion.join(", ")}.` : ""}${mv} It begins as @${g.startRef}${g.endRef ? ` and ends as @${g.endRef}` : " and holds that framing"}. ${cap(named(t(h.moment)))}.${beats.length ? `\n${beats.map((b) => `- ${Math.max(0, b.at - t0)} s: ${b.text}`).join("\n")}` : ""}${h.lines.length ? "\nLips move with the words." : ""}`;
  });
  const cast = ids.map((id) => `- ${has(id) ? `@${id}, ` : ""}${name(id)}: ${strip(state.features[id] || "as in the frames")}.`);
  return [`SEQUENCE\nOne ${total}-second clip covering ${group.length === 1 ? `shot ${group[0].shot.n}` : `shots ${group[0].shot.n} to ${group.at(-1).shot.n}`} of the film${cuts.length ? `, with a HARD CUT to a new camera position at ${cuts.map((s) => `${s} s`).join(", ")}; within each shot the camera moves only as that shot says` : "; the camera moves only as the shot says"}. The frames named below are the keyframes of these shots, in order; the clip passes through each of them at its second.`,
    `CONTEXT\n${scene.inside ? "INT." : "EXT."} ${name(scene.place)}, ${String(scene.time || "").toLowerCase()}${script ? `; scene ${scene.n} of ${script.scenes.length}` : ""}.${multi ? group.filter((g, i, a) => a.findIndex((x) => x.sc.n === g.sc.n) === i).map((g) => g.sc.synopsis ? ` Scene ${g.sc.n}: ${named(t(g.sc.synopsis))}.` : "").join("") : scene.synopsis ? ` Scene: ${named(t(scene.synopsis))}.` : ""}${script?.theme ? ` Theme: ${t(script.theme)}.` : ""} Tone: ${t(scene.tone)}.`,
    ...shots,
    ...(cast.length ? [`CAST (each keeps the face, hair and build of the portrait reference in every frame)\n${cast.join("\n")}`] : []),
    `PEOPLE\n${ids.length} ${ids.length === 1 ? "person" : "people"} and nobody else; nothing appears that is not in the frames.`,
    `SOUND\nAmbient noise: ${multi ? [...new Set(group.map((g) => t(g.sc.ambience)))].join("; then ") : t(scene.ambience)}${ids.some((id) => group.some((g) => g.shot.lines.some((l) => l.who === id))) ? "; the voices clearly" : ""}; no music of any kind (the film's music is added afterwards); no narration; no subtitles.`].join("\n\n");
}
export async function makeSequences({ state, jobs, K, run, say = console.log, video = VIDEO, model = video.model, parallel = 0, maxSeq = 15, voiceRefs = false, grid = [2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30], only = null, across = false, speedUp = 1 }) {
  K.made ??= {}; K.attempts ??= {}; K.sequences ??= {};
  const scene = (n) => state.script.scenes.find((x) => x.n === n), chainBad = (id) => { for (let e = state.still(id); e; e = state.still(e.env)) { if (!K.painted[e.id] || K.painted[e.id].bad) return e.id; } return null; };
  // Grouping: consecutive shots of one scene while the total stays within maxSeq; a title card is its own group.
  const MAX_REFS_V = videoProfile(model).maxRefs || 10, MAX_FRAMES = Math.min(8, MAX_REFS_V - 1);   // the model's reference cap from the registry; frames first, then portraits and voices fill what is left
  const groups = [], framesOf = (g) => g.reduce((n, x) => n + (x.c.end !== x.c.start ? 2 : 1), 0); let cur = null;   // 8 frames leave room for two portraits or voices within the ten references
  for (const c of state.clips) {
    const card = K.painted[c.start]?.card, sc = scene(c.scene), shot = sc.shots.find((h) => h.n === c.n), item = { c, sc, shot };
    if (card || !cur || (!across && cur[0].sc.n !== sc.n) || cur.reduce((n, g) => n + g.c.seconds, 0) + c.seconds > maxSeq || framesOf(cur) + (c.end !== c.start ? 2 : 1) > MAX_FRAMES || K.painted[cur[0].c.start]?.card) { cur = [item]; groups.push(cur); } else cur.push(item);   // across: a scene change is just another hard cut
  }
  const pool = async (items, n, fn) => { const q = [...items], width = Number(n) > 0 ? Math.min(Math.round(Number(n)), q.length) : q.length; await Promise.all(Array.from({ length: Math.max(1, width) }, async () => { while (q.length) await fn(q.shift()); })); };
  const wanted = only ? groups.filter((g) => g.some((x) => only.has(`clip-${x.shot.n}`) || only.has(`seq-${g[0].shot.n}-${g.at(-1).shot.n}`))) : groups;   // --only clip-7 names the group holding shot 7
  await pool(wanted, parallel, async (group) => {
    const key = `${group[0].shot.n}-${group.at(-1).shot.n}`, total = group.reduce((n, g) => n + g.c.seconds, 0);
    if (K.sequences[key]?.clip) return;
    const first = group[0].c, last = group.at(-1).c;
    if (K.painted[first.start]?.card) {   // a card sequence: by code, as a clip
      const file = `clips/seq-${key}.mp4`; execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-loop", "1", "-i", run.path(K.painted[first.start].file), "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", String(total), "-vf", "scale=1280:720,format=yuv420p", "-r", "24", "-c:v", "libx264", "-c:a", "aac", "-shortest", run.path(file)]);
      K.sequences[key] = { clip: file, shots: group.map((g) => g.shot.n), seconds: total, rendered: total, card: true, identity: { ok: true, note: "title card" } }; for (const g of group) K.made[g.c.n] = { sequence: key, card: true, clip: file, identity: { ok: true, note: "title card" } }; run.save(); say(`  sequence ${key}: title card, ${total} s, by code`); return;
    }
    const blocker = group.map((g) => chainBad(g.c.start) || chainBad(g.c.end)).find(Boolean), missing = group.some((g) => !K.painted[g.c.start]?.file || !K.painted[g.c.end]?.file);
    if (blocker || missing) { say(`  sequence ${key}: waiting on ${blocker || "its stills"}`); return; }
    // References: the frames in order (a held shot has one), then portraits while room remains, then voice samples.
    const refs = []; let i = 0;
    for (const g of group) { g.startRef = `f${++i}`; refs.push({ name: g.startRef, file: K.painted[g.c.start].file }); if (g.c.end !== g.c.start) { g.endRef = `f${++i}`; refs.push({ name: g.endRef, file: K.painted[g.c.end].file }); } else g.endRef = null; }
    const ids = [...new Set(group.flatMap((g) => [...g.shot.first.people, ...g.shot.last.people].filter(inFrame).map((p) => p.id)))];
    for (const id of ids) if (refs.length < MAX_REFS_V && state.bank[id]?.file) refs.push({ name: id, file: state.bank[id].file });
    if (voiceRefs) for (const id of [...new Set(group.flatMap((g) => g.shot.lines.map((l) => l.who)))]) if (refs.length < MAX_REFS_V && state.bank[id]?.voice?.sample) refs.push({ name: `${id}_voice`, file: state.bank[id].voice.sample, voice: true });
    // A fast sequence may be rendered longer and played back faster at the stitch (speedUp 1.4 = 40% faster motion).
    const fast = speedUp > 1 && group.every((g) => ["fast", "frantic"].includes(g.shot.pace)), want = fast ? total * speedUp : total;
    const rendered = grid.find((s) => s >= want) ?? Math.ceil(want), k = (K.attempts[`seq-${key}`] || []).length, suffix = k ? `-r${k}` : "", file = `clips/seq-${key}${suffix}.mp4`;
    const prompt = seqPrompt({ group, state, voices: state.voices, refs, script: state.script });
    let made;
    try {
      const job = await jobs.tvideo(`seq-${key}${suffix}`, file, prompt, refs, rendered, { ...VIDEO, ...video, model, audio: true });
      if (job.estimated) { say(`  sequence ${key}: would be made (${rendered} s for ${total} s of shots, ${job.credits} credits); dry run, nothing sent`); return; }
      const ends = clipEnds(run.path(file), { start: run.path(K.painted[first.start].file), end: run.path(K.painted[last.end].file), path: (f) => run.path(`clips/${f}`), key: `seq-${key}${suffix}` });
      frames(run.path(file), run.path(`clips/seq-${key}${suffix}`), 2);
      const ff = []; for (let j = 1; existsSync(run.path(`clips/seq-${key}${suffix}-f${String(j).padStart(2, "0")}.jpg`)); j++) ff.push(`clips/seq-${key}${suffix}-f${String(j).padStart(2, "0")}.jpg`);
      const pseudo = { first: group[0].shot.first, last: group.at(-1).shot.last, lines: group.flatMap((g) => g.shot.lines) };
      const identity = await state.clipCheck(ff, pseudo, rendered), heard = pseudo.lines.length ? await transcribe(run, file) : "";
      say(`  sequence ${key}${suffix} (${rendered} s rendered for ${total} s): first≈start ${ends.first_vs_start} last≈end ${ends.last_vs_end} · identity ${identity.ok ? "ok" : `FLAGGED${identity.badFrames?.length ? ` frames ${identity.badFrames.join(",")}` : ""}`} · ${identity.note}${heard ? ` · heard: ${heard}` : ""}`);
      made = { clip: file, mode: "seq", model, shots: group.map((g) => g.shot.n), seconds: total, rendered, speed: fast ? speedUp : 1, qa: ends, identity, heard, prompt, refs: refs.map((r) => `${r.name}=${r.file}`), attempt: k + 1 };
    } catch (e) { const msg = String(e).slice(0, 300); say(`  sequence ${key}: FAILED ${msg}`); made = { error: msg, mode: "seq", model, shots: group.map((g) => g.shot.n), seconds: total, prompt }; }
    K.sequences[key] = made; for (const g of group) K.made[g.c.n] = { sequence: key, clip: made.clip, identity: made.identity, error: made.error, mode: "seq" }; run.save();
  });
  const seqs = Object.values(K.sequences);
  return { failed: seqs.filter((s) => s.error), flagged: seqs.filter((s) => s.clip && !s.error && !s.identity?.ok), waiting: wanted.filter((g) => !K.sequences[`${g[0].shot.n}-${g.at(-1).shot.n}`]) };
}

export function stitchFilm({ state, K, run, subtitles = true }) {
  // In sequence mode the parts are the sequences in film order, each trimmed to its shots' total; otherwise one clip per shot.
  const seqKeys = K.sequences ? state.clips.map((c) => K.made[c.n]?.sequence).filter((k, i, a) => k && a.indexOf(k) === i) : [];
  const parts = seqKeys.length ? seqKeys.map((k) => ({ file: run.path(K.sequences[k].clip), seconds: K.sequences[k].seconds, speed: K.sequences[k].speed || 1 })) : state.clips.map((c) => run.path(K.made[c.n].clip));
  stitch(parts, run.path("clips/concat.txt"), run.path("clips/film-raw.mp4"));
  const cards = state.clips.filter((c) => K.made[c.n]?.card).map((c) => ({ from: c.start_at, to: c.start_at + c.seconds }));   // cards by code in either mode   // a caption that a title card already shows is not overlaid again
  const caps = state.script.scenes.flatMap((sc) => sc.captions).filter((c) => !cards.some((w) => c.at >= w.from && c.at < w.to)).sort((a, b) => a.at - b.at).map((c, i, all) => ({ file: captionCard(c.text, run.path(`clips/caption-${i + 1}.png`), { at: subtitles ? "top" : "bottom" }), from: c.at, to: Math.min(c.at + 4, all[i + 1]?.at ?? Infinity) }));
  const subs = subtitles ? subtitlesFromScript(state.script).map((s, i) => ({ file: captionCard(s.text, run.path(`clips/subtitle-${i + 1}.png`), { size: 26 }), from: s.from, to: s.to })) : [];
  burnCaptions(run.path("clips/film-raw.mp4"), run.path("clips/film.mp4"), [...caps, ...subs]);
  return "clips/film.mp4";
}
