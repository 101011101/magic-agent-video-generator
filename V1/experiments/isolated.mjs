// Isolated tests, one per open problem (see tickets/G-006). Free ones use LLM vision or ffmpeg on images we already have;
// paid ones go through the Jobs gate under run "exp-isolated". Usage: node cleaned/experiments/isolated.mjs T1 T3 …
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { RUNS } from "../src/env.js";
import { jsonCall, S } from "../src/llm.js";
import { ssim, corners } from "../src/clips.js";

const R = (run, f) => join(RUNS, run, f), json = (run) => JSON.parse(readFileSync(R(run, "run.json"), "utf8"));
const out = {}, want = process.argv.slice(2);
const OUT = join(RUNS, "exp-isolated"); mkdirSync(OUT, { recursive: true });

// T1 (P6): check plates against one essential fact per mark the blocking uses, instead of the full compound "where".
async function T1() {
  const r3 = json("custom-rrh3"), r2 = json("custom-rrh2");
  const used = new Set(r2.plan.steps.flatMap((s) => s.beats.flatMap((b) => [b.to, b.via])).concat(r2.plan.steps.map((s) => s.change.mark)).filter(Boolean));
  const res = {};
  for (const place of r3.seed_plan.places) {
    const marks = place.marks.filter((m) => used.has(m.id));
    const ess = await jsonCall({ name: "t1-essentials", effort: "medium", schema: S.obj({ facts: S.obj(Object.fromEntries(marks.map((m) => [m.id, S.str]))) }),
      prompt: `For each mark of this place, write the ONE essential fact a story needs about it, in at most 12 words, in camera terms
(which side, which wall, which end; for a bed's head: the end against which wall). No relations to other marks unless the mark is a part of it.
Camera: ${place.camera}\n${marks.map((m) => `- ${m.id}: ${m.where}`).join("\n")}` });
    for (const f of ["", "-t2", "-t3"].map((t) => `roots/${place.id}${t}.png`).filter((f) => existsSync(R("custom-rrh3", f)))) {
      const ans = await jsonCall({ name: "t1-check", effort: "medium", images: [R("custom-rrh3", f)],
        schema: S.obj({ facts: S.obj(Object.fromEntries(marks.map((m) => [m.id, S.obj({ holds: S.bool, note: S.str })]))) }),
        prompt: `Look at the picture. For each fact, does it hold? note: what you see, short.\n${marks.map((m) => `- ${m.id}: ${ess.facts[m.id]}`).join("\n")}` });
      const fails = marks.filter((m) => !ans.facts[m.id].holds).map((m) => `${m.id} (${ans.facts[m.id].note})`);
      res[f] = fails.length ? fails : "pass";
      console.log(`T1 ${f}: ${fails.length ? "FAIL " + fails.join("; ") : "pass"}`);
    }
    res[`${place.id} essentials`] = ess.facts;
  }
  return res;
}

// T3 (P14): what predicts a whole-picture re-paint? rrh2's 44 edits, grouped by feature.
async function T3() {
  const t = JSON.parse(readFileSync(R("custom-rrh2", "tracker.json"), "utf8")), rows = [];
  const plan = json("custom-rrh2").plan;
  for (const f of t.frames.filter((f) => f.op === "edit")) for (const a of f.attempts) {
    const s = plan.slides.find((x) => x.n === f.slide);
    const rep = a.obs.framing ? a.obs.framing.changed && a.obs.framing.ssim < 0.7 : ssim(R("custom-rrh2", a.file), R("custom-rrh2", a.base_file)) < 0.7;
    rows.push({ id: a.file, rep, refs: a.refs.length, add: a.add.length, onscreen: s.present.filter((id) => plan.entities.find((e) => e.id === id).kind !== "prop").length,
      action: s.beats.map((b) => b.action).join("+"), len: a.prompt.length, retry: a.a > 1, hops: a.hops, fromPlate: a.base.startsWith("plate") });
  }
  const rate = (k, fn) => { const g = {}; for (const r of rows) { const v = fn(r); (g[v] ??= [0, 0]); g[v][0] += r.rep ? 1 : 0; g[v][1]++; } console.log(`T3 by ${k}: ${Object.entries(g).sort().map(([v, [a, b]]) => `${v}: ${a}/${b}`).join(" · ")}`); return g; };
  console.log(`T3 re-paints: ${rows.filter((r) => r.rep).map((r) => `${r.id} (${r.action}, refs ${r.refs}, ${r.len} chars)`).join("; ")}`);
  return { rows, refs: rate("refs", (r) => r.refs), add: rate("added", (r) => r.add), onscreen: rate("characters on screen", (r) => r.onscreen),
    retry: rate("retry", (r) => r.retry), len: rate("prompt length", (r) => (r.len < 1500 ? "<1500" : r.len < 2000 ? "1500-2000" : "2000+")),
    hops: rate("hops", (r) => (r.hops < 5 ? "<5" : r.hops < 10 ? "5-9" : "10+")) };
}

