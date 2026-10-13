// Memory (VideoMemory entity banks + FilmWorld state versions + StoryMem keyframe bank): per entity, versions of its
// persisted state, each with its own anchor image; a bank of observed keyframes (one vision call per frame) with
// per-entity observed state, a stable flag and lineage pointers (prev stable instance, source entry).
// select() picks the base + extra keyframes for a cut (aesthetic filter, rules, one cheap LLM override);
// carried() merges planned, observed and versioned state into prompt lines. memory.json is the source of truth.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { jsonCall } from "../../state-manager/src/llm.js";
import { net } from "./common.js";
import { visionCallImages } from "../../pipeline-v2/src/vision.js";

const str = { type: "string" }, nstr = { type: ["string", "null"] }, int = { type: "integer" }, bool = { type: "boolean" };
const obj = (props) => ({ type: "object", additionalProperties: false, required: Object.keys(props), properties: props });
const arr = (items) => ({ type: "array", items });
const SIZES = ["as expected", "too large", "too small", "not visible"];
const MOVE_ATTR = /position|placed|held|holding|location|where/i;
const blank = (v) => v == null || v === "" || /^not visible$/i.test(v);
const same = (a, b) => (a ?? null) === (b ?? null);

export class Memory {
  constructor(run, plan) {
    this.run = run; this.plan = plan; this.file = run.path("memory.json");
    this.kinds = Object.fromEntries(plan.entities.map((e) => [e.name, e]));
    const m = existsSync(this.file) ? JSON.parse(readFileSync(this.file, "utf8")) : { entities: {}, bank: [] };
    this.entities = m.entities || {}; this.bank = m.bank || [];
    for (const e of plan.entities) this.entities[e.name] ??= { kind: e.kind, look: e.look, size: e.size,
      versions: [{ v: 1, state: {}, anchor: null, since: null, why: "initial look" }], current: 1 };
    this.save();
  }
  save() { if (!this.run.estimate) writeFileSync(this.file, JSON.stringify({ entities: this.entities, bank: this.bank }, null, 2)); }
  get(id) { return this.bank.find((e) => e.id === id) || null; }
  drop(id) { this.bank = this.bank.filter((e) => e.id !== id); this.save(); }
  current(name) { const e = this.entities[name]; return e ? e.versions.find((x) => x.v === e.current) : null; }
  anchor(name) { return this.current(name)?.anchor ?? null; }
  setAnchor(name, file, v = this.entities[name]?.current) {
    const ver = this.entities[name]?.versions.find((x) => x.v === v);
    if (!ver) throw new Error(`memory: no ${name} v${v}`);
    ver.anchor = file; this.save();
  }

  // Latest bank entry where the entity is stable, before bank index `before`; `ok` filters entries.
  lastStable(name, { before = this.bank.length, ok = () => true } = {}) {
    for (let i = Math.min(before, this.bank.length) - 1; i >= 0; i--) if (this.bank[i].entities[name]?.stable && ok(this.bank[i])) return this.bank[i];
    return null;
  }

  // Observe one frame. expected: [{ name, position, holding, held_by, placed_on, condition }]; the location is added.
  async record({ file, shot, role, expected = [], sources = {} }) {
    const loc = shot.location;
    const exp = expected.filter((s) => this.kinds[s.name] && s.name !== loc);
    if (this.kinds[loc]) exp.push({ name: loc, position: "the setting", holding: null, held_by: null, placed_on: null, condition: shot.start?.time_light || "" });
    const names = exp.map((s) => s.name);
    // Re-recording the same frame (re-run) replaces its entry in place.
    const at = this.bank.findIndex((e) => e.file === file && e.shot === shot.id && e.role === role);
    const idx = at >= 0 ? at : this.bank.length;
    let seen;
    if (this.run.estimate) {
      seen = { sharpness: 10, artifacts: "", people_count: exp.filter((s) => this.kinds[s.name].kind === "character").length,
        entities: exp.map((s) => ({ ...s, present: true, count: 1, size: "as expected", look_ok: true, diffs: [] })) };
    } else if (names.length) seen = await this.observe(file, exp);
    else seen = { sharpness: 0, artifacts: "", people_count: 0, entities: [] };
    // The id is taken after the await, in the same synchronous section as the push (parallel records must not share an id).
    const id = at >= 0 ? this.bank[at].id : `k${Math.max(0, ...this.bank.map((e) => Number(e.id.slice(1)) || 0)) + 1}`;
    const entry = { id, file, shot: shot.id, role, location: loc, quality: { sharpness: seen.sharpness, artifacts: seen.artifacts }, people_count: seen.people_count, entities: {} };
    for (const s of exp) {
      const { name, ...expState } = s, kind = this.kinds[name].kind;
      const o = seen.entities.find((x) => x.name === name) || { present: false, count: 0, position: "", holding: null, held_by: null, placed_on: null, condition: "", size: "not visible", look_ok: false, diffs: ["not reported"] };
      const { name: _n, ...obs } = o;
      const stable = o.present && o.look_ok && o.size !== "too large" && o.size !== "too small" && (kind !== "character" || o.count === 1);
      entry.entities[name] = { ...obs, stable, expected: expState, version: this.entities[name].current,
        prev: this.lastStable(name, { before: idx })?.id ?? null, source: sources[name] ?? null };
    }
    if (at >= 0) this.bank[at] = entry; else this.bank.push(entry);
    this.save();
    return entry;
  }

