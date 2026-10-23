// SB Storyboard: each screenplay scene becomes panels (keyframes), one LLM call per scene, all scenes in parallel.
// A panel is ONE instant (any number of things may change in it). It states what we see (vivid, with screen direction; the image
// edit uses it), its environment, the elements in frame (ids), the screenplay beats it covers, what changes (moves from → to),
// and, for an element new to a continuous scene, the beat that introduces it. Code then checks the one hard rule (every element
// in a panel has a source) and folds the panels into rows for the state manager.
import { jsonCall, S } from "./llm.js";

const ID = { type: "string", pattern: "^[a-z][a-z0-9-]*$" };
const PANEL = S.obj({
  action: S.str,                                                   // what happens in this instant, plainly
  elements: S.arr(ID),
  beats: S.arr(S.int),
  enters: S.arr(S.obj({ id: ID, where: S.str, doing: S.str })),   // elements new to the picture: where they are, what they do
  changes: S.arr(S.obj({ id: ID, now: S.str })),                   // elements that act or move: one phrase of what they do now
  leaves: S.arr(ID),                                               // elements that go out of the picture in this instant
  introductions: S.arr(S.obj({ id: ID, beat: S.int })),
});

// The instruction sent to the storyboard model for one scene (shown and editable in the kaizen scene studio).
export function storyboardPrompt(scene, k, { assets, envs }) {
  const beats = scene.beats.map((b, j) => `  ${j + 1}. ${b.kind === "dialogue" ? `${b.who}: "${b.text}"` : b.text}`).join("\n");
  const envText = envs.map((e) => `- ${e.id}: ${e.look || ""}\n    layout (fixed, from the painted plate): ${(e.marks || []).filter((m) => !m.area).map((m) => `${m.name} — ${m.essential || m.where}`).join("; ")}`).join("\n");
  return `You are the storyboard artist of an animated storybook film. Break this screenplay scene into PANELS. Each panel is one
keyframe: ONE instant in time (several things may happen in it at once). Pick the moments a viewer must see for the scene to
read, in order; a beat that only continues a motion needs no panel. Usually 2-6 panels per scene.
For each panel:
- action: ONE plain sentence of what happens in this instant: who does what, with what, to whom ("Mother hands Red the basket";
  "The wolf knocks on the green door"). No camera or composition words (no "view", "close", "on the left"); say a direction only
  when the story needs it (toward us, away from us). The picture is edited from the previous panel, so describe the change, not
  the whole picture.
- elements: the ids of every tracked asset in the picture (from the list below). Something inside a container (bread in the
  basket) stays listed while its container is. Fixed things of the environment (its bed, door, table) are not elements: name
  them in words.
- beats: the beat numbers this panel covers.
- enters: every element that is new to the picture in this panel (in the FIRST panel of a scene: all of them): where it is, as
  a spot of the environment's layout in plain words ("on the path near us", "in the bed", "at the green door"), and doing: its
  pose or activity in a few words ("standing, holding the basket on her arm"; "lying under the quilt, head on the pillow").
- changes: elements that act or move in this instant: {id, now}, "now" one short phrase of what they do ("hands over the
  basket"; "lies down under the quilt"). Unchanged elements are not listed.
- leaves: elements that go out of the picture in this instant (walks away, is swallowed, is carried out). Only these are removed;
  an element missing from "elements" by mistake is NOT removed.
- introductions: an element in this panel that was not in the previous panel of this scene and does not walk, run or come in on
  screen: the beat that introduces it. The first panel of a scene needs no introductions.
environment: the one environment this scene happens in. Use its layout: where the bed, door and table really are.

Environments:\n${envText}
Tracked assets:\n${assets.map((a) => `- ${a.id}: ${a.name}`).join("\n")}

Scene ${k}: ${scene.inside ? "INT." : "EXT."} ${scene.place} — ${scene.time}${scene.cut ? " (after a cut)" : ""}
${beats}`;
}

export async function storyboardScene(scene, k, ctx, { prompt = null } = {}) {
  return jsonCall({ name: "storyboard", effort: "medium", schema: S.obj({ environment: S.enum(ctx.envs.map((e) => e.id)), panels: S.arr(PANEL) }), prompt: prompt || storyboardPrompt(scene, k, ctx) });
}

// The one hard rule, by code: every element in a panel has a source. Sources: the scene's first panel (a new scene may start
// with anything), the previous panel of the same scene, or an introduction naming a beat of the scene. Returns violations.
export function checkPanels(board) {
  const bad = [];
  board.forEach((sc, i) => sc.panels.forEach((p, j) => {
    if (j === 0) return;
    const prev = new Set(sc.panels[j - 1].elements), intro = new Set(p.introductions.map((x) => x.id)), moved = new Set(p.changes.map((c) => c.id));
    for (const id of p.leaves || []) if (!prev.has(id)) bad.push(`scene ${i + 1} panel ${j + 1}: ${id} leaves but was not in the previous panel`);
    for (const id of p.elements) if (!prev.has(id) && !intro.has(id) && !moved.has(id)) bad.push(`scene ${i + 1} panel ${j + 1}: ${id} has no source (not in the previous panel, not introduced, not moving in)`);
  }));
  return bad;
}
