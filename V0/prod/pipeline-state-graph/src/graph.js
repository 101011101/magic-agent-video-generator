// State graph: the backbone. Entities have versions (a carried-forward wardrobe or condition change creates a new version that
// points to the one it continues). Frames are records of what a generated image actually shows, per entity and version, with
// pointers to the frame they were seeded from and the frames merged in. Seeds are old frames: same location first, then the most
// needed entities in their current version with the right relations. All of this is deterministic code.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const VERSIONED = ["wardrobe", "condition"]; // a forward change of these = a new version of the entity

export class StateGraph {
  constructor(dir, timeline) {
    this.dir = dir; this.path = join(dir, "state.json"); this.timeline = timeline;
    this.entities = Object.fromEntries(timeline.entities.map((e) => [e.id, { ...e, versions: [] }]));
    this.frames = []; this.decisions = [];
    this.buildVersions();
    if (existsSync(this.path)) { const s = JSON.parse(readFileSync(this.path, "utf8")); this.frames = s.frames || []; this.decisions = s.decisions || []; }
  }
  save() { writeFileSync(this.path, JSON.stringify({ entities: this.entities, frames: this.frames, decisions: this.decisions }, null, 2)); }
  get(id) { return this.frames.find((f) => f.id === id); }

  // Versions are a function of the timeline: v1 at first appearance; each forward change of wardrobe/condition at the end of a
  // beat creates the next version, pointing to the previous one. versionAt[n][id] = the version in force at the start of beat n.
  buildVersions() {
    this.versionAt = {};
    const cur = {};
    for (const b of this.timeline.beats) {
      if (!cur[b.location] && this.entities[b.location]) { cur[b.location] = 1; this.entities[b.location].versions.push({ v: 1, wardrobe: "", condition: b.weather || "", continues: null, since_beat: b.n, cause: "first appearance (location)" }); }
      for (const s of b.start.entities) if (!cur[s.id] && this.entities[s.id]) {
        cur[s.id] = 1; this.entities[s.id].versions.push({ v: 1, wardrobe: s.wardrobe, condition: s.condition, continues: null, since_beat: b.n, cause: "first appearance" });
      }
      this.versionAt[b.n] = { ...cur };
      for (const s of b.end.entities) if (!cur[s.id] && this.entities[s.id]) {
        cur[s.id] = 1; this.entities[s.id].versions.push({ v: 1, wardrobe: s.wardrobe, condition: s.condition, continues: null, since_beat: b.n, cause: "first appearance (end of beat)" });
      }
      for (const c of b.changes) if (c.carry === "forward" && VERSIONED.includes(c.attr) && this.entities[c.id] && cur[c.id]) {
        const e = this.entities[c.id], prev = e.versions.at(-1);
        const v = { v: prev.v + 1, wardrobe: prev.wardrobe, condition: prev.condition, continues: `${c.id}@v${prev.v}`, since_beat: b.n, cause: `${c.attr}: ${c.from} → ${c.to}` };
        v[c.attr] = c.to; e.versions.push(v); cur[c.id] = v.v;
      }
    }
  }
  versionOf(id, beat, role = "start") {
    const v = role === "start" ? this.versionAt[beat]?.[id] : (this.timeline.beats.find((b) => b.n === beat + 1) ? this.versionAt[beat + 1]?.[id] : this.entities[id].versions.at(-1)?.v);
    return v || this.entities[id]?.versions.at(-1)?.v || 1;
  }
  version(id, v) { return this.entities[id]?.versions.find((x) => x.v === v); }

  // The wanted state of a beat's start or end frame: location with version, and each visible entity with its version.
  want(beat, role) {
    const fs = beat[role];
    const loc = { id: beat.location, version: this.versionOf(beat.location, beat.n, role) };
    const entities = fs.entities.filter((s) => this.entities[s.id] && s.id !== beat.location)
      .map((s) => ({ ...s, kind: this.entities[s.id].kind, version: this.versionOf(s.id, beat.n, role) }));
    const conflicts = entities.flatMap((s) => { const v = this.version(s.id, s.version); return VERSIONED.filter((a) => v && v[a] && s[a] && v[a] !== s[a]).map((a) => `${s.id} ${a}: beat says "${s[a]}", version v${s.version} says "${v[a]}"`); });
    return { beat: beat.n, role, location: loc, time: beat.time, weather: beat.weather, framing: fs.framing, description: fs.description, entities, conflicts };
  }

