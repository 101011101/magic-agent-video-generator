// Scene grid: one image call per scene draws all of the scene's panels as cells of one storyboard grid (consistency inside one
// image is far better than a chain of edits). Image 1 = the scene's base (its environment's plate, or the latest frame there);
// then one reference per element entering the scene (its latest frame, else its sheet). Code crops the cells, checks each one,
// and records each cell as a frame in the state table. Grid layouts keep 16:9 cells: 1 → 1×1, ≤4 → 2×2, ≤9 → 3×3.
import { execFileSync } from "node:child_process";
import { jsonCall, S } from "./llm.js";

export const layout = (n) => (n <= 1 ? [1, 1] : n <= 4 ? [2, 2] : [3, 3]);

export function gridPrompt({ scene, panels, env, style, refs, name }) {
  const [rows, cols] = layout(panels.length);
  const refLines = refs.map((r, i) => `${name(r.id)}: ${r.from === "sheet" ? `the same ${r.kind === "character" ? "person" : "object"} as image ${i + 2} (same face, hair, clothes and colours; its pose and plain background do not apply)` : `exactly as ${r.kind === "character" ? "they look" : "it looks"} in image ${i + 2} (take only ${name(r.id)} from it)`}`);
  const cells = panels.map((p, i) => {
    const enters = p.enters.map((e) => `${name(e.id)} ${e.where}${e.doing ? `, ${e.doing}` : ""}`).join("; ");
    const changes = p.changes.map((c) => `${name(c.id)}: ${c.now}`).join("; ");
    return `${i + 1}. ${p.action}${enters ? ` [${enters}]` : ""}${changes ? ` (${changes})` : ""}${p.leaves.length ? ` (${p.leaves.map(name).join(", ")} no longer in the picture)` : ""}`;
  });
  return `One image that is a storyboard GRID of ${panels.length} panels in ${rows} rows × ${cols} columns, all cells the same size, filling the
image edge to edge with no gutters, borders, numbers or text. Every cell is the same place from the same camera as image 1
(${env}), with the same light and colours. The cells are consecutive moments of one continuous scene, in reading order
(left to right, top to bottom); whatever is not said to change stays the same from one cell to the next.
${refLines.length ? `Who is who:\n${refLines.join("\n")}\n` : ""}The ${panels.length} moments:
${cells.join("\n")}${panels.length < rows * cols ? `\nLeave the last ${rows * cols - panels.length} cell(s) as the empty place.` : ""}
Style: ${style}`;
}

// Crop the grid into its cells (ffmpeg), left to right, top to bottom. Returns the cell files.
export function cropCells(gridFile, n, outFor) {
  const [rows, cols] = layout(n), out = [];
  const [W, H] = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", gridFile]).toString().trim().split(",").map(Number);
  const cw = Math.floor(W / cols), ch = Math.floor(H / rows);
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols), c = i % cols, f = outFor(i + 1);
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", gridFile, "-vf", `crop=${cw}:${ch}:${c * cw}:${r * ch}`, f]);
    out.push(f);
  }
  return out;
}

// Did the model draw the grid as asked? One vision call on the whole image: cell count and whether cells are equal and ungapped.
export async function checkGrid(file, n) {
  const [rows, cols] = layout(n);
  return jsonCall({ name: "grid-check", effort: "low", images: [file], schema: S.obj({ rows: S.int, cols: S.int, equal_cells: S.bool, gutters_or_text: S.bool, note: S.str }),
    prompt: `This image should be a storyboard grid of ${rows} rows × ${cols} columns of equal cells with no gutters, borders, numbers or text.
rows, cols: how many rows and columns of panels you see. equal_cells: all cells the same size and aligned. gutters_or_text: visible
gaps, borders, numbers or captions between or on the cells. note: short.` });
}
