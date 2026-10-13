// Keyframes: anchors (character sheets, in-context scale anchors for props, location plates with their fixtures drawn in),
// cut start frames built from the memory bank (base frame + extra frames + anchors + fresh entities + carried state),
// a FilmWorld closed-loop gate (record → diff → one corrected retry → keep the better attempt), in-place repair of a
// real last frame, and versioned anchors for persisted appearance changes. All file names are run-relative.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { COST } from "./common.js";

const SINGLE = "One single frame, not a grid, storyboard or collage; no text.";
const st = (name, o = {}) => ({ name, position: "", holding: null, held_by: null, placed_on: null, condition: "", ...o });
const copy = (run, from, to) => { if (run.has(from)) { mkdirSync(run.path(to.split("/").slice(0, -1).join("/") || "."), { recursive: true }); copyFileSync(run.path(from), run.path(to)); run.touch(to); } return to; };
const fixturesOf = (plan, loc) => plan.entities.filter((e) => e.fixture_of === loc);
const firstLocation = (plan, name) => plan.shots.find((s) => s.start.entities.some((x) => x.name === name))?.location ?? null;

// Size rule: in hand if the size names a hand/palm/pocket or every measure is under 30 cm; any measure >= 30 cm → beside.
export function inHand(size = "") {
  const s = size.toLowerCase();
  const cm = [...s.matchAll(/(\d+(?:\.\d+)?)\s*(mm|cm|m)\b/g)].map(([, n, u]) => +n * (u === "mm" ? 0.1 : u === "m" ? 100 : 1));
  if (cm.some((x) => x >= 30)) return false;
  if (/\b(palm|hand|fingers?|thumb|pocket|fist)\b/.test(s)) return true;
  return cm.length > 0;
}

// Anchor kind + prompt for one entity. partnerFile = the partner's anchor file (image 1 of the edit) or null.
export function anchorPrompt(plan, e, byName, partnerFile = null) {
  const { style } = plan;
  if (e.kind === "character") return { kind: "character", why: "character sheet",
    prompt: `${style}. Single frame, not a grid. Character reference of ${e.name}: ${e.look}. Full body, front view, standing, neutral pose, plain light grey background, even soft light.` };
  if (e.kind === "location") {
    const fx = fixturesOf(plan, e.name);
    return { kind: "location", why: fx.length ? `location plate with ${fx.map((f) => f.name).join(", ")} drawn in` : "location plate",
      prompt: `${style}. Single frame, not a grid. Location plate of ${e.name}: ${e.look}.` + fx.map((f) => ` It contains ${f.name}: ${f.look}; real size: ${f.size}.`).join("")
        + (fx.length ? " Draw each of them at its real size; a door, railing or chair in the place gives human scale." : "") + " Wide establishing view, empty, no people." };
  }
  const p = e.scale_partner && byName[e.scale_partner];
  if (p) {
    const hand = inHand(e.size), sheet = partnerFile ? `Image 1 is the character sheet of ${p.name}: identity only (face, hair, clothing); do not copy its pose or framing. ` : "";
    return hand
      ? { kind: "scale-hand", why: `scale anchor: in ${p.name}'s palm`,
        prompt: `${style}. Single frame, not a grid. ${sheet}${p.name} (${p.look}) holds ${e.name} (${e.look}; real size: ${e.size}) in an open palm, hand and forearm large in frame, ${e.name} at its true size relative to the hand; plain light grey background, even soft light.` }
      : { kind: "scale-beside", why: `scale anchor: beside ${p.name}`,
        prompt: `${style}. Single frame, not a grid. ${sheet}${p.name} (${p.look}) stands beside ${e.name} (${e.look}; real size: ${e.size}), full body, both fully in frame, ${e.name} at its true size relative to ${p.name}; plain light grey background, even soft light.` };
  }
  const loc = byName[firstLocation(plan, e.name)];
  return { kind: "context", location: loc?.name ?? null, why: `context anchor: in ${loc?.name ?? "its place"} for scale`,
    prompt: `${style}. Single frame, not a grid. ${e.name}: ${e.look}; real size: ${e.size}. Shown in ${loc ? `${loc.name} (${loc.look.replace(/\.$/, "")})` : "its natural setting"} at its true scale, with the scene for scale.` };
}

