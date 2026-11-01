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
import { ff, ENC, isClip, num } from "./video-util.js";

export const tool = {
  id: "text-overlay", group: "change-content", custom: true, credits: 0,
  takes: ["picture or clip"], makes: "picture or clip", endpoint: "tools/text-overlay.js", kind: "none",
  needs: ["picture", "text"],
  guarantees: ["legible text", "exact words", "placement"],
  explain: "renders the words by code onto the picture; an image model is never asked to spell",
  ext: (ins) => (ins.some((x) => isClip(x.file)) ? "mp4" : "png"),
  // run({ inputs: [{name, file (absolute)}], params, out (absolute .png) }) → { file: out }
  run({ inputs, params, out }) {
    const pic = inputs.find((x) => /\.(png|jpe?g|webp)$/i.test(x.file) || isClip(x.file)); if (!pic) throw new Error("text-overlay needs a picture or a clip");
    const text = (params.text || params.prompt_or_change || "").trim(); if (!text) throw new Error("text-overlay needs the text");
    const [W, H] = imageSize(pic.file); const at = ["top", "middle", "bottom"].includes(params.at) ? params.at : "bottom";
    const size = Number(params.size) || Math.max(18, Math.round(Math.min(W, H) / (text.length > 40 ? 16 : 12)));   // sized to the short side, smaller for long text, so it never covers the picture
    const card = join(mkdtempSync(join(tmpdir(), "ovl-")), "card.png"); captionCard(text, card, { w: W, h: H, size, at });
    // on a clip: the words for its whole length, or extra "from: 0; to: 3" seconds
    if (isClip(pic.file)) { const a = num(params.extra, "from"), b = num(params.extra, "to"); ff(["-i", pic.file, "-i", card, "-filter_complex", `[1]format=rgba[c];[0][c]overlay=0:0${a != null || b != null ? `:enable='between(t,${a ?? 0},${b ?? 9999})'` : ""}`, ...ENC, "-map", "0:a?", out]); return { file: out }; }
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", pic.file, "-i", card, "-filter_complex", "[1]format=rgba[c];[0][c]overlay=0:0", "-frames:v", "1", out]);
    return { file: out };
  },
};
