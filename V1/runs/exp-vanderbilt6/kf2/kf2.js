// KF2: the frame-first still prompt. CREATE THIS FRAME (the scene, the room from the state manager, the camera, one line per
// person with what they are doing and what stands behind them, who is just outside the frame), CONTEXT (the shot's moment
// and the scene's tone), FROM THESE REFERENCES (which image supplies which detail, and how this frame relates to the frame
// it is painted from and to the shot the viewer just saw), RULES. Image 1 binds the place: the plate for the first still of
// a scene, the previous still for the same camera, the scene's master wide for a new setup.
import { namer, t, strip, cap, inFrame } from "../prompts.js";

export const KF = {
  id: "kf2", name: "frame-first: CREATE THIS FRAME, CONTEXT, FROM THESE REFERENCES, RULES; new setups painted from the scene's master",
  sources: { "CREATE THIS FRAME": "scene heading + state.room(plate) + shot.camera + frame.people (third, depth, facing, distance, pose, hands, doing) + state.behind + state.offFrame + count", CONTEXT: "appended: shot.moment + scene.tone", "FROM THESE REFERENCES": "image 1 = plate / previous still / scene master (state.refs) + state.relation (the cut) + bank portraits + cast feature lines", RULES: "medium sentence" },
};

export function stillPrompt({ still, env, prev, scene, els, features, medium, state }) {
  const people = still.frame.people.filter(inFrame), props = still.frame.props.filter(inFrame), n = namer(els, people);
  const heading = `${scene.inside ? "INT." : "EXT."} ${n.name(scene.place)}, ${scene.time.toLowerCase()}`, c = still.camera;
  const camera = `${cap(still.size)} shot, ${c.height} height. The camera stands ${n.named(t(c.stands))}. It looks at ${n.named(t(c.looks_at))}.`;
  const person = (p) => { const b = state?.behindFor(still, env, p) || []; return `- ${n.name(p.id)}: ${p.third} third, ${p.depth} depth; facing ${n.named(t(p.facing))}; ${n.named(t(p.distance))}; ${n.named(t(p.pose))}; hands ${n.named(t(p.hands))}; ${n.named(t(p.doing))}.${b.length ? ` Behind him: ${b.join(", ")}.` : c.behind.length ? ` Behind him: ${c.behind.map(t).join(", ")}.` : ""}`; };
  const prop = (p) => `- ${n.name(p.id)}: ${n.named(t(p.where))}; ${n.named(t(p.condition))}.`;
  const off = state?.offFrame(still.frame) || "";
  const frame = ["CREATE THIS FRAME", `${heading}. ${state?.room(still.place) || ""} ${camera}`.replace(/\s+/g, " ").trim(), ...people.map(person), ...props.map(prop), `Exactly ${people.length} ${people.length === 1 ? "person" : "people"}, nobody else${off ? `; ${off}` : ""}.`].join("\n");
  const context = `CONTEXT\nMoment: ${n.named(cap(t(still.moment)))}.\nTone: ${cap(t(scene.tone))}.`;
  const room = still.envKind === "plate" || !env ? `- The room, its architecture, light and colours: image 1, the empty place.`
    : still.envKind === "edit" ? `- The room, its light and colours, and this exact framing: image 1, the previous frame of this scene, same camera. Everything not listed above stays as it is in image 1.`
    : `- The room, its light and colours: image 1, the scene's wide view. ${state?.relation(still, env, prev) || "This frame is a new camera setup of the same room at the same instant."}`;
  const refs = ["FROM THESE REFERENCES", room, ...people.map((p) => `- ${n.name(p.id)}'s face, hair and clothes: image ${n.idx(p.id)}. ${strip(features[p.id])}.`),
    ...(people.length ? [`The poses and backgrounds of image${people.length > 1 ? `s ${people.map((p) => n.idx(p.id)).join(", ")}` : ` ${n.idx(people[0].id)}`} do not apply.`] : [])].join("\n");
  const rules = `RULES\nNothing is added that is not listed. ${medium.frame} One single frame, no text or captions.`;
  const images = [env ? `env:${env.id}` : `plate:${scene.place}`, ...people.map((p) => `portrait:${p.id}`)];
  return { images, prompt: [frame, context, refs, rules].join("\n\n") };
}
