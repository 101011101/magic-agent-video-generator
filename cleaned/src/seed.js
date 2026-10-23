// S0 Seed: a canonical ground plan per place, used once to make a plate that is logically consistent, then read back.
//   1. plan    (LLM)  marks: every fixed item and named part (bed.head), where it is from the one camera, its size,
//                     which way it faces; doors say where they lead. Checked against each other (sizes fit, doors lead somewhere).
//   2. plate   (image) generated from the plan's own words, not from free prose.
//   3. observe (VLM)  focused questions per mark on the plate. Observed answers become the canonical plan (the picture wins);
//                     a missing or contradicted key mark regenerates the plate (at most PLATE_TRIES in all).
// After the seed, the plan only names the marks the step records may use; the frames carry everything else.
import { jsonCall, S } from "./llm.js";

const PLATE_TRIES = 3;
// Frames keep a painted edge: "film still" / "16:9" in a style pushes the editor to full-bleed re-paints, so plates and edits drop it.
export const frameStyle = (style) => style.replace(/,?\s*(16:9\s*)?film still/gi, "").replace(/,?\s*16:9/g, "").trim();
const MARK_ID = { type: "string", pattern: "^[a-z][a-z0-9-]*(\\.[a-z][a-z0-9-]*)?$" };
const PLAN = S.obj({
  places: S.arr(S.obj({
    id: { type: "string", pattern: "^[a-z][a-z0-9-]*$" },
    look: S.str,                                      // the place as a painter would describe it (materials, mood), no layout
    camera: S.str,                                    // where the one camera stands and looks
    marks: S.arr(S.obj({ id: MARK_ID, name: S.str, where: S.str, essential: S.str, area: S.bool, size: S.str, faces: S.str, key: S.bool })),
    doors: S.arr(S.obj({ mark: MARK_ID, leads_to: S.str, swing: S.str })),
    light: S.str,
  })),
  scale: S.arr(S.obj({ id: { type: "string", pattern: "^[a-z][a-z0-9-]*$" }, height: S.str })),
});

const PLAN_RULES = `Write the canonical GROUND PLAN of every place, from its one fixed camera. It is used once, to paint the empty place.
- camera: where the camera stands and what it looks at (height, wide or close). Keep it simple: one wall-facing or corner view.
- marks: every fixed item a character can be at, pass, or use, and every PART that has a direction. Never the story's
  characters or movable props (listed below): they are added to the frames later from their own sheets. Ids are short: "bed",
  "bed.head", "bed.foot", "door", "window", "hearth", "sewing-table", "path.near", "path.far". A part's id is "<item>.<part>".
  where: in camera terms only: left / centre / right, near (foreground) / middle / far (back wall), against which wall, and next
  to which other mark. Example: "bed.head: headboard against the LEFT wall, nearest the camera; pillow on it".
  size: relative to a grown person ("waist high", "as long as a person lying down"). faces: which way it opens or points, or "".
  essential: the ONE fact the story needs about the mark, at most 12 words, camera terms only (side, wall, end), no relations to
  other marks unless it is a part of one ("bed.head: against the back wall, pillow at this end"). Only essentials are checked.
  area: true for floor zones and paths that are open space, not objects (they are kept clear, never painted as things).
  key: true for marks the story needs (the bed, its head, the door, anything a character uses).
- doors: for each door, where it leads, and swing: which edge is hinged and where the open leaf rests, clear of everything
  ("hinged on its far edge, opens inward and lies flat against the left wall toward the camera, away from the hearth").
- The marks must be consistent with each other and with physics: sizes fit the room, a bed's head and foot are its two ends,
  every door leads somewhere (doors), a window is in a wall, nothing floats or overlaps, there is a clear floor path between
  the marks the story uses.
- scale: every character and group, height relative to a grown person ("a small child, half a grown person").`;

