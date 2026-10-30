// Reference validation (SM-104). An upload adopted as an identity anchor is the reference for every later frame of the
// film, so it is checked before it is adopted: exactly one face for a character, and a face large enough to be a usable
// reference. /v1/face-detection is the tool that supplies that property; nothing called it before.
//
// The check reports; it never silently repairs. A bad reference is a fact the run must record, because a cropped or
// swapped-in substitute would be a different decision than the one the storyboard made — and the point of the state is
// that the original is carried, not quietly replaced.
//
// Face Detection returns face crops, not boxes, so the face's share of the frame is measured from the crop's own pixel
// dimensions against the source image's. Dimensions are read from the file header (PNG IHDR / JPEG SOF), so this needs
// no ffmpeg and no image library.
import { readFileSync, existsSync } from "node:fs";
import { runJob, download, uploadFile } from "./magichour.js";

// Minimum share of the frame area a face must occupy to serve as an identity reference. Provisional: no measured
// threshold exists yet (the only recorded upload is a clean portrait), so this is a floor to surface the 40-pixel-face
// case, not a calibrated value. HUNT: measure against real uploads before treating it as settled.
export const MIN_FACE_AREA = 0.01; // 1% of frame area, i.e. a 10% x 10% box

// Pixel dimensions from a file header. Returns null when the format is not recognised.
export function imageSize(file) {
  if (!existsSync(file)) return null;
  const b = readFileSync(file);
  if (b.length > 24 && b[0] === 0x89 && b.toString("ascii", 1, 4) === "PNG") return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
  if (b.length > 4 && b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i + 9 < b.length; ) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) };
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}

// Detect faces in a local image. Returns { faces: [{ url, file?, w, h, area }], source: {w,h} }.
// `saveTo(i)` optionally gives a local path to write crop i to, so the caller can keep the evidence with the run.
export async function detectFaces(file, { confidence = 0.5, saveTo = null } = {}) {
  const source = imageSize(file);
  const path = await uploadFile(file, "image");
  const r = await runJob("/v1/face-detection", { assets: { target_file_path: path }, confidence_score: confidence }, "faces");
  const urls = r.downloads || [];
  const faces = [];
  for (const [i, url] of urls.entries()) {
    const out = saveTo ? saveTo(i) : null;
    if (out) { await download(url, out); const s = imageSize(out); faces.push({ url, file: out, ...s, area: s && source ? (s.w * s.h) / (source.w * source.h) : null }); }
    else faces.push({ url });
  }
  return { source, faces, credits: r.credits || 0 };
}

// Is this file fit to be `name`'s identity anchor? kind: "character" needs exactly one face of usable size; a prop or
// location needs no face and is passed through. Never mutates the file.
export async function checkReference(file, { name, kind, saveTo = null, minArea = MIN_FACE_AREA } = {}) {
  if (kind !== "character") return { ok: true, checked: false, why: `${kind || "unknown"}: no face expected`, faces: 0 };
  const size = imageSize(file);
  let det;
  try { det = await detectFaces(file, { saveTo }); }
  catch (e) { return { ok: true, checked: false, why: `face check unavailable: ${String(e.message).slice(0, 120)}`, faces: null, error: true }; }
  const problems = [];
  if (det.faces.length === 0) problems.push("no face found");
  if (det.faces.length > 1) problems.push(`${det.faces.length} faces found; a character reference must show exactly one`);
  const biggest = det.faces.reduce((a, f) => (f.area != null && (a == null || f.area > a) ? f.area : a), null);
  if (biggest != null && biggest < minArea) problems.push(`face covers ${(biggest * 100).toFixed(2)}% of the frame, below the ${(minArea * 100).toFixed(0)}% floor for a usable reference`);
  return {
    ok: !problems.length, checked: true, faces: det.faces.length, face_area: biggest, source: size, credits: det.credits,
    why: problems.length ? `${name}: ${problems.join("; ")}` : `${name}: one face, ${(biggest != null ? (biggest * 100).toFixed(1) + "% of frame" : "size unknown")}`,
    problems,
  };
}
