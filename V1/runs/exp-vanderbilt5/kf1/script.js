// SHOOTING SCRIPT: the story as scenes, shots and frames, written once by one call; everything after it is transcribed by code.
// A scene fixes the place, the time, the 180-degree line (the side every camera of the scene stands on) and the blocking
// at its start. A shot fixes its camera (on that side), its seconds (on the clip model's grid) and, for EVERY element of
// the scene, a START frame and an END frame: in or off frame, third, depth, facing, distance, pose, hands (people); where
// and condition (props). Between the frames: timed action, spoken lines, sounds, and what changed. checkScript() verifies
// the structure in code before anything is paid; scriptText() prints it for review.
import { jsonCall, S } from "./llm.js";

// Seconds a clip may run, per video model (Magic Hour image-to-video; veo with an end frame).
export const GRID = { "wan-3.0": [2, 3, 4, 5, 6, 7, 8, 9, 10, 15, 20, 25, 30], "veo3.1": [4, 6, 8], "kling-3.0": [5, 10] };
export const PERSON_FIELDS = ["visible", "third", "depth", "facing", "distance", "pose", "hands"], PROP_FIELDS = ["visible", "where", "condition"];
export const inFrame = (x) => x.visible === "in frame";
export const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const kinds = (els) => ({ chars: els.filter((e) => e.kind === "character"), props: els.filter((e) => e.kind === "prop"), places: els.filter((e) => e.kind === "place"), fixtures: els.filter((e) => e.kind === "fixture") });

export function scriptSchema(els) {
  const { chars, props, places } = kinds(els);
  const CID = S.enum(chars.map((e) => e.id)), PID = S.enum(props.length ? props.map((e) => e.id) : ["none"]), ANY = S.enum([...chars, ...props].map((e) => e.id)), PLACE = S.enum(places.map((e) => e.id));
  const VIS = S.enum(["in frame", "off left", "off right"]);
  const PERSON = S.obj({ id: CID, visible: VIS, third: S.enum(["left", "centre", "right"]), depth: S.enum(["near", "mid", "far"]), facing: S.str, distance: S.str, pose: S.str, hands: S.str });
  const PROP = S.obj({ id: PID, visible: VIS, where: S.str, condition: S.str });
  const FRAME = S.obj({ people: S.arr(PERSON), props: S.arr(PROP) });
  const CAMERA = S.obj({ same_as: S.int, stands: S.str, height: S.enum(["eye", "low", "high"]), looks_at: S.str, behind: S.arr(S.str) });
  const AT = (extra = {}) => S.obj({ at: S.int, ...extra, text: S.str });
  const SHOT = S.obj({ n: S.int, start: S.int, seconds: S.int, size: S.enum(["wide", "medium-wide", "medium", "medium-close", "close"]), cut_reason: S.enum(["scene start", "time up", "new point of interest"]),
    camera: CAMERA, first: FRAME, action: S.arr(AT()), lines: S.arr(AT({ who: CID })), sfx: S.arr(AT()), last: FRAME, changes: S.arr(S.str) });
  const SCENE = S.obj({ n: S.int, place: PLACE, inside: S.bool, time: S.enum(["DAY", "NIGHT", "DAWN", "DUSK"]), continuous: S.bool, start: S.int, seconds: S.int, ambience: S.str, music: S.str, captions: S.arr(AT()),
    line: S.obj({ between: S.str, camera_side: S.str }), blocking: S.arr(S.obj({ id: ANY, where: S.str, facing: S.str, holding: S.str })), shots: S.arr(SHOT) });
  return S.obj({ title: S.str, scenes: S.arr(SCENE) });
}

