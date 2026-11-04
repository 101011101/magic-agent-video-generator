// Tier 3: a story with a setting block and one paragraph per clip, each clip with its reference decision; then each clip is a
// tier-1 call through make.js, the previous clip's last frame handed on when the clip continues the previous one, a user picture
// or a clean generated still when it does not depend on it, nothing otherwise; then the join and the voice-over.
import { jsonCall, S } from "../../V2/backend/lib/llm.js";
import { execFileSync } from "node:child_process";
const frame = (video, at, out) => { execFileSync("ffmpeg", ["-v", "error", "-y", ...(at === "last" ? ["-sseof", "-0.15"] : ["-ss", String(at)]), "-i", video, "-frames:v", "1", "-update", "1", out]); return out; };
import { makeClip, makeStill, voiceOver, joinClips, mixVoice } from "./make.js";

const STORY = S.obj({ title: S.str, setting: S.str,
  clips: S.arr(S.obj({ n: S.int, seconds: S.int, paragraph: S.str, sound: S.enum(["none", "ambient", "music", "narration", "dialogue"]), exact_words: S.arr(S.str),
    depends_on_previous: S.bool, reference: S.enum(["last-frame", "user-picture", "generated-still", "none"]), reference_why: S.str, still_description: S.str, still_placement: S.enum(["start", "end", "whole"]) })),
  narration: S.str, questions: S.arr(S.str) });

export async function storyFor({ brief, P, attachments, previousStory = null, answers = "" }) {
  const refs = attachments.filter((a) => a.use !== "ignore").map((a) => `${a.name}: ${a.role}${a.seen ? ` (${a.seen})` : ""}`).join("; ") || "none";
  return jsonCall({ name: "v4-story-v1", effort: "medium", schema: STORY, prompt: `Turn this request into a short film STORY for ${P.clips || "2–4"} clips of 8–20 seconds each, total about ${P.seconds || 45} seconds, aspect ${P.aspect}, sound ${P.sound}.
REQUEST: ${brief}
${P.exact_words && P.exact_words !== "[]" ? `EXACT WORDS that must appear on screen somewhere in the film (put each in the exact_words of the clip where it is seen, verbatim): ${P.exact_words}\n` : ""}${answers ? `THE USER ALSO SAID: ${answers}\n` : ""}USER PICTURES: ${refs}
${previousStory ? `EARLIER DRAFT (keep what the user did not change): ${JSON.stringify(previousStory)}\n` : ""}
SETTING (100–180 words, before the story): the world and time; each place relationally and concretely; each person or animal with a name and 2–4 visual anchors; the light and grade of the whole film. These exact words are reused wherever the thing appears.
CLIPS: one clip per scene or key idea (a new place or a new subject is a new clip); a logo or end card is ALWAYS its own clip of 4–6 seconds (reference generated-still, still_placement whole) and never part of the scene before it; consecutive clips that continue the same place and moment are marked depends_on_previous so they can be chained. One paragraph each (60–120 words): everything that happens in that clip and nothing from another; actions in order with plain verbs; any spoken line short and quoted; what is seen and at what scale; how it ends. Per clip also: seconds; sound; exact_words (strings that must be readable on screen, e.g. a logo's name; usually []); depends_on_previous = true only when it CONTINUES the previous clip's last image (same place, same moment); reference = "last-frame" if it depends on the previous clip, else "user-picture" if one of the user's pictures is what this clip must show (a logo end card, a product, a place), else "generated-still" if the clip needs a specific designed image that words cannot carry (a logo end card with exact lettering when no picture was given), else "none"; reference_why in one sentence; still_description = when reference is generated-still, a 60–100-word text-to-image description of that still (the exact words quoted), else ""; still_placement = where that still sits in the clip: "start" (the clip grows out of it), "end" (an end card the clip finishes on; the scene before it is generated without a reference) or "whole" (the clip is the card held still), else "whole".
NARRATION: if sound is narration, the full voice-over script for the whole film as it will be SPOKEN: plain sentences only, in clip order, about 2.5 words a second, persuasive and concrete; no timestamps, no headings, no quotation marks, no stage directions; else "".
QUESTIONS: up to 3 plain questions for the user ONLY where the request leaves something the story cannot decide (a missing name on a logo, which animals, the date of an event); [] when nothing is missing.` });
}

// Group the story's clips into calls: a run of consecutive clips that each continue the previous one becomes ONE call when the
// run fits the model's maximum (one scene, one idea, told in one take); a longer run is chained by last frame; a clip that does
// not continue the previous one starts a new group with its own reference (none, a user picture, or a generated still).
export function groupClips(clips, maxSeconds = 60) {
  const groups = []; let cur = null;
  for (const c of clips) {
    if (cur && c.depends_on_previous && cur.seconds + c.seconds <= maxSeconds && cur.reference !== "generated-still" && c.reference !== "generated-still") { cur.members.push(c.n); cur.seconds += c.seconds; cur.paragraph += `\n\nThen, continuing without a cut: ${c.paragraph}`; cur.exact_words = [...new Set([...cur.exact_words, ...c.exact_words])]; continue; }
    cur = { n: groups.length + 1, members: [c.n], seconds: c.seconds, paragraph: c.paragraph, sound: c.sound, exact_words: [...c.exact_words], depends_on_previous: c.depends_on_previous, reference: c.depends_on_previous ? "last-frame" : c.reference, reference_why: c.reference_why, still_description: c.still_description, still_placement: c.still_placement }; groups.push(cur);
  }
  return groups;
}

