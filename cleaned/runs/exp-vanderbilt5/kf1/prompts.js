// Templates, no model: the still prompt and the clip prompt are transcriptions of the shooting script.
// planStills() lists the distinct frames of a script: a shot with no action and no change has one still for both ends; a
// shot whose frame and camera repeat an earlier still reuses it. Each still names its environment reference: the place's
// plate for the first still in a place, else the latest still there. The still prompt itself is a KF variant (src/kf/<id>.js)
// built from the helpers here, so variants can be compared on one script. The clip prompt is the shot's timed beats between
// its two stills. Inside the fields, element ids are replaced by names.
import { PERSON_FIELDS, PROP_FIELDS, inFrame, norm } from "./script.js";
export { inFrame };

// Field text as it goes into a sentence: no trailing full stop; t() also lowercases the first letter (ids and names are
// lowercase in frames; names are put back by the namer afterwards).
export const strip = (s) => String(s ?? "").trim().replace(/[.;,\s]+$/, ""), t = (s) => strip(s).replace(/^[A-Z]/, (c) => c.toLowerCase());
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const camKey = (h) => JSON.stringify({ size: h.size, stands: norm(h.camera.stands), height: h.camera.height, looks_at: norm(h.camera.looks_at), behind: h.camera.behind.map(norm).sort() });
const frameKey = (f) => JSON.stringify({ people: f.people.filter(inFrame).map((p) => [p.id, ...PERSON_FIELDS.map((k) => norm(p[k]))]).sort(), props: f.props.filter(inFrame).map((p) => [p.id, ...PROP_FIELDS.map((k) => norm(p[k]))]).sort() });

export function planStills(script) {
  const stills = [], byShot = {};
  for (const sc of script.scenes) {
    for (const h of sc.shots) {
      const add = (f, which) => {
        const key = `${sc.place}|${camKey(h)}|${frameKey(f)}`;
        let s = stills.find((x) => x.key === key);
        if (!s) { s = { id: `s${sc.n}-${stills.filter((x) => x.scene === sc.n).length + 1}`, key, scene: sc.n, place: sc.place, size: h.size, camera: h.camera, cameraKey: camKey(h), frame: f, uses: [] }; stills.push(s); }
        s.uses.push(`shot ${h.n} ${which}`);
        return s.id;
      };
      const start = add(h.first, "start");
      const end = !h.action.length && !h.changes.length ? add(h.first, "end") : add(h.last, "end");
      byShot[h.n] = { start, end };
    }
  }
  const lastIn = {};
  for (const s of stills) { s.env = lastIn[s.place] || null; lastIn[s.place] = s.id; }
  return { stills, byShot };
}

// The namer for one still: ids → names everywhere, "Name (image k)" for a person in frame.
export function namer(els, people) {
  const name = (id) => els.find((e) => e.id === id)?.name || id;
  const idx = (id) => people.findIndex((p) => p.id === id) + 2;
  const named = (text) => els.filter((e) => e.kind === "character" || e.kind === "prop").reduce((s, e) => s.replace(new RegExp(`\\b${e.id}\\b`, "gi"), e.name), String(text ?? ""));
  const who = (id) => (people.some((p) => p.id === id) ? `${name(id)} (image ${idx(id)})` : name(id));
  return { name, idx, named, who };
}
export const personLine = (p, n) => `- ${n.who(p.id)}: ${p.third} third, ${p.depth} depth; facing ${n.named(t(p.facing))}; ${n.named(t(p.distance))}; ${n.named(t(p.pose))}; hands ${n.named(t(p.hands))}.`;
export const propLine = (p, n) => `- ${n.name(p.id)}: ${n.named(t(p.where))}; ${n.named(t(p.condition))}.`;