// The environment assets' specs (asset bank, spec half). fixtures: ids that stay in a place, which must be marks there with the
// same id; links: confirmed physical links (a room inside a house), whose constraints both places must respect.
export async function seedPlan(world, story, { fixtures = [], links = [] } = {}) {
  const fx = (pid) => fixtures.filter((f) => f.place === pid);
  const r = await jsonCall({ name: "seed-plan", schema: PLAN, effort: "high",
    prompt: `${PLAN_RULES}
- look: one or two sentences describing the place as a painter would (materials, mood, season), without layout.

Places:\n${world.locations.map((l) => `- ${l.id}: ${l.name}. ${l.look || ""}${fx(l.id).length ? `\n  Its marks MUST include these story things with exactly these ids: ${fx(l.id).map((f) => `${f.id} (${f.name})`).join(", ")}` : ""}`).join("\n")}
Characters and props (never marks):\n${world.entities.map((e) => `- ${e.id} (${e.kind}): ${e.name}. ${e.look || ""}`).join("\n")}
${links.length ? `\nPhysical links the places must respect (both sides):\n${links.map((l) => `- ${l.a} ${l.relation} ${l.b}: ${l.constraint}`).join("\n")}\n` : ""}
The story (what the places must allow):\n${story}` });
  // Belt and braces: drop any mark that is one of the story's entities. Open areas are never key (they are kept clear, not checked).
  const ents = new Set(world.entities.map((e) => e.id));
  for (const p of r.places) p.marks = p.marks.filter((m) => !ents.has(m.id.split(".")[0])).map((m) => ({ ...m, key: m.key && !m.area }));
  return r;
}

// The plate prompt is a painting brief, not the plan: the place's look, the camera, one essential fact per object, how each door
// swings, and the open areas to keep clear. The full plan (2,500 characters of chained clauses in custom-rrh3) gave the painter
// contradictions to guess at, such as a door wedged against the hearth.
export const platePrompt = (style, loc, gp, note = "", contents = []) => {
  const objs = gp.marks.filter((m) => !m.area), areas = gp.marks.filter((m) => m.area);
  return `${frameStyle(style)}. One single image, not a grid, collage or storyboard. No text or labels.
Establishing view of ${loc.name}, empty of people and animals. ${gp.look || loc.look || ""}
Camera: ${gp.camera}. A full, finished storybook painting of a lived-in place, with these facts:
${objs.map((m) => `- ${m.name}: ${m.essential || m.where}`).join("\n")}
${gp.doors.map((d) => `- ${gp.marks.find((m) => m.id === d.mark)?.name || d.mark}: ${d.swing || "opens freely"}; leads to ${d.leads_to}.`).join("\n")}
${contents.length ? `Already in the place, each where it naturally belongs (they are used later in the story):\n${contents.map((a) => `- ${a.name}: ${a.spec}`).join("\n")}\n` : ""}${areas.length ? `Keep clear (open floor, nothing standing there): ${areas.map((m) => m.name).join("; ")}.\n` : ""}Light: ${gp.light}${note ? `\nThe last try got this wrong; fix only this: ${note}` : ""}`;
};

// One focused question per essential fact (not the full chained "where"), one required property per mark id (a free list once
// answered only 1 of 14 marks), plus a separate door question: the general "impossible?" question missed a door into the hearth.
export async function observePlate(file, gp, contents = []) {
  const OBS = S.obj({ marks: S.obj(Object.fromEntries(gp.marks.map((m) => [m.id, S.obj({ visible: S.bool, holds: S.bool, observed_where: S.str })]))),
    contents: S.obj(Object.fromEntries(contents.map((a) => [a.id, S.obj({ visible: S.bool })]))),
    doors_open_freely: S.bool, quality: S.int, problems: S.str });
  const r = await jsonCall({ name: "seed-observe", schema: OBS, images: [file], effort: "medium",
    prompt: `This picture is meant to show an empty place from this camera (${gp.camera}). Answer from the picture only.
For each mark: visible (it is clearly in the picture; for an open area: the floor there is visible and clear), holds (this fact is
true in the picture), observed_where (where it really is, in camera terms; for a bed, which end has the headboard and pillow):
${gp.marks.map((m) => `- ${m.id}: ${m.name} — ${m.essential || m.where}`).join("\n")}
${contents.length ? `contents: is each of these clearly in the picture? ${contents.map((a) => `${a.id} (${a.name})`).join(", ")}\n` : ""}doors_open_freely: every door could swing fully open and closed without hitting a fireplace, furniture or a wall it is not hinged on.
quality: 1-5, how rich, finished and in-style the painting is (5 = a finished storybook page; 1 = a sparse sketch or diagram).
problems: one short sentence on anything physically impossible (a blocked door, overlapping or floating furniture), or "".` });
  const extra = { impossible: !r.doors_open_freely, quality: r.quality, problems: r.doors_open_freely ? r.problems : `door cannot open freely. ${r.problems}` };
  return [...gp.marks.map((m) => ({ id: m.id, ...r.marks[m.id], matches: r.marks[m.id].holds, key: m.key, ...extra })),
    ...contents.map((a) => ({ id: a.id, visible: r.contents[a.id].visible, matches: true, holds: true, observed_where: "", key: true, ...extra }))];
}