// Anchors for every entity in >= 1 shot (characters always); fixtures have none (drawn into the plate). uploads: optional { u1: file }.
export async function anchors(run, plan, memory, uploads = {}) {
  mkdirSync(run.path("refs"), { recursive: true });
  const byName = Object.fromEntries(plan.entities.map((e) => [e.name, e]));
  const seen = new Set(plan.shots.flatMap((s) => [s.location, ...s.start.entities.map((x) => x.name)]));
  // Props: a scale anchor only when a character holds it in some shot; a context anchor only when it is seen in 2+ places.
  // Other props enter as text in their first keyframe and are carried by the bank from then on (VideoMemory: anchor at first appearance).
  const held = new Set(plan.shots.flatMap((s) => s.start.entities.filter((x) => x.held_by).map((x) => x.name)));
  const places = (n) => new Set(plan.shots.filter((s) => s.start.entities.some((x) => x.name === n)).map((s) => s.location)).size;
  const want = plan.entities.filter((e) => !e.fixture_of && (e.kind === "character" || (e.kind === "location" ? seen.has(e.name)
    : e.upload || (e.scale_partner && byName[e.scale_partner] ? held.has(e.name) : places(e.name) >= 2))));
  run.log.anchors ??= {};
  const done = {};
  const make = async (e) => {
    const file = `refs/${e.name}.png`;
    if (e.upload) {
      copy(run, uploads[e.upload] ?? `uploads/${e.upload}.png`, file);
      run.log.anchors[e.name] = { file, prompt: null, inputs: [], kind: "upload", why: `upload ${e.upload}` };
      memory.setAnchor(e.name, file);
      if (!run.estimate) await memory.record({ file, shot: { id: "anchor", location: e.kind === "location" ? e.name : null }, role: "anchor", expected: [st(e.name)], sources: {} });
      return file;
    }
    const partner = e.kind === "prop" && e.scale_partner && byName[e.scale_partner] ? e.scale_partner : null;
    const partnerFile = partner ? (await done[partner]) ?? memory.anchor(partner) : null;
    const a = anchorPrompt(plan, e, byName, partnerFile), inputs = partnerFile ? [partnerFile] : [];
    await run.job(`anchor:${e.name}`, file, { prompt: a.prompt }, inputs, COST.image, () => run.image(`${run.caseId} anchor ${e.name}`, a.prompt, inputs, file));
    run.log.anchors[e.name] = { file, prompt: a.prompt, inputs, kind: a.kind, why: a.why };
    memory.setAnchor(e.name, file);
    if (!run.estimate) {
      const expected = e.kind === "location" ? [st(e.name), ...fixturesOf(plan, e.name).map((f) => st(f.name, { placed_on: e.name }))]
        : [st(e.name, { held_by: a.kind === "scale-hand" ? partner : null }), ...(partner ? [st(partner, { holding: a.kind === "scale-hand" ? e.name : null })] : [])];
      await memory.record({ file, shot: { id: "anchor", location: e.kind === "location" ? e.name : a.location ?? null }, role: "anchor", expected, sources: {} });
    }
    return file;
  };
  // Partners first: a prop's scale anchor waits on its partner's sheet so the hand belongs to that character.
  const order = [...want.filter((e) => e.kind === "character"), ...want.filter((e) => e.kind !== "character")];
  for (const e of order) done[e.name] = make(e);
  await Promise.all(Object.values(done));
  run.save();
  return run.log.anchors;
}

// One prompt line per anchor image, by anchor kind.
function anchorLine(run, plan, n, name) {
  const kind = run.log.anchors?.[name]?.kind ?? plan.entities.find((e) => e.name === name)?.kind;
  if (kind === "character" || (kind === "upload" && plan.entities.find((e) => e.name === name)?.kind === "character"))
    return `Image ${n} is the character sheet of ${name}: identity only (face, hair, clothing).`;
  if (kind === "scale-hand") return `Image ${n} shows ${name} at its true size in a hand: keep that size exactly.`;
  if (kind === "scale-beside") return `Image ${n} shows ${name} at its true size beside a person: keep that size exactly.`;
  if (kind === "location") return `Image ${n} is the plate of ${name}: take the architecture, objects and layout from it.`;
  return `Image ${n} shows ${name} at its true size in its place: keep its look and that size exactly.`;
}

const diffText = (d) => typeof d === "string" ? d : [d.attr, d.expected ?? d.want, d.got ?? d.saw ?? d.found].filter(Boolean).join(": ");
const stableCount = (entry, names) => names.filter((n) => entry?.entities?.[n]?.stable).length;
// Correction points from a bank entry: missing, duplicated, diffs; real size added when a diff concerns size.
function corrections(plan, entry, names) {
  const pts = [];
  for (const n of names) {
    const x = entry.entities?.[n], e = plan.entities.find((y) => y.name === n);
    if (!x || x.stable) continue;
    const ds = (x.diffs || []).map(diffText);
    if (!x.present) ds.unshift("missing; it must be in the frame");
    else if (x.count > 1) ds.unshift(`drawn ${x.count} times; it must appear once`);
    if (e?.size && ds.some((d) => /size|large|small|big|tiny|scale/i.test(d))) ds.push(`real size: ${e.size}`);
    if (ds.length) pts.push(`${n}: ${ds.join("; ")}`);
  }
  const art = entry.quality?.artifacts;
  for (const a of Array.isArray(art) ? art : art ? [art] : []) pts.push(`Image flaw: ${diffText(a)}`);
  return pts;
}
const summary = (entry, attempt, names) => entry && ({ attempt, id: entry.id, file: entry.file, stable: stableCount(entry, names), of: names.length,
  unstable: names.filter((n) => !entry.entities?.[n]?.stable), artifacts: entry.quality?.artifacts || [] });

