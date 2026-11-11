// Judge (Co-Director multimodal LLM judge on the compiled cut): per-shot rubric (5 × 0-20) on a contact sheet + start/last
// frames, per-join continuity flags (continuous vs cut), one whole-film rubric on the strips in order, and a reward
// = mean shot total × 0.6 + film total × 0.4. Each judge is one strict-JSON vision call, cached on disk by vision.js.
// Plan = storyboard.js schema (entities with look/size; shots with start/action/end/persist). Image paths: absolute or run-relative.
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { isAbsolute } from "node:path";
import { visionCallImages } from "../../pipeline-v2/src/vision.js";
import { net } from "./common.js";

const FF = existsSync("/opt/homebrew/bin/ffmpeg") ? "/opt/homebrew/bin/ffmpeg" : "ffmpeg";
const bool = { type: "boolean" }, str = { type: "string" }, score = { type: "integer", minimum: 0, maximum: 20 };
const obj = (props) => ({ type: "object", additionalProperties: false, required: Object.keys(props), properties: props });
const abs = (run, f) => (f && (isAbsolute(f) ? f : run.path(f)));
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

// Tile of frames from a clip (5 s at 2 fps = 10 frames in a 5×2 grid).
export function contactSheet(video, out, { fps = 2, cols = 5, rows = 2, w = 320 } = {}) {
  execFileSync(FF, ["-y", "-loglevel", "error", "-i", video, "-vf", `fps=${fps},scale=${w}:-2,tile=${cols}x${rows}`, "-frames:v", "1", "-q:v", "3", out]);
  return out;
}
const frameAt = (video, out, last = false) => (execFileSync(FF, ["-y", "-loglevel", "error", ...(last ? ["-sseof", "-0.1"] : []), "-i", video, "-frames:v", "1", "-q:v", "2", out]), out);

// Entity lines (look + real size) for a set of names; all entities when names is null.
const ents = (plan, names) => plan.entities.filter((e) => !names || names.includes(e.name)).map((e) => `- ${e.name} (${e.kind}): ${e.look}. Size: ${e.size}.`).join("\n");
const stateLine = (s) => `${s.name}: ${s.position}; holding ${s.holding ?? "nothing"}; held_by ${s.held_by ?? "none"}; placed_on ${s.placed_on ?? "none"}; ${s.condition}`;
const shotOf = (plan, id) => plan.shots.find((s) => s.id === id);
const shotBrief = (plan, s) => {
  const names = [...s.start.entities.map((e) => e.name), s.location];
  return `Style: ${plan.style}
Entities (fixed look and real size):
${ents(plan, names)}
Shot ${s.id} at ${s.location} (${s.link}). Start state (${s.start.time_light}): ${s.start.description}
${s.start.entities.map(stateLine).join("\n")}
Action (the only motion): ${s.action}
End changes: ${s.end.changes.map((c) => `${c.name}.${c.attr}: ${c.from} → ${c.to}`).join("; ") || "none"}
Must persist after this shot: ${s.persist.map((p) => `${p.name}.${p.attr} = ${p.to}`).join("; ") || "none"}`;
};

