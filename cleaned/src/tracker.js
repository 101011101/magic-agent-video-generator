// S3 Tracker: frames indexed by location and the entities they show. Presence only; the pixels carry everything else.
import { writeFileSync } from "node:fs";

export class Tracker {
  constructor(run) { this.run = run; this.roots = {}; this.frames = []; }
  save() { if (!this.run.estimate) writeFileSync(this.run.path("tracker.json"), JSON.stringify({ roots: this.roots, frames: this.frames }, null, 2)); }
  get(id) { return this.frames.find((f) => f.id === id) || null; }
  // The latest accepted frame before slide n that shows this entity (any place): its look as the story last left it.
  lastSeen(id, n) { return this.frames.filter((f) => f.accepted && f.op === "edit" && (f.slide ?? 0) < n && f.present.includes(id)).at(-1) || null; }
  bySlide(n) { return this.frames.find((f) => f.slide === n) || null; }

  addPlate(location, file) {
    if (!this.frames.some((f) => f.op === "plate" && f.location === location))
      this.frames.push({ id: `plate-${location}`, file, slide: null, location, present: [], base: null, refs: [], op: "plate", hops: 0, accepted: true });
  }
  add(rec) {
    const f = { id: `s${rec.slide}`, ...rec };
    this.frames = this.frames.filter((x) => x.id !== f.id).concat(f);
    this.save();
    return f;
  }

  // Base for a slide: the previous slide's frame when it continues; else the LATEST accepted frame at the location, because it
  // carries the latest state of the place (an older frame with more wanted entities would lose later changes; entities are
  // cheap to add from their roots, a lost change is not). The plate is the floor (present = [], hops = 0).
  baseFor(slide) {
    if (slide.continues) { const prev = this.bySlide(slide.n - 1); if (prev) return { frame: prev, why: `continues slide ${slide.n - 1}` }; }
    const at = this.frames.filter((f) => f.accepted && f.location === slide.location && (f.slide ?? 0) < slide.n);
    const frame = at.at(-1) || null;
    return { frame, why: frame ? (frame.op === "plate" ? `plate of ${slide.location} (first visit)` : `latest frame at ${slide.location} (${frame.id})`) : "no frame or plate for this location" };
  }
}
