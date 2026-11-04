// Captions as overlays: a transparent PNG card per caption, rendered with the system's own text engine (AppKit through
// osascript, so no font or ImageMagick dependency; the Homebrew ffmpeg has no drawtext), composited onto the film with
// ffmpeg's overlay filter for the caption's seconds. Never painted into a frame.
import { writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

const JXA = `ObjC.import('AppKit');
function run(argv) {
  const text = argv[0], out = argv[1], W = Number(argv[2]), H = Number(argv[3]), size = Number(argv[4]);
  const rep = $.NSBitmapImageRep.alloc.initWithBitmapDataPlanesPixelsWidePixelsHighBitsPerSampleSamplesPerPixelHasAlphaIsPlanarColorSpaceNameBytesPerRowBitsPerPixel(null, W, H, 8, 4, true, false, $.NSCalibratedRGBColorSpace, 0, 0);
  const ctx = $.NSGraphicsContext.graphicsContextWithBitmapImageRep(rep);
  $.NSGraphicsContext.saveGraphicsState; $.NSGraphicsContext.setCurrentContext(ctx);
  $.NSColor.clearColor.set; $.NSRectFill($.NSMakeRect(0, 0, W, H));
  const hex = argv[6] || 'ffffff', box = argv[7] !== '0', font = argv[8] || 'HelveticaNeue', align = argv[9] || 'center', mg = Number(argv[10] || 0.08);
  const col = $.NSColor.colorWithCalibratedRedGreenBlueAlpha(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255, 1);
  const ps = $.NSMutableParagraphStyle.alloc.init; ps.alignment = align === 'left' ? $.NSTextAlignmentLeft : align === 'right' ? $.NSTextAlignmentRight : $.NSTextAlignmentCenter;
  const attrs = $.NSDictionary.dictionaryWithObjectsForKeys($([($.NSFont.fontWithNameSize(font, size) || $.NSFont.fontWithNameSize('HelveticaNeue', size)), col, ps]), $([$.NSFontAttributeName, $.NSForegroundColorAttributeName, $.NSParagraphStyleAttributeName]));
  // Greedy word wrap to 80% of the width, measured with the same attributes (no wrapping call is bridged).
  const width = (s) => $(s).sizeWithAttributes(attrs).width, lines = [];
  for (const para of text.split('\\n')) { let line = ''; for (const w of para.split(' ')) { const t = line ? line + ' ' + w : w; if (line && width(t) > W * 0.8) { lines.push(line); line = w; } else line = t; } lines.push(line); }
  const str = $(lines.join('\\n')), measured = str.sizeWithAttributes(attrs), tw = Math.ceil(measured.width), th = Math.ceil(measured.height);
  const pad = Math.round(size * 0.5), bw = tw + 2 * pad, bh = th + 2 * pad, bx = align === 'left' ? Math.round(W * Math.max(mg, 0.03)) : align === 'right' ? Math.round(W * (1 - Math.max(mg, 0.03)) - bw) : Math.round((W - bw) / 2), by = argv[5] === 'top' ? H - bh - Math.round(H * mg) : argv[5] === 'middle' ? Math.round((H - bh) / 2) : Math.round(H * mg);
  if (box) { $.NSColor.colorWithCalibratedWhiteAlpha(0, 0.55).set; $.NSRectFillUsingOperation($.NSMakeRect(bx, by, bw, bh), $.NSCompositingOperationSourceOver); }
  str.drawInRectWithAttributes($.NSMakeRect(bx + pad, by + pad, tw, th), attrs);
  $.NSGraphicsContext.restoreGraphicsState;
  rep.representationUsingTypeProperties($.NSBitmapImageFileTypePNG, $.NSDictionary.dictionary).writeToFileAtomically($(out), true);
}`;

// One card: text (may hold newlines) → transparent PNG of the film's size, the text boxed near the bottom (or the top).
// color (hex, default white), box (the dark band; default on), font (a system font name), align (left | center | right)
export function captionCard(text, out, { w = 1280, h = 720, size = 30, at = "bottom", color = "ffffff", box = true, font = "HelveticaNeue", align = "center", margin = 0.08 } = {}) {
  const script = join(mkdtempSync(join(tmpdir(), "cap-")), "card.js"); writeFileSync(script, JXA);
  execFileSync("osascript", ["-l", "JavaScript", script, text, out, String(w), String(h), String(size), at, String(color).replace(/^#|^0x/i, "").padEnd(6, "f").slice(0, 6), box ? "1" : "0", font, align, String(margin)]);
  return out;
}

// Subtitles from the screenplay's lines, by code: each line from its film second for its reading time (2.5 words a second,
// at least 1.5 s), cut short by the next line or the end of its shot. [{ text, from, to }]
export function subtitlesFromScript(script) {
  const all = script.scenes.flatMap((sc) => sc.shots.flatMap((h) => h.lines.map((l) => ({ text: l.text, from: l.at, end: h.start + h.seconds })))).sort((a, b) => a.from - b.from);
  const out = all.map((l, i) => ({ text: l.text, from: l.from, to: Math.min(l.end, all[i + 1]?.from ?? Infinity, l.from + Math.max(1.5, l.text.split(/\s+/).length / 2.5 + 0.4)) }));
  for (let i = 0; i + 1 < out.length; i++) if (out[i].to <= out[i].from) { out[i + 1] = { text: `${out[i].text}\n${out[i + 1].text}`, from: out[i].from, to: out[i + 1].to }; out[i] = null; }   // the same second: one card with both lines
  return out.filter(Boolean);
}

// Composite cards onto a film for their seconds. caps: [{ file, from, to }].
export function burnCaptions(input, output, caps) {
  if (!caps.length) { execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", input, "-c", "copy", output]); return output; }
  const chain = caps.map((c, i) => `[${i + 1}]scale=1280:720,format=rgba[c${i}];[${i ? `v${i - 1}` : "0"}][c${i}]overlay=0:0:enable='between(t,${c.from},${c.to})'${i < caps.length - 1 ? `[v${i}]` : ""}`).join(";");
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", input, ...caps.flatMap((c) => ["-i", c.file]), "-filter_complex", chain, "-c:v", "libx264", "-crf", "18", "-c:a", "copy", output]);
  return output;
}