const SHOT = obj({
  scores: obj({ action_adherence: score, entity_fidelity: score, scale_and_interaction: score, spatial_continuity: score, visual_quality: score }),
  issues: { type: "array", items: str }, primary_fault: { type: "string", enum: ["storyboard", "keyframe", "video", "none"] },
  end_state_ok: bool, persisted_ok: bool,
});
export async function judgeShot(run, plan, shot, { strip, startFrame, lastFrame }) {
  const imgs = [["a contact sheet of the clip (10 frames, 2 per second, left to right, top to bottom)", strip], ["the planned start frame", startFrame], ["the real last frame", lastFrame]].filter(([, f]) => f);
  const text = `You judge one 5-second shot of an AI film against its plan. Images, in order: ${imgs.map(([d], i) => `image ${i + 1} = ${d}`).join("; ")}.
${shotBrief(plan, shot)}

Score each criterion 0-20 (20 = perfect, 10 = clear flaws, 0 = fails). Be strict.
- action_adherence: the clip shows exactly the action, one action, nothing invented.
- entity_fidelity: each entity matches its look; each character appears once; no extra people.
- scale_and_interaction: each prop is at its stated real size next to hands and people; held_by, placed_on and holding are as planned; the character interacts with the correct thing.
- spatial_continuity: positions and layout match the start state; the place stays the same throughout.
- visual_quality: sharp, no artifacts or morphing, no text or grids, matches the style.
issues: short strings, one per problem ([] if none).
primary_fault: "storyboard" if the plan itself cannot work, "keyframe" if the problem is already in the start frame, "video" if the motion broke it, "none".
end_state_ok: the end changes are visible by the last frame (true if there are none).
persisted_ok: the must-persist items are visible at the end (true if there are none).`;
  const r = await net(() => visionCallImages("judgeshot", SHOT, text, imgs.map(([, f]) => abs(run, f))));
  return { id: shot.id, scores: r.scores, total: sum(r.scores), issues: r.issues, primary_fault: r.primary_fault, end_state_ok: r.end_state_ok, persisted_ok: r.persisted_ok };
}

const JOIN = {
  continuous: obj({ same_place: bool, same_framing: bool, same_state: bool, motion_continues: bool, jump_visible: bool, notes: str }),
  cut: obj({ world_consistent: bool, state_carried: bool, size_consistent: bool, notes: str }),
};
export async function judgeJoin(run, plan, from, to, { lastFrame, firstFrame, link }) {
  const a = shotOf(plan, from), b = shotOf(plan, to), names = [...new Set([...a.start.entities, ...b.start.entities].map((e) => e.name))];
  const ask = link === "continuous"
    ? `This join is continuous: shot ${to} must continue the same moment.
- same_place: same place. same_framing: same camera position and framing.
- same_state: positions, holding and condition of every entity unchanged.
- motion_continues: image 2 looks like the next instant of image 1, not a reset or a new take.
- jump_visible: a viewer would see a jump at the join.`
    : `This join is a cut to a new setup.
- world_consistent: same world, entities, looks and time of day as the story expects.
- state_carried: persisted changes and held or placed props match the previous shot.
- size_consistent: each entity has the same real size in both images.`;
  const text = `Image 1 = the last frame of shot ${from}; image 2 = the first frame of shot ${to}.
Entities (fixed look and real size):
${ents(plan, names)}
Shot ${from}: ${a.action} End: ${a.end.description} Persist: ${a.persist.map((p) => `${p.name}.${p.attr} = ${p.to}`).join("; ") || "none"}
Shot ${to} start: ${b.start.description}
${b.start.entities.map(stateLine).join("\n")}
${ask}
notes: one short sentence on the biggest problem, or "".`;
  const r = await net(() => visionCallImages(`judgejoin${link === "continuous" ? "c" : "x"}`, JOIN[link === "continuous" ? "continuous" : "cut"], text, [abs(run, lastFrame), abs(run, firstFrame)]));
  return { from, to, link, ...r };
}