  async observe(file, exp) {
    const names = exp.map((s) => s.name);
    const schema = obj({ sharpness: int, artifacts: str, people_count: int, entities: arr(obj({
      name: { type: "string", enum: names }, present: bool, count: int, position: str, holding: nstr, held_by: nstr, placed_on: nstr,
      condition: str, size: { type: "string", enum: SIZES }, look_ok: bool, diffs: arr(str) })) });
    const line = (s) => { const e = this.kinds[s.name], st = this.current(s.name).state;
      return `- ${s.name} (${e.kind}: ${e.look}; real size: ${e.size}${Object.keys(st).length ? `; now: ${Object.entries(st).map(([k, v]) => `${k} = ${v}`).join(", ")}` : ""}). Expected: position = ${s.position}; holding = ${s.holding ?? "nothing"}; held_by = ${s.held_by ?? "nobody"}; placed_on = ${s.placed_on ?? "nothing"}; condition = ${s.condition}.`; };
    const text = `This is one frame of a film. Report one item per entity below.
present = visible in the frame. count = how many times it appears. position = where it is in the frame, a few words. holding = the thing it holds, or null. held_by = who holds it, or null. placed_on = the surface it rests on, or null. condition = its visible state, a few words.
size: judge the real size against people, hands and objects in the frame; "not visible" when you cannot judge it (this is not a failure). look_ok = the identity and look match the look text. diffs = each thing that contradicts the look or the expected state, a few words each, or [].
For the location: present = the frame shows this place; size = "as expected" or "not visible".
Frame quality: sharpness 0-10 (10 = crisp; a painterly or textured style is still crisp when its forms are clear). artifacts = grids, collage, panels, text, extra limbs, duplicate people or broken anatomy, a few words, or ""; the art style itself is never an artifact. people_count = the number of people in the frame.
${exp.map(line).join("\n")}`;
    return net(() => visionCallImages("memobserve", schema, text, [this.run.path(file)]));
  }

  // Keyframe selection for a cut shot.
  async select(shot, { max = 4 } = {}) {
    const loc = shot.location;
    const wanted = [...new Set(shot.start.entities.map((s) => s.name).filter((n) => this.kinds[n] && n !== loc))];
    const ok = (e) => e.quality.sharpness >= 5 && !e.quality.artifacts;
    const cands = this.bank.filter(ok);
    const has = (e, n) => !!e?.entities[n]?.stable;
    const score = (e) => wanted.filter((n) => has(e, n)).length;
    const best = (list) => list.reduce((b, e) => (!b || score(e) >= score(b) ? e : b), null);
    const rule = (() => {
      const sameLoc = cands.filter((e) => e.location === loc);
      const base = sameLoc.length ? best(sameLoc) : (best(cands.filter((e) => score(e) >= 1)) || null);
      return { base, base_why: base ? `${base.location === loc ? "same location" : "no same-location frame"}; shows ${wanted.filter((n) => has(base, n)).join(", ") || "the place"}` : "", extra: this.extras(base, wanted, cands, max), why: "rule selection" };
    })();
    let pick = rule;
    if (!this.run.estimate && cands.length && wanted.length) {
      try { pick = (await this.override(shot, wanted, cands, rule, max)) || rule; } catch { pick = rule; }
    }
    return { ...pick, ...this.anchorsFor(shot, wanted, pick.base, ok) };
  }