// T4 (P16): does a frame-vs-sheet identity question catch a different-looking character?
async function T4() {
  const cases = [
    { frame: R("custom-rrh2", "frames/s5-a2.png"), sheet: R("custom-rrh2", "roots/red.png"), who: "Little Red Riding Hood", truth: "same (made from this sheet, looks it)" },
    { frame: R("custom-rrh2", "frames/s11-a1.png"), sheet: R("custom-rrh2", "roots/red.png"), who: "Little Red Riding Hood", truth: "different (older, long hair)" },
    { frame: R("custom-rrh2", "frames/s5-a2.png"), sheet: R("custom-rrh3", "roots/red.png"), who: "Little Red Riding Hood", truth: "different (rrh3 design)" },
    { frame: R("custom-rrh2", "frames/s8-a2.png"), sheet: R("custom-rrh2", "roots/wolf.png"), who: "The Wolf", truth: "different (invented realistic wolf)" },
    { frame: R("custom-rrh2", "frames/s3-a1.png"), sheet: R("custom-rrh2", "roots/wolf.png"), who: "The Wolf", truth: "same" },
  ];
  const res = [];
  for (const c of cases) {
    const r = await jsonCall({ name: "t4-identity", effort: "medium", images: [c.frame, c.sheet], schema: S.obj({ same_character: S.bool, note: S.str }),
      prompt: `Image 2 is the reference sheet of ${c.who}. Is ${c.who} in image 1 clearly the same character (face, hair style and colour, clothes and colours, build, species, art style)? Pose, expression and background may differ. note: what differs, or "".` });
    console.log(`T4 ${c.frame.split("/").slice(-3).join("/")} vs ${c.sheet.split("/").slice(-3).join("/")}: said ${r.same_character ? "same" : "different"} · truth ${c.truth} · ${r.note}`);
    res.push({ ...c, ...r });
  }
  return res;
}

// T6 (P15): match each drifted frame's colour statistics to its place's plate (per-channel mean and spread), deterministic.
function rgb(file, W = 688, H = 384) { return execFileSync("ffmpeg", ["-loglevel", "error", "-i", file, "-vf", `scale=${W}:${H}`, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], { maxBuffer: 1 << 26 }); }
const stats = (p) => [0, 1, 2].map((c) => { let s = 0, q = 0, n = 0; for (let i = c; i < p.length; i += 3) { s += p[i]; q += p[i] * p[i]; n++; } const m = s / n; return { m, sd: Math.sqrt(q / n - m * m) }; });
async function T6() {
  const res = [];
  for (const f of ["s12-a1", "s18-a1", "s25-a1"]) {
    const ref = stats(rgb(R("custom-rrh2", "frames/s11-a1.png"))), px = rgb(R("custom-rrh2", `frames/${f}.png`)), st = stats(px);
    const fixed = Buffer.from(px.map((v, i) => { const c = i % 3; return Math.max(0, Math.min(255, Math.round((v - st[c].m) * (ref[c].sd / st[c].sd) + ref[c].m))); }));
    const o = join(OUT, `T6-${f}.png`), before = join(OUT, `T6-${f}-before.png`);
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "688x384", "-i", "-", o], { input: fixed });
    execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", R("custom-rrh2", `frames/${f}.png`), "-vf", "scale=688:384", before]);
    const d = (a) => a.map((x, c) => Math.round(x.m - ref[c].m)).join("/");
    console.log(`T6 ${f}: RGB mean shift vs s11 before ${d(st)} → after ${d(stats(rgb(o)))}`);
    res.push({ f, before: d(st), after: d(stats(rgb(o))) });
  }
  return res;
}

// T8 (P8): a focused physical question about the door, on every cottage plate try.
async function T8() {
  const res = {};
  for (const f of ["roots/cottage.png", "roots/cottage-t2.png", "roots/cottage-t3.png"]) {
    const r = await jsonCall({ name: "t8-door", effort: "medium", images: [R("custom-rrh3", f)], schema: S.obj({ opens_freely: S.bool, hinge_side: S.str, swings_into: S.str, note: S.str }),
      prompt: `Look at the entrance door. Could it swing fully open and closed without hitting the fireplace, furniture or a wall it is not hinged on? hinge_side: which edge is hinged. swings_into: what the open leaf points at. note: short.` });
    console.log(`T8 ${f}: opens_freely ${r.opens_freely} · hinged ${r.hinge_side} · swings into ${r.swings_into} · ${r.note}`);
    res[f] = r;
  }
  return res;
}