// Plates for every place: generate → observe → regenerate on a missing or contradicted key mark. The observed plan is canonical.
// plan.initial: { place: [asset ids] } from the solved states; plan.specs: asset specs (for painting initial contents).
export async function makeSeed(plan, jobs, tracker, { estimate }) {
  const out = {};
  await Promise.all(plan.locations.map(async (loc) => {
    const gp = plan.seed.places.find((p) => p.id === loc.id);
    if (!gp) throw new Error(`seed: no ground plan for ${loc.id}`);
    const contents = (plan.initial?.[loc.id] || []).map((id) => plan.specs.find((a) => a.id === id)).filter(Boolean);
    // Key = what the solved states actually use here (marks in beats and changes, their parent item) and the doors. Other marks
    // are painted but not checked: custom-rrh4 rejected good plates over a door latch and a "bare" bed surface.
    const used = plan.used?.[loc.id];
    if (used) { const doors = new Set(gp.doors.map((d) => d.mark)); gp.marks = gp.marks.map((m) => ({ ...m, key: !m.area && !m.id.includes(".") && (used.has(m.id) || doors.has(m.id) || [...used].some((u) => u.split(".")[0] === m.id)) })); }
    let note = "", best = null;
    for (let t = 1; t <= PLATE_TRIES; t++) {
      const file = t === 1 ? `roots/${loc.id}.png` : `roots/${loc.id}-t${t}.png`;
      await jobs.image(t === 1 ? `root-${loc.id}` : `root-${loc.id}-t${t}`, file, platePrompt(plan.style, loc, gp, note, contents));
      if (estimate) { best = { file, obs: [], bad: [] }; break; }
      const obs = await observePlate(jobs.run.path(file), gp, contents);
      const bad = obs.filter((o) => o.key && (!o.visible || !o.matches)), imp = obs[0]?.impossible, q = obs[0]?.quality || 0;
      console.log(`  plate ${loc.id} try ${t}: ${bad.length ? bad.map((o) => `${o.id} ${o.visible ? "misplaced" : "missing"}`).join(", ") : "key marks ok"}${imp ? ` · impossible: ${obs[0].problems}` : ""} · quality ${q}`);
      // Best plate: correct layout first, then physically possible, then the better painting.
      const rank = (x) => x.bad.length * 100 + (x.imp ? 50 : 0) - x.q;
      const cur = { file, obs, bad, t, imp, q };
      if (!best || rank(cur) < rank(best)) best = cur;
      if (!bad.length && !imp && q >= 3) break;
      note = [...bad.map((o) => { const m = gp.marks.find((x) => x.id === o.id); return `${m.name}: ${m.essential || m.where}${o.visible ? ` (it is: ${o.observed_where})` : " (missing)"}`; }),
        imp ? `physically impossible: ${obs[0].problems}` : "", q < 3 ? "paint a full, finished storybook page, not a sparse sketch" : ""].filter(Boolean).join("; ");
    }
    // The plan wins: the states were solved against these marks, so the marks stay; the plate is retried until it matches
    // (what is still off is reported). The observation is kept for the page.
    out[loc.id] = { ...gp, plate: best.file, tries: best.t || 1, unresolved: best.bad.map((o) => o.id), observed: best.obs, contents: contents.map((a) => a.id) };
    tracker.addPlate(loc.id, best.file, contents.map((a) => a.id));
  }));
  return out;
}
