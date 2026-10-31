// The keyframe prompt (PRD §5): short, and only what the references cannot carry.
//   CONTEXT    where this frame sits in the film: the scene heading, the shot and its seconds, whether this is the frame
//              before the shot's action or after it, the action itself LABELLED as what happens during the shot (so the
//              painter knows what the frame leads into or follows, and that it is not yet, or no longer, visible), the
//              moment and the scene's tone.
//   FRAME      the size shot and the moment.
//   PEOPLE     who is in frame, where relative to each other, facing whom, doing what; PROPS likewise.
//   CHANGES    only what differs from image 1 (edit), or nothing (crop).
//   REFERENCES image 1 is the scene as it stands and nothing in it changes but what is listed; portraits and prop pictures
//              only where the state manager says the thing is missing from image 1 or too small in it.
//   RULES      the count, the medium sentence, no text.
// No walls, no light, no camera position, no fixture lists: the reference carries all of that.
import { inFrame, norm, SIZE_WORDS } from "../screenplay/screenplay.js";
import { worldText, previousFrame } from "../screenplay/stage.js";

const strip = (s) => String(s ?? "").trim().replace(/[.;,\s]+$/, ""), t = (s) => strip(s).replace(/^[A-Z]/, (c) => c.toLowerCase()), cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Where a still sits in its shot: the whole shot (first and last frames identical), its end, or its start.
const whichOf = (still) => still.uses.some((u) => u.endsWith("start")) && still.uses.some((u) => u.endsWith("end")) && still.uses.filter((u) => u.startsWith(`shot ${still.shot} `)).length === 2 ? "whole" : still.uses[0]?.endsWith("end") ? "end" : "start";