  // Seed choice. Candidates are accepted frames. Score: same location (100; 60 for an older version of it), then each wanted
  // entity the frame shows in its current version (10; 6 for an older version) with matching relations (+2), then recency.
  // Entities the seed lacks are merged from the latest accepted frame that shows them; the rest are new (drawn from their look).
  // prefer: { id: frameId } forces that entity to be merged from that frame (the size retry re-sources a small prop from its anchor).
  pickSeed(want, { exclude = [], continuous = null, prefer = {} } = {}) {
    const ids = want.entities.map((e) => e.id);
    const rel = (e, shown) => (e.interacting_with || []).some((x) => (shown.interacting_with || []).includes(x)) ? 2 : 0;
    const entScore = (f) => ids.reduce((n, id) => { const e = want.entities.find((x) => x.id === id), s = f.shows[id]; return n + (s?.ok ? (s.version === e.version ? 10 : 6) + rel(e, s) : 0); }, 0);
    const ranked = this.frames.map((f, i) => ({ f, i })).filter(({ f }) => f.accepted && !exclude.includes(f.id)).map(({ f, i }) => {
      const loc = f.location === want.location.id ? (f.loc_version === want.location.version ? 100 : 60) : 0, ents = entScore(f);
      return { id: f.id, beat: f.beat, role: f.role, score: loc + ents + i / 1000, loc, ents, shows: ids.filter((id) => f.shows[id]?.ok) };
    }).filter((c) => c.score >= 6).sort((a, b) => b.score - a.score);
    const seed = continuous ? this.get(continuous) : ranked.length ? this.get(ranked[0].id) : null;
    const missing = ids.filter((id) => !seed?.shows[id]?.ok || prefer[id]);
    const merges = [];
    for (const id of missing) {
      const e = want.entities.find((x) => x.id === id), pref = prefer[id] ? this.get(prefer[id]) : null;
      const src = pref && pref.accepted && pref.shows[id]?.ok && pref !== seed ? pref : [...this.frames].reverse().filter((f) => f.accepted && f !== seed && !exclude.includes(f.id) && f.shows[id]?.ok)
        .sort((a, b) => (b.shows[id].version === e.version) - (a.shows[id].version === e.version))[0];
      if (src) (merges.find((m) => m.frame === src.id) || merges[merges.push({ frame: src.id, ids: [] }) - 1]).ids.push(id);
    }
    const used = merges.slice(0, 3), fresh = missing.filter((id) => !used.some((m) => m.ids.includes(id)));
    const kept = ids.filter((id) => seed?.shows[id]?.ok && !prefer[id]);
    const why = seed ? `seed ${seed.id} (beat ${seed.beat} ${seed.role}): ${seed.location === want.location.id ? "same location" : "other location"}${kept.length ? `, shows ${kept.join(", ")}` : ""}` : "no usable earlier frame: fresh generation";
    return { seed: seed?.id || null, kept, merges: used, fresh, ranked: ranked.slice(0, 8), why: why + (used.length ? `; merge ${used.map((m) => `${m.ids.join(", ")} from ${m.frame}`).join(" + ")}` : "") + (fresh.length ? `; new: ${fresh.join(", ")}` : "") };
  }

  // Root binding of an entity: the frame that first established what it looks like. An upload is the strongest root (the user
  // gave us the thing itself), then an anchor (drawn beside its scale partner), then the first accepted frame that shows it.
  // 05-solver.md:57 — "every generation conditions on the root binding. Never chain generated → generated for identity."
  rootOf(id) {
    const rec = this.entities[id]?.versions?.[0]?.root, byRec = rec && this.get(rec);
    if (byRec) return byRec;
    const ok = this.frames.filter((f) => f.accepted && f.shows[id]?.ok);
    return ok.find((f) => f.op === "upload") || ok.find((f) => f.op === "anchor") || ok[0] || null;
  }

  // Re-anchor (05-solver.md:57). Every entity whose identity this frame must preserve gets its root among the inputs, for every
  // kind — not only small props. Measured on the recorded runs: 32 of 36 generations carried no root for at least one entity,
  // the keeper (a character) in 31 of them, which is the mechanism behind the recorded identity drift.
  // Slots: ai-image-editor takes at most 10 assets, and seed + merges already use some. When roots do not all fit, the order is
  // characters (11 recorded identity faults, the most-cited) → anchored small props (24 size faults) → locations (4 place
  // faults) → remaining props. A root already present as the seed or a merge source is not added twice.
  reAnchor(want, plan, { slots = 10 } = {}) {
    const have = new Set([plan.seed, ...plan.merges.map((m) => m.frame)].filter(Boolean));
    const rank = (e) => (e.kind === "character" ? 0 : e.kind === "prop" && this.rootOf(e.id)?.op === "anchor" ? 1 : e.kind === "location" ? 2 : 3);
    const free = Math.max(0, slots - (plan.seed ? 1 : 0) - plan.merges.length);
    const roots = [], skipped = [];
    for (const e of [...want.entities].sort((a, b) => rank(a) - rank(b))) {
      if (plan.fresh.includes(e.id)) continue;            // nothing to preserve yet: this is its first appearance
      const r = this.rootOf(e.id);
      if (!r || have.has(r.id)) continue;                 // no root yet, or it is already an input
      const at = roots.find((x) => x.frame === r.id);
      if (at) { at.ids.push(e.id); continue; }
      if (roots.length >= free) { skipped.push(e.id); continue; }
      roots.push({ frame: r.id, ids: [e.id], op: r.op });
    }
    return { ...plan, roots, roots_skipped: skipped,
      why: plan.why + (roots.length ? `; re-anchor ${roots.map((r) => `${r.ids.join(", ")} from ${r.frame}`).join(" + ")}` : "") + (skipped.length ? `; no slot for ${skipped.join(", ")}` : "") };
  }

  // Records a frame. shows: { id: { version, pose, position, interacting_with, condition, wardrobe, ok, problems } }.
  addFrame(rec) {
    const id = `f${this.frames.length + 1}`;
    const f = { id, accepted: false, ...rec };
    this.frames.push(f); this.save();
    return f;
  }
  decide(d) { this.decisions.push({ at: new Date().toISOString(), ...d }); this.save(); }
  // Lineage per entity: versions with pointers, and every frame that shows each version.
  lineage() {
    return Object.fromEntries(Object.values(this.entities).map((e) => [e.id, { kind: e.kind, look: e.look, size: e.size,
      versions: e.versions.map((v) => ({ ...v, frames: this.frames.filter((f) => f.shows[e.id]?.version === v.v).map((f) => ({ id: f.id, file: f.file, beat: f.beat, role: f.role, ok: f.shows[e.id].ok, accepted: f.accepted, seed: f.seed, merged: f.merged, problems: f.shows[e.id].problems })) })) }]));
  }
}
