// The stage model (T-029): every scene has one coordinate frame in metres, x along the scene's axis toward its goal, y to
// the right when facing +x, z up. The camera has a position and a point it looks toward; every prop has a position and a
// heading (degrees from +x, counter-clockwise seen from above; pitch up positive). From that this module derives what the
// writer used to guess (screen third, depth, size word, heading relative to the camera, in or off frame), writes the WORLD
// block the painter reads (where things are on the stage, relative to the goal, and what moved since the frame before),
// and checks the geometry for the impossible. Local descriptors can be satisfied in contradictory ways; a world with
// numbers has one reading: the release frame of the fifth film had the jets flying away from a ship the bombs fell toward.

export const HFOV = 40;   // degrees, the horizontal field of a normal lens; the vertical field follows from 16:9
const VFOV = 2 * Math.atan(Math.tan((HFOV / 2) * Math.PI / 180) * 9 / 16) * 180 / Math.PI;
const rad = (d) => d * Math.PI / 180;
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a) => Math.hypot(a.x, a.y, a.z);
const norm = (a) => { const l = len(a) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };
const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
export const isPoint = (p) => p && ["x", "y", "z"].every((k) => Number.isFinite(p[k]));

// The camera's basis: forward, right, up.
export function basis(camera) {
  if (!isPoint(camera?.at) || !isPoint(camera?.toward)) return null;
  const f = norm(sub(camera.toward, camera.at)); if (!len(sub(camera.toward, camera.at))) return null;
  // The documented convention rules the math: y is to the RIGHT when facing +x, z up. So right = up × forward, up = forward × right.
  let r = cross({ x: 0, y: 0, z: 1 }, f); if (len(r) < 1e-6) r = { x: 0, y: 1, z: 0 }; r = norm(r);
  const u = cross(f, r);
  return { f, r, u, at: camera.at };
}

// Where a point lands for this camera: depth along the view, the horizontal and vertical angles off the axis.
export function project(B, p) {
  const v = sub(p, B.at), d = dot(v, B.f), lateral = dot(v, B.r), vertical = dot(v, B.u);
  return { d, lateral, vertical, dist: len(v), hAngle: Math.atan2(lateral, Math.max(d, 1e-6)) * 180 / Math.PI, vAngle: Math.atan2(vertical, Math.max(d, 1e-6)) * 180 / Math.PI };
}

// Derived screen facts for a prop at `at` with `heading` (deg) and `pitch` (deg). Its apparent size follows from its real
// dimensions AND its orientation to the camera: a 135 m frigate seen stern-on along the attack line shows its 45 m mast
// and 16 m beam, not its length. The first version used the longest dimension for the share of the frame's height and
// told the geometry gate the frigate should fill a third of the frame when a tenth was right; four correct frames were
// flagged for it. dims = { length_m, width_m, height_m }; size_m (the longest dimension) is the fallback for all three.
export function derive(camera, at, { size_m = 1, dims = null, heading = 0, pitch = 0 } = {}) {
  const B = basis(camera); if (!B || !isPoint(at)) return null;
  const P = project(B, at);
  const inFrame = P.d > 0 && Math.abs(P.hAngle) <= HFOV / 2 && Math.abs(P.vAngle) <= VFOV / 2;
  const visible = inFrame ? "in frame" : (P.d <= 0 ? (P.lateral < 0 ? "off left" : "off right") : (P.hAngle < 0 ? "off left" : "off right"));
  const third = P.hAngle < -HFOV / 6 ? "left" : P.hAngle > HFOV / 6 ? "right" : "centre";
  const Lm = Number(dims?.length_m) || size_m, Wm = Number(dims?.width_m) || size_m, Hm = Number(dims?.height_m) || size_m;
  const hv = { x: Math.cos(rad(heading)) * Math.cos(rad(pitch)), y: Math.sin(rad(heading)) * Math.cos(rad(pitch)), z: Math.sin(rad(pitch)) };
  const view = norm(sub(at, B.at)), cosT = Math.min(1, Math.abs(dot(hv, view))), sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT));   // angle between the thing's axis and the line of sight: 0 = seen end-on
  const extentH = Lm * sinT + Wm * cosT, extentV = Math.abs(Math.sin(rad(pitch))) * Lm + Math.abs(Math.cos(rad(pitch))) * Hm;   // across the frame; up the frame
  // Shares: of the frame's HEIGHT (what the geometry gate reads back) and of its WIDTH; the size word takes the larger, the
  // width share scaled to height terms (16:9).
  const share = P.dist > 0 ? (extentV / P.dist) / (2 * Math.tan(rad(VFOV / 2))) : 9, shareW = P.dist > 0 ? (extentH / P.dist) / (2 * Math.tan(rad(HFOV / 2))) : 9;
  const prominence = Math.max(share, shareW * 16 / 9);
  const size = prominence >= 0.8 ? "fills" : prominence >= 0.4 ? "large" : prominence >= 0.18 ? "medium" : prominence >= 0.07 ? "small" : "tiny";
  const depth = P.dist <= 50 ? "near" : P.dist <= 500 ? "mid" : "far";   // absolute: a room is all near, a ship two kilometres off is far
  // Heading relative to the camera: the nose vector against forward and right.
  const h = { x: Math.cos(rad(heading)) * Math.cos(rad(pitch)), y: Math.sin(rad(heading)) * Math.cos(rad(pitch)), z: Math.sin(rad(pitch)) };
  const fwd = dot(h, B.f), side = dot(h, B.r);
  const points = pitch <= -45 ? "down" : pitch >= 45 ? "up" : fwd >= 0.6 ? "away from the camera" : fwd <= -0.6 ? "toward the camera" : side > 0 ? "across to screen right" : "across to screen left";
  const yaw = Math.round((Math.atan2(side, fwd) * 180 / Math.PI + 360) % 360);   // the nose as the camera sees it: 0 straight away, 90 to screen right, 180 toward the camera, 270 to screen left
  return { visible, third, size, share: Math.round(share * 1000) / 1000, shareW: Math.round(shareW * 1000) / 1000, depth, points, yaw, distance: Math.round(P.dist), d: Math.round(P.d), lateral: Math.round(P.lateral), hAngle: Math.round(P.hAngle), vAngle: Math.round(P.vAngle) };
}