export function keyframePrompt({ still, state, medium, mode = "paint" }) {   // mode: paint (from plate / master) | edit (same camera) | crop (re-render a crop of the master)
  const els = state.els, name = (id) => state.name(id), people = still.frame.people.filter(inFrame), props = still.frame.props.filter(inFrame);
  const named = (text) => state.labelled.reduce((s, e) => s.replace(new RegExp(`\\b${e.id}\\b`, "gi"), (m, at, str) => { const l = state.name(e.id); return /^the /i.test(l) && /\bthe\s+$/i.test(str.slice(0, at)) ? l.slice(4) : l; }), String(text ?? ""));   // every id → its painter label (fixtures only when their id is a compound); no doubled article
  const refs = state.refs(still), idx = (kind, id) => refs.findIndex((r) => r.ref === `${kind}:${id}`) + 1;
  const env = state.still(still.env), script = state.script, scene = script.scenes.find((sc) => sc.n === still.scene), shots = script.scenes.flatMap((sc) => sc.shots), shot = shots.find((h) => h.n === still.shot);
  // Where this frame sits.
  const which = whichOf(still);
  const actionText = shot?.action?.length ? shot.action.map((a) => named(t(a.text))).join(" ") : "";
  const place = which === "whole" ? `the whole of shot ${still.shot} (${shot.start}–${shot.start + shot.seconds} s): nothing moves during it` : which === "start" ? `the FIRST frame of shot ${still.shot} (${shot.start}–${shot.start + shot.seconds} s)${actionText ? ". This is the instant BEFORE the shot's action: nothing of it has begun; nothing has struck, fallen, opened, lit or changed yet" : ""}` : `the LAST frame of shot ${still.shot} (${shot.start}–${shot.start + shot.seconds} s)${actionText ? `. During the shot, before this frame: ${actionText}. All of that is complete in this frame` : ""}`;
  // Prose written with names (the film synopsis, the situation, the scene synopsis) is labelled only for hyphenated ids,
  // which are unambiguous tokens; a plain-word id inside prose is already a name ("Alice" became "Alice Hart Hart").
  const prose = (text) => state.labelled.filter((e) => e.id.includes("-")).reduce((s, e) => s.replace(new RegExp(`\\b${e.id}\\b`, "gi"), state.name(e.id)), String(text ?? ""));
  const hist = state.history(still);
  // T-022, extended: the first frame of a shot with an action is the instant before it, so it carries the moment of the
  // shot before (the state it continues) and no treatment: "daylight opens between each empty pylon and its departing
  // bomb" is the shot's idea, and in the frame before the release it put both bombs in the air.
  const before = which === "start" && actionText ? shots.filter((h) => h.n < still.shot).pop() : null;
  const momentText = before?.moment ? `${named(cap(t(before.moment)))} (the shot before; this frame continues from it, the instant before anything new happens)` : named(cap(t(still.moment)));
  const context = `CONTEXT\n${scene.inside ? "INT." : "EXT."} ${name(scene.place)}, ${scene.time.toLowerCase()}; scene ${scene.n} of ${script.scenes.length}, ${place}.${script.synopsis ? `\nFilm: ${prose(cap(t(script.synopsis)))}.` : ""}${scene.situation ? `\nNow: ${prose(cap(t(scene.situation)))}.` : ""}${scene.synopsis ? `\nScene: ${prose(cap(t(scene.synopsis)))}.` : ""}${hist.earlier.length ? `\nSo far in this scene: ${hist.earlier.join(" · ")}.` : ""}${hist.before && which !== "end" ? `\nBefore this frame, as last seen: ${cap(hist.before)}.` : ""}${script.theme ? `\nTheme: ${cap(t(script.theme))}.` : ""}\nMoment: ${momentText}.${shot?.treatment && !before ? `\nTreatment: ${named(cap(t(shot.treatment)))}.` : ""}\nTone: ${cap(t(scene.tone))}.`;
  const STILL_CUES = ["motion blur on the subject", "vapor over the wings", "contrails", "wake on the water", "spray", "dust or debris", "foreground element whipping past the lens", "camera low to the ground or sea", "strong diagonals", "lens streaks", "crisp frozen detail"];
  const motion = (shot?.motion || []).filter((m) => STILL_CUES.includes(m));
  const frame = `FRAME\n${cap(still.size)} shot.${motion.length ? ` Motion in this frame: ${motion.join(", ")}.` : ""}${shot?.camera?.view ? ` VIEW: ${shot.camera.view === "from inside" ? "from inside, with the subject" : `${shot.camera.view} the subjects`}, ${shot.camera.height === "eye" ? "at eye level" : `${shot.camera.height} angle`}${shot.camera.view === "from behind" ? ": backs and tails toward the camera, what they move toward lies beyond them" : shot.camera.view === "from ahead" ? ": faces and noses toward the camera" : ""}.` : ""}`;
  // A person at far depth is a small figure, usually inside or on something (a pilot in a jet, a rider on a horse): asked
  // for as that, never as a visible person the painter must show. "Exactly 2 people in frame" for two pilots inside distant
  // jets once produced two extra foreground jets with pilots in them.
  // A speck is far whatever its distance: a pilot inside a jet 200 m off is "mid" depth on the stage and still not a face
  // the painter can show; "exactly 2 people visible up close" for two specks turned the jets round to show the faces.
  const far = (p) => p.depth === "far" || p.size === "tiny", nearPeople = people.filter((p) => !far(p)), farPeople = people.filter(far);
  // A staged prop's size is its two shares of the frame, as the WORLD block states them: the size word is one number
  // (the larger of height and width), and "about a quarter of the frame's height" for a jet seen from behind that takes
  // 5% of the height and 12% of the width made the painter enlarge it, and a large jet over the sea is painted as a hero
  // shot, nose to the camera (s7-2, four of five attempts).
  const pct = (x) => `${Math.max(1, Math.round(x * 100))}%`;
  const sz = (p) => (p.stage && typeof p.stage.share === "number" ? `, about ${pct(p.stage.share)} of the frame's height and ${pct(p.stage.shareW ?? p.stage.share)} of its width` : p.size && SIZE_WORDS[p.size] ? `, ${SIZE_WORDS[p.size]}` : "");
  const person = (p) => far(p) ? `- ${name(p.id)}: ${p.third} third, far${sz(p)}, a small figure ${named(t(p.distance))}; not individually visible beyond that.` : `- ${name(p.id)}: ${p.third} third${sz(p)}, facing ${named(t(p.facing))}, ${named(t(p.distance))}; ${named(t(p.pose))}, hands ${named(t(p.hands))}; ${named(t(p.doing))}.`;
  // Attachment is structured (`on`): a prop on a host is the only thing attached there, and the host carries exactly what is
  // on it (through a chain: the bomb on the pylon on the aircraft is carried by the aircraft). Prose once put "the crosshair
  // carries exactly one thing: the frigate" into a cockpit frame, because "beneath the crosshair" matched a preposition.
  const hostOf = (p) => p.on && p.on !== "none" ? p.on : null;
  const top = (p) => { let id = hostOf(p); for (let i = 0; i < 6; i++) { const h = props.find((x) => x.id === id), up = h && hostOf(h); if (!up || up === id) return id; id = up; } return id; };
  const prop = (p) => `- ${name(p.id)}: ${named(t(p.where))}${sz(p)}${p.facing && p.facing !== "none" ? `; ${named(t(p.facing))}` : ""}; ${named(t(p.condition))}${hostOf(p) ? `; attached to ${name(hostOf(p))}, the only thing attached there` : ""}.`;
  const off = state.offFrame(still.frame);
  const relations = (still.frame.relations || []).filter((r) => [r.a, r.b].every((id) => [...still.frame.people, ...still.frame.props].some((x) => x.id === id && inFrame(x)) || els.some((e) => e.id === id && e.kind === "fixture"))).map((r) => `- ${name(r.a)} ${named(t(r.how))} ${name(r.b)}.`);
  const peopleBlock = `PEOPLE (${nearPeople.length ? `exactly ${nearPeople.length} visible` : "nobody visible up close"}${farPeople.length ? `; ${farPeople.length} far away inside what carries them` : ""}${off ? `; ${off}` : ""})\n${people.map(person).join("\n") || "- nobody in frame."}${props.length ? `\n\nPROPS\n${props.map(prop).join("\n")}` : ""}${relations.length ? `\n\nRELATIONS\n${relations.join("\n")}` : ""}`;
  // A master paint that returns to the place at a later moment (someone has gone, come, or is doing something else) lists the
  // cast changes, so the painter is not told "nothing changes" and "exactly N people" at once.
  const castChanges = mode === "paint" && env && still.envKind === "master" ? deltas(env.frame, still.frame, name, named, { castOnly: true }) : "", later = !!castChanges;
  let changes = "";
  if (mode === "edit" && env) changes = `CHANGES (from image 1)\n${deltas(env.frame, still.frame, name, named)}\n- Everything else stays exactly as in image 1, including what every vehicle carries: nothing is added to any aircraft, vessel or person.`;
  else if (mode === "crop") changes = `CHANGES\nNone: this is the same instant as image 1, re-rendered at full detail in this framing.`;
  else if (later) changes = `CHANGES (since image 1)\n${castChanges}`;
  const first = mode === "crop" ? `image 1: this exact framing of the scene, cut from the wide view; keep everything in it exactly, the place and the people, and render it at full detail.`
    : still.envKind === "plate" || !env ? `image 1: the empty place; keep it exactly, its space, light and colours.`
    : still.envKind === "edit" ? `image 1: the scene as it stands, the place and everyone already in it, seen from the SAME camera: keep its viewpoint, horizon, angle on every subject and distances exactly; nothing in it changes except what is listed under CHANGES.`
    : later ? `image 1: the place as it stood a moment earlier; the place itself does not change, the people do only as listed under CHANGES. ${state.relation(still, true)}`
    : `image 1: the scene as it stands, the place and everyone in it; nothing in it changes. ${state.relation(still)}`;
  const others = refs.slice(1).map((r, i) => { const [kind, id] = r.ref.split(":"), el = els.find((e) => e.id === id); return kind === "style" ? `image ${i + 2}: the film's style sheet; match its grain, colour treatment, contrast, sharpness and finish exactly; nothing in it is part of this scene.` : kind === "prev" ? (state.still(id)?.place !== still.place ? `image ${i + 2}: the frame just before this one, in another place (${name(state.still(id)?.place)}), a moment earlier; from it take the moment and the WORLD OUTSIDE any window or canopy (sky, sea, weather, light, what is in flight and where), never the room itself.` : `image ${i + 2}: the frame just before this one, a moment earlier from another camera; everything continues from it: what is intact or spent, where each thing has got to, and how big each thing is beside the others; only its camera does not apply.`) : kind === "portrait" ? `image ${i + 2}: ${name(id)}'s face, hair and clothes (${strip(state.features[id] || "")}); the pose and background of that picture do not apply.` : `image ${i + 2}: ${name(id)} as the record shows it (${strip(el?.look || "")}); its shape, build and markings; the surroundings, weather, medium and ANGLE of that picture do not apply, this frame's VIEW decides which side of it is seen.`; });
  const references = `REFERENCES\n${[first, ...others].join("\n")}`;
  const carriers = {}; for (const p of props) if (hostOf(p)) { const host = top(p); if (host && host !== p.id) (carriers[host] ??= []).push(name(p.id)); }
  const storesRule = Object.keys(carriers).length ? ` ${Object.entries(carriers).map(([host, items]) => `${name(host)} carries exactly ${items.length === 1 ? "one thing" : `${items.length} things`}: ${items.join(", ")}; nothing else is attached to it or hangs from it (no other weapons, pods, tanks, racks or bags)`).join("; ")}.` : "";
  const rules = `RULES\n${nearPeople.length ? `Exactly ${nearPeople.length} ${nearPeople.length === 1 ? "person" : "people"} visible up close, nobody else` : "No person visible up close"}${farPeople.length ? `; the ${farPeople.length === 1 ? "far one is" : "far ones are"} small figures inside what carries them, each thing once, no extra vehicle or person added to show them` : ""}. ${refs.length > 1 ? "The numbered images are sources for look only: paint no numbers, labels, borders or panels; one single scene. " : ""}${storesRule}${storesRule ? " " : ""}${medium.treatment ? `${medium.treatment} ` : ""}${medium.frame} One frame filling the picture edge to edge, no black bars; no captions, titles or overlaid text, scene text only where named above.`;
  // WORLD: the stage in metres, the camera's place on it, every prop relative to the goal and the line, and what moved since
  // the frame before ON THE SAME STAGE: the shot's first frame for its last, the previous shot's last frame for a first
  // (whatever their cameras). Local descriptors can be read several ways; this has one reading (T-029). The chain's
  // previous still once served here, and for the first exterior after a cockpit scene it was a frame in cockpit
  // coordinates: the painter read "advanced 4420 m along the line" for a jet that had flown 520.
  const world = worldText({ shot, scene, frame: still.frame, prevFrame: previousFrame(scene, shot, which === "end" ? "last" : "first"), name, sizeOf: (id) => Number(els.find((e) => e.id === id)?.size_m) || null });
  return { images: refs.map((r) => r.ref), prompt: [context, frame, ...(world ? [world] : []), peopleBlock, ...(changes ? [changes] : []), references, rules].join("\n\n") };
}

