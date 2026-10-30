// KF1: the edit-framed still prompt. Sections: REFERENCES (what each image is), TASK (put the moment into the plate / edit
// the previous frame / reframe the previous frame), CHANGES (edits only: a code diff of the two frames), CAMERA, PEOPLE,
// PROPS, RULES. Image 1 binds the place: the plate for the first still of a place, else the latest still there. Identity
// always from the portraits, named by their telling features. One fact per line; ids replaced by names inside the fields.
import { namer, t, strip, cap, personLine, propLine, deltas, inFrame } from "../prompts.js";

export const KF = { id: "kf1", name: "edit-framed: REFERENCES, TASK, CHANGES, CAMERA, PEOPLE, RULES; image 1 is the place or the previous still" };

// Returns { prompt, images }: images are references the runner resolves to files, in order:
// "plate:<place>" or "env:<still id>" first, then "portrait:<character>" for each person in frame.
export function stillPrompt({ still, env, scene, els, features, medium }) {
  const people = still.frame.people.filter(inFrame), props = still.frame.props.filter(inFrame), n = namer(els, people);
  const heading = `${scene.inside ? "INT." : "EXT."} ${n.name(scene.place)}, ${scene.time.toLowerCase()}`;
  const same = env && env.cameraKey === still.cameraKey, c = still.camera;
  const refs = ["REFERENCES",
    env ? `Image 1: the previous frame of this scene (${heading}), ${same ? "same camera" : "from another camera"}.` : `Image 1: the empty place (${heading}). Keep its architecture, light and colours.`,
    ...people.map((p) => `Image ${n.idx(p.id)}: ${n.name(p.id)}. ${strip(features[p.id])}.`),
    ...(people.length ? [`Same faces and clothes of the period as in image${people.length > 1 ? "s" : ""} ${people.map((p) => n.idx(p.id)).join(", ")}; their poses and backgrounds do not apply.`] : [])].join("\n");
  const task = !env ? `TASK\nPut this moment into image 1: the place from image 1, the people from the portraits, in the frame described below.`
    : same ? `TASK\nEdit image 1 into the next frame: same framing, same camera, same room and light. Change ONLY what is listed under CHANGES; everything else stays as in image 1.\n\nCHANGES\n${deltas(env.frame, still.frame, n)}`
    : `TASK\nMake the SAME instant as image 1, in the same room, from a new camera setup. Nobody has moved; only the camera changes.`;
  const camera = `CAMERA\n${cap(still.size)} shot, ${c.height} height. Stands ${n.named(t(c.stands))}. Looks at ${n.named(t(c.looks_at))}.${c.behind.length ? ` Behind the people: ${c.behind.map(t).join(", ")}.` : ""}`;
  const peopleBlock = `PEOPLE${same ? " AFTER THE CHANGES" : ""} (exactly ${people.length}, nobody else)\n${people.map((p) => personLine(p, n)).join("\n") || "- nobody in frame."}${props.length ? `\n\nPROPS\n${props.map((p) => propLine(p, n)).join("\n")}` : ""}`;
  const rules = `RULES\nNothing is added that is not listed. ${medium.frame} One single frame, no text or captions.`;
  const images = [env ? `env:${env.id}` : `plate:${scene.place}`, ...people.map((p) => `portrait:${p.id}`)];
  return { images, prompt: [refs, task, camera, peopleBlock, rules].join("\n\n") };
}