const FILM = obj({
  scores: obj({ coherence: score, consistency: score, transformations_carried: score, pacing: score, overall_quality: score }),
  best_shot: str, worst_shot: str, summary: str,
});
// strips = [{ id, file }] in film order; more than 10 are stacked into at most 10 images.
export async function judgeFilm(run, plan, { strips }) {
  const per = Math.ceil(strips.length / 10), groups = [];
  for (let i = 0; i < strips.length; i += per) groups.push(strips.slice(i, i + per));
  const imgs = groups.map((g, i) => {
    if (g.length === 1) return abs(run, g[0].file);
    const out = run.path(`judge-film-${String(i + 1).padStart(2, "0")}.jpg`);
    execFileSync(FF, ["-y", "-loglevel", "error", ...g.flatMap((s) => ["-i", abs(run, s.file)]), "-filter_complex", `vstack=inputs=${g.length}`, "-q:v", "3", out]);
    return out;
  });
  const text = `You judge a whole AI film with no audio. Each image is a contact sheet of 5-second shots (10 frames per shot, left to right, top to bottom), in film order: ${groups.map((g, i) => `image ${i + 1} = shot${g.length > 1 ? "s" : ""} ${g.map((s) => s.id).join(", ")}${g.length > 1 ? " (stacked top to bottom)" : ""}`).join("; ")}.
Style: ${plan.style}
Entities (fixed look and real size):
${ents(plan, null)}
Plan:
${plan.shots.map((s) => `${s.id} (${s.link}, ${s.location}): ${s.action}${s.persist.length ? ` [persist: ${s.persist.map((p) => `${p.name}.${p.attr} = ${p.to}`).join("; ")}]` : ""}`).join("\n")}

Score each 0-20 (20 = perfect). Be strict.
- coherence: the story is readable without audio.
- consistency: same characters, props, sizes and places across the film.
- transformations_carried: state changes persist in later shots.
- pacing: shot order and rhythm serve the story.
- overall_quality: visual quality and style across the film.
best_shot, worst_shot: shot ids. summary: two sentences.`;
  const r = await net(() => visionCallImages("judgefilm", FILM, text, imgs));
  return { scores: r.scores, total: sum(r.scores), best_shot: r.best_shot, worst_shot: r.worst_shot, summary: r.summary };
}

// shots = [{ id, clip, strip, startFrame, lastFrame, link }] in film order (run-relative or absolute).
export async function judgeCut(run, plan, { shots }) {
  if (run.estimate) return { skipped: true };
  const sheet = (s) => s.strip ?? contactSheet(abs(run, s.clip), run.path(`${s.id}-strip.jpg`));
  const first = (s) => s.firstFrame ?? frameAt(abs(run, s.clip), run.path(`${s.id}-judge-first.jpg`));
  const last = (s) => s.lastFrame ?? frameAt(abs(run, s.clip), run.path(`${s.id}-judge-last.jpg`), true);
  const items = shots.map((s) => ({ ...s, strip: sheet(s), lastFrame: last(s) }));
  // Each judge is settled on its own. One failure used to reject the whole Promise.all and throw away every judge that had
  // already succeeded — all of it paid for. Partial results are kept and the failures are listed on the record instead.
  const settle = (label, p) => Promise.resolve(p).then((v) => ({ ok: true, v }), (e) => ({ ok: false, label, error: String(e?.message ?? e) }));
  const [shotS, joinS, filmS] = await Promise.all([
    Promise.all(items.map((s) => settle(`shot ${s.id}`, judgeShot(run, plan, shotOf(plan, s.id), s)))),
    Promise.all(items.slice(1).map((s, i) => settle(`join ${items[i].id}→${s.id}`, judgeJoin(run, plan, items[i].id, s.id, { lastFrame: items[i].lastFrame, firstFrame: first(s), link: s.link ?? shotOf(plan, s.id).link })))),
    settle("film", judgeFilm(run, plan, { strips: items.map((s) => ({ id: s.id, file: s.strip })) })),
  ]);
  const failed = [...shotS, ...joinS, filmS].filter((r) => !r.ok).map(({ label, error }) => ({ label, error }));
  const shotRes = shotS.filter((r) => r.ok).map((r) => r.v), joins = joinS.filter((r) => r.ok).map((r) => r.v), film = filmS.ok ? filmS.v : null;
  const mean = shotRes.reduce((n, s) => n + s.total, 0) / (shotRes.length || 1);
  // The reward weights shots 0.6 and the film 0.4; without the film judge it is the shot mean alone, and says so.
  const reward = shotRes.length ? Math.round((film ? mean * 0.6 + film.total * 0.4 : mean) * 10) / 10 : null;
  return { shots: shotRes, joins, film, reward, ...(film ? {} : { reward_basis: "shots only — the film judge failed" }),
    ...(failed.length ? { failed } : {}), computed_at: new Date().toISOString() };
}