// What differs between two frames, one line per element. A person whose third and depth are unchanged and whose only changed
// field is the distance to someone who DID move stays exactly as in image 1. castOnly: for a frame painted from another
// camera, only who is in or out and what each is doing (thirds, depth, facing and distances differ with the camera, not the
// scene); an empty string when nothing of the cast changed.
// A DELTA EDIT (T-029): the retry of an edit the geometry gate flagged (something turned or changed size where the stage
// says it did not). Image 1 is the still's own image 1, which passed; the text is only what changed, in words and in
// metres, and the invariant that nothing turns. The full prompt restates the whole scene and the painter recomposes it:
// the release frame turned both jets to face the camera in two films; a minimal change-only edit of a flipped frame kept
// its composition exactly, which is the property wanted here.
export function deltaEditPrompt({ still, state, medium, styleSheet = false }) {
  const name = (id) => state.name(id), named = (text) => state.label(text), env = state.still(still.env), script = state.script;
  const scene = script.scenes.find((sc) => sc.n === still.scene), shot = script.scenes.flatMap((sc) => sc.shots).find((h) => h.n === still.shot);
  const change = env ? deltas(env.frame, still.frame, name, named) : "";
  const world = worldText({ shot, scene, frame: still.frame, prevFrame: previousFrame(scene, shot, whichOf(still) === "end" ? "last" : "first"), name, sizeOf: (id) => Number(state.els.find((e) => e.id === id)?.size_m) || null });
  const headings = still.frame.props.filter((p) => inFrame(p) && p.points && p.points !== "none" && !(p.on && p.on !== "none" && p.stage && p.stage.share < 0.005)).map((p) => `${name(p.id)} ${p.points}`);
  return `EDIT (from image 1)\nImage 1 is this exact frame a moment earlier, from the SAME camera: keep its viewpoint, horizon, place, light, every person and vehicle, their positions, headings and sizes, and the finish exactly. Change only this:\n${change || "- nothing listed."}\n- Nothing else changes: nothing turns${headings.length ? ` (${headings.join("; ")}, exactly as in image 1)` : ""}, nothing grows or shrinks, no new thing appears, no aircraft, vessel or person gains anything.${styleSheet ? "\n- Image 2 is the film's style sheet: match its grain, colour treatment, contrast, sharpness and finish exactly; nothing in it is part of this scene." : ""}\n\n${world ? `${world}\n\n` : ""}RULES\n${medium.treatment ? `${medium.treatment} ` : ""}${medium.frame} One frame filling the picture edge to edge, no black bars; no captions, titles or overlaid text.`;
}

