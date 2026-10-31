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
import { headingGap, READ_YAW, HEADING_TOLERANCE } from "../screenplay/stage.js";
import { jsonCall, S } from "../../lib/llm.js";
import { PERSON_FIELDS, PROP_FIELDS, inFrame, norm } from "../screenplay/screenplay.js";
import { maxImages } from "../../lib/models.js";

export const SIZE = { wide: 0, "medium-wide": 1, medium: 2, "medium-close": 3, close: 4 };
export const MAX_REFS = 4;   // image 1 plus at most three carriers per paint
export const MAX_DEPTH = 2;  // generations of painting a wide may be from a plate and still serve as a master
const clean = (s) => String(s ?? "").trim().replace(/[.;,\s]+$/, "");
const camKey = (h) => JSON.stringify({ size: h.size, stands: norm(h.camera.stands), height: h.camera.height, looks_at: norm(h.camera.looks_at), behind: h.camera.behind.map(norm).sort() });
const frameKey = (f, fields) => JSON.stringify({ people: f.people.filter(inFrame).map((p) => [p.id, ...fields.filter((k) => k in p).map((k) => norm(p[k]))]).sort(), props: f.props.filter(inFrame).map((p) => [p.id, ...PROP_FIELDS.filter((k) => k in p).map((k) => norm(p[k]))]).sort() });   // only the fields the frame has: a schema addition must not change the keys of an earlier run

