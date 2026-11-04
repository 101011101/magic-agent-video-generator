// filter: a whole-picture (or clip) look by code, zero credits, every pixel's content kept: black and white, sepia,
// warmer, cooler, brighter, darker, more contrast. A generative edit asked for "black and white" redrew the picture.
// extra "look: bw|sepia|warm|cool|bright|dark|contrast|transparent" (several with commas), "amount: 0.5". "transparent"
// keys out the plain background colour of a flat design (a logo on white) into a PNG with alpha: the AI background remover
// erased a logo's lettering along with its background.
import { execFileSync } from "node:child_process";
import { ff, ENC, isClip, isPic, num } from "./video-util.js";
const LOOK = (a) => ({ bw: "hue=s=0", sepia: "colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131", warm: `colorbalance=rs=${0.15 * a}:bs=${-0.15 * a}:rm=${0.1 * a}:bm=${-0.1 * a}`, cool: `colorbalance=rs=${-0.15 * a}:bs=${0.15 * a}:rm=${-0.1 * a}:bm=${0.1 * a}`, bright: `eq=brightness=${0.12 * a}`, transparent: "colorkey", dark: `eq=brightness=${-0.12 * a}`, contrast: `eq=contrast=${1 + 0.4 * a}` });
export const tool = {
  id: "filter", group: "change-form", custom: true, credits: 0,
  takes: ["picture or clip"], makes: "picture or clip", endpoint: "tools/filter.js (ffmpeg)", kind: "none",
  needs: ["picture or clip", "look"], guarantees: ["the content unchanged: only colour and tone", "exact black and white or sepia"],
  explain: "changes the whole picture's colour or tone (black and white, sepia, warmer, cooler, brighter) without redrawing anything",
  ext: (ins = []) => (ins.some((x) => isClip(x.file)) ? "mp4" : "png"),
  run({ inputs, params, out }) {
    const src = inputs.find((x) => isPic(x.file) || isClip(x.file)); if (!src) throw new Error("filter needs a picture or a clip");
    const text = `${params.extra || ""} ${params.prompt_or_change || ""}`.toLowerCase(), a = Math.max(0.1, Math.min(2, num(params.extra, "amount") ?? 1));
    const want = (text.match(/look:\s*([\w, |]+)/)?.[1] || text).split(/[,| ]+/).map((w) => ({ "black-and-white": "bw", monochrome: "bw", greyscale: "bw", grayscale: "bw", warmer: "warm", cooler: "cool", brighter: "bright", darker: "dark" }[w] || w)).filter((w) => LOOK(1)[w]);
    if (!want.length && /black and white|b&w|monochrome|gr[ae]yscale/.test(text)) want.push("bw");
    if (!want.length) throw new Error("filter needs a look: bw, sepia, warm, cool, bright, dark or contrast");
    if (want.includes("transparent")) {   // the border's colour becomes transparent, edges softened
      const edge = `0x${[...execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", src.file, "-vf", "crop=iw:4:0:0,scale=1:1", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]).subarray(0, 3)].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
      // a colour key for the opacity, then each edge pixel's colour un-mixed from the ground (c = ground + (c - ground) / alpha),
      // so anti-aliased letter edges keep the ink's colour instead of a pale fringe on a dark page
      const [R, G, B] = [1, 3, 5].map((k) => parseInt(edge.slice(k + 1, k + 3), 16)), un = (c, v) => `if(gte(alpha(X,Y),250),${c}(X,Y),clip(${v}+(${c}(X,Y)-${v})*255/max(alpha(X,Y),12),0,255))`;
      execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", src.file, "-vf", `format=rgba,colorkey=${edge}:0.14:0.12,geq=r='${un("r", R)}':g='${un("g", G)}':b='${un("b", B)}':a='alpha(X,Y)'`, "-frames:v", "1", out.replace(/\.[a-z0-9]+$/i, ".png")]);
      return { file: out.replace(/\.[a-z0-9]+$/i, ".png"), text: `background ${edge} made transparent` };
    }
    const vf = [...new Set(want)].map((w) => LOOK(a)[w]).join(",");
    if (isClip(src.file)) ff(["-i", src.file, "-vf", vf, ...ENC, "-map", "0:v", "-map", "0:a?", out]);
    else execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", src.file, "-vf", vf, "-frames:v", "1", out]);
    return { file: out, text: `${[...new Set(want)].join(" + ")}` };
  },
};
