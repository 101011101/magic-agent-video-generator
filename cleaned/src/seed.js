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
    camera: S.str,                                    // where the one camera stands and looks
    marks: S.arr(S.obj({ id: MARK_ID, name: S.str, where: S.str, size: S.str, faces: S.str, key: S.bool })),
    doors: S.arr(S.obj({ mark: MARK_ID, leads_to: S.str })),
    light: S.str,
  })),
  scale: S.arr(S.obj({ id: { type: "string", pattern: "^[a-z][a-z0-9-]*$" }, height: S.str })),
});

const PLAN_RULES = `Write the canonical GROUND PLAN of every place, from its one fixed camera. It is used once, to paint the empty place.
- camera: where the camera stands and what it looks at (height, wide or close). Keep it simple: one wall-facing or corner view.
- marks: every fixed item a character can be at, pass, or use, and every PART that has a direction. Ids are short: "bed",
  "bed.head", "bed.foot", "door", "window", "hearth", "sewing-table", "path.near", "path.far". A part's id is "<item>.<part>".
  where: in camera terms only: left / centre / right, near (foreground) / middle / far (back wall), against which wall, and next
  to which other mark. Example: "bed.head: headboard against the LEFT wall, nearest the camera; pillow on it".
  size: relative to a grown person ("waist high", "as long as a person lying down"). faces: which way it opens or points, or "".
  key: true for marks the story needs (the bed, its head, the door, anything a character uses).
- The marks must be consistent with each other and with physics: sizes fit the room, a bed's head and foot are its two ends,
  every door leads somewhere (doors), a window is in a wall, nothing floats or overlaps, there is a clear floor path between
  the marks the story uses.
- scale: every character and group, height relative to a grown person ("a small child, half a grown person").`;

export async function seedPlan(world, story) {
  return jsonCall({ name: "seed-plan", schema: PLAN, effort: "high",
    prompt: `${PLAN_RULES}\n\nPlaces:\n${world.locations.map((l) => `- ${l.id}: ${l.name}. ${l.look}`).join("\n")}\nCharacters:\n${world.entities.filter((e) => e.kind !== "prop").map((e) => `- ${e.id}: ${e.name}. ${e.look}`).join("\n")}\n\nThe story (what the places must allow):\n${story}` });
}

// The plate prompt is the plan itself, mark by mark.
export const platePrompt = (style, loc, gp, note = "") => `${frameStyle(style)}. One single image, not a grid, collage or storyboard. No text or labels.
Establishing view of ${loc.name}, empty of people and animals. ${loc.look}
Camera: ${gp.camera}. A full, lived-in, richly painted place in this style (not a sparse diagram), with exactly this layout:
${gp.marks.map((m) => `- ${m.name}: ${m.where}${m.size ? `; ${m.size}` : ""}${m.faces ? `; ${m.faces}` : ""}`).join("\n")}
${gp.doors.length ? `Doors: ${gp.doors.map((d) => `${gp.marks.find((m) => m.id === d.mark)?.name || d.mark} leads to ${d.leads_to}`).join("; ")}.\n` : ""}Light: ${gp.light}.${note ? `\nThe last try got this wrong; fix it: ${note}` : ""}`;

// One focused question per mark. observed_where is written in the same camera terms, from the picture. One required property
// per mark id: in a free list the model once answered only the first mark (custom-rrh2 cottage try 1) and the rest read as missing.
export async function observePlate(file, gp) {
  const OBS = S.obj({ marks: S.obj(Object.fromEntries(gp.marks.map((m) => [m.id, S.obj({ visible: S.bool, matches: S.bool, observed_where: S.str })]))), impossible: S.bool, quality: S.int, problems: S.str });
  const r = await jsonCall({ name: "seed-observe", schema: OBS, images: [file], effort: "medium",
    prompt: `This picture is meant to show a place with this layout, from this camera (${gp.camera}).
For each mark, look at the picture only and answer:
${gp.marks.map((m) => `- ${m.id}: ${m.name} — intended: ${m.where}`).join("\n")}
visible: the item (or part) is clearly in the picture. matches: it is where the intended text says (same side, same wall, same end).
observed_where: where it really is, in camera terms (left / centre / right, near / middle / far, against which wall, next to which
other mark). For a part with a direction (a bed's head and foot), say which end is which: the head is the end with the headboard
and pillow. Write "" if not visible.
impossible: true if anything is physically impossible: a door that could not open (it swings into a fireplace or furniture,
it hangs from nothing, it leads nowhere), overlapping or floating furniture. problems: one short sentence naming it, or "".
quality: 1-5, how rich, finished and in-style the painting is (5 = a finished storybook page; 1 = a sparse sketch or diagram).` });
  return gp.marks.map((m) => ({ id: m.id, ...r.marks[m.id], key: m.key, impossible: r.impossible, quality: r.quality, problems: r.problems }));
}

// Plates for every place: generate → observe → regenerate on a missing or contradicted key mark. The observed plan is canonical.
export async function makeSeed(plan, jobs, tracker, { estimate }) {
  const out = {};
  await Promise.all(plan.locations.map(async (loc) => {
    const gp = plan.seed.places.find((p) => p.id === loc.id);
    if (!gp) throw new Error(`seed: no ground plan for ${loc.id}`);
    let note = "", best = null;
    for (let t = 1; t <= PLATE_TRIES; t++) {
      const file = t === 1 ? `roots/${loc.id}.png` : `roots/${loc.id}-t${t}.png`;
      await jobs.image(t === 1 ? `root-${loc.id}` : `root-${loc.id}-t${t}`, file, platePrompt(plan.style, loc, gp, note));
      if (estimate) { best = { file, obs: [], bad: [] }; break; }
      const obs = await observePlate(jobs.run.path(file), gp);
      const bad = obs.filter((o) => o.key && (!o.visible || !o.matches)), imp = obs[0]?.impossible, q = obs[0]?.quality || 0;
      console.log(`  plate ${loc.id} try ${t}: ${bad.length ? bad.map((o) => `${o.id} ${o.visible ? "misplaced" : "missing"}`).join(", ") : "key marks ok"}${imp ? ` · impossible: ${obs[0].problems}` : ""} · quality ${q}`);
      // Best plate: correct layout first, then physically possible, then the better painting.
      const rank = (x) => x.bad.length * 100 + (x.imp ? 50 : 0) - x.q;
      const cur = { file, obs, bad, t, imp, q };
      if (!best || rank(cur) < rank(best)) best = cur;
      if (!bad.length && !imp && q >= 3) break;
      note = [...bad.map((o) => `${o.id} must be: ${gp.marks.find((m) => m.id === o.id).where}${o.visible ? ` (it is: ${o.observed_where})` : " (missing)"}`),
        imp ? `physically impossible: ${obs[0].problems}` : "", q < 3 ? "paint a full, finished storybook page, not a sparse sketch" : ""].filter(Boolean).join("; ");
    }
    // Canonical marks: the picture's answer where it saw the mark; marks it could not see are dropped (unusable by the steps).
    const marks = estimate ? gp.marks : gp.marks.filter((m) => best.obs.find((o) => o.id === m.id)?.visible)
      .map((m) => { const o = best.obs.find((x) => x.id === m.id); return { ...m, intended: m.where, where: o.matches ? m.where : o.observed_where }; });
    out[loc.id] = { ...gp, marks, plate: best.file, tries: best.t || 1, unresolved: best.bad.map((o) => o.id) };
    tracker.addPlate(loc.id, best.file);
  }));
  return out;
}
