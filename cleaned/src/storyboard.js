// SB Storyboard: each screenplay scene becomes panels (keyframes), one LLM call per scene, all scenes in parallel.
// A panel is ONE instant (any number of things may change in it). It states what we see (vivid, with screen direction; the image
// edit uses it), its environment, the elements in frame (ids), the screenplay beats it covers, what changes (moves from → to),
// and, for an element new to a continuous scene, the beat that introduces it. Code then checks the one hard rule (every element
// in a panel has a source) and folds the panels into rows for the state manager.
import { jsonCall, S } from "./llm.js";

const ID = { type: "string", pattern: "^[a-z][a-z0-9-]*$" };
const PANEL = S.obj({
  what_we_see: S.str,
  elements: S.arr(ID),
  beats: S.arr(S.int),
  changes: S.arr(S.obj({ id: ID, from: S.str, to: S.str, pose: S.str, expression: S.str })),
  introductions: S.arr(S.obj({ id: ID, beat: S.int })),
});

export async function storyboardScene(scene, k, { assets, envs }) {
  const beats = scene.beats.map((b, j) => `  ${j + 1}. ${b.kind === "dialogue" ? `${b.who}: "${b.text}"` : b.text}${b.sfx ? `   [sfx: ${b.sfx}]` : ""}`).join("\n");
  return jsonCall({ name: "storyboard", effort: "medium",
    schema: S.obj({ environment: S.enum(envs.map((e) => e.id)), panels: S.arr(PANEL) }),
    prompt: `You are the storyboard artist of an animated storybook film. Break this screenplay scene into PANELS. Each panel is one
keyframe: ONE instant in time (several things may change in it at once). Pick the moments a viewer must see for the scene to
read, in order; a beat that only continues a motion needs no panel. Usually 2-6 panels per scene.
For each panel:
- what_we_see: one or two vivid present-tense sentences of exactly what is in the picture at that instant, with screen direction
  (toward / away from us, left / right) and how bodies are placed ("Red crawls out of the slit in the wolf's belly onto the
  quilt, squinting at the light"). Never "appears at" or similar abstractions.
- elements: the ids of every tracked asset visible in the picture (from the list below; environments are not elements).
- beats: the beat numbers this panel covers.
- changes: what changed since the previous panel: an element that moves (from where to where, in plain words), its pose and
  expression now. An element that does not change is not listed.
- introductions: an element visible here that was not in the previous panel of this scene and does not walk, run or come in on
  screen: the beat that introduces it. The first panel of a scene needs no introductions (a new scene may start with anything).
environment: the one environment this scene happens in (from the list below).

Environments:\n${envs.map((e) => `- ${e.id}: ${e.look || e.camera || e.id}`).join("\n")}
Tracked assets:\n${assets.map((a) => `- ${a.id}: ${a.name}`).join("\n")}

Scene ${k}: ${scene.inside ? "INT." : "EXT."} ${scene.place} — ${scene.time}${scene.cut ? " (after a cut)" : ""}
Background sound: ${scene.ambience || "—"}
${beats}` });
}

// The one hard rule, by code: every element in a panel has a source. Sources: the scene's first panel (a new scene may start
// with anything), the previous panel of the same scene, or an introduction naming a beat of the scene. Returns violations.
export function checkPanels(board) {
  const bad = [];
  board.forEach((sc, i) => sc.panels.forEach((p, j) => {
    if (j === 0) return;
    const prev = new Set(sc.panels[j - 1].elements), intro = new Set(p.introductions.map((x) => x.id)), moved = new Set(p.changes.map((c) => c.id));
    for (const id of p.elements) if (!prev.has(id) && !intro.has(id) && !moved.has(id)) bad.push(`scene ${i + 1} panel ${j + 1}: ${id} has no source (not in the previous panel, not introduced, not moving in)`);
  }));
  return bad;
}