// Start frame of a cut: memory.select → prompt → gate with one corrected retry; keeps the attempt with more stable entities.
export async function cutKeyframe(run, plan, memory, shot) {
  const id = shot.id, file = `${id}-start.png`, byName = Object.fromEntries(plan.entities.map((e) => [e.name, e]));
  const expected = shot.start.entities, names = expected.map((x) => x.name);
  run.log.keyframes ??= {};
  if (shot.start_upload) {
    copy(run, `uploads/${shot.start_upload}.png`, file);
    const entry = await memory.record({ file, shot, role: "start", expected, sources: Object.fromEntries(names.map((n) => [n, `upload:${shot.start_upload}`])) });
    const out = { file, selection: null, checks: [] };
    run.log.keyframes[id] = { ...out, entry: entry?.id ?? null }; run.save();
    return { ...out, entry };
  }
  // Finished keyframe (done): replay it. The bank grows as later shots land, so select() would pick differently and the
  // signature would miss; the decision made when the shot was generated is final. The record is re-observed (vision is cached).
  const prev = run.log.keyframes[id];
  if (prev?.done && run.has(prev.file || file)) {
    const entry = await memory.record({ file: prev.file || file, shot, role: "start", expected, sources: prev.sources || {} });
    return { ...prev, entry };
  }
  const sel = await memory.select(shot);
  const inputs = [], lines = [], sources = {};
  const b = sel.base;
  if (b) {
    inputs.push(b.file);
    const baseLoc = b.location ?? b.shot?.location;
    const same = baseLoc ? baseLoc === shot.location : !!b.entities?.[shot.location]?.present;
    const keep = names.filter((n) => b.entities?.[n]?.stable);
    for (const n of keep) sources[n] = b.id;
    lines.push(same || !keep.length
      ? "Image 1 is an earlier frame of this same place. Transform it into the new shot. Keep the place, its objects and the real size of everything as in image 1; change only framing, positions, poses, light and time as described."
      : `Image 1 is an earlier frame showing ${keep.join(", ")}. Transform it into the new shot in a new place, ${shot.location}: ${(byName[shot.location]?.look ?? "").replace(/\.$/, "")}. Keep ${keep.join(", ")} and their real size relative to each other as in image 1; replace the place.`);
  }
  for (const x of sel.extra || []) {
    inputs.push(x.entry.file);
    for (const n of x.names) sources[n] = x.entry.id;
    lines.push(`Image ${inputs.length} is an earlier frame showing ${x.names.join(", ")}: take its exact look, state and real size from it and merge it into the new shot; do not copy its framing.`);
  }
  for (const a of sel.anchors || []) {
    inputs.push(a.file);
    sources[a.name] ??= `anchor:${a.name}`;
    lines.push(anchorLine(run, plan, inputs.length, a.name));
  }
  for (const n of sel.fresh || []) { const e = byName[n]; sources[n] ??= "fresh"; lines.push(`New in this shot: ${n}: ${e?.look ?? ""}; real size: ${e?.size ?? ""}.`); }
  const carried = memory.carried(shot);
  const state = [...(carried.lines || []), ...(carried.persisted || [])];
  const small = names.filter((n) => byName[n]?.kind === "prop" && inHand(byName[n].size)).map((n) => `${n} is ${byName[n].size}`);
  const SIZE = small.length ? `\nReal sizes are absolute: ${small.join("; ")}. Draw each at that size relative to the hands, feet and objects at the same depth, even if it becomes small in the frame; never enlarge it to make it visible.` : "";
  const prompt = `${plan.style}. 16:9 film frame. ${SINGLE} New shot: ${shot.start.description}\n${lines.join("\n")}`
    + (state.length ? `\nState at this frame:\n${state.join("\n")}` : "") + SIZE + `\nTime and light: ${shot.start.time_light}.`;
  const selection = { base: b?.id ?? null, extra: (sel.extra || []).map((x) => ({ id: x.entry.id, names: x.names, why: x.why })),
    anchors: (sel.anchors || []).map(({ name, file, why }) => ({ name, file, why })), fresh: sel.fresh || [], why: sel.why };
  const gen = (key, p, attempt) => run.job(key, file, { prompt: p, attempt }, inputs, COST.image, () => run.image(`${run.caseId} ${id} a${attempt}`, p, inputs, file));

  const before = run.log.jobs[`frame:${id}`];
  await gen(`frame:${id}`, prompt, 1);
  if (run.estimate && run.estimated.at(-1)?.key === `frame:${id}`) run.estimated.push({ key: `frame:${id}:retry (possible)`, cost: COST.image });
  const cached = !run.estimate && run.log.jobs[`frame:${id}`] === before && run.log.keyframes[id]?.prompt === prompt;
  let entry = await memory.record({ file, shot, role: "start", expected, sources });
  const checks = [summary(entry, 1, names)].filter(Boolean);
  let retry = null;
  // Gate: runs only on a fresh first attempt (a cached frame already passed its gate in an earlier run).
  if (!run.estimate && !cached && entry) {
    const fix = corrections(plan, entry, names);
    if (fix.length) {
      const a1 = `${id}-start-a1.png`;
      copy(run, file, a1);
      entry.file = a1; // assumption: the bank holds this object; attempt 1 now lives in a1
      retry = `${prompt}\nFix these problems from the previous attempt: ${fix.join("; ")}.`;
      await gen(`frame:${id}:retry`, retry, 2);
      const e2 = await memory.record({ file, shot, role: "start", expected, sources });
      checks.push(summary(e2, 2, names));
      const s1 = stableCount(entry, names) - (entry.quality?.artifacts?.length ? 0.5 : 0);
      const s2 = stableCount(e2, names) - (e2.quality?.artifacts?.length ? 0.5 : 0);
      if (s1 > s2) { copy(run, a1, file); entry.file = file; await memory.drop?.(e2.id); console.log(`  frame:${id}: retry worse (${s2} < ${s1}) → kept attempt 1`); }
      else { await memory.drop?.(entry.id); entry = e2; }
    }
  }
  const out = { file, selection, inputs, prompt, retry_prompt: retry, checks, sources, done: !run.estimate };
  run.log.keyframes[id] = { ...out, entry: entry?.id ?? null }; run.save();
  return { ...out, entry };
}

