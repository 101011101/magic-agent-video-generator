// trim: part of a clip, by code, zero credits. extra "from: 2; to: 12" (seconds); or params.seconds from the start.
import { duration } from "../lib/media.js";
import { ff, ENC, isClip, num } from "./video-util.js";
export const tool = {
  id: "trim", group: "change-form", custom: true, credits: 0,
  takes: ["clip"], makes: "clip", endpoint: "tools/trim.js (ffmpeg)", kind: "none",
  needs: ["clip", "from and to, in seconds"], guarantees: ["the exact range", "nothing regenerated"],
  explain: "cuts the clip to the seconds asked; the pictures and sound inside are untouched",
  ext: () => "mp4",
  run({ inputs, params, out }) {
    const c = inputs.find((x) => isClip(x.file)); if (!c) throw new Error("trim needs a clip");
    const rg = String(params.extra || "").match(/^\s*(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*s?\s*$/);   // "0-5" too, not only "from: 0; to: 5" (it was silently ignored)
    const L = duration(c.file), from = Math.max(0, num(params.extra, "from") ?? (rg ? Number(rg[1]) : 0)), to = Math.min(L, num(params.extra, "to") ?? (rg ? Number(rg[2]) : Number(params.seconds) ? from + Number(params.seconds) : L));
    if (to - from < 0.3) throw new Error(`trim range ${from}-${to} is empty (clip is ${L.toFixed(1)} s)`);
    ff(["-ss", String(from), "-i", c.file, "-t", String(to - from), ...ENC, out]);
    return { file: out, text: `${from}-${Math.round(to * 10) / 10} s of ${Math.round(L * 10) / 10} s` };
  },
};