// The camera of a frame: the shot's camera, or, when it flies with an element (a chase camera, camera.moves_with), the
// shot's camera carried by that element's displacement between the first and the last frame. A fixed camera 185 m behind
// jets at 260 m/s sees them shrink to specks in three seconds; the painter never paints that, and should not have to.
export function cameraFor(shot, which) {
  const cam = shot.camera, id = cam?.moves_with; if (!cam || !id || id === "none" || which !== "last") return cam;
  const a = shot.first?.props.find((p) => p.id === id), b = shot.last?.props.find((p) => p.id === id); if (!isPoint(a?.at) || !isPoint(b?.at)) return cam;
  const d = sub(b.at, a.at); return { ...cam, at: { x: cam.at.x + d.x, y: cam.at.y + d.y, z: cam.at.z + d.z }, toward: { x: cam.toward.x + d.x, y: cam.toward.y + d.y, z: cam.toward.z + d.z } };
}

// A shot has a stage when its camera is placed and its frames' props carry positions.
export const staged = (shot) => isPoint(shot?.camera?.at) && isPoint(shot?.camera?.toward) && ["first", "last"].some((w) => (shot[w]?.props || []).some((p) => isPoint(p.at)));

// Apply the stage to a script: every positioned prop's screen facts replace the writer's (third/depth live on people, size,
// points and visible on props; a person inside a vehicle takes the vehicle's third/depth/visible). Returns the notes of
// what was changed, so the run log shows the override.
export function applyStage(script, elements) {
  const sizeOf = (id) => Number(elements.find((e) => e.id === id)?.size_m) || 1, dimsOf = (id) => elements.find((e) => e.id === id)?.dims || null, notes = [];
  for (const sc of script.scenes) for (const h of sc.shots) {
    if (!staged(h) || h.camera.view === "from inside") continue;   // inside a vehicle the vehicle is the room: the writer's words stand, the WORLD block still speaks
    for (const w of ["first", "last"]) {
      const fr = h[w], derivedBy = {};
      for (const p of fr.props) {
        if (!isPoint(p.at)) continue;
        const d = derive(cameraFor(h, w), p.at, { size_m: sizeOf(p.id), dims: dimsOf(p.id), heading: Number(p.heading) || 0, pitch: Number(p.pitch) || 0 }); if (!d) continue;
        derivedBy[p.id] = d;
        for (const k of ["visible", "size", "points"]) if (p[k] !== d[k]) { notes.push(`shot ${h.n} ${w}: ${p.id}.${k} ${p[k]} → ${d[k]} (from the stage)`); p[k] = d[k]; }
        p.third = d.third; p.depth = d.depth; p.stage = { distance: d.distance, share: d.share, shareW: d.shareW, hAngle: d.hAngle, yaw: d.yaw, pitch: Number(p.pitch) || 0 };
      }
      for (const q of fr.people) {
        const host = q.on && q.on !== "none" ? derivedBy[q.on] : null; if (!host) continue;
        for (const k of ["visible", "third", "depth"]) if (q[k] !== host[k]) { notes.push(`shot ${h.n} ${w}: ${q.id}.${k} ${q[k]} → ${host[k]} (inside ${q.on})`); q[k] = host[k]; }
        if (host.size === "tiny" || host.size === "small") q.size = "tiny";
      }
    }
  }
  return notes;
}

