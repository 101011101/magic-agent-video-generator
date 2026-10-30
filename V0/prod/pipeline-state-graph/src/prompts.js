// Prompts are derived from state differences, not written by an LLM: the seed frame's recorded state vs the wanted state.
// Image prompt = style + one-frame rule + composition + per-input role lines (seed: keep/transform; merges: take look and size;
// new entities: look and size) + per-entity differences. Video prompt = action + camera + sound line from the cue sheet.
import { ATTRS } from "./timeline.js";

// Real size in cm parsed from an entity's size text ("7 cm long, fits in a palm" → 7; "1.8 m tall" → 180); 0 when none.
export const cm = (t) => { const m = String(t).match(/(\d+(?:\.\d+)?)\s*(cm|m)\b/); return m ? Number(m[1]) * (m[2] === "m" ? 100 : 1) : 0; };
const SINGLE = "One single 16:9 film frame, not a grid, storyboard or collage; no text, borders, timecodes or signatures.";
const name = (id) => id;
const rel = (s) => (s.interacting_with?.length ? `; interacting with ${s.interacting_with.join(", ")}` : "");
const stateLine = (s) => `${s.pose}; ${s.position}${rel(s)}; ${s.condition}${s.wardrobe ? `; wearing ${s.wardrobe}` : ""}; lit: ${s.lighting}`;

// diffs between a recorded entity state (what a frame shows) and a wanted state, attribute by attribute.
export function diffState(shown, want) {
  return ATTRS.filter((a) => a !== "lighting").map((a) => {
    const x = Array.isArray(shown?.[a]) ? shown[a].join(", ") : shown?.[a] || "", y = Array.isArray(want[a]) ? want[a].join(", ") : want[a] || "";
    return x && y && x.trim().toLowerCase() !== y.trim().toLowerCase() ? { attr: a, from: x, to: y } : null;
  }).filter(Boolean);
}

// plan: { seed: frame|null, kept: [ids], merges: [{ frame, ids }], fresh: [ids] }; want: graph.want(); ents: graph.entities.
export function framePrompt({ style, want, plan, ents, frames }) {
  const lines = [`${style}. ${SINGLE}`, `Frame: ${want.framing}. ${want.description} Place: ${name(want.location.id)}, ${want.time}, ${want.weather}.`];
  let k = 1;
  if (plan.seed) {
    const s = plan.seed, same = s.location === want.location.id;
    lines.push(same
      ? `Image ${k} is an earlier frame of this same place (beat ${s.beat}). Transform it into the new frame: keep the place, its architecture, objects and the real size of everything exactly as in image ${k}; change only framing, positions, poses, light, time and weather as stated below.`
      : `Image ${k} is an earlier frame in another place. Keep ${plan.kept.join(", ") || "nothing"} from it exactly (same identity, face, hair, clothing, shape, colours and real size) and put them in the new place: ${ents[want.location.id]?.look || want.location.id}.`);
    for (const id of plan.kept) {
      const w = want.entities.find((e) => e.id === id), d = diffState(s.shows[id], w);
      lines.push(d.length ? `${name(id)}: as in image ${k}, but ${d.map((x) => `${x.attr.replace("_", " ")} changes from "${x.from}" to "${x.to}"`).join("; ")}.` : `${name(id)}: exactly as in image ${k} (${stateLine(w)}).`);
    }
    if (same && s.loc_version !== want.location.version) lines.push(`The place itself changes: ${ents[want.location.id]?.versions.find((v) => v.v === want.location.version)?.cause || ""}.`);
    // Whatever the seed shows that this frame does not want (or shows wrongly) is removed, so nothing is kept beside its replacement.
    const extra = Object.keys(s.shows).filter((id) => !plan.kept.includes(id) && ents[id] && ents[id].kind !== "location");
    if (extra.length) lines.push(`Remove from image ${k}: ${extra.map((id) => `the ${ents[id].kind === "character" ? "person" : "object"} standing for ${id}`).join(", ")}${extra.some((id) => want.entities.some((e) => e.id === id)) ? " (it is drawn again below, correctly)" : ""}. No other people than those listed.`);
    k++;
  }
  for (const m of plan.merges) {
    const f = frames(m.frame);
    lines.push(`Image ${k} is an earlier frame (beat ${f.beat}) showing ${m.ids.join(", ")}: take their exact identity, design, colours and real size from it (${m.ids.map((id) => `${id}: ${ents[id].size}`).join("; ")}) and merge them into the new frame; do not copy its framing or background.`);
    for (const id of m.ids) { const w = want.entities.find((e) => e.id === id); lines.push(`${name(id)}: ${stateLine(w)}.`); }
    k++;
  }
  // Root bindings (05-solver.md:57). Not a content source like a merge: the entity is already coming from the seed or a merge.
  // This is the canonical record of what it looks like, so identity is corrected against the original instead of drifting down
  // a chain of copies. Framing, pose, position and background of the root frame are explicitly not to be used.
  for (const r of plan.roots || []) {
    const f = frames(r.frame);
    lines.push(`Image ${k} is the canonical reference for ${r.ids.join(", ")} (beat ${f.beat}${r.op === "upload" ? ", the original photograph" : r.op === "anchor" ? ", drawn to establish its real size" : ""}). ${r.ids.length > 1 ? "Each of them must match it" : "It must match it"} exactly in identity — ${r.ids.map((id) => `${id}: ${ents[id].kind === "character" ? "face, age, hair, build and clothing design" : ents[id].kind === "location" ? "architecture and landscape" : "shape, design, colours, material"}, real size ${ents[id].size}`).join("; ")}. Take nothing else from image ${k}: not its framing, not its pose or position, not its background, not its light.`);
    k++;
  }
  for (const id of plan.fresh) {
    const w = want.entities.find((e) => e.id === id), e = ents[id];
    lines.push(`New in this frame, ${name(id)}: ${e.look} Real size: ${e.size}. ${stateLine(w)}.`);
  }
  if (!plan.seed) lines.push(`The place, ${name(want.location.id)}: ${ents[want.location.id]?.look || ""}`);
  lines.push(`Keep every real size consistent with the people and the place: ${want.entities.map((e) => `${e.id} ${ents[e.id].size}`).join("; ")}.`);
  const small = want.entities.filter((e) => e.kind === "prop" && cm(ents[e.id].size) > 0 && cm(ents[e.id].size) <= 30);
  if (small.length) lines.push(`Small objects are drawn small: ${small.map((e) => `${e.id} is only ${cm(ents[e.id].size)} cm, smaller than a hand; at this distance it is a small detail, never a large object`).join("; ")}.`);
  return lines.join("\n");
}