export class State {
  constructor({ log, run, script = null, elements, bank, features = {}, voices = {}, reactions = false, stillModel = null }) {
    Object.assign(this, { log, run, script, els: elements, bank, features, voices, reactions, stills: [], byShot: {}, clips: [] });
    // How many images a paint may send in all, image 1 included: the pipeline's own cap, tightened to the still model's input
    // cap from the registry (qwen takes three images in all, krea two). Changing the model changes every reference list.
    this.maxImages = stillModel ? maxImages(stillModel, MAX_REFS) : MAX_REFS;
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
      // An edit keeps the camera of the still before it, except when a positioned prop (a vehicle on the stage) comes INTO
      // frame: the painter then recomposes around the newcomer (six edits of a single-jet frame brought the second jet in
      // as a huge foreground jet nose-first, with the words, the WORLD block and a change-only edit all saying otherwise),
      // and the master wide that already shows every vehicle from this side is the better image 1.
      const enters = (x) => s.frame.props.some((p) => inFrame(p) && p.at && typeof p.at.x === "number" && !(p.on && p.on !== "none") && !x.frame.props.some((q) => q.id === p.id && inFrame(q)));
      if (!last) { s.env = null; s.envKind = "plate"; }
      else if (last.cameraKey === s.cameraKey && !enters(last)) { s.env = last.id; s.envKind = "edit"; }
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
    // A face is nothing to a speck inside a jet, and a portrait invites the painter to show it: no portrait for a tiny person.
    const prominence = ({ el, kind }) => { if (kind === "portrait") return el.size === "tiny" ? 0 : el.depth === "near" ? 3 : el.depth === "mid" ? 2 : 1; const w = String(el.where || "").toLowerCase(); if (/^(worn by|attached (beneath|to|under)|held by|inside|carried by)/.test(w)) return SIZE[still.size] >= 3 ? 2 : 0; return /\bnear\b/.test(w) ? 3 : /\bmid\b/.test(w) ? 2 : /\bfar\b/.test(w) ? 1 : 2; };
    const worthy = (a) => prominence(a) >= (SIZE[still.size] <= 1 ? 2 : 1);   // in a wide, only near or mid things; closer in, anything that is not nothing
    // The frame just before this one, when it is not already image 1: the state manager hands the painter what was last seen
    // (what has fallen, what is spent, how big things are beside each other) as a picture, not only as the "before this
    // frame" words. A close on the frigate painted from the wide master alone once drew the falling bombs at a third of the
    // frame while the frame before had them beside the ship.
    // (also when image 1 is a plate: the first still of a place in a continuous scene learns the world outside from the frame before it)
    const prev = this.still(still.prev), prevRef = prev && prev.id !== env?.id && !prev.card && (prev.place === still.place || !!this.script?.scenes.find((sc) => sc.n === still.scene)?.continuous) && this.maxImages >= 2 ? [{ ref: `prev:${prev.id}`, role: "the frame just before", why: prev.place === still.place ? "the state as last seen, from another camera than image 1" : "a continuous scene in another place: the moment and the world outside continue from it" }] : [];
    // The style sheet rides outside the pipeline's cap on a roomy model; on a model with a tight input cap it counts, and
    // is dropped before the previous frame is (the finish is in image 1 too; the state is not).
    // A model with a tight input cap never gets the style sheet: with three images in all, qwen painted the style sheet's
    // offshore platform outside a cockpit canopy; image 1 carries the finish well enough there.
    const tight = this.maxImages < MAX_REFS, styleWanted = !!(env && this.styleSheet), styleKept = styleWanted && !tight;
    const budget = Math.max(0, this.maxImages - 1 - prevRef.length - (tight && styleKept ? 1 : 0));
    const carriers = appearing.filter((a) => (a.kind === "portrait" || this.bank[a.el.id]?.file) && !this.carried(still, a.el) && worthy(a)).sort((a, b) => prominence(b) - prominence(a) || (a.kind === "portrait" ? -1 : 1)).slice(0, budget).map(({ el, kind }) => ({ ref: `${kind}:${el.id}`, role: `${kind === "portrait" ? "portrait" : "reference picture"} of ${this.name(el.id)}`, why: !env || still.envKind === "plate" ? "not in image 1" : [...env.frame.people, ...env.frame.props].some((x) => x.id === el.id && inFrame(x)) ? "framed much closer than image 1 shows it" : "not in image 1" }));
    // The style sheet rides along whenever image 1 is itself a painting (one generation or more), outside the carrier cap.
    const style = styleKept ? [{ ref: `style:${this.styleSheet}`, role: "the film's style sheet", why: "image 1 is a painting; the finish is matched to the sheet, not to image 1" }] : [];
    return [first, ...prevRef, ...carriers, ...style];
  }
  // What each host in a frame carries, from the structured `on` of the props (through chains: bomb on pylon on aircraft).
  // The one rule of dependency (T-046, lib/deps.js): what a change to `id` does to the rest of the film. HARD, remade:
  // the stills painted into it (image 1), recursively; the clips and the sequences pinned on any of them; the film.
  // SOFT, kept and marked: the stills that took it as the frame before, a portrait or a prop picture (refs()). For a
  // plate (`root-<place>`) the hard set is the place's stills that start from it and all built on them. Ids are the
  // pipeline's own: still ids, clip-N, seq-A-B. The working tree reads the same rule from the run record by edge role.
  dependents(id) {
    const K = this.log.build || {}, place = id.startsWith("root-") ? id.slice(5) : null, hard = [];
    const walk = (x) => { for (const s of this.stills) if (s.env === x && !hard.includes(s.id)) { hard.push(s.id); walk(s.id); } };
    if (place) { for (const s of this.stills) if (s.place === place && s.envKind === "plate" && !s.card && !hard.includes(s.id)) { hard.push(s.id); walk(s.id); } } else walk(id);
    const set = new Set([id, ...hard]), clips = this.clips.filter((c) => set.has(c.start) || set.has(c.end)), shots = new Set(clips.map((c) => c.n));
    const sequences = Object.entries(K.sequences || {}).filter(([, q]) => (q.shots || []).some((n) => shots.has(n))).map(([k]) => `seq-${k}`);
    const soft = place ? [] : this.stills.filter((s) => !set.has(s.id) && !s.card && this.refs(s).some((r) => [`prev:${id}`, `portrait:${id}`, `prop:${id}`].includes(r.ref))).map((s) => s.id);
    return { hard, clips: clips.map((c) => `clip-${c.n}`), sequences, film: clips.length > 0, soft };
  }
  loads(still) {
    const props = still.frame.props.filter(inFrame), hostOf = (p) => p.on && p.on !== "none" ? p.on : null;
    const top = (p) => { let id = hostOf(p); for (let i = 0; i < 6; i++) { const h = props.find((x) => x.id === id), up = h && hostOf(h); if (!up || up === id) return id; id = up; } return id; };
    const person = (id) => this.els.find((e) => e.id === id)?.kind === "character";
    const out = {}; for (const p of props) if (hostOf(p)) { const h = top(p); if (h && h !== p.id && !person(h)) (out[h] ??= []).push(p.id); }   // a person's helmet, mask and harness are clothing, not a load
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
      // Two staged shots with the same camera view (both from behind) are the same side and angle: "moved to a new angle"
      // for a chase camera that had not moved invited the painter to pick one (the front, seven times in a row).
      const shotOf = (x) => this.script.scenes.flatMap((sc) => sc.shots).find((h) => h.n === x.shot), hv = shotOf(still)?.camera?.view, ev = shotOf(env)?.camera?.view, sameView = hv && hv === ev && hv !== "from inside";
      const move = sameView ? `held on the same side and at the same angle (${hv} the subjects${SIZE[still.size] > SIZE[env.size] ? ", closer" : SIZE[still.size] < SIZE[env.size] ? ", further back" : ""}); only where things have got to changes` : SIZE[still.size] > SIZE[env.size] ? "closer" : SIZE[still.size] < SIZE[env.size] ? "further back" : "moved to a new angle";
      parts.push(`Image 1 is ${base}${where.length ? `: ${where.join("; ")}` : shows ? `; ${shows}` : ""}. Image 1 shows: ${label(clean(env.moment || ""))}. This frame is ${later ? "the same place a moment later" : "the same scene and instant"} with the camera ${move}, framing ${subject(still)}.`);
    }
    if (prev && prev.id !== env?.id && prev.id !== still.id) parts.push(`The shot just seen was a ${prev.size} on ${subject(prev)}; this ${SIZE[still.size] > SIZE[prev.size] ? "cuts closer" : SIZE[still.size] < SIZE[prev.size] ? "cuts wider" : "cuts"} to ${subject(still)}, on the same side of the action, so left and right stay as they were.`);
    return parts.join(" ");
  }
  // A punch-in cut from the master: a 16:9 box in fractions of the master, from the people boxes the gate returned for it
  // (x = horizontal centre, top and bottom in percent). Vertical extent by size; wide enough for everyone plus a margin.
  // Boxes for the positioned props of a frame (the vehicles), read from a painted master, the people boxes' shape: x = the
  // centre, top and bottom, in percent. A punch-in whose subjects are two jets with specks for pilots has no people boxes
  // to cut by, and was painted instead, and the painter turned the jets round; the cut is free and keeps the master.
  async propBoxes(file, props) {
    const ids = props.filter((p) => inFrame(p) && p.at && typeof p.at.x === "number" && !(p.on && p.on !== "none")).map((p) => p.id); if (!ids.length) return {};
    this._propBoxes ??= {}; const key = `${file}|${ids.join(",")}`; if (this._propBoxes[key]) return this._propBoxes[key];
    const r = await jsonCall({ name: "prop-boxes", effort: "low", images: [this.run.path(file)],
      schema: S.obj({ items: S.obj(Object.fromEntries(ids.map((id) => [id, S.obj({ absent: S.bool, x: S.num, top: S.num, bottom: S.num })]))) }),
      prompt: `In this picture, for each thing below give its box: absent = true if it is not visible; x = the horizontal centre of the thing as a percentage of the picture's width (0 = left edge, 100 = right edge); top and bottom = the top and bottom of the thing as percentages of the picture's height (0 = top edge, 100 = bottom edge). Things:\n${ids.map((id) => `- ${id}: ${this.name(id)}`).join("\n")}` });
    const out = {}; for (const id of ids) { const b = r.items?.[id]; if (b && !b.absent) out[id] = { x: b.x, top: b.top, bottom: b.bottom }; }
    return (this._propBoxes[key] = out);
  }
  cropFor(still, boxes, propBoxes = null) {
    const usable = (b) => b && Number.isFinite(b.x) && Number.isFinite(b.top) && Number.isFinite(b.bottom) && b.bottom > b.top;
    const want = still.frame.people.filter(inFrame).map((p) => p.id); let ids = want.filter((id) => usable(boxes?.[id])), by = boxes || {};
    if (!ids.length || ids.length < want.length) {   // a person the gate did not box cannot be framed by a cut; the frame's vehicles can, when their boxes are known
      const pw = still.frame.props.filter((p) => inFrame(p) && p.at && typeof p.at.x === "number" && !(p.on && p.on !== "none")).map((p) => p.id), pids = pw.filter((id) => usable(propBoxes?.[id]));
      if (!pids.length || pids.length < pw.length) return null;   // paint from the master instead
      ids = pids; by = propBoxes;
    }
    const tops = ids.map((id) => by[id].top / 100), bots = ids.map((id) => by[id].bottom / 100), xs = ids.map((id) => by[id].x / 100);
    const top = Math.min(...tops), h = Math.max(...bots) - top, keep = { wide: 1, "medium-wide": 0.8, medium: 0.6, "medium-close": 0.42, close: 0.3 }[still.size];
    let ch = Math.min(1, h * keep + 0.08), y = Math.max(0, top - 0.06), cw = ch;   // the source is 16:9, so equal fractions keep the aspect
    const need = Math.max(...xs) - Math.min(...xs) + 0.3; if (cw < need) { cw = Math.min(1, need); ch = cw; }
    let x = (Math.min(...xs) + Math.max(...xs)) / 2 - cw / 2; x = Math.max(0, Math.min(1 - cw, x)); if (y + ch > 1) y = Math.max(0, 1 - ch);
    // Keep people the frame puts OFF frame out of the crop: pull the crop's edge in to their inner shoulder when they fall
    // inside it, as long as everyone in frame still fits with a small margin (the crop stays 16:9 by shrinking both sides).
    const offs = still.frame.people.filter((p) => !inFrame(p) && usable(boxes?.[p.id])).map((p) => ({ side: p.visible === "off left" ? "left" : "right", x: boxes[p.id].x / 100 }));
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
  // An accepted people count travels with the picture, like an accepted load: the edit of an over-the-shoulder frame that
  // was accepted with one person "too many" shows the same person, and is not a new flag. Inherited down the chain.
  peopleBaseline(still, painted) {
    const env = this.still(still.env), p = env && painted[env.id], c = p?.check; if (!p || !c) return null;
    if (Number.isFinite(c.baseline)) return c.baseline;
    return p.accepted && c.ok === false && Number.isFinite(c.people) ? c.people : null;
  }
  async peopleCheck(file, people, baseline = null) {
    const ids = people.map((p) => p.id);
    const r = await jsonCall({ name: "still-check-boxes", effort: "low", images: [this.run.path(file)],
      schema: S.obj({ people: S.int, countable: S.bool, ...(ids.length ? { distinguishable: S.bool, order: S.arr(S.enum(ids)), sides: S.obj(Object.fromEntries(ids.map((id) => [id, S.enum(["left", "centre", "right", "absent"])]))), boxes: S.obj(Object.fromEntries(ids.map((id) => [id, S.obj({ x: S.int, top: S.int, bottom: S.int })]))) } : {}), note: S.str }),
      prompt: `In this picture: how many people are visible? A reflection in a visor, a window or a screen, and a picture of a person, are not people. countable: true only if people in this picture, if any, would be large and plain enough to count reliably; false when the expected people would be tiny figures inside vehicles, behind glass, or hidden.${ids.length ? ` These people may be in it:\n${people.map((p) => `- ${p.id}: ${this.features[p.id]}`).join("\n")}\ndistinguishable: true only if the features above let you tell WHICH visible person is which (false when faces are hidden by helmets or visors, when the people are too small, or when the features do not differ); never guess an identity. order: the ids of those visible, from the left edge to the right edge (your best reading even if not distinguishable). sides: for each id, the third of the frame the person stands in (left, centre, right), or absent. boxes: for each id, x = the horizontal centre of the person as a percent of the picture width, top = the top of the head and bottom = the lowest visible point (feet or the frame edge) as percents of the height (0 at the top); zeros if absent.` : ""}\nnote: anything wrong (an extra person, a face that does not match the features), short.` });
    const RANK = { left: 0, centre: 1, right: 2 }, order = r.order || [];
    // The order (left to right) is checked only when the picture lets the gate tell the people apart; two helmeted pilots
    // are a count, not an order: the gate once guessed one and flagged a correct frame.
    const checkable = ids.length <= 1 || r.distinguishable !== false;
    // People the screenplay puts far away inside something (pilots in jets in a wide) may be invisible at this size: when
    // every expected person is at far depth, a count BELOW the expected one is not enforced (the vehicles that carry them
    // are the room and load gates' business); a count above it still is. The gate's own "countable" answer was unreliable
    // at 640px: it said countable and saw nobody in a frame of two distant jets.
    // …and the same for people the screenplay puts INSIDE something (`on`: a pilot in their jet, at any depth): they are
    // judged through the vehicle, which the room and load gates see. The nano run's second frame, two jets at mid depth
    // with the pilots behind glass, was flagged "0 people, want 2".
    const inside = (p) => p.on && p.on !== "none";
    const tooSmall = people.length > 0 && people.every((p) => p.depth === "far" || inside(p)) && r.people <= people.length;
    const inherited = baseline !== null && r.people === baseline && r.people !== people.length;
    // Nobody countable means nobody orderable: the order is not enforced either (an attack approach with the pilots
    // hidden in their jets was flagged on an empty order).
    const orderOk = !checkable || tooSmall || (people.every((p) => order.includes(p.id)) && people.every((a) => people.every((b) => RANK[a.third] >= RANK[b.third] || order.indexOf(a.id) < order.indexOf(b.id))));
    const countOk = r.people === people.length || tooSmall || inherited;
    return { ok: countOk && orderOk, ...r, orderOk, countOk, ...(baseline !== null ? { baseline } : {}), note: `${r.note || ""}${inherited ? " · the same count as the accepted frame it was made from (not flagged again)" : ""}${tooSmall && r.people !== people.length ? " · people far or inside what carries them (count below the expected not enforced)" : ""}${checkable ? "" : " · identities not distinguishable here (count checked, order not)"}`.replace(/^ · /, "") };
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
  // view: the shot's camera (looks_at, behind) so the gate knows what is meant to be in view. The opening wide of three
  // runs was flagged for a missing offshore platform that the camera, looking broadside at two jets with open sea behind,
  // had every right to leave out of frame.
  cameraOf(still) { return this.script?.scenes.find((sc) => sc.n === still.scene)?.shots.find((h) => h.n === still.shot)?.camera || null; }
  async roomCheck(file, placeId, expected = [], against = null, view = null) {
    const base = against || this.bank[placeId]?.file; if (!base) return { ok: true, note: "no plate" };
    const looks = view ? ` The camera of image 1 looks at ${clean(view.looks_at || "the subjects")}${view.behind?.length ? `, with ${view.behind.map(clean).join(", ")} behind` : ""}: a fixture of image 2 that is not named there may simply be out of view, and its absence does not make same_room false; same_room is false only when what IS visible contradicts image 2 (a different kind of place, a fixture moved to the other side, another finish).` : "";
    const r = await jsonCall({ name: "room-check", effort: "low", images: [this.run.path(file), this.run.path(base)],
      schema: S.obj({ same_room: S.bool, seen: S.arr(S.str), added: S.arr(S.str), note: S.str }),
      prompt: `Image 1 is a new film frame; image 2 is ${against ? "the same place as the painter was given to keep, an earlier frame of the film (ignore any people in it)" : "the empty place it must be in"}, which may be seen closer or from a different angle in image 1.${looks} Judge the ARRANGEMENT, not the craftsmanship: same_room is true when the same kinds of fixtures stand in the same places (a fireplace on the same side, the same windows and drapes, the same door; the same shoreline and sky for an exterior) and the walls or ground have the same kind of finish, even if a closer view renders details differently. seen: the fixtures of image 2 visible in image 1. added: only things in image 1 with NO counterpart in image 2 and not in this expected list (the expected things may appear at any size, distance or angle, nearer or larger than their words suggest, and are never "added"; a SECOND copy of an expected thing is added): ${expected.length ? expected.join("; ") : "(nothing expected)"}; new furniture, wallpaper where the walls were plain, objects the place did not have; a restyled version of an existing fixture is not added. Ignore the people and everything they wear or hold (a helmet, a visor, an oxygen mask and its hose, a harness, clothing, a thing in a hand): those belong to the person, never to the room. note: short.` });
    return { ok: r.same_room && !r.added.length, against: base, ...r };
  }
  // The load gate: for every host that carries something in this frame, what the picture shows attached to it against what
  // the screenplay puts on it; flag only. Three paints of the fourth Top Gun screenplay hung extra bombs and missiles on
  // the jets while every other gate passed: nothing was looking at what the aircraft carried.
  // An accepted liberty travels with the picture: when image 1 of a still was accepted with extra stores on a host, those
  // stores are the baseline for the still, and only something beyond them is extra. Without this every edit of an accepted
  // approach re-flagged the same missile.
  // The baseline is inherited down the chain: a still that passed WITH a baseline hands the same baseline to the stills made
  // from it (the punch-in from the bank frame re-flagged the missile its own image 1 had been passed with).
  loadBaseline(still, painted) {
    const env = this.still(still.env), p = env && painted[env.id], load = p?.check?.load; if (!p || !load) return null;
    if (load.baseline) return load.baseline;
    if (!p.accepted || load.ok !== false) return null;
    const base = {}; for (const [id, v] of Object.entries(load.hosts || {})) if (v.extra && v.attached?.length) base[id] = v.attached;
    return Object.keys(base).length ? base : null;
  }
  async loadCheck(file, hosts, baseline = null) {
    if (!hosts.length) return { ok: true, note: "nothing carried" };
    const accepted = baseline ? `\nAlready accepted by the director on the frame this one was made from, so NOT extra here: ${hosts.filter((h) => baseline[h.id]).map((h) => `${h.id}: ${baseline[h.id].join(", ")}`).join("; ")}. extra is true only for something beyond the listed things and these accepted ones together.` : "";
    const r = await jsonCall({ name: "load-check", effort: "low", images: [this.run.path(file)],
      schema: S.obj({ hosts: S.obj(Object.fromEntries(hosts.map((h) => [h.id, S.obj({ absent: S.bool, attached: S.arr(S.str), extra: S.bool, listed_attached: S.bool })]))), note: S.str }),
      prompt: `In this picture, these things carry something:\n${hosts.map((h) => `- ${h.id}: ${h.name}${h.look ? ` (${h.look})` : ""}; it carries exactly: ${h.carries.join(", ")}`).join("\n")}\n${accepted}\nFor each: absent = true when it is not in the picture or too small to judge (then attached is empty and extra is false). attached = everything visibly attached to, mounted on or hanging from it beyond its own body, each item separately and both sides counted (every bomb, missile, pod, tank, rack, bag, or thing in a hand), as short phrases. extra = true when attached holds MORE items than the list above, or an item of a kind the list does not name (a second bomb where one is listed; missiles where only a bomb is listed). The fitting that holds a listed item (its pylon, rack, strap, sling, or the hand that holds it) belongs to that item and is never extra. listed_attached = true when every item in its list is visibly attached to it in the picture; false when a listed item is missing from it or has separated (a bomb falling below the wing it was listed on). note: short, what and where.` });
    const extra = Object.entries(r.hosts || {}).filter(([, v]) => v.extra && !v.absent).map(([id]) => hosts.find((h) => h.id === id)?.name || id);
    // A listed item that is not attached any more (released, dropped, missing) is a flag too: the frame before the release
    // once showed both bombs already falling, and the gate, built for extras, passed it.
    const separated = Object.entries(r.hosts || {}).filter(([, v]) => v.listed_attached === false && !v.absent).map(([id]) => hosts.find((h) => h.id === id)?.name || id);
    return { ok: !extra.length && !separated.length, extra, separated, hosts: r.hosts, note: `${separated.length ? `${separated.join(", ")} no longer carr${separated.length === 1 ? "ies" : "y"} what the screenplay attaches (released or missing in the picture) · ` : ""}${r.note || ""}`, ...(baseline ? { baseline } : {}) };
  }
  // The geometry gate (T-029): for every positioned prop in frame, the picture's heading and apparent size against the
  // stage's. The heading is read as one of eight directions and held against the stage's yaw: more than 70° off is a
  // flag (a quarter turn; one reading step and a half is the painter's licence). The first gate flagged only the exact
  // opposite of the staged word, and s7-2 of the ninth film passed it with both jets turned 90° to face each other. A
  // size off by more than 2.5 times is a flag, and so is a staged thing missing from the picture. The release frame of the fifth film had both jets facing the camera with
  // nothing to see it.
  // An accepted size deviation travels with the picture, like an accepted load: the edit of a frame accepted with the jet
  // painted large shows the same large jet. Headings are never inherited: a flipped heading is wrong in every frame.
  geoBaseline(still, painted) {
    const env = this.still(still.env), p = env && painted[env.id], g = p?.check?.geo; if (!p || !g) return null;
    // A record checked before `sizeOff` existed: the size complaints are read back from the gate's own lines.
    const own = p.accepted && g.ok === false ? (g.sizeOff || Object.keys(g.items || {}).filter((id) => (g.bad || []).some((b) => b.startsWith(`${this.name(id)} takes `)))) : [];
    const all = [...new Set([...(g.baseline || []), ...own])]; return all.length ? all : null;
  }
  // A heading accepted upstream travels with the picture only for a thing that does not move: the frigate painted
  // broadside in the accepted wide is the same ship in the same orientation in every frame painted from it, and the
  // painter is told to keep it. A mover's heading is never inherited: a flipped jet is wrong in every frame.
  headingBaseline(still, painted) {
    const env = this.still(still.env), p = env && painted[env.id], g = p?.check?.geo; if (!p || !g) return [];
    const own = p.accepted && g.ok === false ? (g.headingOff || Object.keys(g.items || {}).filter((id) => (g.bad || []).some((b) => b.startsWith(`${this.name(id)} heads `)))) : [];
    const shot = this.script.scenes.flatMap((sc) => sc.shots).find((h) => h.n === still.shot), scene = this.script.scenes.find((sc) => sc.n === still.scene);
    const stationary = (id) => { if (scene?.stage?.goal === id) return true; const a = shot?.first?.props.find((x) => x.id === id), b = shot?.last?.props.find((x) => x.id === id); return !!(a?.at && b?.at && Math.hypot(b.at.x - a.at.x, b.at.y - a.at.y, b.at.z - a.at.z) < 5); };
    return [...new Set([...(g.headingBaseline || []), ...own])].filter(stationary);
  }
  async geometryCheck(file, props, baseline = null, headingBaseline = []) {
    const SIZE_OFF = 2.5;   // a size this many times off the stage's is a flag: a jet at 39% where the stage says 14% passed at 3×
    const items = props.filter((p) => inFrame(p) && p.stage && p.points); if (!items.length) return { ok: true, note: "nothing positioned" };
    const r = await jsonCall({ name: "geometry-check", effort: "low", images: [this.run.path(file)],
      schema: S.obj({ items: S.obj(Object.fromEntries(items.map((p) => [p.id, S.obj({ absent: S.bool, points: S.enum([...Object.keys(READ_YAW), "down", "up", "none"]), height_share: S.num })]))), note: S.str }),
      prompt: `In this picture, for each thing below: absent = true if it is not visible. points = the direction its front (nose, bow, face) points as the camera sees it, one of eight: "away from the camera" (we see its back or tail squarely); "away, angled to screen right" or "away, angled to screen left" (tail toward us, nose swung toward that edge of the picture); "across to screen right" or "across to screen left" (seen side-on, nose toward that edge); "toward the camera, angled to screen right" or "toward the camera, angled to screen left" (nose toward us, swung toward that edge); "toward the camera" (nose at us squarely); or "down", "up", or "none" for a thing with no front. Judge the nose, not where the thing sits in the picture. height_share = the share of the picture's HEIGHT the thing takes (0.05 = a twentieth, 0.5 = half). Things:\n${items.map((p) => `- ${p.id}: ${this.name(p.id)}`).join("\n")}\nnote: short.` });
    const opposite = { "away from the camera": "toward the camera", "toward the camera": "away from the camera", "across to screen left": "across to screen right", "across to screen right": "across to screen left", up: "down", down: "up" };
    const bad = [], sizeOff = [], headingOff = [];
    const absent = [];
    for (const p of items) { const o = r.items?.[p.id]; if (!o) continue;
      // A staged thing the picture does not hold, where the stage gives it a visible size, is a flag: the film's opening wide
      // was accepted with no frigate in it (6% of the height on the stage) because an absent thing was skipped here.
      if (o.absent) { if (p.stage.share >= 0.03 && !(p.on && p.on !== "none")) { absent.push(p.id); bad.push(`${this.name(p.id)} is not in the picture, the stage puts it in frame at ${Math.round(p.stage.share * 100)}% of the height`); } continue; }
      const gap = headingGap(p.stage, o.points); if (!(headingBaseline || []).includes(p.id) && (gap === null ? o.points === opposite[p.points] : gap > HEADING_TOLERANCE)) { headingOff.push(p.id); bad.push(`${this.name(p.id)} heads ${o.points}${o.points in READ_YAW ? ` (${READ_YAW[o.points]}°)` : ""}, the stage says ${p.points}${typeof p.stage.yaw === "number" ? ` (${p.stage.yaw}°)` : ""}`); } const want = p.stage.share; if (!(baseline || []).includes(p.id) && want >= 0.03 && o.height_share >= 0.03 && (o.height_share / want > SIZE_OFF || want / o.height_share > SIZE_OFF)) { sizeOff.push(p.id); bad.push(`${this.name(p.id)} takes ${Math.round(o.height_share * 100)}% of the height, the stage says ${Math.round(want * 100)}%`); } }
    return { ok: !bad.length, bad, sizeOff, headingOff, absent, items: r.items, ...(baseline ? { baseline } : {}), ...(headingBaseline?.length ? { headingBaseline } : {}), note: `${bad.join("; ")}${bad.length && r.note ? " · " : ""}${r.note || ""}${baseline?.length ? ` · sizes accepted upstream for ${baseline.map((id) => this.name(id)).join(", ")} (not flagged again)` : ""}${headingBaseline?.length ? ` · headings accepted upstream for ${headingBaseline.map((id) => this.name(id)).join(", ")}, which do not move (not flagged again)` : ""}` };
  }
  // The style gate: a frame against the film's style sheet, finish only (grain, colour, contrast, medium); flag only.
  async styleCheck(file, expectation = "") {
    if (!this.styleSheet) return { ok: true, note: "no style sheet" };
    const r = await jsonCall({ name: "style-check", effort: "low", images: [this.run.path(file), this.run.path(this.styleSheet)],
      schema: S.obj({ same_medium: S.bool, faults: S.arr(S.enum(["posterization", "halftone-or-dot-pattern", "painterly-strokes", "banding", "line-art", "plastic-smoothness", "heavy-oversaturation", "monochrome-or-desaturated"])), tonal_notes: S.str, note: S.str }),
      prompt: `Image 1 is a frame of a film; image 2 is the film's style sheet, a picture made in the medium every frame must share. Judge the MEDIUM and the FINISH only, never content or composition. same_medium = image 1 is the same kind of picture as image 2 (both photographic live-action, or both the same animation style). faults = only the listed faults that are plainly present in image 1 and absent from image 2: posterization (flat colour steps), halftone or dot pattern, painterly strokes, banding, line art, plastic smoothness, heavy oversaturation, monochrome or desaturated (the whole frame in black and white or near it while image 2 is in colour; a monochrome screen or picture INSIDE a colour frame is not a fault); ordinary differences of grain, warmth, contrast or sharpness are NOT faults and go in tonal_notes instead.${expectation ? ` This shot deliberately departs from the sheet in this way, which is not a fault: ${expectation}.` : ""} note: short.` });
    // A model that cannot take the style sheet (tight input cap) cannot be held to it: its finish is reported, not flagged.
    // qwen flagged plastic-smoothness on every frame of the attack chain, with nothing the pipeline could send to fix it.
    if (this.maxImages < MAX_REFS) return { ok: true, drift: r.faults, ...r, note: `${r.note || ""}${r.faults.length ? ` · finish differs (${r.faults.join(", ")}); not enforced on a model that cannot take the style sheet` : ""}`.replace(/^ · /, "") };
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