// One call. salt: a run label, so the script is made fresh for the run instead of read from the cache.
export async function writeScript({ story, elements: els, total = 30, max = 15, model = "wan-3.0", salt = "" }) {
  const { chars, props, places, fixtures } = kinds(els);
  const grid = (GRID[model] || GRID["wan-3.0"]).filter((s) => s <= max);
  const script = await jsonCall({ name: "shooting-script-v2", effort: "high", salt, schema: scriptSchema(els),
    prompt: `Turn this story into a SHOOTING SCRIPT for a ${total}-second live-action film. Code paints the first and the last frame of every shot from the frames you write and makes the clip between them, so every frame must be complete and unambiguous; nothing is left to interpretation.

Elements (use ONLY these ids; no other person or object may appear):
- characters: ${chars.map((e) => `${e.id} = ${e.name}`).join("; ")}
- props: ${props.map((e) => `${e.id} = ${e.name}`).join("; ") || "none (the props arrays stay empty)"}
- places: ${places.map((e) => `${e.id} = ${e.name}; fixtures: ${e.look}`).join(" | ")}
- fixtures, for camera and facing text: ${fixtures.map((e) => `${e.id} = ${e.name}`).join("; ") || "none"}

SCENES: one place and one continuous stretch of time each; start and seconds contiguous over the film, the last scene ending at ${total}. time: DAY, NIGHT, DAWN or DUSK; continuous: true when the scene follows the previous one without a jump in time. ambience: the background sound under the scene. music: a cue, or "". captions: on-screen overlays with the film second they appear (the title, a date, a source note; never dialogue).
- line: the 180-degree line of the scene. between: the two characters (or a character and a fixture) it runs through. camera_side: the side of that line on which EVERY camera of the scene stands, named by the fixture or wall at the camera's back. No shot of the scene crosses it.
- blocking: for every character and prop of the scene, where it is when the scene starts, in world terms (relative to fixtures and to each other, not to the frame), which way it faces, and what it holds ("" if nothing).

SHOTS: one continuous take from one camera. seconds must be one of ${grid.join(", ")}; shots are contiguous within the scene and sum to its seconds. A new shot only where the content turns, and always with a real change: a different size, or an angle of 30 degrees or more. cut_reason: scene start, time up, or new point of interest. Lines run at 2.5 words a second and an action needs at least 2 seconds; a shot holds everything it contains.
- camera: stands = where the camera is in the place, on the scene's camera_side, named by the fixtures and walls around it in a photographer's words ("at the south wall, a room's width from the men, facing the doorway"), never in metres; height = eye, low or high; looks_at = who or what it points at; behind = the fixtures seen behind the people, as fixture ids or nouns from the place's fixture list only. same_as = the number of an earlier shot of this scene whose setup this shot repeats exactly, else 0.
- first and last frames (first = the shot's first frame, last = its last): EVERY character and prop in the scene's blocking appears in BOTH frames of EVERY shot, as "in frame", "off left" or "off right" (off-frame people keep their state so the next shot can pick it up). These frames are read by an image painter, so they use its words: screen terms and body terms. People: third = left, centre or right of the frame (off frame: the side they are beyond); depth = near, mid or far; facing = toward whom or which fixture, with the screen direction ("toward lincoln, screen right"), never a compass point; distance = to the nearest person or fixture, in body terms ("an arm's length from lincoln", "a pace behind vanderbilt", "at the doorway, a room's width from lincoln"), never metres; pose = body, head and expression at this instant only; hands = clasped with X, at sides, holding Y. Props: where = held by whom in which hand, or on which fixture, or its third and depth; condition = its state (raw, wrapped, open). Never clothing, age or faces in a frame: those come from the portraits.
- Continuity: the first frame of a shot copies the previous shot's last frame word for word for every element (facing, distance, pose, hands; where, condition); only third and depth may differ, and only because the camera changed. Within a shot a person changes third only through an action, and the last frame says where everyone stopped. When nothing happens in a shot, its last frame copies its first frame word for word and changes is empty.
- action: what happens, each item with the film second it starts (ids for people). lines: the dialogue as SPOKEN lines in the speaker's own words, faithful to the record; where the story reports speech ("Lincoln asks whether…") write the words, and quote directly where the story quotes; each line with its film second and speaker id. sfx: sounds with their film second. changes: what differs at the end from the start, one phrase each.
- Only the events the story contains: no invented business, no handshakes or gestures the story does not mention. "Nothing else may appear" applies to people and props; each place keeps its declared fixtures and furniture.

Story:
${story}` });
  // A repeated setup copies the earlier shot's camera, so identical frames become one still.
  for (const sc of script.scenes) for (const h of sc.shots) if (h.camera.same_as) { const o = sc.shots.find((x) => x.n === h.camera.same_as); if (o) h.camera = { ...o.camera, same_as: h.camera.same_as }; }
  return script;
}

