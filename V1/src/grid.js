// Scene grid: one image call per scene draws all of the scene's panels as cells of one storyboard grid (consistency inside one
// image is far better than a chain of edits). Image 1 = the scene's base (its environment's plate, or the latest frame there);
// then one reference per element entering the scene (its latest frame, else its sheet). Code crops the cells, checks each one,
// and records each cell as a frame in the state table. Grid layouts keep 16:9 cells: 1 → 1×1, ≤4 → 2×2, ≤9 → 3×3.
import { execFileSync } from "node:child_process";
import { jsonCall, S } from "./llm.js";

export const layout = (n) => (n <= 1 ? [1, 1] : n <= 4 ? [2, 2] : [3, 3]);

// hasState: image 2 is the latest frame of the environment (state: what has changed since the plate); references then start at 3.
export function gridPrompt({ scene, panels, env, style, refs, textRefs = [], name, hasState = false }) {
  const [rows, cols] = layout(panels.length), off = hasState ? 3 : 2;
  const refLines = textRefs.map((r) => `${name(r.id)}: ${r.spec || name(r.id)}`).concat(refs.map((r, i) => `${name(r.id)}: ${r.from === "sheet" ? `the same ${r.kind === "character" ? "person" : "object"} as image ${i + off} (same face, hair, clothes and colours; its pose and plain background do not apply)` : `exactly as ${r.kind === "character" ? "they look" : "it looks"} in image ${i + off} (take only ${name(r.id)} from it)`}`));
  const cells = panels.map((p, i) => {
    const enters = p.enters.map((e) => `${name(e.id)} ${e.where}${e.doing ? `, ${e.doing}` : ""}`).join("; ");
    const changes = p.changes.map((c) => `${name(c.id)}: ${c.now}`).join("; ");
    return `${i + 1}. ${p.action}${enters ? ` [${enters}]` : ""}${changes ? ` (${changes})` : ""}${p.leaves.length ? ` (${p.leaves.map(name).join(", ")} no longer in the picture)` : ""}`;
  });
  return `One image that is a storyboard GRID of ${panels.length} panels in ${rows} rows × ${cols} columns, all cells the same size, filling the
image edge to edge with no gutters, borders, numbers or text.
Image 1 is the place itself (${env}): EVERY cell shows this same room from this same fixed wide camera, the same walls, furniture,
light and colours, as if the camera never moved and only the people and things in it changed. No close-ups, no new angles, no
other rooms.${hasState ? "\nImage 2 is the latest moment in this place: start from its state (what is open, where things lie) in cell 1." : ""}
The cells are consecutive moments of one continuous scene, in reading order (left to right, top to bottom); whatever is not said
to change stays the same from one cell to the next.
${refLines.length ? `Who is who:\n${refLines.join("\n")}\n` : ""}The ${panels.length} moments:
${cells.join("\n")}${panels.length < rows * cols ? `\nLeave the last ${rows * cols - panels.length} cell(s) as the empty place.` : ""}
Style: ${style}`;
}

// Crop the grid into its cells (ffmpeg), left to right, top to bottom. Returns the cell files.
// grid: [rows, cols] actually drawn (from checkGrid) when it differs from the requested layout but still holds n cells.
export function cropCells(gridFile, n, outFor, grid = null) {
  const [rows, cols] = grid && grid[0] * grid[1] >= n ? grid : layout(n), out = [];
  const [W, H] = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", gridFile]).toString().trim().split(",").map(Number);
  const cw = Math.floor(W / cols), ch = Math.floor(H / rows);
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols), c = i % cols, f = outFor(i + 1);
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", gridFile, "-vf", `crop=${cw}:${ch}:${c * cw}:${r * ch}`, f]);
    out.push(f);
  }
  return out;
}

// Each cell against the environment: same room and same camera as the plate? (the counts check cannot see a changed room).
export async function checkCellsRoom(cellFiles, plateFile) {
  const r = await jsonCall({ name: "grid-room-check", effort: "low", images: [plateFile, ...cellFiles],
    schema: S.obj({ cells: S.arr(S.obj({ cell: S.int, same_room: S.bool, same_camera: S.bool, note: S.str })) }),
    prompt: `Image 1 is an empty place (the plate). Images 2 to ${cellFiles.length + 1} are cells of a storyboard that must show this same place
from the same fixed camera. For each cell (numbered 1 to ${cellFiles.length} in order): same_room: the same walls, furniture and layout as image 1
(people and small objects may differ); same_camera: the same wide framing and angle (not a close-up, not another angle). note: short.` });
  return cellFiles.map((_, i) => r.cells.find((c) => c.cell === i + 1) || { cell: i + 1, same_room: false, same_camera: false, note: "not reported" });
}

// Did the model draw the grid as asked? One vision call on the whole image: cell count and whether cells are equal and ungapped.
export async function checkGrid(file, n) {
  const [rows, cols] = layout(n);
  return jsonCall({ name: "grid-check", effort: "low", images: [file], schema: S.obj({ rows: S.int, cols: S.int, equal_cells: S.bool, gutters_or_text: S.bool, note: S.str }),
    prompt: `This image should be a storyboard grid of ${rows} rows × ${cols} columns of equal cells with no gutters, borders, numbers or text.
rows, cols: how many rows and columns of panels you see. equal_cells: all cells the same size and aligned. gutters_or_text: visible
gaps, borders, numbers or captions between or on the cells. note: short.` });
}