// Continuous shot whose real last frame lacks entities: edit that frame in place to add them.
export async function repairStart(run, plan, memory, shot, lastFile, missing) {
  const file = `${shot.id}-start.png`, carried = memory.carried(shot);
  const about = [...(carried.lines || []), ...(carried.persisted || [])].filter((l) => missing.some((n) => l.startsWith(`${n}:`)));
  const inputs = [lastFile], refs = [];
  for (const n of missing) { const a = memory.anchor(n); if (a) { inputs.push(a); refs.push(anchorLine(run, plan, inputs.length, n)); } }
  const prompt = `${plan.style}. 16:9 film frame. ${SINGLE} Image 1 is the current frame: keep its place, camera, light and every object exactly. Add ${missing.join(", ")}: ${about.join(" ") || shot.start.description}`
    + (refs.length ? `\n${refs.join("\n")}` : "");
  await run.job(`repair:${shot.id}`, file, { prompt }, inputs, COST.image, async () => ({ ...(await run.image(`${run.caseId} ${shot.id} repair`, prompt, inputs, file)), repaired_from: lastFile, missing }));
  (run.log.repairs ??= {})[shot.id] = { file, from: lastFile, missing, prompt, inputs }; run.save();
  return file;
}

// Persisted appearance change → a new clean anchor version from the old anchor and the frame that shows the change.
export async function versionAnchor(run, plan, memory, req) {
  const { name, v, from_anchor, from_frame, prompt_hint } = req, file = `refs/${name}-v${v}.png`;
  const inputs = [...(from_anchor ? [from_anchor] : []), from_frame];
  const prompt = from_anchor
    ? `${plan.style}. Single frame, not a grid. Image 1 is the reference of ${name}. Image 2 shows ${name} after a change. Make a new clean reference of ${name}, identical to image 1 except: ${prompt_hint}. Same framing and background as image 1.`
    : `${plan.style}. Single frame, not a grid. Image 1 shows ${name} after a change: ${prompt_hint}. Make a clean reference of ${name} as it is in image 1: centred, plain light grey background, even soft light.`;
  await run.job(`anchor:${name}-v${v}`, file, { prompt }, inputs, COST.image, () => run.image(`${run.caseId} anchor ${name} v${v}`, prompt, inputs, file));
  const base = run.log.anchors?.[name];
  (run.log.anchors ??= {})[`${name}-v${v}`] = { file, prompt, inputs, kind: base?.kind ?? plan.entities.find((e) => e.name === name)?.kind, why: `version ${v}: ${prompt_hint}` };
  memory.setAnchor(name, file, v);
  if (!run.estimate) await memory.record({ file, shot: { id: "anchor", location: null }, role: "anchor", expected: [st(name, { condition: req.state ? JSON.stringify(req.state) : "" })], sources: {} });
  run.save();
  return file;
}
