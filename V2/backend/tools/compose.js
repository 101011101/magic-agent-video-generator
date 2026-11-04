// compose: several pictures into one, by code, zero credits: side by side, a before/after, a grid. Every picture is kept
// as it is (scaled to fit its panel on a neutral ground, never redrawn: an image-edit before/after regenerated the
// "before" and lost the room's fixtures); labels go on top of each panel. params.aspect (default 16:9 for two, 1:1 for a
// grid); extra "labels: Before | After", "layout: row|column|grid", "gap: 8", "ground: #f2f0eb".
import { join } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { ff, FRAME, isPic, word } from "./video-util.js";
import { tool as overlay } from "./text-overlay.js";
export const tool = {
  id: "compose", group: "change-form", custom: true, credits: 0,
  takes: ["two or more pictures, in order"], makes: "picture", endpoint: "tools/compose.js (ffmpeg)", kind: "none",
  needs: ["the pictures in order", "aspect"], guarantees: ["every picture kept exactly as it is (scaled, never redrawn)", "the exact order and labels"],
  explain: "puts the pictures side by side or in a grid, each kept exactly as it is, with a label on each",
  ext: () => "png",
  run({ inputs, params, out }) {
    const pics = inputs.filter((x) => isPic(x.file)); if (pics.length < 2) throw new Error("compose needs two or more pictures");
    const extra = params.extra || "", n = pics.length, layout = word(extra, "layout") || (n === 2 ? "row" : n <= 3 ? "row" : "grid");
    const cols = layout === "column" ? 1 : layout === "grid" ? Math.ceil(Math.sqrt(n)) : n, rows = Math.ceil(n / cols);
    const [W, H] = FRAME[params.aspect] || (n === 2 || layout === "row" ? FRAME["16:9"] : FRAME["1:1"]), gap = Number((extra.match(/gap:\s*(\d+)/) || [])[1] ?? 8);
    const ground = ((extra.match(/ground:\s*#?([0-9a-f]{6})/i) || [])[1] || "f2f0eb"), pw = Math.floor((W - gap * (cols + 1)) / cols), ph = Math.floor((H - gap * (rows + 1)) / rows);
    const listed = extra.match(/labels:\s*([^;]+)/i)?.[1] || "";
    let labels = listed.split(listed.includes("|") ? "|" : ",").map((x) => x.trim().replace(/^["“]|["”]$/g, "")).filter(Boolean);   // "Before | After" or "Before, After"
    if (labels.length && labels.length !== n) labels = [];
    if (!labels.length) { const q = [...`${params.prompt_or_change || ""} ${extra}`.matchAll(/"([^"]+)"|“([^”]+)”/g)].map((m) => (m[1] ?? m[2]).trim()); const uniq = [...new Set(q)]; if (uniq.length === n) labels = uniq; }   // "labeled “Before” and “After”" in the prompt
    const tmp = mkdtempSync(join(tmpdir(), "compose-"));
    const panels = pics.map((p, k) => { const f = join(tmp, `p${k}.png`); ff(["-i", p.file, "-vf", `scale=${pw}:${ph}:force_original_aspect_ratio=decrease,pad=${pw}:${ph}:(ow-iw)/2:(oh-ih)/2:color=0x${ground}`, "-frames:v", "1", f]);
      if (labels[k]) { const g = join(tmp, `l${k}.png`); overlay.run({ inputs: [{ name: "panel", file: f }], params: { text: labels[k], at: "top", size: Math.max(16, Math.round(Math.min(pw, ph) / 14)) }, out: g }); return g; } return f; });
    const lay = panels.map((_, k) => `${gap + (k % cols) * (pw + gap)}_${gap + Math.floor(k / cols) * (ph + gap)}`).join("|");
    ff([...panels.flatMap((f) => ["-i", f]), "-f", "lavfi", "-i", `color=c=0x${ground}:s=${W}x${H}`, "-filter_complex", `${panels.map((_, k) => `[${k}:v]`).join("")}xstack=inputs=${n}:layout=${lay}:fill=0x${ground}[g];[${n}:v][g]overlay=0:0:shortest=1`, "-frames:v", "1", out]);
    return { file: out, text: `${n} pictures, ${layout}, ${W}x${H}${labels.length ? `, labelled ${labels.join(" / ")}` : ""}` };
  },
};