// Paid tests share one Jobs gate (run "exp-isolated", same ledger and cap as the pipeline).
import { Jobs } from "../src/jobs.js";
import { sheetPrompt } from "../src/assets.js";
const runLog = existsSync(join(OUT, "run.json")) ? JSON.parse(readFileSync(join(OUT, "run.json"), "utf8")) : {};
const run = { name: "exp-isolated", path: (f) => join(OUT, f), log: runLog }; run.save = () => writeFileSync(join(OUT, "run.json"), JSON.stringify(run.log, null, 2));
const jobs = new Jobs(run);
const take = (src, f) => { const to = `in/${src}-${f.split("/").pop()}`; mkdirSync(join(OUT, "in"), { recursive: true }); if (!existsSync(join(OUT, to))) copyFileSync(R(src, f), join(OUT, to)); return to; };

// T2 (P11): the wolf sheet with (a) the medium only (no palette or light words) and (b) the full style plus an own-colours rule.
async function T2() {
  const r3 = json("custom-rrh3"), wolf = r3.asset_specs.find((a) => a.id === "wolf"), style = r3.world.style, res = [];
  const medium = "Hand-painted watercolour storybook illustration with delicate ink outlines and expressive faces";
  const variants = { medium: sheetPrompt(medium, wolf), owncolours: `${sheetPrompt(style, wolf)}\nColours: the subject's OWN colours exactly as described (charcoal-grey fur, cream muzzle). The style's palette and light do not tint the subject.` };
  for (const [v, prompt] of Object.entries(variants)) {
    const f = `T2-wolf-${v}.png`; await jobs.image(`T2-${v}`, f, prompt);
    const r = await jsonCall({ name: "t2-colour", effort: "medium", images: [join(OUT, f)], schema: S.obj({ fur_charcoal_grey: S.bool, other_colour_patches: S.bool, natural_wolf: S.bool, single_view: S.bool, note: S.str }),
      prompt: `A wolf reference sheet. fur_charcoal_grey: the body fur is charcoal grey. other_colour_patches: red, olive, green or other non-grey patches in the fur. natural_wolf: natural wolf build on four legs. single_view: one view only. note: short.` });
    console.log(`T2 ${v}: grey ${r.fur_charcoal_grey} · patches ${r.other_colour_patches} · natural ${r.natural_wolf} · single ${r.single_view} · ${r.note}`);
    res.push({ v, f, ...r });
  }
  return res;
}

// T5 (P14, P17): redo two rrh2 edits that re-painted or duplicated, WITHOUT sheets of characters already in the base frame.
async function T5() {
  const t = JSON.parse(readFileSync(R("custom-rrh2", "tracker.json"), "utf8")), res = [];
  for (const [slide, who] of [[12, "Little Red Riding Hood"], [15, "Little Red Riding Hood"]]) {
    const a = t.frames.find((f) => f.slide === slide).attempts[0], base = take("custom-rrh2", a.base_file);
    const prompt = a.prompt.split("\n").filter((l) => !/is already in image 1; image \d+ is their identity reference/.test(l)).join("\n")
      .replace("Take the pose and expression from this text, not from any reference image.", "Move the one already in image 1; there is exactly one of each character.");
    for (const v of [1, 2]) {
      const f = `T5-s${slide}-v${v}.png`; await jobs.image(`T5-s${slide}-v${v}`, f, `${prompt}\n(variant ${v})`, [base]);
      const fr = { ssim: ssim(join(OUT, f), join(OUT, base)), corners: Math.abs(corners(join(OUT, f)) - corners(join(OUT, base))) };
      const c = await jsonCall({ name: "t5-count", effort: "medium", images: [join(OUT, f)], schema: S.obj({ count: S.int, note: S.str }), prompt: `How many times does ${who} (girl in a red hooded cape) appear? note: where.` });
      console.log(`T5 s${slide} v${v}: SSIM ${fr.ssim} corners ${fr.corners} → ${fr.ssim < 0.7 || fr.corners >= 10 ? "RE-PAINT" : "kept framing"} · Red ×${c.count}`);
      res.push({ slide, v, f, ...fr, count: c.count });
    }
  }
  return res;
}

for (const t of want) out[t] = await ({ T1, T2, T3, T4, T5, T6, T8 })[t]();
const file = join(OUT, "results.json"), prev = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
writeFileSync(file, JSON.stringify({ ...prev, ...out }, null, 2));
