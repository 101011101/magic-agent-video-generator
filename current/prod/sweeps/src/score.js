// Scoring, kept in its own phase because it needs ffmpeg and generation does not: visionCallImages() pipes every image
// through toJpg(), which shells out to ffmpeg. Paid frames are therefore written to disk and scored separately, so a
// scoring failure — or a machine without ffmpeg — never loses work that was paid for.
// Uses the pipelines' own visionCallImages so a verdict here is comparable with a verdict there (same model, same cache).
import { visionCallImages } from "../../pipeline-v2/src/vision.js";

const bool = { type: "boolean" }, str = { type: "string" };
const schema = (extra = {}) => ({ type: "object", additionalProperties: false,
  required: ["pass", "observed", "problem", ...Object.keys(extra)],
  properties: { pass: bool, observed: str, problem: str, ...extra } });

// One judgement per criterion. Each asks for the observation before the verdict, so "pass" has something to rest on, and
// each is phrased to be answerable from the frame alone — no reference image, since every arm drew its own.
const JUDGES = {
  scale: { name: "sweepscale", schema: schema({ relative_size: str }),
    text: `This image should show a woman's open palm holding a single ivory spiral seashell that is 7 cm long and fits easily within the cupped palm — smaller than her hand.
relative_size: how big the shell is compared with the hand (a few words).
pass = true only if the shell is within twice and at least half the size it would really be against that hand. A shell as large as or larger than the whole hand is a fail.
observed: what the frame actually shows. problem: the fault in a few words, or "".` },

  text: { name: "sweeptext", schema: schema({ glyphs_seen: str }),
    text: `This image should contain NO text of any kind: no signage, lettering, numbers, logos or brand marks on any surface.
glyphs_seen: quote any readable text you can see, or "none".
pass = true only if there is no readable glyph, letter, digit or logo anywhere in the frame. Shapes that only suggest writing without being readable do not count as a fail; anything legible does.
observed: what the frame shows. problem: the fault in a few words, or "".` },

  count: { name: "sweepcount", schema: schema({ boats: { type: "integer" } }),
    text: `This image should show exactly three identical small wooden fishing boats moored side by side at a harbour wall.
boats: how many boats are in the frame.
pass = true only if there are exactly three. Two or four is a fail.
observed: what the frame shows. problem: the fault in a few words, or "".` },

  // The only two-image judgement: image 1 is the edit, image 2 the source it was made from.
  edit: { name: "sweepedit", schema: schema({ identity_kept: bool, place_kept: bool }),
    text: `Image 1 is an edit of image 2. The edit was asked to change ONLY the time of day to dusk, keeping the person identical (face, hair, clothing, pose, position) and every fixed part of the place identical in shape and position.
identity_kept: is the person in image 1 recognisably the same person as in image 2.
place_kept: are the building, landscape and fixed objects unchanged in shape and position.
pass = true only if both are true. A changed face, a moved building or a redrawn coastline is a fail, even if the light is correct.
observed: what changed between the two images. problem: the fault in a few words, or "".` },
};

// arm: { id, kind, file, source? }. Returns the judge's verdict, or an error record — a scoring failure is never fatal.
export async function score(arm, dir) {
  const j = JUDGES[arm.kind];
  if (!j) return { pass: null, error: `no judge for ${arm.kind}` };
  const images = arm.kind === "edit" ? [`${dir}/${arm.file}`, `${dir}/${arm.source}`] : [`${dir}/${arm.file}`];
  try { return await visionCallImages(j.name, j.schema, j.text, images); }
  catch (e) { return { pass: null, error: String(e.message).slice(0, 300) }; }
}

export const CRITERIA = Object.fromEntries(Object.entries(JUDGES).map(([k, v]) => [k, v.text.split("\n")[0]]));