// The same instant: nothing of the cast differs between two frames (who is in frame and what each is doing; what each prop
// is and in what condition). A punch-in is cut from its master only then: the strike frame, a tighter setup of the
// release wide with the ship now burning, was once cut from the release as it stood.
export function sameInstant(a, b) {
  const key = (f) => JSON.stringify({ people: f.people.filter(inFrame).map((p) => [p.id, norm(p.doing), norm(p.pose), norm(p.hands)]).sort(), props: f.props.filter(inFrame).map((p) => [p.id, norm(p.condition), norm(p.where)]).sort() });
  return key(a) === key(b);
}

function deltas(prev, cur, name, named, { castOnly = false } = {}) {
  const out = [], moved = (p, q) => p.third !== q.third || p.depth !== q.depth;
  if (castOnly) {   // presence means presence in the PLACE: listed in the frame at all (in frame or just outside it), since every element of a scene is in every frame
    for (const p of cur.people) {
      const q = prev.people.find((x) => x.id === p.id);
      if (!q && inFrame(p)) out.push(`- ${name(p.id)} is now here: ${p.third} third, facing ${named(t(p.facing))}, ${named(t(p.distance))}; ${named(t(p.pose))}, hands ${named(t(p.hands))}; ${named(t(p.doing))}.`);
      else if (q && inFrame(p) && inFrame(q) && (norm(p.doing) !== norm(q.doing) || norm(p.pose) !== norm(q.pose) || norm(p.hands) !== norm(q.hands))) out.push(`- ${name(p.id)}: now ${named(t(p.pose))}, hands ${named(t(p.hands))}; ${named(t(p.doing))}.`);
    }
    for (const q of prev.people) if (inFrame(q) && !cur.people.some((x) => x.id === q.id)) out.push(`- ${name(q.id)} is no longer here.`);
    for (const p of cur.props) { const q = prev.props.find((x) => x.id === p.id); if (!q && inFrame(p)) out.push(`- ${name(p.id)} is now here: ${named(t(p.where))}; ${named(t(p.condition))}.`); else if (q && inFrame(p) && inFrame(q) && norm(p.condition) !== norm(q.condition)) out.push(`- ${name(p.id)}: now ${named(t(p.condition))}.`); }
    for (const q of prev.props) if (inFrame(q) && !cur.props.some((x) => x.id === q.id)) out.push(`- ${name(q.id)} is no longer here.`);
    return out.join("\n");
  }
  for (const p of cur.people) {
    const q = prev.people.find((x) => x.id === p.id), now = inFrame(p), before = q && inFrame(q);
    if (now && !before) out.push(`- ${name(p.id)} enters the frame: ${p.third} third, facing ${named(t(p.facing))}, ${named(t(p.distance))}; ${named(t(p.pose))}, hands ${named(t(p.hands))}; ${named(t(p.doing))}.`);
    else if (!now && before) out.push(`- ${name(p.id)} leaves the frame.`);
    else if (now) {
      const d = ["third", "depth", "facing", "distance", "pose", "hands", "doing"].filter((k) => norm(p[k]) !== norm(q[k])); if (!d.length) continue;
      const other = cur.people.find((o) => o.id !== p.id && new RegExp(`\\b${o.id}\\b`, "i").test(p.distance)), otherQ = other && prev.people.find((x) => x.id === other.id);
      if (!moved(p, q) && d.every((k) => k === "distance") && other && otherQ && moved(other, otherQ)) { out.push(`- ${name(p.id)}: stays exactly as in image 1; ${named(t(p.distance))} now that ${name(other.id)} has moved.`); continue; }
      out.push(`- ${name(p.id)}: ${moved(p, q) ? "" : "stays where he is; "}now ${d.map((k) => (k === "third" ? `in the ${p.third} third` : k === "depth" ? `at ${p.depth} depth` : k === "facing" ? `facing ${named(t(p.facing))}` : k === "hands" ? `hands ${named(t(p.hands))}` : named(t(p[k])))).join("; ")}.`);
    }
  }
  for (const p of cur.props) {
    const q = prev.props.find((x) => x.id === p.id), now = inFrame(p), before = q && inFrame(q);
    if (now && !before) out.push(`- ${name(p.id)} appears: ${named(t(p.where))}; ${named(t(p.condition))}.`);
    else if (!now && before) out.push(`- ${name(p.id)} leaves the frame.`);
    else if (now) { const d = ["where", "facing", "condition"].filter((k) => p[k] !== undefined && norm(p[k]) !== norm(q[k])); if (d.length) out.push(`- ${name(p.id)}: now ${d.map((k) => named(t(p[k]))).join("; ")}.`); }
  }
  return out.join("\n") || "- nothing: the same frame.";
}
