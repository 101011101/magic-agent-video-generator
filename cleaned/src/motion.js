// V2 Motion director: one vision call per clip. Sees the start frame (and the end frame when connected) and writes a
// motion-only prompt: what moves and how. The frames already hold the look; the prompt must not re-describe it.
import { jsonCall, S } from "./llm.js";

const SCHEMA = S.obj({ prompt: S.str, camera: S.enum(["static", "slow push in", "slow pull out", "slow pan left", "slow pan right"]), risk: S.str });

export async function direct(slide, nextSlide, { start, end, seconds }) {
  const prompt = `You direct one ${seconds}-second animated clip of an illustrated story.
Image 1 is the clip's FIRST frame.${end ? " Image 2 is its LAST frame: the clip must move from image 1 to image 2." : " There is no fixed last frame."}
Story beat: ${slide.caption} (${slide.shows})${end ? `\nWhat the last frame shows: ${nextSlide.caption} (${nextSlide.shows})` : ""}
Write the motion prompt for an image-to-video model:
- Describe only MOTION: who moves, which way, how fast, small secondary motion (hair, steam, cloth). Present tense, 1-3 sentences.
- Do not describe looks, colours, the room or the style; the frames carry them. Do not add people, animals or objects that are not in image 1${end ? " or image 2" : ""}.
- ${end ? "Every change between image 1 and image 2 must happen on screen, in a plausible order." : "Keep the action small enough to finish in the clip; end on a calm pose."}
camera: the camera move (prefer static; the scene was framed for it). risk: one short phrase on what could go wrong, or "".`;
  return jsonCall({ name: "motion", schema: SCHEMA, prompt, images: end ? [start, end] : [start], effort: "low" });
}
