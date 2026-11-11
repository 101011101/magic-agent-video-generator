// The stage model: derived screen facts, the override of the writer's guesses, the checks and the WORLD text. No model
// calls. Run: node V2/tests/stage.test.mjs
import { derive, applyStage, checkStage, worldText, staged, previousFrame, headingGap, TURN, ATTITUDE } from "../backend/composer/screenplay/stage.js";

let fails = 0; const ok = (c, m) => { console.log(`${c ? "ok  " : "FAIL"} ${m}`); if (!c) fails++; };
const cam = (at, toward) => ({ same_as: 0, stands: "s", view: "from behind", move: "static", height: "high", looks_at: "x", behind: [], at, toward });

// A camera 400 m behind two jets on the attack line, looking along it: tails toward the camera, the frigate ahead and tiny.
{
  const C = cam({ x: -400, y: 0, z: 200 }, { x: 2000, y: 0, z: 0 });
  const jet = derive(C, { x: 0, y: -20, z: 150 }, { size_m: 15.7, heading: 0 });
  ok(jet.points === "away from the camera" && jet.visible === "in frame" && jet.third === "centre", `jet ahead of the camera heading +x, 20 m off a 400 m line is still centre: ${JSON.stringify(jet)}`);
  const wide = derive(C, { x: 0, y: -120, z: 150 }, { size_m: 15.7, heading: 0 });
  ok(wide.third === "left", `120 m off the line at 400 m is the left third: ${wide.third} (${wide.hAngle}°)`);
  const ship = derive(C, { x: 2000, y: 0, z: 0 }, { size_m: 135, heading: 0 });
  ok(ship.visible === "in frame" && (ship.size === "tiny" || ship.size === "small") && ship.depth === "far", `the frigate 2.4 km off is small or tiny and far: ${JSON.stringify(ship)}`);
  const back = derive(C, { x: -800, y: 0, z: 150 }, { size_m: 15.7, heading: 0 });
  ok(back.visible.startsWith("off"), `a thing behind the camera is off frame: ${back.visible}`);
  const side = derive(cam({ x: 0, y: -300, z: 150 }, { x: 0, y: 0, z: 150 }), { x: 0, y: 0, z: 150 }, { size_m: 15.7, heading: 0 });
  ok(side.points === "across to screen left" || side.points === "across to screen right", `a camera abeam sees the jet crossing: ${side.points}`);
  // Orientation and dimensions: a frigate seen stern-on shows its mast and beam, not its length; broadside, its length.
  const sternOn = derive(cam({ x: 4900, y: 0, z: 125 }, { x: 5720, y: 0, z: 10 }), { x: 5720, y: 0, z: 8 }, { size_m: 135, dims: { length_m: 135, width_m: 16, height_m: 45 }, heading: 0 });
  ok(sternOn.share > 0.08 && sternOn.share < 0.2 && sternOn.shareW < 0.08, `a frigate 820 m ahead, stern-on: about ${Math.round(sternOn.share * 100)}% of the height (the mast), ${Math.round(sternOn.shareW * 100)}% of the width (the beam)`);
  const broadside = derive(cam({ x: 5720, y: -820, z: 125 }, { x: 5720, y: 0, z: 10 }), { x: 5720, y: 0, z: 8 }, { size_m: 135, dims: { length_m: 135, width_m: 16, height_m: 45 }, heading: 0 });
  ok(broadside.shareW > 0.18 && broadside.shareW < 0.3 && broadside.size === "medium", `the same frigate broadside at 820 m: ${Math.round(broadside.shareW * 100)}% of the width, size ${broadside.size}`);
  const bomb = derive(C, { x: 300, y: -20, z: 120 }, { size_m: 3.3, heading: 0, pitch: -60 });
  ok(bomb.points === "down" && bomb.size === "tiny", `a falling bomb points down and is tiny at 700 m: ${JSON.stringify(bomb)}`);
}