// Code checks. errors: the structure is wrong (timing, grid, presence, thirds). notes: things to look at (continuity wording,
// timing pressure, undeclared fixtures). Nothing is paid while errors exist.
export function checkScript(script, { total, max = 15, model = "wan-3.0", elements: els }) {
  const grid = (GRID[model] || GRID["wan-3.0"]).filter((s) => s <= max), errors = [], notes = [];
  const vocab = els.flatMap((e) => [e.id, e.name, e.aka || "", ...(e.kind === "place" || e.kind === "fixture" ? e.look.split(/[,.;]/) : [])]).map(norm).filter(Boolean);
  const declared = (m) => { const w = norm(m).replace(/^(the|a|an) /, ""); return !w || vocab.some((v) => v.includes(w) || w.includes(v)); };
  let t = 0;
  for (const sc of script.scenes) {
    if (sc.start !== t) errors.push(`scene ${sc.n} starts at ${sc.start} s, expected ${t}`);
    const ids = sc.blocking.map((b) => b.id);
    let u = sc.start, prev = null;
    for (const h of sc.shots) {
      if (h.start !== u) errors.push(`shot ${h.n} starts at ${h.start} s, expected ${u}`);
      if (!grid.includes(h.seconds)) errors.push(`shot ${h.n}: ${h.seconds} s is not on the grid (${grid.join(", ")})`);
      u += h.seconds;
      if (h.camera.same_as && !sc.shots.some((x) => x.n === h.camera.same_as && x.n < h.n)) errors.push(`shot ${h.n}: same_as ${h.camera.same_as} is not an earlier shot of scene ${sc.n}`);
      for (const which of ["first", "last"]) {
        const present = [...h[which].people, ...h[which].props].map((x) => x.id);
        for (const id of ids) if (!present.includes(id)) errors.push(`shot ${h.n} ${which} frame: ${id} is missing (every element of the scene is in every frame, in or off)`);
        for (const id of present) if (!ids.includes(id)) errors.push(`shot ${h.n} ${which} frame: ${id} is not in scene ${sc.n}'s blocking`);
        const dup = present.filter((id, i) => present.indexOf(id) !== i); if (dup.length) errors.push(`shot ${h.n} ${which} frame: ${dup.join(", ")} listed twice`);
        if (![...h[which].people, ...h[which].props].some(inFrame)) errors.push(`shot ${h.n} ${which} frame: nobody and nothing in frame`);
      }
      for (const a of h.first.people) {
        const b = h.last.people.find((x) => x.id === a.id); if (!b) continue;
        if ((b.third !== a.third || b.visible !== a.visible) && !h.action.length) errors.push(`shot ${h.n}: ${a.id} changes third or leaves the frame with no action`);
        if (!h.action.length && !h.changes.length) { const d = PERSON_FIELDS.filter((k) => norm(a[k]) !== norm(b[k])); if (d.length) notes.push(`shot ${h.n}: no action and no change, but ${a.id}'s last frame differs in ${d.join(", ")}`); }
      }
      if (prev) {
        for (const a of h.first.people) { const b = prev.last.people.find((x) => x.id === a.id); if (!b) continue; const d = ["facing", "distance", "pose", "hands"].filter((k) => norm(a[k]) !== norm(b[k])); if (d.length) notes.push(`continuity: shot ${h.n} first vs shot ${prev.n} last, ${a.id}: ${d.map((k) => `${k} "${b[k]}" → "${a[k]}"`).join("; ")}`); }
        for (const a of h.first.props) { const b = prev.last.props.find((x) => x.id === a.id); if (!b) continue; const d = ["where", "condition"].filter((k) => norm(a[k]) !== norm(b[k])); if (d.length) notes.push(`continuity: shot ${h.n} first vs shot ${prev.n} last, ${a.id}: ${d.map((k) => `${k} "${b[k]}" → "${a[k]}"`).join("; ")}`); }
      }
      const need = h.lines.reduce((n, l) => n + l.text.split(/\s+/).length / 2.5, 0) + 2 * h.action.length;
      if (need > h.seconds + 0.5) notes.push(`shot ${h.n}: ${h.seconds} s holds about ${Math.round(need)} s of lines and actions`);
      for (const b of [...h.lines, ...h.action, ...h.sfx]) if (b.at < h.start || b.at >= h.start + h.seconds) errors.push(`shot ${h.n}: a beat at ${b.at} s is outside the shot (${h.start}–${h.start + h.seconds} s)`);
      for (const m of h.camera.behind) if (!declared(m)) notes.push(`shot ${h.n}: "${m}" behind the people is not a declared fixture`);
      prev = h;
    }
    if (u !== sc.start + sc.seconds) errors.push(`scene ${sc.n}: shots sum to ${u - sc.start} s, scene says ${sc.seconds}`);
    for (const c of sc.captions) if (c.at < sc.start || c.at >= sc.start + sc.seconds) errors.push(`scene ${sc.n}: caption at ${c.at} s is outside the scene`);
    t = sc.start + sc.seconds;
  }
  if (t !== total) errors.push(`film ends at ${t} s, expected ${total}`);
  return { errors, notes };
}

