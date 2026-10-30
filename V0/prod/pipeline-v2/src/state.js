// State store: typed records of what each frame actually shows, with lineage pointers.
// A record = one frame (start, end or real last frame) and, per label, the observed typed attributes.
// Each asset instance points to its last stable instance (prev) and to the record it was built from (source).
// Stable = present + invariant attributes match + the pairwise check says it is the same asset as prev.
// Retrieval: for a wanted state, the best base record (same location first, then stable wanted labels, then matched
// typed attributes, then most recent); labels the base lacks come from their last stable instance.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { jsonCall } from "../../state-manager/src/llm.js";
import { visionCallImages } from "./vision.js";

// Atoms from the v1 vocabulary (tests/fixtures/tool-signatures.json), plus size, position and condition for frame state.
export const ATOMS = ["identity", "head_hair", "body", "wardrobe", "size", "background", "expression", "pose_action", "position", "condition", "lighting"];
export const INVARIANT = { character: ["identity", "head_hair", "body", "wardrobe"], prop: ["identity", "size"], location: ["background"] };

export class StateStore {
  constructor(dir, assets) {
    this.dir = dir; this.assets = assets; this.path = join(dir, "state.json");
    this.records = existsSync(this.path) ? JSON.parse(readFileSync(this.path, "utf8")).records : [];
  }
  save() { writeFileSync(this.path, JSON.stringify({ atoms: ATOMS, invariant: INVARIANT, records: this.records }, null, 2)); }
  get(id) { return this.records.find((r) => r.id === id); }
  // The latest stable instance of a label, before record index `before`.
  lastStable(label, before = this.records.length) {
    for (let i = Math.min(before, this.records.length) - 1; i >= 0; i--) if (this.records[i].assets[label]?.stable) return this.records[i];
    return null;
  }

  // Adds a frame. expected: { label: { atom: value } } (the typed state it should show). source: { label: recordId }.
  async add({ file, scene, role, location, expected, source = {}, rejected = false }) {
    const id = `r${this.records.length + 1}`, labels = Object.keys(expected).filter((l) => this.assets[l]);
    const seen = labels.length ? await this.observe(file, expected, labels) : [];
    const rec = { id, file, scene, role, location, rejected, assets: {} };
    for (const l of labels) {
      const o = seen.find((x) => x.label === l) || { present: false, count: 0, attrs: [] };
      const allowed = new Set([...(INVARIANT[this.assets[l].kind] || []), ...Object.keys(expected[l] || {})]);
      o.attrs = o.attrs.filter((a) => allowed.has(a.atom));
      const inv = INVARIANT[this.assets[l].kind] || [];
      const invOk = o.attrs.filter((a) => inv.includes(a.atom)).every((a) => a.matches);
      const prev = this.lastStable(l);
      const pair = o.present && prev ? await this.pairwise(l, prev.file, file) : null;
      rec.assets[l] = {
        expected: expected[l], observed: Object.fromEntries(o.attrs.map((a) => [a.atom, a.observed])),
        matches: Object.fromEntries(o.attrs.map((a) => [a.atom, a.matches])), present: o.present, count: o.count,
        prev: prev?.id || null, same_as_prev: pair ? pair.same : null, diffs: pair?.diffs || [], source: source[l] || null,
        stable: !rejected && o.present && invOk && (pair ? pair.same : true),
      };
    }
    this.records.push(rec); this.save();
    return rec;
  }

  async observe(file, expected, labels) {
    const schema = { type: "object", additionalProperties: false, required: ["assets"], properties: { assets: { type: "array", items: {
      type: "object", additionalProperties: false, required: ["label", "present", "count", "attrs"], properties: {
        label: { type: "string", enum: labels }, present: { type: "boolean" }, count: { type: "integer" },
        attrs: { type: "array", items: { type: "object", additionalProperties: false, required: ["atom", "observed", "matches"],
          properties: { atom: { type: "string", enum: ATOMS }, observed: { type: "string" }, matches: { type: "boolean" } } } } } } } } };
    // Judge only the expected attributes plus the invariants of each kind (an invariant without a value = "as in the look").
    const checks = (l) => ({ ...Object.fromEntries((INVARIANT[this.assets[l].kind] || []).map((a) => [a, "as in the look"])), ...(expected[l] || {}) });
    const text = `This is one frame of a film. For each asset below: present = visible in the frame; count = how many times it appears; for each listed attribute, and only those, observed = what the frame shows (a few words) and matches.
matches = false only when the frame clearly contradicts the expected value. If the attribute cannot be seen or measured in this frame, observed = "not visible" and matches = true. Judge size against people and objects in the frame.
${labels.map((l) => `- ${l} (${this.assets[l].kind}: ${this.assets[l].look}). Attributes: ${Object.entries(checks(l)).map(([a, v]) => `${a} = ${v}`).join("; ")}`).join("\n")}`;
    return (await visionCallImages("observe", schema, text, [join(this.dir, file)])).assets;
  }

