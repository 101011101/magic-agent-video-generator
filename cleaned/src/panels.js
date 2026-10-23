// Panel run (draft v3): screenplay (with sound) → storyboard panels → keyframes, one panel at a time, each previewable before it
// is generated (kaizen). Reuses a source run's ids, specs, sheets and plates. The state manager is the tracker; references follow
// its rule: base = latest frame of the environment; an entering element comes from the latest frame that shows it, else its
// sheet, else its text spec. Only characters leave by absence; props leave only when a panel says so.
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { RUNS } from "./env.js";
import { jsonCall, S, usage } from "./llm.js";
import { Jobs } from "./jobs.js";
import { Tracker } from "./tracker.js";
import { framing } from "./clips.js";
import { frameStyle } from "./seed.js";
import { storyboardScene, checkPanels } from "./storyboard.js";

const SLOTS = 10;

export class PanelRun {
  constructor(from, label, { estimate = false } = {}) {
    this.from = from; this.name = `custom-${label}`; this.estimate = estimate;
    this.src = JSON.parse(readFileSync(join(RUNS, from, "run.json"), "utf8")); this.dir = join(RUNS, this.name);
    for (const d of ["", "roots", "frames"]) mkdirSync(join(this.dir, d), { recursive: true });
    const logFile = join(this.dir, "run.json");
    this.run = { name: this.name, estimate, path: (f) => join(this.dir, f), log: existsSync(logFile) ? JSON.parse(readFileSync(logFile, "utf8")) : {} };
    this.run.save = () => { if (!estimate) writeFileSync(logFile, JSON.stringify(this.run.log, null, 2)); };
    this.jobs = new Jobs(this.run, { estimate }); this.tracker = new Tracker(this.run);
    const src = this.src;
    this.ent = Object.fromEntries(src.world.entities.map((e) => [e.id, { ...e, ...(src.asset_specs?.find((a) => a.id === e.id) || {}) }]));
    this.envs = src.seed_plan.places.filter((p) => src.seed[p.id]);
    for (const [id, a] of Object.entries(src.assets)) { const to = this.run.path(a.file); if (!existsSync(to)) copyFileSync(join(RUNS, from, a.file), to); this.tracker.roots[id] = a.file; }
    for (const e of this.envs) { const p = src.seed[e.id], to = this.run.path(p.plate); if (!existsSync(to)) copyFileSync(join(RUNS, from, p.plate), to); this.tracker.addPlate(e.id, p.plate, p.contents || []); }
    this.sp = src.screenplay_sound || src.screenplay_approved;
    this.style = src.style_medium || frameStyle(src.world.style);
    Object.assign(this.run.log, { name: this.name, from, screenplay: this.sp });
    // Resume: frames already generated and accepted in an earlier session.
    const tf = join(this.dir, "tracker.json");
    if (existsSync(tf)) { const t = JSON.parse(readFileSync(tf, "utf8")); this.tracker.frames = t.frames; this.tracker.roots = { ...this.tracker.roots, ...t.roots }; }
  }
  name_(id) { return this.ent[id]?.name || id; }

  // Storyboard all scenes in parallel (cached per scene); scenes that break the hard rule are redone once with the violations.
  async storyboard() {
    // The style for edits is the medium only (watercolour, line work): a story-wide style line carries lighting of other scenes.
    this.run.log.style_medium ??= (await jsonCall({ name: "style-medium", effort: "low", schema: S.obj({ medium: S.str }),
      prompt: `Reduce this illustration style line to the MEDIUM only (materials, line work, level of finish), one sentence, no lighting, no colours of specific things, no scene words:\n${this.src.world.style}` })).medium;
    this.style = this.run.log.style_medium;
    const ctx = { assets: Object.values(this.ent).map((e) => ({ id: e.id, name: e.name })), envs: this.envs };
    let board = this.run.log.board ??= await Promise.all(this.sp.scenes.map((sc, i) => storyboardScene(sc, i + 1, ctx)));
    let bad = checkPanels(board);
    if (bad.length && !this.run.log.board_fixed) {
      board = await Promise.all(board.map(async (b, i) => {
        const mine = bad.filter((x) => x.startsWith(`scene ${i + 1} `));
        return mine.length ? storyboardScene({ ...this.sp.scenes[i], beats: [...this.sp.scenes[i].beats, { kind: "action", who: "", text: `(Storyboard note: fix these: ${mine.join("; ")}.)` }] }, i + 1, ctx) : b;
      }));
      this.run.log.board = board; this.run.log.board_fixed = true; bad = checkPanels(board);
    }
    this.run.log.board_violations = bad;
    const slides = [];
    board.forEach((b, i) => b.panels.forEach((p, j) => slides.push({
      n: slides.length + 1, scene: i + 1, first: j === 0, location: b.environment, present: [...new Set(p.elements)].filter((id) => this.ent[id]),
      what: p.action || p.what_we_see, changes: p.changes || [], enters: (p.enters || []).filter((e) => this.ent[e.id]), leaves: (p.leaves || []).filter((id) => this.ent[id]), intro: p.introductions || [],
      beats: p.beats.map((k) => this.sp.scenes[i].beats[k - 1]).filter(Boolean), ambience: this.sp.scenes[i].ambience || "", music: this.sp.scenes[i].music || "",
    })));
    this.slides = slides;
    this.run.log.plan = { title: this.sp.title, entities: Object.values(this.ent), locations: this.envs.map((e) => ({ id: e.id, name: e.id })),
      slides: slides.map((s) => ({ ...s, caption: s.what, ste: [s.what], kind: s.first ? "establish" : "act", cast: s.present.map((id) => ({ id, where: "", acting: s.changes.find((c) => c.id === id)?.now || "" })), changed: s.changes.map((c) => c.id), change: "" })) };
    this.run.save();
    return { slides, violations: bad, perScene: board.map((b) => b.panels.length) };
  }

