// place: a picture (a logo, a watermark, a sticker) laid onto a picture or a clip, by code, zero credits.
// inputs: the base first, then the picture to place (transparent PNG keeps its shape). extra "corner: top-right|top-left|
// bottom-right|bottom-left|center; scale: 0.15 (of the base width); from: 0; to: 3" (seconds, clips only).
import { size } from "../lib/media.js";
import { ff, ENC, isClip, isPic, num, word } from "./video-util.js";
export const tool = {
  id: "place", group: "change-content", custom: true, credits: 0,
  takes: ["picture or clip (the base)", "picture to place (a logo)"], makes: "picture or clip", endpoint: "tools/place.js (ffmpeg)", kind: "none",
  needs: ["the base", "the logo", "where"], guarantees: ["the logo exactly as supplied", "the base untouched elsewhere", "placement"],
  explain: "lays the logo onto the picture or clip at the corner asked, the same size throughout",
  ext: (ins) => (isClip(ins[0]?.file || "") ? "mp4" : "png"),
  run({ inputs, params, out }) {
    const base = inputs[0], logo = inputs.slice(1).find((x) => isPic(x.file)); if (!base || !logo) throw new Error("place needs the base first and then the picture to place");
    const [W, H] = size(base.file), sc = num(params.extra, "scale") ?? 0.15, lw = Math.round((W * sc) / 2) * 2, m = Math.round(W * 0.03), c = word(params.extra, "corner") || "top-right";
    const x = c.endsWith("left") ? m : c === "center" ? `(W-w)/2` : `W-w-${m}`, y = c.startsWith("bottom") ? `H-h-${m}` : c === "center" ? `(H-h)/2` : m;
    const a = num(params.extra, "from"), b = num(params.extra, "to"), en = isClip(base.file) && (a != null || b != null) ? `:enable='between(t,${a ?? 0},${b ?? 9999})'` : "";
    const fc = `[1]format=rgba,scale=${lw}:-1[l];[0][l]overlay=${x}:${y}${en}`;
    if (isClip(base.file)) ff(["-i", base.file, "-i", logo.file, "-filter_complex", fc, ...ENC, "-map", "0:a?", out]); else ff(["-i", base.file, "-i", logo.file, "-filter_complex", fc, "-frames:v", "1", out]);
    return { file: out, text: `${logo.name} at ${c}, ${Math.round(sc * 100)}% wide` };
  },
};