// Repair of a continuous start (the real last frame lacks what the next action needs): keep the frame, add the missing entities.
// missing: entities absent from the frame (added); wrong: present but wrong identity or size (replaced in place, nothing added beside them).
export function repairPrompt({ style, want, missing, wrong = [], ents, sources }) {
  const lines = [`${style}. ${SINGLE}`, `Image 1 is the current frame: keep its place, camera, framing, light and everything else exactly. Do not add any other person or object.`];
  let k = 2;
  for (const m of sources) { lines.push(`Image ${k++} is an earlier frame showing ${m.ids.join(", ")}: take their exact identity and real size from it.`); }
  for (const id of wrong) { const w = want.entities.find((e) => e.id === id); lines.push(`Replace the ${ents[id].kind === "character" ? "person" : "object"} that stands for ${name(id)} in image 1, in the same place and pose, with the correct ${name(id)} (${ents[id].look} Real size: ${ents[id].size}): ${stateLine(w)}.`); }
  for (const id of missing) { const w = want.entities.find((e) => e.id === id); lines.push(`Add ${name(id)} (${ents[id].look} Real size: ${ents[id].size}): ${stateLine(w)}.`); }
  return lines.join("\n");
}

// Anchor: the first appearance of a small prop, drawn in context with its scale partner (image 1 gives the partner's identity).
export function anchorPrompt({ style, prop, partner, ents, condition }) {
  const e = ents[prop];
  return [`${style}. ${SINGLE}`,
    `Close frame at eye level: ${partner}'s open hand holds ${prop} in the palm; the hand and ${prop} fill the lower half of the frame, ${partner}'s face is visible behind, in the same place and light as image 1.`,
    `Image 1 is an earlier frame showing ${partner}: keep the identity exactly (face, hair, clothing).`,
    `${prop}: ${e.look} Real size: ${e.size}. It is only ${cm(e.size)} cm long: smaller than the palm it rests on, with room around it; never larger than the hand. ${condition ? `Condition: ${condition}.` : ""}`].join("\n");
}

export function fixText(problems) { return `\nThe previous attempt had these faults; fix them:\n${problems.map((p) => `- ${p}`).join("\n")}`; }

// Video prompt: action + camera + the sound cue (wan-3.0 has no audio field; cues go in the prompt).
export function videoPrompt(beat, cue, ents, { continuous = false } = {}) {
  const sound = cue ? ` ${cue.replace(/\.\s*\./g, ".").replace(/\.?$/, ".")}` : "";
  const motion = continuous ? " The motion is already under way at the first frame; no pause, no restart." : "";
  const ids = [...new Set([...beat.start.entities, ...beat.end.entities].map((e) => e.id))].filter((id) => ents[id]?.kind === "prop");
  const sizes = ids.length ? ` Objects keep their real size: ${ids.map((id) => `${id} ${ents[id].size}`).join("; ")}.` : "";
  return `${beat.action} ${beat.camera}${motion}${sizes} No other people appear.${sound}`;
}
// A rejected prompt (content filter) falls back to the bare action: logged, never silent.
export function safeVideoPrompt(beat) { return `${beat.action} ${beat.camera}`; }