// Turns: a mover is a positioned prop, carried by nothing, that moves more than 5 m within a shot; its turn is the change
// of heading between the frames (degrees, the short way round). TURN_DEG is the least change a still can show: asked to
// drop "bank inward" from a shot whose headings did not change, the writer changed them by exactly 10° instead and kept
// the words; a turn the camera can see is a quarter of a right angle at least, and its track must bend with it (below).
export const TURN_DEG = 20;
// A thing goes where its nose points: over a shot in which a mover covers 50 m or more, the heading in each frame lies
// within half the shot's turn plus 5° of the track (the chord from the first position to the last). The slack a token
// heading change can hide in is then no larger than the track itself.
export const TRACK_SLACK = 5;
const angleDiff = (a, b) => Math.abs(((a - b) % 360 + 540) % 360 - 180);
const trackOf = (a, b) => (Math.atan2(b.at.y - a.at.y, b.at.x - a.at.x) * 180 / Math.PI + 360) % 360;
const turnOf = (a, b) => !a || !b ? 0 : Math.abs((((Number(b.heading) || 0) - (Number(a.heading) || 0)) % 360 + 540) % 360 - 180);
// The stage goal is never a mover: it is what things move toward, and in coordinates that ride with an aircraft (a
// cockpit scene) it is the one thing that seems to move. The track check once read a frigate 520 m "closer" in cockpit
// coordinates as a ship steaming backward, and the writer turned it around to satisfy the check.
const movers = (h, goal = null) => (h.first?.props || []).filter((a) => { const b = h.last?.props.find((x) => x.id === a.id); return b && a.id !== goal && isPoint(a.at) && isPoint(b.at) && !(a.on && a.on !== "none") && len(sub(b.at, a.at)) > 5; });
const maxTurn = (shots, goal = null) => Math.max(0, ...shots.flatMap((h) => movers(h, goal).map((a) => turnOf(a, h.last.props.find((x) => x.id === a.id)))));
const movement = (a, b) => { const d = sub(b.at, a.at), out = []; if (Math.abs(d.x) > 5) out.push(`${d.x > 0 ? "advances" : "falls back"} ${Math.round(Math.abs(d.x))} m`); if (Math.abs(d.y) > 5) out.push(Math.sign(a.at.y) === Math.sign(b.at.y) && Math.abs(b.at.y) < Math.abs(a.at.y) ? `closes ${Math.round(Math.abs(d.y))} m toward the line` : `moves ${Math.round(Math.abs(d.y))} m to the ${d.y > 0 ? "right" : "left"}`); if (Math.abs(d.z) > 2) out.push(`${d.z > 0 ? "climbs" : "drops"} ${Math.round(Math.abs(d.z))} m`); return `${a.id} ${out.join(", ") || "holds its position"}, heading unchanged`; };
// Words that name a turn (a change of heading) or a bank, a roll, a flare (an attitude). Verbs that are also nouns or
// have still meanings (bank, turn, wheel, swing, curve, arc, break, peel, sweep) count only with a direction after them.
const DIR = "(?:inward|outward|toward|towards|into|away|left|right|hard|over|steeply|back|about|around|in|out|across)", MOVE = "(?:bank|banks|banked|banking|turn|turns|turned|turning|roll|rolls|rolled|rolling|swing|swings|swung|swinging|curve|curves|curving|veer|veers|veered|veering|close|closes|closed|closing|cut|cuts|cutting|drift|drifts|drifting|move|moves|moved|moving|head|heads|heading)";
export const TURN = new RegExp(`\\b(bank(?:ed|ing)|banks?\\s+${DIR}|turn(?:s|ed|ing)?\\s+${DIR}|converg\\w*|diverg\\w*|diagonal\\w*|veer\\w*|swerv\\w*|wheel(?:s|ed|ing)?\\s+${DIR}|swing(?:s|ing)?\\s+${DIR}|swung|curv(?:es|ing)\\s+${DIR}|arc(?:s|ed|ing)?\\s+${DIR}|sweep(?:s|ing)?\\s+${DIR}|peel(?:s|ed|ing)?\\s+(?:off|away)|break(?:s|ing)?\\s+(?:left|right|away|off)|${MOVE}\\s+(?:inward|outward)s?|(?:inward|outward)s?\\s+(?:bank|banks|turn|turns|roll|rolls|swing|swings|curve|curves|veer|veers)|(?:toward|towards|at|facing)\\s+(?:each other|one another))\\b`, "i");   // "outward-canted tails" is a shape, "the two inward banks" a turn
export const ATTITUDE = /\b(bank(?:s|ed|ing)?|roll(?:s|ed|ing)?|flar(?:e|es|ed|ing)|nose[- ](?:up|down|high|low)|pitch(?:es|ed|ing)?\s+(?:up|down))\b/i;

