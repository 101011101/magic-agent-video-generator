// frame: one still from a clip, by code, zero credits: a thumbnail's starting picture, a reference frame.
// extra "at: 3.5" (seconds) or "at: start|middle|end"; the default is the middle.
import { duration } from "../lib/media.js";
import { ff, isClip, num, word } from "./video-util.js";
export const tool = {
  id: "frame", group: "change-form", custom: true, credits: 0,
  takes: ["clip"], makes: "picture", endpoint: "tools/frame.js (ffmpeg)", kind: "none",
  needs: ["clip", "when"], guarantees: ["a real frame of the clip, unchanged"],
  explain: "takes the picture at the moment asked out of the clip",
  ext: () => "png",
  run({ inputs, params, out }) {
    const c = inputs.find((x) => isClip(x.file)); if (!c) throw new Error("frame needs a clip");
    const L = duration(c.file), w = word(params.extra, "at"), at = num(params.extra, "at") ?? (w === "start" ? 0.2 : w === "end" ? L - 0.2 : L / 2);
    ff(["-ss", String(Math.max(0, Math.min(L - 0.05, at))), "-i", c.file, "-frames:v", "1", out]);
    return { file: out, text: `the frame at ${Math.round(at * 10) / 10} s` };
  },
};