  extras(base, wanted, cands, max) {
    const ok = (e) => cands.includes(e), out = [];
    for (const n of wanted) {
      if (base?.entities[n]?.stable) continue;
      const e = this.lastStable(n, { ok });
      if (!e || e === base) continue;
      const x = out.find((x) => x.entry === e);
      if (x) x.names.push(n);
      else if ((base ? 1 : 0) + out.length < max) out.push({ entry: e, names: [n], why: "" });
    }
    for (const x of out) x.why = `last stable ${x.names.join(", ")} (shot ${x.entry.shot}, ${x.entry.role})`;
    return out;
  }

  anchorsFor(shot, wanted, base, ok) {
    const loc = shot.location, anchors = [], fresh = [];
    for (const n of wanted) {
      const kind = this.kinds[n].kind, a = this.anchor(n), earlier = this.lastStable(n, { ok });
      if (kind === "character" && a) anchors.push({ name: n, file: a, why: `identity of ${n} (v${this.entities[n].current})` });
      else if (kind !== "character" && !earlier && a) anchors.push({ name: n, file: a, why: `scale and look of ${n}: no earlier stable frame` });
      if (!earlier && !a) fresh.push(n);
    }
    if (this.kinds[loc]) {
      const a = this.anchor(loc);
      if (base?.location !== loc && a) anchors.push({ name: loc, file: a, why: `plate of ${loc}: no same-location base` });
      if (!a && !this.lastStable(loc, { ok })) fresh.push(loc);
    }
    return { anchors, fresh };
  }

  // One cheap LLM call that may override the rule choice; null when the answer is not usable.
  async override(shot, wanted, cands, rule, max) {
    const pool = cands.filter((e) => e.location === shot.location || wanted.some((n) => e.entities[n]?.stable)).slice(-12);
    if (!pool.length) return null;
    const ids = pool.map((e) => e.id);
    const schema = obj({ base: { type: "string", enum: [...ids, "none"] }, base_why: str,
      extra: arr(obj({ id: { type: "string", enum: ids }, names: arr({ type: "string", enum: wanted }), why: str })), why: str });
    const want = shot.start.entities.filter((s) => wanted.includes(s.name))
      .map((s) => `- ${s.name}: ${s.position}; holding ${s.holding ?? "nothing"}; held by ${s.held_by ?? "nobody"}; on ${s.placed_on ?? "nothing"}; ${s.condition}`).join("\n");
    const prompt = `Choose reference keyframes for the first frame of a new shot (a cut) at ${shot.location}.
The base frame is edited into the new frame, so pick the one closest to the wanted state (same place first, then the most wanted entities shown in their wanted state). Extra frames each supply entities the base lacks (at most ${max - 1}; names = the entities taken from it, only entities that frame shows). Give one sentence why per chosen frame and one overall why.
Wanted start state (${shot.start.time_light}):
${want}

Candidate frames (only stable entities listed):
${pool.map((e) => this.summary(e)).join("\n")}

Rule choice: base ${rule.base?.id ?? "none"}; extra ${rule.extra.map((x) => `${x.entry.id} (${x.names.join(", ")})`).join(", ") || "none"}.`;
    const r = await net(() => jsonCall({ name: "memselect", schema, prompt, effort: "low" }));
    const base = r.base === "none" ? null : this.get(r.base);
    if (r.base !== "none" && !pool.includes(base)) return null;
    if (!base && rule.base) return null;
    const extra = [];
    for (const x of r.extra) {
      const e = this.get(x.id);
      if (!pool.includes(e) || e === base) return null;
      const names = [...new Set(x.names)].filter((n) => e.entities[n]?.stable);
      if (names.length && (base ? 1 : 0) + extra.length < max) extra.push({ entry: e, names, why: x.why });
    }
    return { base, base_why: r.base_why, extra, why: r.why };
  }