// applyStage overrides the writer's words from the numbers; checkStage finds the impossible; worldText says what moved.
{
  const elements = [{ id: "jet", kind: "prop", name: "the jet", size_m: 15.7 }, { id: "ship", kind: "prop", name: "the ship", size_m: 135 }, { id: "bomb", kind: "prop", name: "the bomb", size_m: 3.3 }, { id: "pilot", kind: "character", name: "Pilot" }];
  const prop = (id, at, extra = {}) => ({ id, visible: "in frame", where: "w", size: "large", points: "toward the camera", facing: "f", condition: "level flight", on: "none", at, heading: 0, ...extra });
  const person = { id: "pilot", visible: "in frame", third: "right", depth: "near", size: "large", facing: "f", distance: "d", pose: "p", hands: "h", doing: "w", on: "jet" };
  const C = { ...cam({ x: -400, y: 0, z: 200 }, { x: 2000, y: 0, z: 0 }), moves_with: "jet" };   // a chase camera flying with the jet
  const shot = { n: 1, start: 0, seconds: 2, size: "wide", camera: C, first: { people: [person], props: [prop("jet", { x: 0, y: -20, z: 150 }), prop("ship", { x: 2000, y: 0, z: 0 }), prop("bomb", { x: 0, y: -20, z: 140, }, { on: "jet", condition: "secured" })] },
    last: { people: [{ ...person }], props: [prop("jet", { x: 600, y: -20, z: 150 }), prop("ship", { x: 2000, y: 0, z: 0 }), prop("bomb", { x: 520, y: -20, z: 120 }, { pitch: -50, condition: "falling" })] } };
  const script = { scenes: [{ n: 1, stage: { axis: "the attack line from the formation to the ship", goal: "ship" }, shots: [shot] }] };
  ok(staged(shot), "a shot with a placed camera and positioned props is staged");
  const notes = applyStage(script, elements);
  const j = shot.first.props[0], p = shot.first.people[0];
  ok(j.points === "away from the camera" && j.size !== "large" && p.third === j.third && p.depth === j.depth, `the writer's 'toward the camera, large' became '${j.points}, ${j.size}'; the pilot took the jet's third and depth (${notes.length} notes)`);
  ok(checkStage(script, elements).length === 0, `a plausible stage passes the checks: ${checkStage(script, elements).join(" | ")}`);
  const w = worldText({ shot, scene: script.scenes[0], frame: shot.last, prevFrame: shot.first, name: (id) => elements.find((e) => e.id === id)?.name || id, sizeOf: (id) => elements.find((e) => e.id === id)?.size_m });
  const banked = { scenes: [{ n: 1, stage: { axis: "a", goal: "ship" }, shots: [{ ...shot, last: { ...shot.last, props: shot.last.props.map((p) => p.id === "jet" ? { ...p, condition: "banked 15 degrees inward, level flight" } : p) } }] }] };
  ok(checkStage(banked, elements).some((e) => /changes only in attitude/.test(e)), "a bank as the only difference in a jet's condition, heading unchanged, is an error: attitude is motion");
  const fixed = { scenes: [{ n: 1, stage: { axis: "a", goal: "ship" }, shots: [{ ...shot, camera: { ...C, moves_with: "none" } }] }] };
  ok(checkStage(fixed, elements).some((e) => /moves 600 m during the shot while the camera is fixed/.test(e)), "a fixed camera on a jet that covers 600 m in the shot is an error: attach the camera or shorten the shot");
  ok(/^WORLD\n/.test(w) && /the jet: 1400 m short of the ship/.test(w) && /advanced 600 m along the line/.test(w) && /the bomb: [^\n]*; trails the jet by 80 m, 30 m below it; since/.test(w) && /Camera: [^\n]*behind it on the line[^\n]*flies with the jet/.test(w), `the WORLD block states positions, the camera and the change:\n${w}`);
  // The impossible: a camera inside the jet, a jet underwater, a jet at 1,000 m/s.
  const bad = { scenes: [{ n: 1, stage: { axis: "a", goal: "ship" }, shots: [{ ...shot, camera: cam({ x: 0, y: -20, z: -5 }, { x: 2000, y: 0, z: 0 }), first: { people: [], props: [prop("jet", { x: 0, y: -20, z: -5 }), prop("ship", { x: 2000, y: 0, z: 0 })] }, last: { people: [], props: [prop("jet", { x: 2500, y: -20, z: 150 }), prop("ship", { x: 2000, y: 0, z: 0 })] } }] }] };
  const errs = checkStage(bad, elements);
  ok(errs.some((e) => /camera is inside jet/.test(e)) && errs.some((e) => /below the surface/.test(e)) && errs.some((e) => /m\/s between its frames/.test(e)), `the checks name the camera inside a jet, a jet underwater and an impossible speed: ${errs.join(" | ")}`);
}