  // What the next generation of panel n would use: base, references (with where each comes from) and the prompt. No job.
  preview(n) {
    const s = this.slides[n - 1], { frame: base, why } = this.tracker.baseFor(s);
    if (!base) return { error: why };
    const add = s.present.filter((id) => !base.present.includes(id));
    const remove = base.present.filter((id) => this.ent[id] && (s.leaves.includes(id) || (!s.present.includes(id) && this.ent[id].kind === "character")));
    const { prompt, imgs } = this.prompt(s, base, add, remove);
    const refs = [{ role: "base", label: base.op === "plate" ? `plate of ${base.location}` : `panel ${base.slide} (latest frame of ${base.location})`, file: base.file, slide: base.slide || null, why },
      ...imgs.map((x) => ({ role: "ref", id: x.id, label: x.from === "sheet" ? `${this.name_(x.id)}: seed sheet (first appearance)` : `${this.name_(x.id)}: from panel ${this.tracker.get(x.from)?.slide ?? x.from}`, file: x.file, slide: this.tracker.get(x.from)?.slide || null }))];
    const textOnly = add.filter((id) => !imgs.some((x) => x.id === id) && !this.packed(s, id)).map((id) => this.name_(id));
    const done = this.tracker.bySlide(n);
    return { n, scene: s.scene, location: s.location, what: s.what, beats: s.beats, ambience: s.ambience, elements: s.present.map((id) => this.name_(id)), add: add.map((id) => this.name_(id)), remove: remove.map((id) => this.name_(id)), textOnly, refs, prompt,
      done: done ? { file: done.file, forced: done.forced, attempts: done.attempts.map((a) => ({ a: a.a, file: a.file, faults: a.faults.map((x) => `${x.id ? this.name_(x.id) + ": " : ""}${x.kind}`) })) } : null };
  }
  packed(s, id) { const c = this.ent[id]?.inside; return c && s.present.includes(c); }

  // The edit prompt. Image 1 is the base; one image per entering element (its latest frame, or its sheet). Each entering element
  // gets where it is and what it does (from the panel's enters); elements already in the base get only their change.
  prompt(s, base, add, remove) {
    const imgs = [], lines = [];
    let k = 2;
    const isChar = (id) => this.ent[id]?.kind === "character", place = (id) => { const e = s.enters.find((x) => x.id === id); return e ? `${e.where ? ` ${e.where}` : ""}${e.doing ? `, ${e.doing}` : ""}` : ""; };
    const byFrame = new Map(), fresh = [];
    for (const id of add) { if (this.packed(s, id)) continue; const seen = this.tracker.lastSeen(id, s.n); if (seen) byFrame.set(seen.id, [...(byFrame.get(seen.id) || []), id]); else fresh.push(id); }
    for (const [fid, ids] of byFrame) {
      if (k > SLOTS) break;
      const f = this.tracker.get(fid); for (const id of ids) imgs.push({ id, file: f.file, from: fid });
      for (const id of ids) lines.push(`${this.name_(id)}${place(id)}: exactly as ${isChar(id) ? "they look" : "it looks"} in image ${k} (take only ${this.name_(id)} from it).`);
      k++;
    }
    for (const id of fresh) {
      if (this.tracker.roots[id] && k <= SLOTS) { imgs.push({ id, file: this.tracker.roots[id], from: "sheet" }); lines.push(`${this.name_(id)}${place(id)}: ${isChar(id) ? `the same person as image ${k++} (same face, hair, clothes and colours; its pose and plain background do not apply)` : `the same object as image ${k++} (same shape, material and colours; its plain background does not apply)`}.`); }
      else lines.push(`${this.name_(id)}${place(id)}: ${this.ent[id]?.spec || this.name_(id)}`);
    }
    for (const id of remove) lines.push(`${this.name_(id)} is no longer in the picture; show the place behind.`);
    for (const c of s.changes) if (base.present.includes(c.id) && !remove.includes(c.id) && c.now) lines.push(`${this.name_(c.id)} (already in image 1): ${c.now}. Exactly one ${this.name_(c.id)}.`);
    const firstFrame = base.op === "plate";
    const head = firstFrame
      ? `Image 1 is the empty place. Put this moment in it, keeping the place, light, colours and framing of image 1 exactly:`
      : `Edit image 1. Change only what this moment needs; everything else stays exactly as in image 1 (place, objects, light, colours, framing).`;
    const prompt = `${head}
${s.what}
${lines.join("\n")}
Style: ${this.style} One single frame, no text.`;
    return { prompt, imgs };
  }

