// text-overlay: words on a picture, rendered by code, zero credits. The one thing an image model cannot promise is
// legible, exact text; this tool promises it. The card is drawn with the system text engine (the same renderer as the
// film's caption cards) at the picture's own size and composited with ffmpeg. params: text (required), at (top | middle
// | bottom), size (px; default from the picture's width), box (true draws the translucent box behind the words).
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { captionCard } from "../lib/captions.js";
import { size as imageSize } from "../lib/media.js";

export const tool = {
  id: "text-overlay", group: "change-content", custom: true, credits: 0,
  takes: ["picture"], makes: "picture", endpoint: "tools/text-overlay.js", kind: "none",
  needs: ["picture", "text"],
  guarantees: ["legible text", "exact words", "placement"],
  explain: "renders the words by code onto the picture; an image model is never asked to spell",
  // run({ inputs: [{name, file (absolute)}], params, out (absolute .png) }) → { file: out }
  run({ inputs, params, out }) {
    const pic = inputs.find((x) => /\.(png|jpe?g|webp)$/i.test(x.file)); if (!pic) throw new Error("text-overlay needs a picture");
    const text = (params.text || params.prompt_or_change || "").trim(); if (!text) throw new Error("text-overlay needs the text");
    const [W, H] = imageSize(pic.file); const at = ["top", "middle", "bottom"].includes(params.at) ? params.at : "bottom";
    const size = Number(params.size) || Math.round(W / 11);
    const card = join(mkdtempSync(join(tmpdir(), "ovl-")), "card.png"); captionCard(text, card, { w: W, h: H, size, at });
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", pic.file, "-i", card, "-filter_complex", "[1]format=rgba[c];[0][c]overlay=0:0", "-frames:v", "1", out]);
    return { file: out };
  },
};
