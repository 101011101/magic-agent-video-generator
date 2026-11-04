// KF2: the frame-first still prompt. CREATE THIS FRAME (the scene, the camera, one line per person: what to make), then FROM
// THESE REFERENCES (which image supplies which detail: the room from image 1, each person's face, hair and clothes from a
// portrait), then RULES. No task verb, no change list: the same facts and the same images as KF1 in the order a generator
// reads them. Image 1 still binds the place: the plate for the first still of a place, else the latest still there.
import { namer, t, strip, cap, inFrame } from "../prompts.js";

export const KF = { id: "kf2", name: "frame-first: CREATE THIS FRAME, FROM THESE REFERENCES, RULES; no edit verb, no change list" };

export function stillPrompt({ still, env, scene, els, features, medium }) {
  const people = still.frame.people.filter(inFrame), props = still.frame.props.filter(inFrame), n = namer(els, people);
  const heading = `${scene.inside ? "INT." : "EXT."} ${n.name(scene.place)}, ${scene.time.toLowerCase()}`;
  const same = env && env.cameraKey === still.cameraKey, c = still.camera;
  const camera = `${cap(still.size)} shot, ${c.height} height. The camera stands ${n.named(t(c.stands))}. It looks at ${n.named(t(c.looks_at))}.${c.behind.length ? ` Behind the people: ${c.behind.map(t).join(", ")}.` : ""}`;
  const person = (p) => `- ${n.name(p.id)}: ${p.third} third, ${p.depth} depth; facing ${n.named(t(p.facing))}; ${n.named(t(p.distance))}; ${n.named(t(p.pose))}; hands ${n.named(t(p.hands))}.`;
  const prop = (p) => `- ${n.name(p.id)}: ${n.named(t(p.where))}; ${n.named(t(p.condition))}.`;
  const frame = ["CREATE THIS FRAME", `${heading}. ${camera}`, ...people.map(person), ...props.map(prop), `Exactly ${people.length} ${people.length === 1 ? "person" : "people"}, nobody else.`].join("\n");
  const room = !env ? `- The room, its architecture, light and colours: image 1, the empty place.`
    : same ? `- The room, its light and colours, and this exact framing: image 1, the previous frame of this scene. Everything not listed above stays as it is in image 1.`
    : `- The room, its light and colours: image 1, the previous frame of this scene; this frame is a new camera setup of the same room at the same instant.`;
  const refs = ["FROM THESE REFERENCES", room, ...people.map((p) => `- ${n.name(p.id)}'s face, hair and clothes: image ${n.idx(p.id)}. ${strip(features[p.id])}.`),
    ...(people.length ? [`The poses and backgrounds of image${people.length > 1 ? `s ${people.map((p) => n.idx(p.id)).join(", ")}` : ` ${n.idx(people[0].id)}`} do not apply.`] : [])].join("\n");
  const rules = `RULES\nNothing is added that is not listed. ${medium.frame} One single frame, no text or captions.`;
  const images = [env ? `env:${env.id}` : `plate:${scene.place}`, ...people.map((p) => `portrait:${p.id}`)];
  return { images, prompt: [frame, refs, rules].join("\n\n") };
}