// Geometry checks: errors the writer must fix.
export function checkStage(script, elements) {
  const errors = [], sizeOf = (id) => Number(elements.find((e) => e.id === id)?.size_m) || 1;
  const flying = (p) => /\b(flight|flying|banked|climb|airborne|descend|falling)\b/i.test(`${p.where} ${p.condition}`);
  for (const sc of script.scenes) {
    const shots = sc.shots.filter(staged); if (!shots.length) continue;
    if (!sc.stage?.goal) errors.push(`scene ${sc.n}: shots carry positions but the scene names no stage goal`);
    const MIN_SHARE = { wide: 0, "medium-wide": 0.08, medium: 0.15, "medium-close": 0.25, close: 0.35 };   // the largest subject's share of the frame's height a shot size promises
    for (const h of shots) {
      const cam = h.camera, inside = cam.view === "from inside"; if (len(sub(cam.toward, cam.at)) < 0.5) errors.push(`shot ${h.n}: the camera looks at its own position`);
      for (const w of ["first", "last"]) for (const p of h[w].props) {
        if (!isPoint(p.at)) { errors.push(`shot ${h.n} ${w} frame: ${p.id} has no position while the shot is staged`); continue; }
        if (!inside && len(sub(p.at, cam.at)) < sizeOf(p.id) / 2) errors.push(`shot ${h.n} ${w} frame: the camera is inside ${p.id}`);
        if (p.at.z < 0 && flying(p)) errors.push(`shot ${h.n} ${w} frame: ${p.id} is below the surface (z ${p.at.z}) while described as flying`);
      }
      // A fixed camera cannot hold a subject that moves hundreds of metres within the shot: the writer attaches the camera (moves_with) or shortens the shot.
      if (!cam.moves_with || cam.moves_with === "none") for (const a of h.first.props) { const b = h.last.props.find((x) => x.id === a.id); if (b && isPoint(a.at) && isPoint(b.at) && a.visible === "in frame" && b.visible === "in frame" && len(sub(b.at, a.at)) > 300) errors.push(`shot ${h.n}: ${a.id} moves ${Math.round(len(sub(b.at, a.at)))} m during the shot while the camera is fixed, so it would leave the frame or shrink to a speck: set camera.moves_with to ${a.id} (a chase camera that keeps its distance) or shorten the shot`); }
      // Attitude is motion, not a frame: with the heading unchanged, a condition that differs only by bank, roll, pitch or
      // flare words is the same still, and the word "banked" alone turned the painter's jets to face the camera three times.
      const ATT = /\b(bank(?:ed|ing)?|roll(?:ed|ing)?|pitch(?:ed|ing)?(?: up| down)?|flar(?:ed|ing|e)|nose[- ](?:up|down|high|low)|wings? level|level(?:led)?|inward|outward|\d+\s*degrees?)\b/gi;
      for (const a of h.first.props) { const b = h.last.props.find((x) => x.id === a.id); if (!b || !isPoint(a.at) || !isPoint(b.at)) continue; const strip = (t) => String(t || "").replace(ATT, " ").replace(/[,;.\s]+/g, " ").trim().toLowerCase(); if (Number(a.heading) === Number(b.heading) && Number(a.pitch || 0) === Number(b.pitch || 0) && String(a.condition) !== String(b.condition) && strip(a.condition) === strip(b.condition)) errors.push(`shot ${h.n}: ${a.id}'s condition changes only in attitude ("${a.condition}" → "${b.condition}") while its heading is unchanged; attitude is motion for the clip, not a frame: copy the first frame's condition into the last, and change the heading in the last frame if the thing really turns`); }
      // With the heading unchanged across the shot, neither frame's condition carries a bank, a roll or a flare: "banked 15
      // degrees inward" on a first frame (the last frame of the shot before said "wings level") is a turn the numbers deny.
      const goal = sc.stage?.goal && sc.stage.goal !== "none" ? sc.stage.goal : null;
      for (const a of movers(h, goal)) { const b = h.last.props.find((x) => x.id === a.id); if (turnOf(a, b) >= TURN_DEG) continue; for (const [w, fr] of [["first", a], ["last", b]]) { const hit = String(fr.condition || "").match(ATTITUDE); if (hit) errors.push(`shot ${h.n} ${w} frame: ${a.id}'s condition says "${fr.condition}" while its heading is unchanged across the shot (${Number(a.heading) || 0}° → ${Number(b.heading) || 0}°); attitude is motion for the clip, not a frame: write the condition without "${hit[0]}", and change the heading in the last frame if the thing really turns`); } }
      // A thing goes where its nose points: each frame's heading against the track between the positions.
      for (const a of movers(h, goal)) { const b = h.last.props.find((x) => x.id === a.id); if (len(sub(b.at, a.at)) < 50) continue; const track = trackOf(a, b), allow = turnOf(a, b) / 2 + TRACK_SLACK; for (const [w, fr] of [["first", a], ["last", b]]) { const hd = ((Number(fr.heading) || 0) % 360 + 360) % 360, off = angleDiff(hd, track); if (off > allow) errors.push(`shot ${h.n} ${w} frame: ${a.id} heads ${hd}° but its track over the shot runs at ${Math.round(track)}° (from (${a.at.x}, ${a.at.y}) to (${b.at.x}, ${b.at.y})), ${Math.round(off)}° off; a thing goes where its nose points: set the heading along the track, or if it really turns, bend the track by moving its last position where the new heading leads`); } }
      // "Strong diagonals" is a motion cue the writer picks from a list; with every mover heading along the camera's axis the
      // stage shows no diagonal, and the cue invites the painter to angle the jets.
      if ((h.motion || []).includes("strong diagonals")) { const ax = movers(h, goal).filter((a) => a.visible === "in frame" && a.stage && typeof a.stage.yaw === "number"), axial = (y) => Math.min(angleDiff(y, 0), angleDiff(y, 180)) <= 20; if (ax.length && ax.every((a) => axial(a.stage.yaw))) errors.push(`shot ${h.n}: motion cue "strong diagonals", but every mover heads along the camera's axis (${ax.map((a) => `${a.id} ${a.stage.yaw}°`).join(", ")}) and the stage shows no diagonal: drop the cue, or stand the camera to one side`); }
      // Turn words are headings: prose about the shot's movers may call a movement a bank, a turn or a convergence only
      // when a mover's heading changes between the frames. The ninth film's writer narrated a 19 m slide toward the line
      // over 520 m (a 2° change) as "bank inward … converging diagonals"; the painter drew the jets converging, then facing
      // each other, through four attempts, while every number in the prompt said straight ahead.
      const mv = movers(h, goal);
      if (mv.length && !mv.some((a) => turnOf(a, h.last.props.find((x) => x.id === a.id)) >= TURN_DEG)) {
        const texts = [...(h.action || []).map((a) => ["action", a.text]), ["treatment", h.treatment], ["camera.looks_at", h.camera?.looks_at], ...["first", "last"].flatMap((w) => (h[w]?.relations || []).filter((r) => mv.some((a) => a.id === r.a || a.id === r.b)).map((r) => [`${w} frame relation ${r.a} … ${r.b}`, r.how]))];
        for (const [field, text] of texts) { const hit = String(text || "").match(TURN); if (hit) errors.push(`shot ${h.n}: "${hit[0]}" (${field}) names a turn, but no mover changes heading by ${TURN_DEG}° or more in this shot (${mv.map((a) => `${a.id} ${Number(a.heading) || 0}° → ${Number(h.last.props.find((x) => x.id === a.id).heading) || 0}°`).join(", ")}); drop the turn words and say what the numbers do (${mv.map((a) => movement(a, h.last.props.find((x) => x.id === a.id))).join("; ")}); only if it really turns, stage the turn: a heading change of ${TURN_DEG}° or more AND the last position moved where the new heading leads`); }
      }
      // Speed between the two frames of a shot: nothing on record moves faster than 400 m/s.
      for (const a of h.first.props) { const b = h.last.props.find((x) => x.id === a.id); if (a && b && isPoint(a.at) && isPoint(b.at) && h.seconds > 0) { const v = len(sub(b.at, a.at)) / h.seconds; if (v > 400) errors.push(`shot ${h.n}: ${a.id} moves ${Math.round(v)} m/s between its frames (${len(sub(b.at, a.at)).toFixed(0)} m in ${h.seconds} s)`); } }
      // Something the camera looks at should be in frame: at least one positioned prop in frame or a person in it.
      if (inside) continue;
      for (const w of ["first", "last"]) if (!h[w].props.some((p) => isPoint(p.at) && p.visible === "in frame") && !h[w].people.some((q) => q.visible === "in frame")) errors.push(`shot ${h.n} ${w} frame: the camera at (${cam.at.x}, ${cam.at.y}, ${cam.at.z}) looking toward (${cam.toward.x}, ${cam.toward.y}, ${cam.toward.z}) has nothing in frame`);
      // The shot's size is a promise about its largest subject: a "medium" of two jets that take 4% of the frame is a wide.
      for (const w of ["first", "last"]) { const best = Math.max(0, ...h[w].props.filter((p) => p.stage && p.visible === "in frame").map((p) => p.stage.share)); const need = MIN_SHARE[h.size] ?? 0; if (best > 0 && best < need) errors.push(`shot ${h.n} ${w} frame: a ${h.size} shot, but its largest subject takes ${Math.round(best * 100)}% of the frame's height (a ${h.size} needs about ${Math.round(need * 100)}%): bring the camera nearer or the subjects closer, or call the shot wide`); }
    }
    // The scene's own prose (situation, synopsis) against every mover of the scene: a turn word needs a turn somewhere in it.
    const scGoal = sc.stage?.goal && sc.stage.goal !== "none" ? sc.stage.goal : null, scMovers = shots.flatMap((h) => movers(h, scGoal)); if (scMovers.length && maxTurn(shots, scGoal) < TURN_DEG) for (const [field, text] of [["situation", sc.situation], ["synopsis", sc.synopsis]]) { const hit = String(text || "").match(TURN); if (hit) errors.push(`scene ${sc.n}: "${hit[0]}" (${field}) names a turn, but nothing changes heading by ${TURN_DEG}° or more in any shot of the scene (the largest change is ${maxTurn(shots, scGoal)}°); drop the turn words and say what the numbers do; only if something really turns, stage the turn in a shot (a heading change of ${TURN_DEG}° or more and a track that bends with it)`); }
  }
  // The film synopsis, read by the painter in every frame, against the whole film.
  const goalOf = (sc) => sc.stage?.goal && sc.stage.goal !== "none" ? sc.stage.goal : null, filmMovers = script.scenes.flatMap((sc) => sc.shots.filter(staged).flatMap((h) => movers(h, goalOf(sc)))), filmTurn = Math.max(0, ...script.scenes.map((sc) => maxTurn(sc.shots.filter(staged), goalOf(sc))));
  if (filmMovers.length && filmTurn < TURN_DEG) { const hit = String(script.synopsis || "").match(TURN); if (hit) errors.push(`synopsis: "${hit[0]}" names a turn, but nothing changes heading by ${TURN_DEG}° or more in any shot of the film (the largest change is ${filmTurn}°); drop the turn words and say what the numbers do; only if something really turns, stage the turn in a shot`); }
  // A stage goal that is never a mover keeps one heading across the film: the frigate's bow points the same way in the
  // cockpit scene and in the attack scene (a 180 in one scene turned the ship around between two shots).
  const goalHeadings = {}; for (const sc of script.scenes) { const g = sc.stage?.goal; if (!g || g === "none") continue; for (const h of sc.shots.filter(staged)) for (const w of ["first", "last"]) { const p = h[w].props.find((x) => x.id === g); if (p && isPoint(p.at)) (goalHeadings[g] ??= []).push({ scene: sc.n, shot: h.n, heading: ((Number(p.heading) || 0) % 360 + 360) % 360 }); } }
  for (const [g, list] of Object.entries(goalHeadings)) { const counts = {}; for (const x of list) counts[x.heading] = (counts[x.heading] || 0) + 1; const common = Number(Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]); const odd = list.filter((x) => angleDiff(x.heading, common) > 5), where = [...new Set(odd.map((x) => `scene ${x.scene} shot ${x.shot}`))]; if (odd.length) errors.push(`${g} is the stage goal and heads ${common}° in most frames, but ${where.join(", ")} give${where.length === 1 ? "s" : ""} it ${[...new Set(odd.map((x) => `${x.heading}°`))].join(", ")}; a goal that does not move keeps one heading in every scene: set it to ${common}° there`); }
  return errors;
}