// The script as text, for review.
export function scriptText(script, els, { total } = {}) {
  const name = (id) => els.find((e) => e.id === id)?.name || id;
  const pf = (p) => `      ${p.id.padEnd(11)} [${p.visible}]  ${p.third} third, ${p.depth}; facing ${p.facing}; ${p.distance}; ${p.pose}; hands ${p.hands}`;
  const xf = (p) => `      ${p.id.padEnd(11)} [${p.visible}]  ${p.where}; ${p.condition}`;
  const fr = (f) => [...f.people.map(pf), ...f.props.map(xf)].join("\n");
  const out = [`${script.title.toUpperCase()}  (${total ?? script.scenes.reduce((n, s) => n + s.seconds, 0)} s; ${script.scenes.length} scenes, ${script.scenes.reduce((n, s) => n + s.shots.length, 0)} shots)`];
  for (const s of script.scenes) {
    out.push(`\n${s.n}. ${s.inside ? "INT." : "EXT."} ${name(s.place).toUpperCase()} — ${s.time}${s.continuous ? " (CONTINUOUS)" : ""}   ${s.start}–${s.start + s.seconds} s`);
    out.push(`   ambience: ${s.ambience}${s.music ? `   music: ${s.music}` : ""}`);
    if (s.captions.length) out.push(`   captions: ${s.captions.map((c) => `[${c.at}s] "${c.text.replace(/\n/g, " / ")}"`).join("  ")}`);
    out.push(`   line: ${s.line.between}; camera side: ${s.line.camera_side}`);
    out.push(`   blocking: ${s.blocking.map((b) => `${b.id}: ${b.where}; facing ${b.facing}; holding ${b.holding || "nothing"}`).join(" | ")}`);
    for (const h of s.shots) {
      out.push(`\n   SHOT ${h.n}  ${h.start}–${h.start + h.seconds} s  ${h.size}  (${h.cut_reason})`);
      out.push(`   camera: ${h.camera.same_as ? `same setup as shot ${h.camera.same_as}: ` : ""}stands ${h.camera.stands}; ${h.camera.height} height; looks at ${h.camera.looks_at}; behind: ${h.camera.behind.join(", ") || "nothing named"}`);
      out.push(`   FIRST FRAME`, fr(h.first));
      if (h.action.length) out.push(`   ACTION`, ...h.action.map((a) => `      [${a.at}s] ${a.text}`));
      if (h.lines.length) out.push(`   LINES`, ...h.lines.map((l) => `      [${l.at}s] ${name(l.who).toUpperCase()}: "${l.text}"`));
      if (h.sfx.length) out.push(`   SFX  ${h.sfx.map((x) => `[${x.at}s] ${x.text}`).join("  ")}`);
      out.push(`   LAST FRAME`, fr(h.last));
      if (h.changes.length) out.push(`   changed: ${h.changes.join("; ")}`);
    }
  }
  return out.join("\n");
}
