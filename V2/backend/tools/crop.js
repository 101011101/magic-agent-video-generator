// crop: a picture cut to an aspect, by code, zero credits. The image model cannot crop (it returns the same picture);
// this tool can. params: aspect (4:5, 1:1, 16:9, 9:16, 3:2, 2:3) from params.aspect or extra "aspect: 4:5";
// anchor (center | top | bottom | left | right) from extra "anchor: top"; or an explicit box "x,y,w,h" in extra.
import { execFileSync } from "node:child_process";
import { size as imageSize } from "../lib/media.js";
import { ff, ENC, isClip } from "./video-util.js";

export const tool = {
  id: "crop", group: "change-form", custom: true, credits: 0,
  takes: ["picture or clip"], makes: "picture or clip", endpoint: "tools/crop.js (ffmpeg)", kind: "none",
  needs: ["picture", "aspect"], guarantees: ["the exact aspect", "nothing regenerated", "placement"],
  explain: "cuts the picture to the aspect asked, keeping every pixel it keeps exactly as it was",
  ext: (ins) => (ins.some((x) => isClip(x.file)) ? "mp4" : "png"),
  run({ inputs, params, out }) {
    const pic = inputs.find((x) => /\.(png|jpe?g|webp)$/i.test(x.file) || isClip(x.file)); if (!pic) throw new Error("crop needs a picture or a clip");
    const extra = params.extra || ""; const [W, H] = imageSize(pic.file);
    // fit: contain: the whole picture or clip kept, fitted inside the new size, a blurred copy of it filling the rest (a story
    // from a portrait that must keep all the hair and shoulders; plain cropping cut them off)
    if (/fit:\s*contain|blur(red)? (copy|background)|without cropping|contain the/i.test(extra) && params.aspect) {
      const [a, b] = params.aspect.split(":").map(Number), r = a / b, clip = isClip(pic.file);
      let w = clip ? (r < 1 ? 720 : Math.round(720 * r)) : Math.max(W, Math.round(H * r)), h = Math.round(w / r); if (!clip && h < H) { h = H; w = Math.round(H * r); } w -= w % 2; h -= h % 2;
      // the space around it: a blurred copy, or ("plain", "solid", "matching background") the colour of the picture's border
      const plain = /plain|solid|matching (background|colou?r)|no blur/i.test(`${extra} ${params.prompt_or_change || ""}`);
      const edge = plain ? `0x${[...execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", pic.file, "-vf", "crop=iw:6:0:0,scale=1:1", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]).subarray(0, 3)].map((x) => x.toString(16).padStart(2, "0")).join("")}` : null;
      const g = plain ? `[0:v]scale=${w}:${h}:force_original_aspect_ratio=decrease,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=${edge}` : `[0:v]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},boxblur=20:2[bg];[0:v]scale=${w}:${h}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2`;
      if (clip) ff(["-i", pic.file, "-filter_complex", g, ...ENC, "-map", "0:a?", out]);
      else execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", pic.file, "-filter_complex", g, "-frames:v", "1", out]);
      return { file: out, fit: "contain", size: [w, h] };
    }
    const box = extra.match(/box:\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    let x, y, w, h;
    if (box) [x, y, w, h] = box.slice(1).map(Number);
    else {
      const asp = (params.aspect || extra.match(/aspect:\s*(\d+:\d+)/i)?.[1] || "1:1").split(":").map(Number); const r = asp[0] / asp[1];
      if (W / H > r) { h = H; w = Math.round(H * r); } else { w = W; h = Math.round(W / r); }
      const zoom = Math.max(1, Number((extra.match(/zoom:\s*([\d.]+)/i) || [])[1] || 1)); w = Math.round(w / zoom); h = Math.round(h / zoom);   // a close-up: zoom 2 is half the width, around the anchor
      const anchor = (extra.match(/anchor:\s*(center|top|bottom|left|right)/i)?.[1] || "center").toLowerCase();
      x = anchor === "left" ? 0 : anchor === "right" ? W - w : Math.round((W - w) / 2); y = anchor === "top" ? 0 : anchor === "bottom" ? H - h : Math.round((H - h) / 2);
    }
    w -= w % 2; h -= h % 2;
    if (isClip(pic.file)) ff(["-i", pic.file, "-vf", `crop=${w}:${h}:${x}:${y},scale=${w < h ? 720 : -2}:${w < h ? -2 : 720}:flags=lanczos`, ...ENC, "-map", "0:v", "-map", "0:a?", out]);   // reframe a clip (16:9 to 9:16)
    else execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", pic.file, "-vf", `crop=${w}:${h}:${x}:${y}`, "-frames:v", "1", out]);
    return { file: out, box: { x, y, w, h } };
  },
};
