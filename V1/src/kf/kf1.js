// KF1: the edit-framed still prompt. Sections: REFERENCES (what each image is, and how this frame relates to the frame it is
// painted from and to the shot the viewer just saw), TASK (put the moment into the plate / edit the previous frame / make the
// new setup from the scene's master), CHANGES (edits only: a code diff of the two frames), CONTEXT (the shot's moment and the
// scene's tone), CAMERA, PEOPLE (position, what each person is doing, what stands behind them, who is just outside the frame),
// PROPS, RULES. Image 1 binds the place: the plate for the first still of a scene, the previous still for the same camera,
// the scene's master wide for a new setup. Identity always from the portraits, named by their telling features.
import { namer, t, strip, cap, personLine, propLine, deltas, inFrame } from "../prompts.js";

export const KF = {
  id: "kf1", name: "edit-framed: REFERENCES, TASK, CHANGES, CONTEXT, CAMERA, PEOPLE, RULES; new setups painted from the scene's master",
  sources: { REFERENCES: "image 1 = plate / previous still / scene master (state.refs) + state.relation (the cut) + bank portraits + cast feature lines", TASK: "branch picked by code: first still of the scene / same camera / new camera", CHANGES: "code diff of this frame against the previous still's frame", CONTEXT: "appended: shot.moment + scene.tone", CAMERA: "shot.camera (size, height, stands, looks_at) + state.room(plate)", PEOPLE: "frame.people (third, depth, facing, distance, pose, hands, doing) + state.behind + state.offFrame", "PEOPLE AFTER THE CHANGES": "frame.people + state.behind + state.offFrame", PROPS: "frame.props: where, condition", RULES: "count + medium sentence" },
};

export function stillPrompt({ still, env, prev, scene, els, features, medium, state }) {
  const people = still.frame.people.filter(inFrame), props = still.frame.props.filter(inFrame), n = namer(els, people);
  const heading = `${scene.inside ? "INT." : "EXT."} ${n.name(scene.place)}, ${scene.time.toLowerCase()}`, c = still.camera;
  const kind = !env ? "plate" : still.envKind;
  const refs = ["REFERENCES",
    kind === "plate" ? `Image 1: the empty place (${heading}). Keep its architecture, light and colours.` : kind === "edit" ? `Image 1: the previous frame of this scene (${heading}), same camera.` : `Image 1: the scene's wide view (${heading}). ${state?.relation(still, env, prev) || ""}`.trim(),
    ...people.map((p) => `Image ${n.idx(p.id)}: ${n.name(p.id)}. ${strip(features[p.id])}.`),
    ...(people.length ? [`Same faces and clothes of the period as in image${people.length > 1 ? "s" : ""} ${people.map((p) => n.idx(p.id)).join(", ")}; their poses and backgrounds do not apply.`] : [])].join("\n");
  const task = kind === "plate" ? `TASK\nPut this moment into image 1: the place from image 1, the people from the portraits, in the frame described below.`
    : kind === "edit" ? `TASK\nEdit image 1 into the next frame: same framing, same camera, same room and light. Change ONLY what is listed under CHANGES; everything else stays as in image 1.\n\nCHANGES\n${deltas(env.frame, still.frame, n)}`
    : `TASK\nMake this new camera setup of the same room at the same instant as image 1, with the people where they stand in image 1.`;
  const context = `CONTEXT\nMoment: ${n.named(cap(t(still.moment)))}.\nTone: ${cap(t(scene.tone))}.`;
  const camera = `CAMERA\n${cap(still.size)} shot, ${c.height} height. Stands ${n.named(t(c.stands))}. Looks at ${n.named(t(c.looks_at))}. ${state?.room(still.place) || ""}`.trim();
  const off = state?.offFrame(still.frame) || "";
  const line = (p) => { const b = state?.behindFor(still, env, p) || []; return `${personLine(p, n)}${b.length ? ` Behind him: ${b.join(", ")}.` : c.behind.length ? ` Behind him: ${c.behind.map(t).join(", ")}.` : ""}`; };
  const peopleBlock = `PEOPLE${kind === "edit" ? " AFTER THE CHANGES" : ""} (exactly ${people.length}, nobody else${off ? `; ${off}` : ""})\n${people.map(line).join("\n") || "- nobody in frame."}${props.length ? `\n\nPROPS\n${props.map((p) => propLine(p, n)).join("\n")}` : ""}`;
  const rules = `RULES\nNothing is added that is not listed. ${medium.frame} One single frame, no text or captions.`;
  const images = [env ? `env:${env.id}` : `plate:${scene.place}`, ...people.map((p) => `portrait:${p.id}`)];
  return { images, prompt: [refs, task, context, camera, peopleBlock, rules].join("\n\n") };
}
