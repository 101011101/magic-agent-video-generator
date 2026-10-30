// STATE MANAGER: one pass over the whole screenplay that emits the tables, then answers the templates' questions. Nothing
// creative lives here. Tables (saved as state.json in the run):
//   places  id → the plate and what it contains (walls, floor, light, fixtures with side and depth), one vision call each
//   stills  the distinct keyframes of the film: scene, shot, size, camera, frame (who is in frame and where, who is off and to
//           which side), env (the image it is painted from) and envKind (plate | edit | master | crop), prev (the shot the
//           viewer has just seen), uses (which shot starts and ends it serves)
//   clips   one per shot: its start and end stills
// Queries: refs(still) the images to send and why; needsPortrait(still, person); offFrame(frame); relation(still); cropFor
// (still, boxes) a punch-in cut from the master; peopleCheck / roomCheck / clipCheck the gates; record() keeps the still table
// current as frames are painted.
// Environment rule: the first still of a scene in a place → the plate; the same camera as the still before it → that still
// (edit); a new camera → the scene's MASTER, the latest wide or medium-wide still of the scene, never a single; when the place
// has no wide view at all (a cockpit only ever seen close), the LATEST still of it, the place as last seen with whoever was
// in it, because the plate would lose them; and when the master is painted, a tighter setup is a CROP of it (used as the
// frame when large enough, else painted from the crop).
import { writeFileSync } from "node:fs";
import { jsonCall, S } from "../lib/llm.js";
import { PERSON_FIELDS, PROP_FIELDS, inFrame, norm } from "../screenplay/screenplay.js";

export const SIZE = { wide: 0, "medium-wide": 1, medium: 2, "medium-close": 3, close: 4 };
export const MAX_REFS = 4;   // image 1 plus at most three carriers per paint
export const MAX_DEPTH = 2;  // generations of painting a wide may be from a plate and still serve as a master
const clean = (s) => String(s ?? "").trim().replace(/[.;,\s]+$/, "");
const camKey = (h) => JSON.stringify({ size: h.size, stands: norm(h.camera.stands), height: h.camera.height, looks_at: norm(h.camera.looks_at), behind: h.camera.behind.map(norm).sort() });
const frameKey = (f, fields) => JSON.stringify({ people: f.people.filter(inFrame).map((p) => [p.id, ...fields.filter((k) => k in p).map((k) => norm(p[k]))]).sort(), props: f.props.filter(inFrame).map((p) => [p.id, ...PROP_FIELDS.filter((k) => k in p).map((k) => norm(p[k]))]).sort() });   // only the fields the frame has: a schema addition must not change the keys of an earlier run