export async function produce({ story, P, attachments, run, jobs, say = console.log, DRY = false }) {
  const rec = run.log; rec.clips = rec.clips || [];
  const groups = groupClips(story.clips, 60); rec.groups = groups.map((g) => ({ call: g.n, story_clips: g.members, seconds: g.seconds, reference: g.reference })); run.save();
  say(`${story.clips.length} story clips → ${groups.length} call(s): ${groups.map((g) => `[${g.members.join("+")}] ${g.seconds}s ${g.reference}`).join(" · ")}`);
  let lastFrame = null;
  for (const c of groups) {
    const key = `clip-${c.n}`;
    const entry = { n: c.n, seconds: c.seconds, sound: c.sound, reference: c.reference, reference_why: c.reference_why, depends_on_previous: c.depends_on_previous };
    rec.clips[c.n - 1] = entry; run.save();
    let ref = null;
    if (c.reference === "last-frame" && lastFrame) ref = { file: lastFrame, kind: "last-frame" };
    else if (c.reference === "user-picture") { const pick = attachments.find((a) => a.use === "reference") || attachments[0]; if (pick) ref = { file: pick.file, kind: "user-picture", name: pick.name }; }
    else if (c.reference === "generated-still" && c.still_description) { const still = await makeStill({ key: `${key}-still`, description: c.still_description, aspect: P.aspect, exactWords: c.exact_words, run, jobs, say, DRY }); ref = { file: still.file, kind: "generated-still", prompt: still.prompt, credits: still.credits }; }
    entry.reference_used = ref ? { kind: ref.kind, file: ref.file, name: ref.name, prompt: ref.prompt, credits: ref.credits } : null;
    const brief = `SETTING:\n${story.setting}\n\nCLIP ${c.n} (${c.seconds} seconds${c.n < groups.length ? `; what happens in the next clip is not shown here` : `; the last clip`}):\n${c.paragraph}`;
    const snd = c.sound === "narration" ? "none" : c.sound;
    if (ref?.kind === "generated-still" && (c.still_placement === "end" || c.still_placement === "whole")) {
      // an end card is never a start frame: the scene is made without a reference, then the card is its own short held clip from the still
      const cardSecs = Math.min(5, c.seconds), sceneSecs = c.seconds - cardSecs;
      if (sceneSecs >= 3 && c.still_placement === "end") { const scene = await makeClip({ key: `${key}-scene`, brief: `${brief}\n(The end card is a separate shot; do not show any card, logo or lettering in this scene.)`, seconds: sceneSecs, aspect: P.aspect, sound: snd, exactWords: [], run, jobs, say, DRY }); entry.scene = scene; }
      const card = await makeClip({ key: `${key}-card`, brief: `A ${cardSecs}-second end card: the supplied image held almost motionless (a very slow, barely perceptible push in), fully readable throughout, nothing else happening. Lettering must stay exactly as in the image.`, seconds: cardSecs, aspect: P.aspect, sound: "none", exactWords: c.exact_words, startFrame: ref.file, run, jobs, say, DRY });
      entry.card = card;
      if (!DRY) { const parts = [entry.scene?.file, card.file].filter(Boolean); entry.file = parts.length > 1 ? await joinClips({ files: parts, out: `${key}.mp4`, transition: "dissolve", run, say }) : card.file; entry.prompt = `${entry.scene?.prompt || ""}\n\n[card] ${card.prompt}`; entry.credits = (entry.scene?.credits || 0) + (card.credits || 0); entry.kind = "scene + held end card"; entry.review = card.review; }
    } else {
      const out = await makeClip({ key, brief, seconds: c.seconds, aspect: P.aspect, sound: snd, exactWords: c.exact_words, startFrame: ref?.file || null, run, jobs, say, DRY });
      Object.assign(entry, out);
    }
    run.save();
    if (!DRY && entry.file) { lastFrame = `${key}-last.jpg`; frame(run.path(entry.file), "last", run.path(lastFrame)); entry.last_frame = lastFrame; }
  }
  if (DRY) return { clips: rec.clips, estimated: true };
  const files = rec.clips.filter((c) => c?.file).map((c) => c.file);
  if (files.length === groups.length) {
    rec.film = await joinClips({ files, out: "film.mp4", run, say });
    if (P.sound === "narration" && story.narration) { const vo = await voiceOver({ script: story.narration, out: "narration.mp3", run, say }); rec.narration = vo; rec.film = await mixVoice({ video: rec.film, voice: vo.file, out: "film-voiced.mp4", run, say }); }
  }
  run.save(); return { clips: rec.clips, film: rec.film, narration: rec.narration };
}
