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

const strip = (s) => String(s ?? "").trim().replace(/[.;,\s]+$/, ""), t = (s) => strip(s).replace(/^[A-Z]/, (c) => c.toLowerCase()), cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function keyframePrompt({ still, state, medium, mode = "paint" }) {   // mode: paint (from plate / master) | edit (same camera) | crop (re-render a crop of the master)
  const els = state.els, name = (id) => state.name(id), people = still.frame.people.filter(inFrame), props = still.frame.props.filter(inFrame);
  const named = (text) => state.labelled.reduce((s, e) => s.replace(new RegExp(`\\b${e.id}\\b`, "gi"), (m, at, str) => { const l = state.name(e.id); return /^the /i.test(l) && /\bthe\s+$/i.test(str.slice(0, at)) ? l.slice(4) : l; }), String(text ?? ""));   // every id → its painter label (fixtures only when their id is a compound); no doubled article
  const refs = state.refs(still), idx = (kind, id) => refs.findIndex((r) => r.ref === `${kind}:${id}`) + 1;
  const env = state.still(still.env), script = state.script, scene = script.scenes.find((sc) => sc.n === still.scene), shots = script.scenes.flatMap((sc) => sc.shots), shot = shots.find((h) => h.n === still.shot);
  // Where this frame sits.
  const which = still.uses.some((u) => u.endsWith("start")) && still.uses.some((u) => u.endsWith("end")) && still.uses.filter((u) => u.startsWith(`shot ${still.shot} `)).length === 2 ? "whole" : still.uses[0]?.endsWith("end") ? "end" : "start";
  const actionText = shot?.action?.length ? shot.action.map((a) => named(t(a.text))).join(" ") : "";
  const place = which === "whole" ? `the whole of shot ${still.shot} (${shot.start}–${shot.start + shot.seconds} s): nothing moves during it` : which === "start" ? `the FIRST frame of shot ${still.shot} (${shot.start}–${shot.start + shot.seconds} s)${actionText ? `. During the shot, after this frame: ${actionText}. None of that has happened yet in this frame` : ""}` : `the LAST frame of shot ${still.shot} (${shot.start}–${shot.start + shot.seconds} s)${actionText ? `. During the shot, before this frame: ${actionText}. All of that is complete in this frame` : ""}`;
  const hist = state.history(still);
  const context = `CONTEXT\n${scene.inside ? "INT." : "EXT."} ${name(scene.place)}, ${scene.time.toLowerCase()}; scene ${scene.n} of ${script.scenes.length}, ${place}.${scene.synopsis ? `\nScene: ${named(cap(t(scene.synopsis)))}.` : ""}${hist.earlier.length ? `\nSo far in this scene: ${hist.earlier.join(" · ")}.` : ""}${hist.before && which !== "end" ? `\nBefore this frame, as last seen: ${cap(hist.before)}.` : ""}${script.theme ? `\nTheme: ${cap(t(script.theme))}.` : ""}\nMoment: ${named(cap(t(still.moment)))}.${shot?.treatment ? `\nTreatment: ${named(cap(t(shot.treatment)))}.` : ""}\nTone: ${cap(t(scene.tone))}.`;
  const STILL_CUES = ["motion blur on the subject", "vapor over the wings", "contrails", "wake on the water", "spray", "dust or debris", "foreground element whipping past the lens", "camera low to the ground or sea", "strong diagonals", "lens streaks", "crisp frozen detail"];
  const motion = (shot?.motion || []).filter((m) => STILL_CUES.includes(m));
  const frame = `FRAME\n${cap(still.size)} shot.${motion.length ? ` Motion in this frame: ${motion.join(", ")}.` : ""}${shot?.camera?.view ? ` VIEW: ${shot.camera.view === "from inside" ? "from inside, with the subject" : `${shot.camera.view} the subjects`}, ${shot.camera.height === "eye" ? "at eye level" : `${shot.camera.height} angle`}${shot.camera.view === "from behind" ? ": backs and tails toward the camera, what they move toward lies beyond them" : shot.camera.view === "from ahead" ? ": faces and noses toward the camera" : ""}.` : ""}`;
  // A person at far depth is a small figure, usually inside or on something (a pilot in a jet, a rider on a horse): asked
  // for as that, never as a visible person the painter must show. "Exactly 2 people in frame" for two pilots inside distant
  // jets once produced two extra foreground jets with pilots in them.
  const far = (p) => p.depth === "far", nearPeople = people.filter((p) => !far(p)), farPeople = people.filter(far);
  const sz = (p) => (p.size && SIZE_WORDS[p.size] ? `, ${SIZE_WORDS[p.size]}` : "");
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
  const others = refs.slice(1).map((r, i) => { const [kind, id] = r.ref.split(":"), el = els.find((e) => e.id === id); return kind === "style" ? `image ${i + 2}: the film's style sheet; match its grain, colour treatment, contrast, sharpness and finish exactly; nothing in it is part of this scene.` : kind === "prev" ? `image ${i + 2}: the frame just before this one, a moment earlier from another camera; everything continues from it: what is intact or spent, where each thing has got to, and how big each thing is beside the others; only its camera does not apply.` : kind === "portrait" ? `image ${i + 2}: ${name(id)}'s face, hair and clothes (${strip(state.features[id] || "")}); the pose and background of that picture do not apply.` : `image ${i + 2}: ${name(id)} as the record shows it (${strip(el?.look || "")}); its shape, build and markings; the surroundings, weather and medium of that picture do not apply.`; });
  const references = `REFERENCES\n${[first, ...others].join("\n")}`;
  const carriers = {}; for (const p of props) if (hostOf(p)) { const host = top(p); if (host && host !== p.id) (carriers[host] ??= []).push(name(p.id)); }
  const storesRule = Object.keys(carriers).length ? ` ${Object.entries(carriers).map(([host, items]) => `${name(host)} carries exactly ${items.length === 1 ? "one thing" : `${items.length} things`}: ${items.join(", ")}; nothing else is attached to it or hangs from it (no other weapons, pods, tanks, racks or bags)`).join("; ")}.` : "";
  const rules = `RULES\n${nearPeople.length ? `Exactly ${nearPeople.length} ${nearPeople.length === 1 ? "person" : "people"} visible up close, nobody else` : "No person visible up close"}${farPeople.length ? `; the ${farPeople.length === 1 ? "far one is" : "far ones are"} small figures inside what carries them, each thing once, no extra vehicle or person added to show them` : ""}. ${refs.length > 1 ? "The numbered images are sources for look only: paint no numbers, labels, borders or panels; one single scene. " : ""}${storesRule}${storesRule ? " " : ""}${medium.treatment ? `${medium.treatment} ` : ""}${medium.frame} One frame filling the picture edge to edge, no black bars; no captions, titles or overlaid text, scene text only where named above.`;
  return { images: refs.map((r) => r.ref), prompt: [context, frame, peopleBlock, ...(changes ? [changes] : []), references, rules].join("\n\n") };
}

// What differs between two frames, one line per element. A person whose third and depth are unchanged and whose only changed
// field is the distance to someone who DID move stays exactly as in image 1. castOnly: for a frame painted from another
// camera, only who is in or out and what each is doing (thirds, depth, facing and distances differ with the camera, not the
// scene); an empty string when nothing of the cast changed.
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