export class State {
  constructor({ log, run, script = null, elements, bank, features = {}, voices = {}, reactions = false }) {
    Object.assign(this, { log, run, script, els: elements, bank, features, voices, reactions, stills: [], byShot: {}, clips: [] });
    log.places ??= {}; log.stills ??= {};
    // The film's STYLE SHEET: one image every paint that is not straight from a plate is told to match for grain, colour,
    // contrast and finish: the first generated plate (the assets stage keeps it as style_ref), else the first plate of any
    // kind. Style drifted when nothing carried it: by the ninth generation of painting the sea had posterized.
    this.styleSheet = log.style_ref || Object.values(bank).find((b) => b?.file && /^roots\//.test(b.file))?.file || null;
    if (script) this.plan();
  }
  setScript(script) { this.script = script; this.plan(); }
  place(id) { return this.log.places[id] || {}; }
  // The elements whose ids may be rewritten as labels inside prose: people, props and places always; a fixture only when its
  // id is a compound (a plain-word fixture id such as "doorway" also occurs as an ordinary word in the frames' text).
  get labelled() { return this.els.filter((e) => e.kind !== "fixture" || e.id.includes("-")); }
  // Ids in prose become labels; a label beginning with "the" never doubles an article already in the text.
  label(text) { return this.labelled.reduce((t, e) => t.replace(new RegExp(`\\b${e.id}\\b`, "gi"), (m, at, str) => { const l = this.name(e.id); return /^the /i.test(l) && /\bthe\s+$/i.test(str.slice(0, at)) ? l.slice(4) : l; }), String(text ?? "")); }
  still(id) { return id ? this.stills.find((s) => s.id === id) || null : null; }

  // The single pass: distinct stills, their environment reference, the shot the viewer has just seen, the clips.
  plan() {
    const stills = [], byShot = {}, fields = this.reactions ? PERSON_FIELDS : PERSON_FIELDS.filter((k) => k !== "doing");
    for (const sc of this.script.scenes) for (const h of sc.shots) {
      const add = (f, which) => {
        const key = `${sc.place}|${sc.time}|${sc.inside ? "int" : "ext"}|${camKey(h)}|${frameKey(f, fields)}`;
        let s = stills.find((x) => x.key === key);
        if (!s) { s = { id: `s${sc.n}-${stills.filter((x) => x.scene === sc.n).length + 1}`, key, scene: sc.n, place: sc.place, shot: h.n, start_at: h.start, seconds_of: h.seconds, moment: h.moment, size: h.size, camera: h.camera, cameraKey: camKey(h), frame: f, uses: [] }; stills.push(s); }
        s.uses.push(`shot ${h.n} ${which}`); return s.id;
      };
      const start = add(h.first, "start"), held = (!h.action.length && !h.changes.length) || frameKey(h.first, fields) === frameKey(h.last, fields);
      byShot[h.n] = { start, end: held ? add(h.first, "end") : add(h.last, "end") };
    }
    // A scene that continues in a place already shown (the same place, marked continuous, or any earlier scene there when the
    // blocking has not changed) keeps that place's stills as its references, so the room is the same rendering across the cut.
    const sceneOf = (n) => this.script.scenes.find((sc) => sc.n === n);
    for (let i = 0; i < stills.length; i++) {
      const s = stills[i], sc = sceneOf(s.scene);
      // A title card (nothing in frame, a caption covering the shot) is rendered by code and is never anyone's image 1.
      s.card = ![...s.frame.people, ...s.frame.props].some(inFrame) && !!sc?.captions.some((c) => c.at >= s.start_at && c.at < s.start_at + s.seconds_of);
      const samePlace = stills.slice(0, i).filter((x) => x.place === s.place && !x.card);
      const before = sc?.continuous || samePlace.some((x) => x.scene !== s.scene) ? samePlace : samePlace.filter((x) => x.scene === s.scene), last = before[before.length - 1];
      if (!last) { s.env = null; s.envKind = "plate"; }
      else if (last.cameraKey === s.cameraKey) { s.env = last.id; s.envKind = "edit"; }
      // A new camera in a place already shown is painted from the widest recent view of it, and when the place has no wide
      // view at all (a cockpit is only ever close), from the LATEST still of it: the place as last seen, with whoever was in
      // it. The plate is only ever the base of the first still of a place.
      else {
        // The master is the wide of the place that shows the MOST of what this frame shows (ties to the latest): the attack
        // wide was once painted from the warship wide, which held one of its nine elements, and became a collage.
        // Among wides sharing the most elements, the SHALLOWEST (fewest generations of painting from a plate) wins, then the
        // latest: every frame painted from the frame before it compounds texture, and the attack scene of the third Top Gun
        // film was nine generations deep by its last frame, posterized sea and sky.
        // Score: one point per element in frame that the candidate also shows, one more when the candidate shows it in the
        // same STATE (a prop's condition, a person's doing); so the frame with the ship already burning beats the approach.
        const cur = new Map([...s.frame.people, ...s.frame.props].filter(inFrame).map((x) => [x.id, norm(x.condition ?? x.doing ?? "")]));
        const shared = (x) => [...x.frame.people, ...x.frame.props].filter((e) => inFrame(e) && cur.has(e.id)).reduce((n, e) => n + 1 + (norm(e.condition ?? e.doing ?? "") === cur.get(e.id) ? 1 : 0), 0);
        // Fresh wides (at most MAX_DEPTH generations deep) are preferred, the latest among them for continuity; only when none
        // is fresh does the shallowest deep one serve.
        // Continuity wins: the LATEST wide among those sharing the most elements (the frame before the climb is the burning
        // ship, not the approach). Texture over generations is the style sheet's and the style gate's job, not a reason to
        // paint from a stale frame; depth is recorded for the gate's note.
        const wides = before.filter((x) => SIZE[x.size] <= 1), best = wides.length ? wides.reduce((a, b) => (shared(b) >= shared(a) ? b : a)) : last;
        s.env = best.id; s.envKind = "master";
      }
      if (s.card) { s.env = null; s.envKind = "card"; }
      s.depth = s.env ? (stills.find((x) => x.id === s.env)?.depth ?? 0) + 1 : 0;   // generations of painting from a plate
      const prevShot = this.script.scenes.flatMap((sc) => sc.shots).filter((h) => h.n < s.shot).pop();
      s.prev = prevShot ? byShot[prevShot.n]?.end || null : null;
      const envStill = stills.find((x) => x.id === s.env);
      s.punchIn = s.envKind === "master" && !!envStill && SIZE[s.size] > SIZE[envStill.size];
    }
    this.stills = stills; this.byShot = byShot;
    this.clips = this.script.scenes.flatMap((sc) => sc.shots.map((h) => ({ n: h.n, scene: sc.n, start_at: h.start, seconds: h.seconds, start: byShot[h.n].start, end: byShot[h.n].end })));
  }
  // Painter-facing label: unique. Ids are the operational keys (the screenplay, the frames, the tables); a name is only what
  // the painter reads, so when two elements share a name the label is qualified by kind ("the steamship Vanderbilt").
  name(id) {
    const e = this.els.find((x) => x.id === id); if (!e) return id;
    const same = this.els.filter((x) => x.id !== id && x.name.toLowerCase() === e.name.toLowerCase() || (x.id !== id && e.name.split(" ").length === 1 && x.name.toLowerCase().split(" ").includes(e.name.toLowerCase())));
    if (!same.length) return e.name;
    const label = `the ${e.kind === "prop" ? (String(e.look || "").match(/\b(steamship|ship|vessel|aircraft|jet|frigate|boat|carriage|horse|dog|cat)\b/i)?.[1]?.toLowerCase() || "object") : e.kind} ${e.name}`;
    return same.some((x) => x.kind === e.kind && x.name.toLowerCase() === e.name.toLowerCase()) ? `${label} (${e.id})` : label;   // two of a kind with one name: the id tells them apart
  }
  // The one reference rule, for every element that appears in a frame: its carrier image goes along unless image 1 already
  // shows it at a size that carries its identity. The place's carrier is image 1 itself (the plate, the previous still or
  // the master), so it never needs another; people and props follow the same test: not in image 1, or framed two sizes
  // closer than image 1 shows them, or image 1 is the empty plate.
  carried(still, el) {   // is this element already carried by image 1 at a usable size?
    const env = this.still(still.env); if (!env || still.envKind === "plate") return false;
    const inEnv = [...env.frame.people, ...env.frame.props].some((x) => x.id === el.id && inFrame(x)); if (!inEnv) return false;
    return SIZE[still.size] - SIZE[env.size] < 2;
  }
  needsPortrait(still, p) { return !this.carried(still, p); }
  refs(still) {
    if (still.card) return [{ ref: `card:${still.id}`, role: "title card rendered by code from the caption", why: "nothing in frame; the caption fills the shot" }];
    const env = this.still(still.env);
    const first = !env ? { ref: `plate:${still.place}`, role: "plate", why: "first still of the scene in this place" } : still.envKind === "edit" ? { ref: `env:${env.id}`, role: "previous still, same camera", why: "the same camera as the still before it" } : { ref: `env:${env.id}`, role: still.punchIn ? "the scene's master wide (cropped to this framing when it exists)" : "the scene's master wide", why: SIZE[env.size] <= 1 ? "a new camera setup: painted from the widest recent view of the scene" : "a new camera setup in a place with no wide view yet: painted from the place as last seen" };
    const appearing = [...still.frame.people.filter(inFrame).map((p) => ({ el: p, kind: "portrait" })), ...still.frame.props.filter(inFrame).map((p) => ({ el: p, kind: "prop" }))];
    // Prominence: how much of the frame the element can occupy. A carrier image only helps when the element is large enough
    // to be recognised; a helmet worn by a pilot who is a dot in a wide shot carries nothing, and nine references once
    // became a labelled collage. At most MAX_REFS images go out; the least prominent are dropped first.
    const prominence = ({ el, kind }) => { if (kind === "portrait") return el.depth === "near" ? 3 : el.depth === "mid" ? 2 : 1; const w = String(el.where || "").toLowerCase(); if (/^(worn by|attached (beneath|to|under)|held by|inside|carried by)/.test(w)) return SIZE[still.size] >= 3 ? 2 : 0; return /\bnear\b/.test(w) ? 3 : /\bmid\b/.test(w) ? 2 : /\bfar\b/.test(w) ? 1 : 2; };
    const worthy = (a) => prominence(a) >= (SIZE[still.size] <= 1 ? 2 : 1);   // in a wide, only near or mid things; closer in, anything that is not nothing
    // The frame just before this one, when it is not already image 1: the state manager hands the painter what was last seen
    // (what has fallen, what is spent, how big things are beside each other) as a picture, not only as the "before this
    // frame" words. A close on the frigate painted from the wide master alone once drew the falling bombs at a third of the
    // frame while the frame before had them beside the ship.
    const prev = this.still(still.prev), prevRef = prev && env && prev.id !== env.id && !prev.card && prev.place === still.place ? [{ ref: `prev:${prev.id}`, role: "the frame just before", why: "the state as last seen, from another camera than image 1" }] : [];
    const carriers = appearing.filter((a) => (a.kind === "portrait" || this.bank[a.el.id]?.file) && !this.carried(still, a.el) && worthy(a)).sort((a, b) => prominence(b) - prominence(a) || (a.kind === "portrait" ? -1 : 1)).slice(0, MAX_REFS - 1 - prevRef.length).map(({ el, kind }) => ({ ref: `${kind}:${el.id}`, role: `${kind === "portrait" ? "portrait" : "reference picture"} of ${this.name(el.id)}`, why: !env || still.envKind === "plate" ? "not in image 1" : [...env.frame.people, ...env.frame.props].some((x) => x.id === el.id && inFrame(x)) ? "framed much closer than image 1 shows it" : "not in image 1" }));
    // The style sheet rides along whenever image 1 is itself a painting (one generation or more), outside the carrier cap.
    const style = env && this.styleSheet ? [{ ref: `style:${this.styleSheet}`, role: "the film's style sheet", why: "image 1 is a painting; the finish is matched to the sheet, not to image 1" }] : [];
    return [first, ...prevRef, ...carriers, ...style];
  }
  // What each host in a frame carries, from the structured `on` of the props (through chains: bomb on pylon on aircraft).
  loads(still) {
    const props = still.frame.props.filter(inFrame), hostOf = (p) => p.on && p.on !== "none" ? p.on : null;
    const top = (p) => { let id = hostOf(p); for (let i = 0; i < 6; i++) { const h = props.find((x) => x.id === id), up = h && hostOf(h); if (!up || up === id) return id; id = up; } return id; };
    const out = {}; for (const p of props) if (hostOf(p)) { const h = top(p); if (h && h !== p.id) (out[h] ??= []).push(p.id); }
    return Object.entries(out).map(([id, carries]) => ({ id, name: this.name(id), look: this.els.find((e) => e.id === id)?.look || "", carries: carries.map((c) => this.name(c)) }));
  }
  offFrame(frame) {
    const g = { left: [], right: [] }; for (const p of frame.people) if (!inFrame(p)) g[p.visible === "off left" ? "left" : "right"].push(this.name(p.id));
    return Object.entries(g).filter(([, v]) => v.length).map(([side, v]) => `${v.join(" and ")} ${v.length > 1 ? "are" : "is"} just outside the frame to the ${side}`).join("; ");
  }
  // Memory for a frame: the moments of the earlier shots of its scene (and the last shot of the previous scene when the scene
  // is continuous), and what the frame just before it showed. The tables know which scene and clip every still serves;
  // this hands that over so the painter is told what has already happened rather than left to infer it.
  history(still) {
    const scenes = this.script.scenes, sc = scenes.find((x) => x.n === still.scene), i = scenes.indexOf(sc);
    const label = (text) => this.label(text);
    const earlier = sc.shots.filter((h) => h.n < still.shot).map((h) => `shot ${h.n}: ${label(clean(h.moment))}${h.changes?.length ? ` (${label(clean(h.changes.join("; ")))})` : ""}`);
    if (sc.continuous && i > 0) { const p = scenes[i - 1], last = p.shots.at(-1); if (last) earlier.unshift(`scene ${p.n}, shot ${last.n}: ${label(clean(last.moment))}${last.changes?.length ? ` (${label(clean(last.changes.join("; ")))})` : ""}`); }
    const prev = this.still(still.prev), before = prev && prev.id !== still.id ? `${label(clean(prev.moment))}; ${[...prev.frame.props, ...prev.frame.people].filter(inFrame).slice(0, 4).map((x) => `${this.name(x.id)} ${label(clean(x.condition ?? x.doing ?? ""))}`).join("; ")}` : "";
    return { earlier, before };
  }
  // The cut, in one or two sentences: how this frame relates to the frame it is painted from (its env) and to the shot the
  // viewer has just seen (prev). The subject of a frame is the people in it, else what the camera looks at.
  // later: image 1 is an earlier moment of the place (a return to it with the cast changed), not this instant.
  relation(still, later = false) {
    const env = this.still(still.env), prev = this.still(still.prev);
    const label = (text) => this.labelled.reduce((t, e) => t.replace(new RegExp(`\\b${e.id}\\b`, "gi"), (m, at, str) => { const l = this.name(e.id); return /^the /i.test(l) && /\bthe\s+$/i.test(str.slice(0, at)) ? l.slice(4) : l; }), String(text ?? ""));
    const names = (f) => f.people.filter(inFrame).map((p) => this.name(p.id)), subject = (s) => names(s.frame).join(" and ") || label(clean(s.camera?.looks_at || "").split(/[;:,]/)[0]) || "the place";
    const third = (f, id) => f.people.find((p) => p.id === id && inFrame(p))?.third, parts = [];
    if (still.envKind === "master" && env) {
      const base = later ? (SIZE[env.size] <= 1 ? "the wide view of this place a moment earlier" : `this place as last seen, a ${env.size} shot of an earlier moment`) : SIZE[env.size] <= 1 ? "the wide view of this same instant" : `this place as last seen, a ${env.size} shot of the same instant`;
      const where = still.frame.people.filter(inFrame).map((p) => { const t = third(env.frame, p.id); return t ? `${this.name(p.id)} is the one at the ${t} of image 1` : `${this.name(p.id)} is not in image 1`; });
      const shows = names(env.frame).length ? `it shows ${names(env.frame).join(" and ")}` : "";
      const move = SIZE[still.size] > SIZE[env.size] ? "closer" : SIZE[still.size] < SIZE[env.size] ? "further back" : "moved to a new angle";
      parts.push(`Image 1 is ${base}${where.length ? `: ${where.join("; ")}` : shows ? `; ${shows}` : ""}. Image 1 shows: ${label(clean(env.moment || ""))}. This frame is ${later ? "the same place a moment later" : "the same scene and instant"} with the camera ${move}, framing ${subject(still)}.`);
    }
    if (prev && prev.id !== env?.id && prev.id !== still.id) parts.push(`The shot just seen was a ${prev.size} on ${subject(prev)}; this ${SIZE[still.size] > SIZE[prev.size] ? "cuts closer" : SIZE[still.size] < SIZE[prev.size] ? "cuts wider" : "cuts"} to ${subject(still)}, on the same side of the action, so left and right stay as they were.`);
    return parts.join(" ");
  }
  // A punch-in cut from the master: a 16:9 box in fractions of the master, from the people boxes the gate returned for it
  // (x = horizontal centre, top and bottom in percent). Vertical extent by size; wide enough for everyone plus a margin.
  cropFor(still, boxes) {
    const usable = (b) => b && Number.isFinite(b.x) && Number.isFinite(b.top) && Number.isFinite(b.bottom) && b.bottom > b.top;
    const want = still.frame.people.filter(inFrame).map((p) => p.id), ids = want.filter((id) => usable(boxes?.[id]));
    if (!ids.length || ids.length < want.length) return null;   // a person the gate did not box cannot be framed by a cut: paint from the master instead
    const tops = ids.map((id) => boxes[id].top / 100), bots = ids.map((id) => boxes[id].bottom / 100), xs = ids.map((id) => boxes[id].x / 100);
    const top = Math.min(...tops), h = Math.max(...bots) - top, keep = { wide: 1, "medium-wide": 0.8, medium: 0.6, "medium-close": 0.42, close: 0.3 }[still.size];
    let ch = Math.min(1, h * keep + 0.08), y = Math.max(0, top - 0.06), cw = ch;   // the source is 16:9, so equal fractions keep the aspect
    const need = Math.max(...xs) - Math.min(...xs) + 0.3; if (cw < need) { cw = Math.min(1, need); ch = cw; }
    let x = (Math.min(...xs) + Math.max(...xs)) / 2 - cw / 2; x = Math.max(0, Math.min(1 - cw, x)); if (y + ch > 1) y = Math.max(0, 1 - ch);
    // Keep people the frame puts OFF frame out of the crop: pull the crop's edge in to their inner shoulder when they fall
    // inside it, as long as everyone in frame still fits with a small margin (the crop stays 16:9 by shrinking both sides).
    const offs = still.frame.people.filter((p) => !inFrame(p) && usable(boxes[p.id])).map((p) => ({ side: p.visible === "off left" ? "left" : "right", x: boxes[p.id].x / 100 }));
    const fits = (lo, hi) => Math.min(...xs) - 0.05 >= lo && Math.max(...xs) + 0.05 <= hi, minH = Math.min(1, h * keep + 0.08);
    // The crop shrinks only while it still covers the wanted vertical extent, and stays anchored just above the head.
    for (const o of offs) {
      if (o.side === "left" && o.x + 0.06 > x && fits(o.x + 0.06, x + cw)) { const nx = o.x + 0.06, nw = x + cw - nx; if (nw >= minH) { x = nx; cw = nw; ch = nw; y = Math.max(0, Math.min(top - 0.06, 1 - ch)); } }
      if (o.side === "right" && o.x - 0.06 < x + cw && fits(x, o.x - 0.06)) { const nw = o.x - 0.06 - x; if (nw >= minH) { cw = nw; ch = nw; y = Math.max(0, Math.min(top - 0.06, 1 - ch)); } }
    }
    const r = (v) => Math.round(v * 1000) / 1000; return { x: r(x), y: r(y), w: r(cw), h: r(ch) };
  }
  // One vision call per plate, once per run: the place as a set decorator lists it.
  async describePlaces() {
    for (const p of this.els.filter((e) => e.kind === "place")) {
      if (this.log.places[p.id]?.fixtures || !this.bank[p.id]?.file) continue;
      const r = await jsonCall({ name: "plate-fixtures", effort: "low", images: [this.run.path(this.bank[p.id].file)],
        schema: S.obj({ walls: S.str, floor: S.str, light: S.str, fixtures: S.arr(S.obj({ name: S.str, side: S.enum(["left", "centre", "right"]), depth: S.enum(["foreground", "middle", "background"]), detail: S.str })) }),
        prompt: `This is the empty place "${p.name}" as it will appear in every frame of a film. List what is in it as a set decorator would: walls (plain or papered, material, colour), floor, light (sources and quality), and every fixture and piece of furniture with its side of the picture (left, centre, right), its depth (foreground, middle, background) and a short detail ("a fireplace with a mantel clock", "a dark panelled door", "a round centre table"). Only what is visible.` });
      this.log.places[p.id] = { plate: this.bank[p.id].file, ...r }; this.run.save();
    }
  }
  behind(placeId, third) { return (this.place(placeId).fixtures || []).filter((f) => f.depth !== "foreground" && f.side === third).map((f) => clean(f.detail || f.name)); }
  // Gates. people: count, left-to-right order (what the 180-degree line needs) and each person's box, for crops.
  async peopleCheck(file, people) {
    const ids = people.map((p) => p.id);
    const r = await jsonCall({ name: "still-check-boxes", effort: "low", images: [this.run.path(file)],
      schema: S.obj({ people: S.int, countable: S.bool, ...(ids.length ? { distinguishable: S.bool, order: S.arr(S.enum(ids)), sides: S.obj(Object.fromEntries(ids.map((id) => [id, S.enum(["left", "centre", "right", "absent"])]))), boxes: S.obj(Object.fromEntries(ids.map((id) => [id, S.obj({ x: S.int, top: S.int, bottom: S.int })]))) } : {}), note: S.str }),
      prompt: `In this picture: how many people are visible? countable: true only if people in this picture, if any, would be large and plain enough to count reliably; false when the expected people would be tiny figures inside vehicles, behind glass, or hidden.${ids.length ? ` These people may be in it:\n${people.map((p) => `- ${p.id}: ${this.features[p.id]}`).join("\n")}\ndistinguishable: true only if the features above let you tell WHICH visible person is which (false when faces are hidden by helmets or visors, when the people are too small, or when the features do not differ); never guess an identity. order: the ids of those visible, from the left edge to the right edge (your best reading even if not distinguishable). sides: for each id, the third of the frame the person stands in (left, centre, right), or absent. boxes: for each id, x = the horizontal centre of the person as a percent of the picture width, top = the top of the head and bottom = the lowest visible point (feet or the frame edge) as percents of the height (0 at the top); zeros if absent.` : ""}\nnote: anything wrong (an extra person, a face that does not match the features), short.` });
    const RANK = { left: 0, centre: 1, right: 2 }, order = r.order || [];
    // The order (left to right) is checked only when the picture lets the gate tell the people apart; two helmeted pilots
    // are a count, not an order: the gate once guessed one and flagged a correct frame.
    const checkable = ids.length <= 1 || r.distinguishable !== false;
    const orderOk = !checkable || (people.every((p) => order.includes(p.id)) && people.every((a) => people.every((b) => RANK[a.third] >= RANK[b.third] || order.indexOf(a.id) < order.indexOf(b.id))));
    // People the screenplay puts far away inside something (pilots in jets in a wide) may be invisible at this size: when the
    // gate says they are not countable and every expected person is at far depth, the count is not enforced.
    const tooSmall = r.countable === false && people.length > 0 && people.every((p) => p.depth === "far") && r.people <= people.length;
    const countOk = r.people === people.length || tooSmall;
    return { ok: countOk && orderOk, ...r, orderOk, countOk, note: `${r.note || ""}${tooSmall && r.people !== people.length ? " · people too small to count at this size (count not enforced)" : ""}${checkable ? "" : " · identities not distinguishable here (count checked, order not)"}`.replace(/^ · /, "") };
  }
  // What a still may show that its image 1 does not: every prop in frame with its declared place AND state (fire and spray
  // where a bomb has struck are the bomb's condition, not an addition), and the shot's own change list when the still is the
  // shot's last frame. The gate flagged a correct impact frame for "added explosions" while it was told positions only.
  expectedFor(still) {
    const props = still.frame.props.filter(inFrame).map((p) => `${this.name(p.id)}: ${clean(p.where)}; ${clean(p.condition)}`);
    const shot = this.script?.scenes.find((sc) => sc.n === still.scene)?.shots.find((h) => h.n === still.shot);
    const changes = still.uses.some((u) => u.endsWith("end")) && shot?.changes?.length ? [`what changed during the shot: ${shot.changes.map(clean).join("; ")}`] : [];
    return [...props, ...changes];
  }
  // expected: the props the screenplay puts into this frame (they are not "added"; the plate is the empty place).
  // against: the run-relative file the painter was given as image 1 (the master or the previous still); the plate when absent.
  // The gate asks "did the painter keep what it was told to keep", so a deviation the user accepted upstream is not flagged
  // again on every still built on it; the plate is reached transitively through the chain of gates.
  async roomCheck(file, placeId, expected = [], against = null) {
    const base = against || this.bank[placeId]?.file; if (!base) return { ok: true, note: "no plate" };
    const r = await jsonCall({ name: "room-check", effort: "low", images: [this.run.path(file), this.run.path(base)],
      schema: S.obj({ same_room: S.bool, seen: S.arr(S.str), added: S.arr(S.str), note: S.str }),
      prompt: `Image 1 is a new film frame; image 2 is ${against ? "the same place as the painter was given to keep, an earlier frame of the film (ignore any people in it)" : "the empty place it must be in"}, which may be seen closer or from a different angle in image 1. Judge the ARRANGEMENT, not the craftsmanship: same_room is true when the same kinds of fixtures stand in the same places (a fireplace on the same side, the same windows and drapes, the same door; the same shoreline and sky for an exterior) and the walls or ground have the same kind of finish, even if a closer view renders details differently. seen: the fixtures of image 2 visible in image 1. added: only things in image 1 with NO counterpart in image 2 and not in this expected list (the expected things may appear at any size, distance or angle, nearer or larger than their words suggest, and are never "added"; a SECOND copy of an expected thing is added): ${expected.length ? expected.join("; ") : "(nothing expected)"}; new furniture, wallpaper where the walls were plain, objects the place did not have; a restyled version of an existing fixture is not added. Ignore the people. note: short.` });
    return { ok: r.same_room && !r.added.length, against: base, ...r };
  }
  // The load gate: for every host that carries something in this frame, what the picture shows attached to it against what
  // the screenplay puts on it; flag only. Three paints of the fourth Top Gun screenplay hung extra bombs and missiles on
  // the jets while every other gate passed: nothing was looking at what the aircraft carried.
  async loadCheck(file, hosts) {
    if (!hosts.length) return { ok: true, note: "nothing carried" };
    const r = await jsonCall({ name: "load-check", effort: "low", images: [this.run.path(file)],
      schema: S.obj({ hosts: S.obj(Object.fromEntries(hosts.map((h) => [h.id, S.obj({ absent: S.bool, attached: S.arr(S.str), extra: S.bool })]))), note: S.str }),
      prompt: `In this picture, these things carry something:\n${hosts.map((h) => `- ${h.id}: ${h.name}${h.look ? ` (${h.look})` : ""}; it carries exactly: ${h.carries.join(", ")}`).join("\n")}\nFor each: absent = true when it is not in the picture or too small to judge (then attached is empty and extra is false). attached = everything visibly attached to, mounted on or hanging from it beyond its own body, each item separately and both sides counted (every bomb, missile, pod, tank, rack, bag, or thing in a hand), as short phrases. extra = true when attached holds MORE items than the list above, or an item of a kind the list does not name (a second bomb where one is listed; missiles where only a bomb is listed). The fitting that holds a listed item (its pylon, rack, strap, sling, or the hand that holds it) belongs to that item and is never extra. note: short, what and where.` });
    const extra = Object.entries(r.hosts || {}).filter(([, v]) => v.extra && !v.absent).map(([id]) => hosts.find((h) => h.id === id)?.name || id);
    return { ok: !extra.length, extra, hosts: r.hosts, note: r.note || "" };
  }
  // The style gate: a frame against the film's style sheet, finish only (grain, colour, contrast, medium); flag only.
  async styleCheck(file, expectation = "") {
    if (!this.styleSheet) return { ok: true, note: "no style sheet" };
    const r = await jsonCall({ name: "style-check", effort: "low", images: [this.run.path(file), this.run.path(this.styleSheet)],
      schema: S.obj({ same_medium: S.bool, faults: S.arr(S.enum(["posterization", "halftone-or-dot-pattern", "painterly-strokes", "banding", "line-art", "plastic-smoothness", "heavy-oversaturation"])), tonal_notes: S.str, note: S.str }),
      prompt: `Image 1 is a frame of a film; image 2 is the film's style sheet, a picture made in the medium every frame must share. Judge the MEDIUM and the FINISH only, never content or composition. same_medium = image 1 is the same kind of picture as image 2 (both photographic live-action, or both the same animation style). faults = only the listed faults that are plainly present in image 1 and absent from image 2: posterization (flat colour steps), halftone or dot pattern, painterly strokes, banding, line art, plastic smoothness, heavy oversaturation; ordinary differences of grain, warmth, contrast or sharpness are NOT faults and go in tonal_notes instead.${expectation ? ` This shot deliberately departs from the sheet in this way, which is not a fault: ${expectation}.` : ""} note: short.` });
    return { ok: r.same_medium && !r.faults.length, drift: r.faults, ...r };
  }
  // The clip gate: frames at two per second, one call: count and order per frame against the shot's frames, and identity drift.
  async clipCheck(frameFiles, shot, seconds) {
    const people = [...new Set([...shot.first.people, ...shot.last.people].filter(inFrame).map((p) => p.id))];
    if (!people.length || !frameFiles.length) return { ok: true, note: "no people to check" };
    const r = await jsonCall({ name: "clip-check", effort: "low", images: frameFiles.map((f) => this.run.path(f)),
      schema: S.obj({ frames: S.obj(Object.fromEntries(frameFiles.map((_, i) => [`image_${i + 1}`, S.obj({ people: S.int, clear: S.bool, order: S.arr(S.enum(people)) })]))), distinguishable: S.bool, drift: S.bool, note: S.str }),   // keyed: one answer per frame, never a shorter list
      prompt: `Images 1 to ${frameFiles.length} are frames in time order from one ${seconds}-second clip, two per second. These people may appear:\n${people.map((id) => `- ${id}: ${this.features[id]}`).join("\n")}\nFor each image (image_1 … image_${frameFiles.length}): people = how many people are visible; clear = true only if the people in it are large and plain enough to count and place reliably (false when they are tiny figures, silhouettes inside a vehicle, or hidden by glass, helmets or motion); order = the ids visible, from the left edge to the right edge. distinguishable = true only if the features above let you tell which person is which anywhere in the clip; never guess. drift = true if in ANY image a person's face, beard, hair or glasses have turned into another person's. note: which image and what, short.` });
    const RANK = { left: 0, centre: 1, right: 2 }, want = [shot.first, shot.last].map((fr) => fr.people.filter(inFrame)), counts = new Set(want.map((w) => w.length));
    const okOrder = (w, order) => w.every((p) => order.includes(p.id)) && w.every((a) => w.every((b) => RANK[a.third] >= RANK[b.third] || order.indexOf(a.id) < order.indexOf(b.id)));
    // A frame counts against the clip only when its people are clear enough to count; the order only when they can be told
    // apart (two helmeted pilots are a count, not an order). Unclear frames are reported, never flagged.
    const checkOrder = people.length <= 1 || r.distinguishable !== false;
    const badFrames = Object.entries(r.frames).filter(([, f]) => f.clear !== false && (!counts.has(f.people) || (checkOrder && !want.some((w) => okOrder(w, f.order))))).map(([k]) => Number(k.replace("image_", "")));
    const unclear = Object.entries(r.frames).filter(([, f]) => f.clear === false).map(([k]) => Number(k.replace("image_", "")));
    return { ok: !r.drift && !badFrames.length, drift: r.drift, badFrames, unclear, frames: frameFiles.length, note: `${r.note || ""}${unclear.length ? ` · people too small or hidden to count in ${unclear.length === frameFiles.length ? "every frame" : `frames ${unclear.join(",")}`} (not counted)` : ""}${!checkOrder ? " · identities not distinguishable (order not checked)" : ""}` };
  }
  // The still table, kept current as frames are painted; saved with the plan as state.json.
  record(still, entry) {
    this.log.stills[still.id] = { scene: still.scene, shot: still.shot, size: still.size, place: still.place, in: still.frame.people.filter(inFrame).map((p) => ({ id: p.id, third: p.third })), off: still.frame.people.filter((p) => !inFrame(p)).map((p) => ({ id: p.id, side: p.visible })), from: still.env ? `${still.envKind}:${still.env}` : still.card ? "card" : "plate", ...entry };
    this.save();
  }
  save() {
    // elements: every asset with its properties: the reference picture, the feature line, and the voice (preset, instructions, sample).
    const elements = this.els.map((e) => ({ id: e.id, kind: e.kind, name: e.name, real: e.real, reference: this.bank[e.id]?.file || null, source: this.bank[e.id]?.source || null, features: this.features[e.id] || null, voice: this.bank[e.id]?.voice || null }));
    if (this.bank.narrator?.voice) elements.push({ id: "narrator", kind: "voice", name: "the narrator", voice: this.bank.narrator.voice });
    const tables = { elements, places: this.log.places, stills: this.stills.map(({ key, ...s }) => ({ ...s, refs: this.refs(s), painted: this.log.stills[s.id] || null })), clips: this.clips };
    writeFileSync(this.run.path("state.json"), JSON.stringify(tables, null, 2)); this.run.save();
  }
}