  // Carried state lines for prompts. A field takes the plan when the plan changed it since the observed frame;
  // else the observed value; persisted version attributes override both.
  carried(shot) {
    const lines = [], persisted = [];
    for (const s of shot.start.entities) {
      const e = this.kinds[s.name];
      if (!e || e.kind === "location") continue;
      const last = this.lastStable(s.name), o = last?.entities[s.name], then = o?.expected || {};
      const pick = (k) => (!o || !same(then[k], s[k]) || (blank(o[k]) && k !== "holding" && k !== "held_by" && k !== "placed_on") ? s[k] : o[k]);
      const st = { position: pick("position"), holding: pick("holding"), held_by: pick("held_by"), placed_on: pick("placed_on"), condition: pick("condition") };
      if (e.kind === "character" && !s.placed_on) st.placed_on = null; // where a person stood is not carried into a new place
      const ver = this.current(s.name).state, extra = [];
      for (const [k, v] of Object.entries(ver)) (k in st ? (st[k] = v) : extra.push(`${k}: ${v}`));
      const parts = [st.held_by ? `held by ${st.held_by}, ${st.position}` : st.position, st.holding && `holding ${st.holding}`,
        st.placed_on && `on ${st.placed_on}` !== st.position && `on ${st.placed_on}`, st.condition, ...extra].filter(Boolean);
      lines.push(`${s.name} (${e.kind}, ${e.size}): ${parts.join("; ")}.`);
    }
    for (const n of [...new Set([...shot.start.entities.map((s) => s.name), shot.location])]) {
      const ent = this.entities[n];
      if (!ent) continue;
      for (const ver of ent.versions.filter((x) => x.v > 1 && x.v <= ent.current)) {
        const prev = ent.versions.find((x) => x.v === ver.v - 1)?.state || {};
        const ch = Object.entries(ver.state).filter(([k, v]) => prev[k] !== v).map(([k, v]) => (k === "condition" ? `${n} is ${v}` : `${n} ${k}: ${v}`));
        if (ch.length) persisted.push(`In force since shot ${ver.since}: ${ch.join("; ")}.`);
      }
    }
    return { lines, persisted };
  }

  // New versions for shot.persist; returns the entities that need a new anchor image.
  persist(shot) {
    const byName = {};
    for (const p of shot.persist || []) if (this.entities[p.name]) (byName[p.name] ??= []).push(p);
    const last = [...this.bank].reverse().find((e) => e.shot === shot.id && e.role === "last") || [...this.bank].reverse().find((e) => e.shot === shot.id);
    const out = [];
    for (const [name, items] of Object.entries(byName)) {
      const ent = this.entities[name];
      let ver = ent.versions.find((x) => x.since === shot.id);
      const prev = ver ? ent.versions.find((x) => x.v === ver.v - 1) : this.current(name);
      const state = { ...prev.state, ...Object.fromEntries(items.map((p) => [p.attr, p.to])) };
      const why = items.map((p) => { const c = shot.end?.changes?.find((c) => c.name === name && c.attr === p.attr); return `${p.attr}: ${c ? `${c.from} → ` : ""}${p.to}`; }).join("; ");
      if (ver) Object.assign(ver, { state, why });
      else { ver = { v: prev.v + 1, state, anchor: null, since: shot.id, why }; ent.versions.push(ver); }
      ent.current = ver.v;
      if (ent.kind === "character" || (ent.kind === "prop" && items.some((p) => !MOVE_ATTR.test(p.attr))))
        out.push({ name, v: ver.v, state, from_anchor: prev.anchor, from_frame: last?.file ?? null,
          prompt_hint: `same ${name}, now ${items.map((p) => `${p.attr} = ${p.to}`).join(", ")}` });
    }
    this.save();
    return out;
  }

  // Continuous-shot gate: entities the action needs that the real last frame does not show.
  needed(shot, entry) {
    return shot.start.entities.filter((s) => { const k = this.kinds[s.name]?.kind; return k === "character" || (k === "prop" && s.held_by); })
      .map((s) => s.name).filter((n) => !entry?.entities[n]?.present);
  }

  lineage() {
    return Object.fromEntries(Object.entries(this.entities).map(([name, e]) => [name, { kind: e.kind, look: e.look, size: e.size, versions: e.versions,
      instances: this.bank.filter((b) => b.entities[name]).map((b) => { const x = b.entities[name];
        return { entry: b.id, shot: b.shot, role: b.role, file: b.file, stable: x.stable, position: x.position, holding: x.holding, held_by: x.held_by,
          placed_on: x.placed_on, condition: x.condition, size: x.size, prev: x.prev, source: x.source, version: x.version }; }) }]));
  }

  summary(entry) {
    const ents = Object.entries(entry.entities).filter(([n, x]) => x.stable && n !== entry.location).map(([n, x]) =>
      `${n} [${[x.position, x.holding && `holding ${x.holding}`, x.held_by && `held by ${x.held_by}`, x.placed_on && `on ${x.placed_on}`, x.condition].filter(Boolean).join("; ")}]`);
    return `${entry.id}: shot ${entry.shot} ${entry.role} at ${entry.location}${entry.entities[entry.location]?.stable ? "" : " (place not confirmed)"}; ${ents.join(" · ") || "no stable entities"}; sharpness ${entry.quality.sharpness}${entry.quality.artifacts ? `, artifacts: ${entry.quality.artifacts}` : ""}`;
  }
}