// What differs between two frames, one line per element, for "change ONLY this". A person whose third and depth are unchanged
// and whose only changed field is the distance to someone who DID move stays exactly as in image 1: the distance changed
// because the other person came or went, and the editor must not move this one.
export function deltas(prev, cur, n) {
  const out = [], moved = (p, q) => p.third !== q.third || p.depth !== q.depth;
  for (const p of cur.people) {
    const q = prev.people.find((x) => x.id === p.id), now = inFrame(p), before = q && inFrame(q);
    if (now && !before) out.push(`- ${n.who(p.id)} enters the frame: ${p.third} third, ${p.depth} depth; facing ${n.named(t(p.facing))}; ${n.named(t(p.distance))}; ${n.named(t(p.pose))}; hands ${n.named(t(p.hands))}.`);
    else if (!now && before) out.push(`- ${n.name(p.id)} leaves the frame.`);
    else if (now) {
      const d = ["third", "depth", "facing", "distance", "pose", "hands"].filter((k) => norm(p[k]) !== norm(q[k]));
      if (!d.length) continue;
      const other = cur.people.find((o) => o.id !== p.id && new RegExp(`\\b${o.id}\\b`, "i").test(p.distance)), otherQ = other && prev.people.find((x) => x.id === other.id);
      if (!moved(p, q) && d.every((k) => k === "distance") && other && otherQ && moved(other, otherQ)) { out.push(`- ${n.who(p.id)}: stays exactly as in image 1; ${n.named(t(p.distance))} now that ${n.name(other.id)} has moved.`); continue; }
      const what = d.map((k) => (k === "third" ? `in the ${p.third} third of the frame` : k === "depth" ? `at ${p.depth} depth` : k === "facing" ? `facing ${n.named(t(p.facing))}` : k === "hands" ? `hands ${n.named(t(p.hands))}` : n.named(t(p[k])))).join("; ");
      out.push(`- ${n.who(p.id)}: ${moved(p, q) ? "" : `stays in the ${p.third} third, ${p.depth} depth; `}now ${what}.`);
    }
  }
  for (const p of cur.props) {
    const q = prev.props.find((x) => x.id === p.id), now = inFrame(p), before = q && inFrame(q);
    if (now && !before) out.push(`- ${n.name(p.id)} appears: ${n.named(t(p.where))}; ${n.named(t(p.condition))}.`);
    else if (!now && before) out.push(`- ${n.name(p.id)} leaves the frame.`);
    else if (now) { const d = ["where", "condition"].filter((k) => norm(p[k]) !== norm(q[k])); if (d.length) out.push(`- ${n.name(p.id)}: now ${d.map((k) => n.named(t(p[k]))).join("; ")}.`); }
  }
  return out.length ? out.join("\n") : "- nothing: the same frame.";
}

// One clip: the shot's beats in order, seconds relative to the clip, between its two stills.
export function clipPrompt({ shot, scene, els, voices }) {
  const n = namer(els, []), rel = (at) => Math.max(0, at - shot.start);
  const beats = [...shot.action.map((a) => ({ at: a.at, text: `${cap(n.named(t(a.text)))}.` })), ...shot.lines.map((l) => ({ at: l.at, text: `${n.name(l.who)} (${t(voices?.[l.who]) || "a natural period voice"}) says: "${l.text}"` })), ...shot.sfx.map((x) => ({ at: x.at, text: `Sound: ${n.named(t(x.text))}.` }))].sort((a, b) => a.at - b.at);
  const people = new Set([...shot.first.people, ...shot.last.people].filter(inFrame).map((p) => p.id));
  return [`FRAMES\nImage 1 is the first frame and image 2 the last frame of one continuous ${shot.seconds}-second shot; the camera does not move.`,
    `BEATS (seconds from the start of the clip)\n${beats.map((b) => `- ${rel(b.at)} s: ${b.text}`).join("\n") || "- none: a held moment."}${shot.lines.length ? "\nLips move with the words." : ""}`,
    `PEOPLE\n${people.size} ${people.size === 1 ? "person" : "people"} and nobody else; they move naturally and end exactly as in image 2; nothing appears that is not in the frames.`,
    `SOUND\n${cap(t(scene.ambience))}${shot.lines.length ? "; the voices clearly" : ""}; ${scene.music ? `music: ${t(scene.music)}` : "no music"}; no narration.`].join("\n\n");
}