  async check(file, s, removed) {
    const ids = [...new Set([...s.present, ...removed])].filter((id) => !this.packed(s, id));
    const r = await jsonCall({ name: "panel-check", effort: "medium", images: [file],
      schema: S.obj({ counts: S.obj(Object.fromEntries(ids.map((id) => [id, S.int]))), impossible: S.bool, single_frame: S.bool, problems: S.str }),
      prompt: `This is one frame of an illustrated story. counts: how many times each of these appears (0 if not visible):
${ids.map((id) => `- ${id}: ${this.name_(id)}${this.ent[id]?.spec ? ` (${this.ent[id].spec.slice(0, 160)})` : ""}`).join("\n")}
impossible: true only if something is physically impossible (extra limbs, a body through furniture, floating). single_frame: one
picture (not a grid or comic). problems: one short sentence naming what is wrong, or "".` });
    const f = [];
    for (const id of ids) {
      const n = r.counts[id] ?? 0, kind = this.ent[id]?.kind;
      if (s.present.includes(id) && n === 0) f.push({ id, kind: "missing" });
      if (s.present.includes(id) && n > 1 && kind !== "group") f.push({ id, kind: "duplicated" });
      if (removed.includes(id) && n > 0) f.push({ id, kind: "still there" });
    }
    if (r.impossible) f.push({ id: null, kind: `physically impossible: ${r.problems}` });
    if (!r.single_frame) f.push({ id: null, kind: "not a single frame" });
    return { obs: r, faults: f };
  }

  // Generate one attempt of panel n (prompt may be edited by the user). Accepts it into the state table when accept is true or
  // the attempt passes; a failed attempt is recorded and can be retried or accepted from the page.
  async generate(n, { prompt: override = null, accept = false } = {}) {
    const s = this.slides[n - 1], { frame: base, why } = this.tracker.baseFor(s);
    const add = s.present.filter((id) => !base.present.includes(id));
    const remove = base.present.filter((id) => this.ent[id] && (s.leaves.includes(id) || (!s.present.includes(id) && this.ent[id].kind === "character")));
    const built = this.prompt(s, base, add, remove), prompt = override || built.prompt, imgs = built.imgs;
    const prev = this.run.log.attempts?.[n] || [], a = prev.length + 1, file = `frames/p${n}-a${a}.png`;
    await this.jobs.image(`p${n}-a${a}`, file, prompt, [base.file, ...new Set(imgs.map((x) => x.file))]);
    const { obs, faults } = await this.check(this.run.path(file), s, remove);
    obs.framing = framing(this.run.path(file), this.run.path(base.file));
    if (obs.framing.changed) faults.push({ id: null, kind: `framing changed (SSIM ${obs.framing.ssim}, corners ${obs.framing.corner_shift})` });
    const att = { a, file, base: base.id, base_file: base.file, add, remove, keep: [], change: "", refs: imgs.map((x) => ({ id: x.id, file: x.file, from: x.from })), prompt, obs, faults, present: s.present, hops: base.hops + 1, edited: !!override };
    (this.run.log.attempts ??= {})[n] = [...prev, att]; this.run.save();
    return { attempt: att, faults: faults.map((x) => `${x.id ? this.name_(x.id) + ": " : ""}${x.kind}`), base: base.id, why };
  }
  accept(n, a) {
    const s = this.slides[n - 1], atts = this.run.log.attempts?.[n] || [], att = atts.find((x) => x.a === a) || atts.at(-1);
    if (!att) throw new Error(`panel ${n}: nothing generated yet`);
    this.tracker.add({ slide: n, file: att.file, location: s.location, present: [...s.present], observed: att.present, base: att.base, refs: att.refs, op: "edit", hops: att.hops, accepted: true, forced: att.faults.length > 0, base_why: "", attempts: atts });
    this.run.save(); return att;
  }
  spent() { return this.jobs.spent(); }
}
