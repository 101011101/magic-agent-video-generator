// text-overlay: words on a picture, rendered by code, zero credits. The one thing an image model cannot promise is
// legible, exact text; this tool promises it. The card is drawn with the system text engine (the same renderer as the
// film's caption cards) at the picture's own size and composited with ffmpeg. params: text (required), at (top | middle
// | bottom), size (px; default from the picture's width); in params.extra: "color: #1a1a1a", "box: none" (no dark band:
// the words sit on the design in its own colour), "font: serif | sans | mono | <a system font>", "align: left|center|right",
// "size: 22". Every setting it does not know is reported in the note, never silently dropped.
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { captionCard } from "../lib/captions.js";
import { size as imageSize } from "../lib/media.js";
import { ff, ENC, isClip, num, word } from "./video-util.js";

export const tool = {
  id: "text-overlay", group: "change-content", custom: true, credits: 0,
  takes: ["picture or clip"], makes: "picture or clip", endpoint: "tools/text-overlay.js", kind: "none",
  needs: ["picture", "text"],
  guarantees: ["exact words, any length, letter for letter", "colour, font family, alignment, size, top/middle/bottom, with or without a band", "placement and timing on a clip"],
  explain: "renders the words by code onto the picture; an image model is never asked to spell",
  ext: (ins) => (ins.some((x) => isClip(x.file)) ? "mp4" : "png"),
  // run({ inputs: [{name, file (absolute)}], params, out (absolute .png) }) → { file: out }
  run({ inputs, params, out }) {
    const pic = inputs.find((x) => /\.(png|jpe?g|webp)$/i.test(x.file) || isClip(x.file)); if (!pic) throw new Error("text-overlay needs a picture or a clip");
    const text = (params.text || params.prompt_or_change || "").trim(); if (!text) throw new Error("text-overlay needs the text");
    const [W, H] = imageSize(pic.file), ex = params.extra || "";
    const pos = ex.match(/(?:position:\s*)?\b(top|middle|bottom)[- ](left|center|centre|right)\b/i);
    const at = ["top", "middle", "bottom"].includes(params.at) ? params.at : pos ? pos[1].toLowerCase() : "bottom";
    // a watermark or handle: small, bottom right, no band, a little see-through, unless the settings say otherwise
    const mark = /watermark|\bhandle\b|subtl|discreet|corner/i.test(`${ex} ${params.prompt_or_change || ""}`);
    let size = Number(params.size) || Math.max(18, Math.round(Math.min(W, H) / (text.length > 40 ? 16 : 12)));   // sized to the short side, smaller for long text
    if (mark) size = Math.max(14, Math.round(Math.min(W, H) / 26));
    if (/\bsmall\b/i.test(ex)) size = Math.round(size * 0.7);
    const color = (ex.match(/colou?r:\s*#?([0-9a-f]{6})/i)?.[1] || "ffffff").toLowerCase(), box = !mark && (/box:\s*(yes|on|true|dark|backing|band)|dark (backing|band|box)/i.test(ex) || (!/box:\s*(none|no|off|false)|no (box|band|backing)/i.test(ex) && color === "ffffff"));
    const fam = word(ex, "font"), font = { serif: "Georgia", sans: "HelveticaNeue", mono: "Menlo", bold: "HelveticaNeue-Bold" }[fam] || (fam ? ex.match(/font:\s*([\w -]+?)(;|$)/i)[1].trim() : "HelveticaNeue");
    const align = word(ex, "align") || (pos ? pos[2].toLowerCase().replace("centre", "center") : mark ? "right" : "center");
    const opacity = num(ex, "opacity") ?? (mark ? 0.75 : 1);
    let sz = num(ex, "size") || size;
    // a line with no spaces (a URL) cannot wrap: the size comes down until it fits 90% of the width (D23c's URL ran off both sides)
    const longest = Math.max(...text.split(/\s+/).map((w) => w.length)); sz = Math.min(sz, Math.floor((0.9 * W) / (0.56 * longest)));
    const unknown = ex.split(/;|\n/).map((x) => x.trim()).filter((x) => x && !/^(at|colou?r|box|font|align|size|from|to|position|opacity|windows?)\s*:/i.test(x) && !/keep clear|not over|away from|safe margins?|readable|legible|plain font|small|subtle|watermark|throughout|exact/i.test(x) && /^[a-z -]+:/i.test(x));
    const dir = mkdtempSync(join(tmpdir(), "ovl-")), cardOf = (t, k) => { const f = join(dir, `card${k}.png`); captionCard(t, f, { w: W, h: H, size: sz, at, color, box, font, align, margin: mark ? 0.025 : 0.08 }); return f; };
    const fadeA = opacity < 1 ? `,colorchannelmixer=aa=${opacity}` : "";
    const note = unknown.length ? `ignored: ${unknown.join("; ")}` : undefined;
    if (isClip(pic.file)) {
      // several lines with as many time windows ("0-5 s, 5-10 s, 10-15 s"): one card per line in its own window (H40c stacked
      // three captions at once); otherwise the words for the whole clip, or extra "from: 0; to: 3"
      const lines = text.split(/\n+/).map((x) => x.trim()).filter(Boolean), wins = [...ex.matchAll(/(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*s?\b/gi)].map((m) => [Number(m[1]), Number(m[2])]);
      const cards = lines.length > 1 && wins.length === lines.length ? lines.map((t, k) => ({ f: cardOf(t, k), a: wins[k][0], b: wins[k][1] })) : [{ f: cardOf(text, 0), a: num(ex, "from"), b: num(ex, "to") }];
      const chain = cards.map((c, k) => `[${k + 1}]format=rgba${fadeA}[c${k}];[${k ? `v${k - 1}` : "0"}][c${k}]overlay=0:0${c.a != null || c.b != null ? `:enable='between(t,${c.a ?? 0},${c.b ?? 9999})'` : ""}${k < cards.length - 1 ? `[v${k}]` : ""}`).join(";");
      ff(["-i", pic.file, ...cards.flatMap((c) => ["-i", c.f]), "-filter_complex", chain, ...ENC, "-map", "0:a?", out]);
      return { file: out, text: [cards.length > 1 ? `${cards.length} cards in their windows` : null, note].filter(Boolean).join(" · ") || undefined };
    }
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", pic.file, "-i", cardOf(text, 0), "-filter_complex", `[1]format=rgba${fadeA}[c];[0][c]overlay=0:0`, "-frames:v", "1", out]);
    return { file: out, text: note };
  },
};