  // Pairwise: is the label in `b` the same asset as in `a`, on its invariant attributes only?
  async pairwise(label, a, b) {
    const inv = INVARIANT[this.assets[label].kind] || ["identity"];
    const schema = { type: "object", additionalProperties: false, required: ["same", "diffs"], properties: { same: { type: "boolean" }, diffs: { type: "array", items: { type: "string" } } } };
    const text = `Image 1 and image 2 are two frames of one film. Both should show ${label} (${this.assets[label].kind}: ${this.assets[label].look}).
Compare only what must never change: ${inv.join(", ")} (for a prop: shape, design, colour, material and real size relative to people or the scene). Ignore pose, position, framing, light, weather and background.
same = true if image 2 clearly shows the same ${label} as image 1. diffs: each invariant difference, a few words each, or [].`;
    return visionCallImages("pairwise", schema, text, [join(this.dir, a), join(this.dir, b)]);
  }

  // Best base for a wanted state: { location, assets: { label: { atom: value } } }.
  async rank(want) {
    const labels = Object.keys(want.assets).filter((l) => this.assets[l] && l !== want.location);
    const cands = this.records.map((r, i) => ({ r, i, stable: labels.filter((l) => r.assets[l]?.stable), loc: r.location === want.location && !r.rejected }))
      .filter((c) => !c.r.rejected && (c.loc || c.stable.length));
    if (!cands.length) return { base: null, scored: [] };
    // Typed attribute match for the top candidates (one text LLM call): how many wanted (label, atom = value) pairs each shows.
    const top = cands.sort((a, b) => (b.loc - a.loc) || (b.stable.length - a.stable.length) || (b.i - a.i)).slice(0, 6);
    const pairs = labels.flatMap((l) => Object.entries(want.assets[l] || {}).map(([atom, value]) => ({ label: l, atom, value })));
    let counts = {};
    if (pairs.length) {
      const schema = { type: "object", additionalProperties: false, required: ["candidates"], properties: { candidates: { type: "array", items: {
        type: "object", additionalProperties: false, required: ["id", "matched"], properties: { id: { type: "string", enum: top.map((c) => c.r.id) }, matched: { type: "integer" } } } } } };
      const prompt = `Wanted state:\n${pairs.map((p) => `- ${p.label} ${p.atom} = ${p.value}`).join("\n")}\n\nCandidate frames and what they actually show:\n${top.map((c) => `${c.r.id}: ${Object.entries(c.r.assets).filter(([, a]) => a.stable).map(([l, a]) => `${l} {${Object.entries(a.observed).map(([k, v]) => `${k}: ${v}`).join("; ")}}`).join(" · ") || "(no stable assets)"}`).join("\n")}\n\nFor each candidate, count how many wanted lines it already satisfies (same meaning, not same words).`;
      counts = Object.fromEntries((await jsonCall({ name: "rankstate", schema, prompt, effort: "low" })).candidates.map((x) => [x.id, x.matched]));
    }
    const scored = top.map((c) => ({ id: c.r.id, score: (c.loc ? 1000 : 0) + 100 * c.stable.length + 10 * (counts[c.r.id] || 0) + c.i / 1000, stable: c.stable, matched: counts[c.r.id] || 0 }))
      .sort((a, b) => b.score - a.score);
    return { base: this.get(scored[0].id), scored };
  }

  // Lineage per label: every instance in order, with its stable flag and pointers.
  lineage() {
    const out = {};
    for (const r of this.records) for (const [l, a] of Object.entries(r.assets)) (out[l] ??= []).push({ record: r.id, scene: r.scene, role: r.role, file: r.file, rejected: r.rejected, ...a });
    return out;
  }
}
