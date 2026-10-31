// crop: a picture cut to an aspect, by code, zero credits. The image model cannot crop (it returns the same picture);
// this tool can. params: aspect (4:5, 1:1, 16:9, 9:16, 3:2, 2:3) from params.aspect or extra "aspect: 4:5";
// anchor (center | top | bottom | left | right) from extra "anchor: top"; or an explicit box "x,y,w,h" in extra.
import { execFileSync } from "node:child_process";
import { size as imageSize } from "../lib/media.js";

export const tool = {
  id: "crop", group: "change-form", custom: true, credits: 0,
  takes: ["picture"], makes: "picture", endpoint: "tools/crop.js (ffmpeg)", kind: "none",
  needs: ["picture", "aspect"], guarantees: ["the exact aspect", "nothing regenerated", "placement"],
  explain: "cuts the picture to the aspect asked, keeping every pixel it keeps exactly as it was",
  run({ inputs, params, out }) {
    const pic = inputs.find((x) => /\.(png|jpe?g|webp)$/i.test(x.file)); if (!pic) throw new Error("crop needs a picture");
    const extra = params.extra || ""; const [W, H] = imageSize(pic.file);
    const box = extra.match(/box:\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
    let x, y, w, h;
    if (box) [x, y, w, h] = box.slice(1).map(Number);
    else {
      const asp = (params.aspect || extra.match(/aspect:\s*(\d+:\d+)/i)?.[1] || "1:1").split(":").map(Number); const r = asp[0] / asp[1];
      if (W / H > r) { h = H; w = Math.round(H * r); } else { w = W; h = Math.round(W / r); }
      const anchor = (extra.match(/anchor:\s*(center|top|bottom|left|right)/i)?.[1] || "center").toLowerCase();
      x = anchor === "left" ? 0 : anchor === "right" ? W - w : Math.round((W - w) / 2); y = anchor === "top" ? 0 : anchor === "bottom" ? H - h : Math.round((H - h) / 2);
    }
    w -= w % 2; h -= h % 2;
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", pic.file, "-vf", `crop=${w}:${h}:${x}:${y}`, "-frames:v", "1", out]);
    return { file: out, box: { x, y, w, h } };
  },
};
