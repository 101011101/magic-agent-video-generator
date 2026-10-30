// The STATE MANAGER: tables of what exists and where it is, filled by code (and one vision call per plate), queried by the
// templates. Nothing creative lives here.
//   elements  id → kind, name, reference file, feature line                      (the bank + the cast stage)
//   places    id → plate, what the plate contains (walls, floor, light, fixtures with side and depth), described once
//   stills    id → scene, shot, which people are in frame and where, who is off frame and to which side, what stands
//             behind each person, which still it was painted from and why (plate / same camera / the scene's master)
// Queries: refs(still) the images to send and why; behind(place, third) the fixtures behind a person; offFrame(frame);
// relation(still) how this frame relates to the master it is painted from and to the shot the viewer just saw;
// roomCheck(file, place) the room gate; record() keeps the table current as stills are painted.
import { jsonCall, S } from "./llm.js";
import { inFrame } from "./script.js";

const SIZE = { wide: 0, "medium-wide": 1, medium: 2, "medium-close": 3, close: 4 };
const clean = (s) => String(s ?? "").trim().replace(/[.;,\s]+$/, "");
export const isWide = (size) => SIZE[size] <= 1;

export class State {
  constructor({ els, bank, features, log, run }) { this.els = els; this.bank = bank; this.features = features || {}; this.log = log; this.run = run; log.places ??= {}; }
  name(id) { return this.els.find((e) => e.id === id)?.name || id; }
  place(id) { return this.log.places[id] || {}; }

  // One vision call per plate, once per run: the place as a set decorator lists it.
  async describePlaces() {
    for (const p of this.els.filter((e) => e.kind === "place")) {
      if (this.log.places[p.id]?.fixtures || !this.bank[p.id]?.file) continue;
      const r = await jsonCall({ name: "plate-fixtures", effort: "low", images: [this.run.path(this.bank[p.id].file)],
        schema: S.obj({ walls: S.str, floor: S.str, light: S.str, fixtures: S.arr(S.obj({ name: S.str, side: S.enum(["left", "centre", "right"]), depth: S.enum(["foreground", "middle", "background"]), detail: S.str })) }),
        prompt: `This is the empty place "${p.name}" as it will appear in every frame of a film. List what is in it as a set decorator would, so that later frames can be told what stands behind each person: walls (plain or papered, material, colour), floor, light (sources and quality), and every fixture and piece of furniture with its side of the picture (left, centre, right), its depth (foreground, middle, background) and a short detail ("a fireplace with a mantel clock", "a dark panelled door", "a round centre table"). Only what is visible.` });
      this.log.places[p.id] = { ...(this.log.places[p.id] || {}), ...r }; this.run.save();
    }
  }
  // The fixtures behind a person: the place's middle and background fixtures on the side of the ROOM the person stands on.
  // That side is the person's third in the master wide when the still is painted from one (a single centres its subject
  // while he stands at the right of the room), else the person's third in this frame.
  behind(placeId, third) { return (this.place(placeId).fixtures || []).filter((f) => f.depth !== "foreground" && f.side === third).map((f) => clean(f.detail || f.name)); }
  behindFor(still, env, p) { const inMaster = still.envKind === "master" && env ? env.frame.people.find((x) => x.id === p.id && inFrame(x))?.third : null; return this.behind(still.place, inMaster || p.third); }
  room(placeId) { const p = this.place(placeId); return p.walls ? `Walls: ${clean(p.walls)}. Floor: ${clean(p.floor)}. Light: ${clean(p.light)}.` : ""; }
  // Who is outside the frame, and on which side.
  offFrame(frame) {
    const g = { left: [], right: [] }; for (const p of frame.people) if (!inFrame(p)) g[p.visible === "off left" ? "left" : "right"].push(this.name(p.id));
    return Object.entries(g).filter(([, v]) => v.length).map(([side, v]) => `${v.join(" and ")} ${v.length > 1 ? "are" : "is"} just outside the frame to the ${side}`).join("; ");
  }
  // How this frame relates to the frame it is painted from (its env) and to the shot the viewer just saw (prev), from the records.
  relation(still, env, prev) {
    const names = (f) => f.people.filter(inFrame).map((p) => this.name(p.id)), third = (f, id) => f.people.find((p) => p.id === id && inFrame(p))?.third;
    const parts = [];
    if (still.envKind === "master" && env) {
      const where = still.frame.people.filter(inFrame).map((p) => { const t = third(env.frame, p.id); return t ? `${this.name(p.id)} is the man at the ${t} of image 1` : `${this.name(p.id)} is not visible in image 1`; });
      parts.push(`Image 1 is the wide view of this same instant. ${where.join("; ")}. This frame is the same scene and the same instant with the camera ${SIZE[still.size] > SIZE[env.size] ? "closer" : SIZE[still.size] < SIZE[env.size] ? "further back" : "moved"}, framing ${names(still.frame).join(" and ") || "nobody"}: a ${still.size} shot. The room, its walls, light and colours are those of image 1.`);
    }
    if (prev && prev.id !== env?.id) {
      const pn = names(prev.frame), cut = SIZE[still.size] > SIZE[prev.size] ? "cuts closer" : SIZE[still.size] < SIZE[prev.size] ? "cuts wider" : "cuts";
      parts.push(`The shot the viewer has just seen was a ${prev.size} on ${pn.join(" and ") || "the room"} (${prev.frame.people.filter(inFrame).map((p) => `${this.name(p.id)} ${p.third}`).join(", ")}); this shot ${cut} to ${names(still.frame).join(" and ") || "the room"}, on the same side of the room, so left and right stay as they were.`);
    }
    return parts.join(" ");
  }
  // The room gate: the new still against the plate.
  async roomCheck(file, placeId) {
    if (!this.bank[placeId]?.file) return { ok: true, note: "no plate" };
    const r = await jsonCall({ name: "room-check", effort: "low", images: [this.run.path(file), this.run.path(this.bank[placeId].file)],
      schema: S.obj({ same_room: S.bool, seen: S.arr(S.str), added: S.arr(S.str), note: S.str }),
      prompt: `Image 1 is a new film frame; image 2 is the empty room it must be in, which may be seen closer or from a different angle in image 1. Judge the ARRANGEMENT, not the craftsmanship: same_room is true when the same kinds of fixtures stand in the same places (a fireplace on the same side, the same windows and drapes, the same door) and the walls have the same kind of finish (plain stays plain, papered stays papered), even if a closer view renders their details differently (a different carving on the mantel, another clock design). seen: the fixtures of image 2 that are visible in image 1. added: only things in image 1 that have NO counterpart in image 2: new furniture, wallpaper where the walls were plain, objects the room did not have; a restyled version of an existing fixture is not added. Ignore the people. note: short.` });
    return { ok: r.same_room && !r.added.length, ...r };
  }
  // Keep the still table current.
  record(still, entry, env = null) { (this.log.stills ??= {})[still.id] = { scene: still.scene, shot: still.shot, size: still.size, place: still.place, in: still.frame.people.filter(inFrame).map((p) => ({ id: p.id, third: p.third, behind: this.behindFor(still, env, p) })), off: still.frame.people.filter((p) => !inFrame(p)).map((p) => ({ id: p.id, side: p.visible })), from: still.env ? `${still.envKind}:${still.env}` : "plate", ...entry }; this.run.save(); }
}
