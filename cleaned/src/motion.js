// V2 Motion director: one vision call per clip. Sees the start frame (and the end frame when connected) and writes a
// motion-only prompt: what moves and how. The frames already hold the look; the prompt must not re-describe it.
// Plans with a step script (ste) get the step's own text as the action; older plans keep their original prompt byte for byte,
// so their recorded clips stay cached.
import { jsonCall, S } from "./llm.js";

const SCHEMA = S.obj({ prompt: S.str, camera: S.enum(["static", "slow push in", "slow pull out", "slow pan left", "slow pan right"]), risk: S.str });

function legacy(slide, nextSlide, end, seconds) {
  return `You direct one ${seconds}-second animated clip of an illustrated story.
Image 1 is the clip's FIRST frame.${end ? " Image 2 is its LAST frame: the clip must move from image 1 to image 2." : " There is no fixed last frame."}
Story beat: ${slide.caption} (${slide.shows})${end ? `\nWhat the last frame shows: ${nextSlide.caption} (${nextSlide.shows})` : ""}
Write the motion prompt for an image-to-video model:
- Describe only MOTION: who moves, which way, how fast, small secondary motion (hair, steam, cloth). Present tense, 1-3 sentences.
- Do not describe looks, colours, the room or the style; the frames carry them. Do not add people, animals or objects that are not in image 1${end ? " or image 2" : ""}.
- ${end ? "Every change between image 1 and image 2 must happen on screen, in a plausible order." : "Keep the action small enough to finish in the clip; end on a calm pose."}
camera: the camera move (prefer static; the scene was framed for it). risk: one short phrase on what could go wrong, or "".`;
}

function scripted(slide, nextSlide, end, seconds) {
  return `You direct one ${seconds}-second animated clip of an illustrated story.
Image 1 is the clip's FIRST frame.${end ? " Image 2 is its LAST frame: the clip must move from image 1 to image 2." : " There is no fixed last frame."}
The first frame shows (step script): ${slide.shows}
${end ? `The action from image 1 to image 2 (step script; follow it exactly, including the path): ${nextSlide.ste.join(" ")}\nThe last frame shows: ${nextSlide.shows}` : `The action in this clip: small continuation of "${slide.ste.join(" ")}" — hold the same feeling; nothing new happens.`}
Write the motion prompt for an image-to-video model:
- Describe only MOTION and ACTING: who moves, which way and by which path (around items, never through them), how fast, the
  expression and body as given, small secondary motion (hair, steam, cloth). Present tense, 1-3 sentences, one main action.
- Do not describe looks, colours, the room or the style; the frames carry them. Do not add people, animals or objects that are not in image 1${end ? " or image 2" : ""}.
- Name what must NOT change (e.g. "the fireplace stays cold and dark", "the door stays closed") when the frame has such items.
- ${end ? "Every change between image 1 and image 2 must happen on screen, in a plausible order." : "Keep the action small enough to finish in the clip; end on a pose that matches the feeling."}
camera: the camera move (prefer static; the scene was framed for it). risk: one short phrase on what could go wrong, or "".`;
}

export async function direct(slide, nextSlide, { start, end, seconds }) {
  const prompt = slide.ste ? scripted(slide, nextSlide, end, seconds) : legacy(slide, nextSlide, end, seconds);
  return jsonCall({ name: "motion", schema: SCHEMA, prompt, images: end ? [start, end] : [start], effort: "low" });
}