// The frame before a frame, on the same stage: a shot's first frame for its last; the previous shot's last frame for a
// first frame (the same instant from another camera); nothing for the first frame of a scene. The WORLD block once took
// the previous still in chain order, which for the first exterior after a cockpit scene was a frame in cockpit
// coordinates: "advanced 4420 m along the line" for a jet that had flown 520, "unmoved" for a jet the cockpit frame
// never held. Scenes have their own stages; a delta across two of them means nothing.
export function previousFrame(scene, shot, which) {
  if (!scene || !shot) return null;
  if (which === "last") return shot.first || null;
  const i = scene.shots.findIndex((h) => h.n === shot.n); return i > 0 ? scene.shots[i - 1].last || null : null;
}

// The WORLD block for the painter: the stage, the camera, each prop relative to the goal and the line, the change since
// the previous frame (positions in metres, rounded), and what each thing's size follows from.
export function worldText({ shot, scene, frame, prevFrame = null, name, sizeOf }) {
  if (!staged(shot) || !scene.stage) return "";
  const goalId = scene.stage.goal, goal = frame.props.find((p) => p.id === goalId && isPoint(p.at)), lines = [];
  const m = (n) => `${Math.round(Math.abs(n))} m`;
  lines.push(`Stage: ${scene.stage.axis}; x runs toward ${goalId ? name(goalId) : "the goal"}, y to the right of that line, z up; distances in metres.`);
  const cam = cameraFor(shot, frame === shot.last ? "last" : "first"), B = basis(cam), chase = shot.camera.moves_with && shot.camera.moves_with !== "none" ? ` The camera flies with ${name(shot.camera.moves_with)}, keeping its distance (a chase camera).` : "";
  const subject = frame.props.filter((p) => isPoint(p.at) && p.visible === "in frame").sort((a, b) => len(sub(a.at, cam.at)) - len(sub(b.at, cam.at)))[0];
  if (subject) { const v = sub(subject.at, cam.at); lines.push(`Camera: ${m(len(v))} from ${name(subject.id)}, ${v.x > 0 ? "behind it on the line" : "ahead of it on the line"}${Math.abs(v.y) > 5 ? `, ${m(v.y)} to its ${v.y > 0 ? "left" : "right"}` : ""}, ${cam.at.z > (subject.at.z + 5) ? `${m(cam.at.z - subject.at.z)} above it` : cam.at.z < (subject.at.z - 5) ? `${m(subject.at.z - cam.at.z)} below it` : "at its height"}; looking ${B && Math.abs(B.f.x) > 0.7 ? (B.f.x > 0 ? "along the line toward the goal" : "back along the line, away from the goal") : "across the line"}${cam.at.z > 20 ? `, ${m(cam.at.z)} above the surface` : ""}.${chase}`); }
  for (const p of frame.props) {
    if (!isPoint(p.at)) continue;
    if (p.on && p.on !== "none" && p.stage && p.stage.share < 0.005) continue;   // a worn or carried speck (a helmet 700 m off) says nothing about the world
    const rel = [];
    if (goal && p.id !== goalId) { const dx = goal.at.x - p.at.x; rel.push(dx > 20 ? `${m(dx)} short of ${name(goalId)}` : dx < -20 ? `${m(dx)} past ${name(goalId)}` : `abeam ${name(goalId)}`); }
    if (Math.abs(p.at.y) > 5) rel.push(`${m(p.at.y)} ${p.at.y > 0 ? "right" : "left"} of the line`);
    if (p.at.z > 2) rel.push(`${m(p.at.z)} up`);
    if (p.at.z <= 2 && p.id === goalId) rel.push("on the surface");
    const prev = prevFrame?.props.find((x) => x.id === p.id && isPoint(x.at)), moved = [];
    if (prev) { const d = sub(p.at, prev.at); if (Math.abs(d.x) > 5) moved.push(`${d.x > 0 ? "advanced" : "fell back"} ${m(d.x)} along the line`); if (Math.abs(d.z) > 2) moved.push(`${d.z > 0 ? "climbed" : "dropped"} ${m(d.z)}`); if (Math.abs(d.y) > 5) moved.push(Math.sign(p.at.y) === Math.sign(prev.at.y) && Math.abs(p.at.y) < Math.abs(prev.at.y) ? `closed ${m(d.y)} toward the line` : Math.sign(p.at.y) === Math.sign(prev.at.y) ? `opened ${m(d.y)} from the line` : `moved ${m(d.y)} to the ${d.y > 0 ? "right" : "left"}, across the line`); const dh = (((Number(p.heading) || 0) - (Number(prev.heading) || 0)) % 360 + 540) % 360 - 180; if (Math.abs(dh) >= TURN_DEG) moved.push(`turned ${Math.round(Math.abs(dh))}° to the ${dh > 0 ? "right" : "left"}`); }
    const host = p.on && p.on !== "none" ? null : frame.props.find((x) => x.id !== p.id && isPoint(x.at) && /bomb|missile|shell|round/i.test(p.id) && /f35|jet|aircraft|plane/i.test(x.id) && Math.abs(x.at.y - p.at.y) < 15);
    const trail = host ? `; ${p.at.x < host.at.x - 5 ? `trails ${name(host.id)} by ${m(host.at.x - p.at.x)}` : `level with ${name(host.id)} along the line`}, ${m(host.at.z - p.at.z)} below it` : "";
    lines.push(`- ${name(p.id)}: ${rel.join(", ") || "at the origin"}; heading ${p.points === "away from the camera" ? "away from the camera" : p.points === "toward the camera" ? "toward the camera" : p.points}${trail}${prev ? (moved.length ? `; since the frame before: ${moved.join(", ")}` : "; unmoved since the frame before") : ""}${p.stage ? `; ${m(p.stage.distance)} from the camera, so about ${Math.round(p.stage.share * 100)}% of the frame's height and ${Math.round((p.stage.shareW ?? 0) * 100)}% of its width${sizeOf ? ` (${sizeOf(p.id)} m long)` : ""}` : ""}.`);
  }
  return `WORLD\n${lines.join("\n")}`;
}

// The geometry gate's reading of a heading, against the stage's yaw. The picture is read as one of eight directions (the
// nose as the camera sees it) or down, up, none; READ_YAW gives each its angle. headingGap is the difference in degrees
// the short way round, or null when the reading says nothing about yaw (down, up, none, or a thing pitched past 60°,
// whose nose direction on the ground plane is not what the picture shows). The first gate flagged only the exact
// opposite of the staged word, and two jets turned 90° to face each other passed it (s7-2 of the ninth film).
export const READ_YAW = { "away from the camera": 0, "away, angled to screen right": 45, "across to screen right": 90, "toward the camera, angled to screen right": 135, "toward the camera": 180, "toward the camera, angled to screen left": 225, "across to screen left": 270, "away, angled to screen left": 315 };
export const HEADING_TOLERANCE = 70;   // degrees: one reading step (45°) and half of the next is the painter's licence; a quarter turn is not
export function headingGap(stage, read) {
  if (!stage || typeof stage.yaw !== "number") return null;
  const pitch = Number(stage.pitch) || 0;
  // A thing staged level (a bomb on its pylon) read as pointing down has separated and fallen: 180, a flag. A thing staged
  // steep is held only against the opposite direction.
  if (read === "down" || read === "up") return pitch <= -45 ? (read === "up" ? 180 : null) : pitch >= 45 ? (read === "down" ? 180 : null) : 180;
  if (!(read in READ_YAW) || Math.abs(pitch) >= 60) return null;
  return Math.abs(((READ_YAW[read] - stage.yaw) % 360 + 540) % 360 - 180);
}