// Turn words are headings; attitude words need a heading change; the WORLD deltas come from the frame before on the same
// stage; the geometry gate's reading is held against the stage's yaw (s7-2 of the ninth film: "bank inward … converging
// diagonals" over a 2° change, two jets painted facing each other, passed by a gate that flagged only the exact opposite).
{
  const elements = [{ id: "jet", kind: "prop", name: "the jet", size_m: 15.7 }, { id: "jet2", kind: "prop", name: "the second jet", size_m: 15.7 }, { id: "ship", kind: "prop", name: "the ship", size_m: 135 }];
  const prop = (id, at, extra = {}) => ({ id, visible: "in frame", where: "w", size: "small", points: "away from the camera", facing: "f", condition: "intact, wings level, canopy closed", on: "none", at, heading: 0, ...extra });
  const C = { ...cam({ x: -400, y: -90, z: 200 }, { x: 2000, y: 0, z: 0 }), moves_with: "jet" };
  const mk = (lastExtra = {}, text = "jet and jet2 bank inward toward ship, moving their centre lines from y minus 28 and plus 28 to minus 9 and plus 9") => ({ n: 1, start: 0, seconds: 2, size: "wide", camera: C, action: [{ at: 0, text }], treatment: "the two inward banks draw converging diagonals over the sea",
    first: { people: [], props: [prop("jet", { x: 0, y: -28, z: 150 }), prop("jet2", { x: -100, y: 28, z: 170 }), prop("ship", { x: 2000, y: 0, z: 0 })], relations: [{ a: "jet", how: "banks toward", b: "ship" }] },
    last: { people: [], props: [prop("jet", { x: 520, y: -9, z: 150 }, lastExtra), prop("jet2", { x: 420, y: 9, z: 170 }, lastExtra), prop("ship", { x: 2000, y: 0, z: 0 })], relations: [{ a: "jet", how: "banks toward", b: "ship" }] } });
  const script = (shot, extra = {}) => ({ synopsis: "Two jets fly toward a ship and strike it.", scenes: [{ n: 1, stage: { axis: "a", goal: "ship" }, situation: "both jets in level flight toward the ship", synopsis: "the jets close on the ship", shots: [shot], ...extra }] });
  const errs = checkStage(script(mk()), elements);
  ok(errs.some((e) => /"bank inward" \(action\) names a turn/.test(e) && /jet 0° → 0°/.test(e) && /closes 19 m toward the line/.test(e)), `an action line that banks jets whose heading does not change is an error that says what the numbers do: ${errs.find((e) => /names a turn/.test(e))}`);
  ok(errs.some((e) => /\(treatment\) names a turn/.test(e)) && errs.some((e) => /relation jet … ship\) names a turn/.test(e)), `the treatment ("converging diagonals") and a relation ("banks toward") are caught too (${errs.length} errors)`);
  ok(!checkStage(script(mk({ heading: 30, at: { x: 500, y: 100, z: 150 } })), elements).some((e) => /names a turn/.test(e)), "the same words with the heading changed 30° in the last frame and the track bent to match pass: the turn is staged");
  const token = checkStage(script(mk({ heading: 10 })), elements);
  ok(token.some((e) => /names a turn/.test(e)) && token.some((e) => /shot 1 last frame: jet2 heads 10° but its track over the shot runs at 358°/.test(e)), `a token 10° heading change with the track unbent is still a turn-word error, and a track error where the nose crosses the track: ${token.find((e) => /its track/.test(e))}`);
  ok(!checkStage(script(mk({}, "the jets advance")), elements).some((e) => /its track/.test(e)), "headings along the track pass the track check");
  // The goal is never a mover: in cockpit coordinates the ship "moves" 520 m toward the origin, heading unchanged.
  const cockpit = { synopsis: "s", scenes: [{ n: 1, stage: { axis: "aircraft-fixed", goal: "ship" }, situation: "Vega turns toward the touchscreen", synopsis: "s", shots: [{ ...mk({}, "vega turns toward the touchscreen"), camera: { ...C, view: "from inside", moves_with: "none", at: { x: 1, y: 0, z: 138 }, toward: { x: 4, y: 0, z: 137 } }, first: { people: [], props: [prop("jet", { x: 0, y: 0, z: 137 }), prop("ship", { x: 2340, y: 0, z: 0 })] }, last: { people: [], props: [prop("jet", { x: 0, y: 0, z: 137 }), prop("ship", { x: 1820, y: 0, z: 0 })] } }] }] };
  const ce = checkStage(cockpit, elements);
  ok(!ce.some((e) => /its track|names a turn/.test(e)), `a goal that seems to move in cockpit coordinates is neither a track error nor a mover for the turn words: ${ce.join(" | ") || "no errors"}`);
  const turned = { ...script(mk({}, "the jets advance")), scenes: [...script(mk({}, "the jets advance")).scenes, { ...cockpit.scenes[0], n: 2, shots: cockpit.scenes[0].shots.map((h) => ({ ...h, n: 2, first: { ...h.first, props: h.first.props.map((p) => p.id === "ship" ? { ...p, heading: 180 } : p) }, last: { ...h.last, props: h.last.props.map((p) => p.id === "ship" ? { ...p, heading: 180 } : p) } })) }] };
  ok(checkStage(turned, elements).some((e) => /^ship is the stage goal and heads 0° in most frames, but scene 2 shot 2 gives it 180°/.test(e)), `a goal turned around in one scene is an error: ${checkStage(turned, elements).find((e) => /stage goal/.test(e))}`);
  ok(!checkStage(script(mk({}, "jet and jet2 close 19 m toward the line, straight ahead; the stagger remains")), elements).some((e) => /\(action\) names a turn/.test(e)), "an action line that says what the numbers do passes");
  const sc = checkStage(script(mk({}, "the jets advance"), { situation: "both jets bank toward the ship" }), elements);
  ok(sc.some((e) => /scene 1: "bank toward" \(situation\) names a turn/.test(e)), `the scene's situation is held against every shot of the scene: ${sc.find((e) => /scene 1/.test(e))}`);
  const film = checkStage({ ...script(mk({}, "the jets advance")), synopsis: "They bank toward the ship and release one bomb each." }, elements);
  ok(film.some((e) => /^synopsis: "bank toward" names a turn/.test(e)), `the film synopsis is held against the whole film: ${film.find((e) => /^synopsis/.test(e))}`);
  const att = checkStage(script({ ...mk({}, "the jets advance"), first: { ...mk().first, props: mk().first.props.map((p) => p.id === "jet" ? { ...p, condition: "intact, banked 15 degrees inward, canopy closed" } : p) } }), elements);
  ok(att.some((e) => /first frame: jet's condition says "intact, banked 15 degrees inward, canopy closed" while its heading is unchanged/.test(e)), `a bank in a first frame's condition with the heading unchanged is an error: ${att.find((e) => /condition says/.test(e))}`);
  ok(TURN.test("bank inward toward harrow") && TURN.test("converging diagonals") && TURN.test("banks toward") && !TURN.test("flies toward") && !TURN.test("the bank on the corner") && !TURN.test("roll level and continue ahead") && !TURN.test("settles the head forward"), "the turn words: banks, converges, diagonals; not a bank building, not rolling level, not a head settling");
  ok(ATTITUDE.test("banked 15 degrees inward") && !ATTITUDE.test("intact, wings level, canopy closed"), "attitude words: banked; wings level is a level state");
  const diag = script({ ...mk({}, "the jets advance"), motion: ["strong diagonals"] }); applyStage(diag, elements);
  ok(checkStage(diag, elements).some((e) => /motion cue "strong diagonals", but every mover heads along the camera's axis/.test(e)), "strong diagonals with every mover heading along the camera axis is an error");
  const diagSide = script({ ...mk({}, "the jets advance"), motion: ["strong diagonals"], camera: { ...C, at: { x: 200, y: -400, z: 200 }, toward: { x: 260, y: 0, z: 150 } } }); applyStage(diagSide, elements);
  ok(!checkStage(diagSide, elements).some((e) => /strong diagonals/.test(e)), "strong diagonals from a camera to the side passes");
  // The frame before on the same stage, and the deltas from it.
  const shot = mk(), sc1 = { n: 1, stage: { axis: "a", goal: "ship" }, shots: [shot, { ...mk(), n: 2 }] };
  ok(previousFrame(sc1, shot, "last") === shot.first && previousFrame(sc1, sc1.shots[1], "first") === shot.last && previousFrame(sc1, shot, "first") === null, "the frame before a last frame is the shot's first; before a first frame, the previous shot's last; nothing before a scene's first");
  const w = worldText({ shot, scene: sc1, frame: shot.last, prevFrame: shot.first, name: (id) => elements.find((e) => e.id === id)?.name || id, sizeOf: () => 15.7 });
  ok(/the jet: [^\n]*since the frame before: advanced 520 m along the line, closed 19 m toward the line/.test(w), `the deltas: advanced 520 m, closed 19 m toward the line:\n${w.split("\n").find((l) => /^- the jet:/.test(l))}`);
  const w2 = worldText({ shot, scene: sc1, frame: shot.last, prevFrame: { props: [shot.first.props[0]] }, name: (id) => id, sizeOf: () => 15.7 });
  ok(!/jet2: [^\n]*unmoved/.test(w2) && /- jet: [^\n]*since the frame before/.test(w2), "a thing the frame before never held is not called unmoved");
  // The gate's reading against the yaw.
  ok(headingGap({ yaw: 2, pitch: 0 }, "across to screen right") === 88 && headingGap({ yaw: 2, pitch: 0 }, "away, angled to screen right") === 43 && headingGap({ yaw: 350, pitch: 0 }, "away, angled to screen left") === 35 && headingGap({ yaw: 0, pitch: 0 }, "toward the camera") === 180, "headingGap: a quarter turn is 88° off, one reading step is 43°, the wrap-around works");
  ok(headingGap({ yaw: 0, pitch: -60 }, "toward the camera") === null && headingGap({ yaw: 0, pitch: -60 }, "up") === 180 && headingGap({ yaw: 0, pitch: -60 }, "down") === null && headingGap({ yaw: 0, pitch: 0 }, "down") === 180 && headingGap({ yaw: 0, pitch: 0 }, "none") === null && headingGap({}, "toward the camera") === null, "a thing pitched past 60° has no yaw to hold; down against up is 180; a level thing read as down has fallen (180); none says nothing; no yaw, no gap");
  const d = derive(cam({ x: -400, y: 0, z: 200 }, { x: 2000, y: 0, z: 0 }), { x: 0, y: 0, z: 150 }, { size_m: 15.7, heading: 90 });
  ok(d.yaw === 90 && d.points === "across to screen right", `heading 90 is to the right of the line, seen from behind as across to screen right: yaw ${d.yaw}, ${d.points}`);
}

console.log(fails ? `${fails} FAILED` : "all passed"); process.exit(fails ? 1 : 0);
