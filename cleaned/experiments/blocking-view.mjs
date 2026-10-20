// Plan view of a run's blocking under the state-manager rule (no generation): per slide the screenplay block, every asset with
// its transformation, and where its reference comes from. State rows are the REQUESTED ids per slide; the base of a slide is the
// latest row at its place (else the place's plate); an entering asset comes from the latest row that has it, else the asset bank
// (first appearance), else it is generated from text (never seen, not banked). Fixtures come with the place's environment.
// Usage: node cleaned/experiments/blocking-view.mjs custom-rrh2 → <run>/blocking/data.json
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { RUNS } from "../src/env.js";

const name = process.argv[2], dir = join(RUNS, name), log = JSON.parse(readFileSync(join(dir, "run.json"), "utf8"));
const plan = log.plan || { ...log.blocking, seed: log.seed };   // a seed-only run has its states and plates but no plan yet
const bank = new Set(Object.keys((existsSync(join(dir, "tracker.json")) ? JSON.parse(readFileSync(join(dir, "tracker.json"), "utf8")) : { roots: {} }).roots));
const ent = Object.fromEntries((log.world?.entities || plan.entities).map((e) => [e.id, e]));
const sheetImg = Object.fromEntries([...bank].map((id) => [id, `img/${id}.jpg`]));
const plateImg = Object.fromEntries(Object.entries(plan.seed || {}).map(([id, s]) => [id, `img/${s.plate.split("/")[1].replace(".png", ".jpg")}`]));
const t = existsSync(join(dir, "tracker.json")) ? JSON.parse(readFileSync(join(dir, "tracker.json"), "utf8")) : { frames: [] };
const keptImg = Object.fromEntries(t.frames.filter((f) => f.slide).map((f) => [f.slide, `img/${f.file.replace(/[/]/g, "_").replace(/\.png$/, ".jpg")}`]));
const rows = [];   // the state table: { slide, place, ids }; a plate is row 0 of its place, holding the initial contents
for (const [place, ids] of Object.entries(plan.initial || {})) rows.push({ slide: 0, place, ids: [...ids] });
const markName = (place, id) => plan.seed?.[place]?.marks.find((m) => m.id === id)?.name || id;
const VERB = { be: "is at", enter: "comes in at", exit: "goes out at", appear: "appears at", vanish: "disappears", move: "goes to", sit: "sits at", lie: "lies down at", stand: "stands up at", kneel: "kneels at", turn: "turns at", "pick-up": "picks up", "put-down": "puts down", act: "" };

const slides = plan.slides.map((s, i) => {
  const step = plan.steps[i], place = s.location;
  const baseRow = rows.filter((r) => r.place === place).at(-1);
  const base = baseRow && baseRow.slide ? { kind: "frame", slide: baseRow.slide } : { kind: "plate", place, img: plateImg[place] };
  const baseIds = baseRow ? baseRow.ids : [];
  // Screenplay block
  const heading = `${place === "woodland" ? "EXT." : "INT."} ${(plan.locations.find((l) => l.id === place)?.name || place).toUpperCase()}${step.time_jump ? " — LATER" : ""}`;
  const lines = step.beats.map((b) => {
    const who = ent[b.actor]?.name || b.actor, obj = b.object ? ent[b.object]?.name || b.object : "";
    const where = b.to ? ` ${markName(place, b.to)}` : "", via = b.via ? `, passing ${markName(place, b.via)}` : "";
    const body = b.action === "act" ? "" : b.action === "pick-up" ? ` picks up ${obj}` : b.action === "put-down" ? ` puts ${obj} down at${where}` : b.action === "vanish" ? " disappears" : ` ${VERB[b.action]}${where}${via}`;
    return `${who.toUpperCase()}${body}.${b.pose ? ` (${b.pose})` : ""}${b.expression ? ` — ${b.expression}` : ""}`;
  });
  if (step.change.mark) lines.push(`${markName(place, step.change.mark).toUpperCase()}: ${step.change.state}.`);
  // Assets in the slide and their transformations
  const beatsBy = {}; for (const b of step.beats) { (beatsBy[b.actor] ??= []).push(b); if (b.object) (beatsBy[b.object] ??= []).push({ ...b, asObject: true }); }
  const assets = s.present.map((id) => {
    const bs = beatsBy[id] || [];
    const tr = bs.length ? bs.map((b) => b.asObject ? (b.action === "pick-up" ? `picked up by ${ent[b.actor].name}` : b.action === "put-down" ? `put down at ${markName(place, b.to)}` : `${b.action} with ${ent[b.actor].name}`)
      : [b.action === "act" ? "" : b.action === "vanish" ? "disappears" : `${VERB[b.action]} ${b.to ? markName(place, b.to) : ""}`.trim(), b.pose, b.expression].filter(Boolean).join("; ")).join(" · ") : "unchanged";
    let src;
    const holder = ent[id]?.inside;
    if (baseIds.includes(id)) src = base.kind === "plate" ? { kind: "base", label: "plate (always here: painted into the place)" } : { kind: "base", label: `frame ${base.slide} (already in it)`, slide: base.slide };
    else {
      const seen = rows.filter((r) => r.ids.includes(id)).at(-1);
      src = seen ? { kind: "frame", label: seen.slide ? `frame ${seen.slide} (last seen)` : `plate of ${seen.place} (last seen)`, slide: seen.slide }
        : holder && bank.has(holder) ? { kind: "bank", label: `inside ${ent[holder]?.name || holder} (its sheet)`, img: sheetImg[holder] }
        : bank.has(id) ? { kind: "bank", label: "asset bank (first appearance)", img: sheetImg[id] } : { kind: "gen", label: "generated from text (never seen, not banked)" };
    }
    return { id, name: ent[id]?.name || id, kind: ent[id]?.kind, transform: tr, entering: !baseIds.includes(id), src };
  });
  const leaving = baseIds.filter((id) => !s.present.includes(id)).map((id) => ({ id, name: ent[id]?.name || id }));
  const fixtures = [...new Set([...step.beats.flatMap((b) => [b.to, b.via]), step.change.mark].filter(Boolean))].map((m) => ({ id: m, name: markName(place, m), changed: m === step.change.mark ? step.change.state : "" }));
  rows.push({ slide: s.n, place, ids: [...s.present] });
  const onlyBase = assets.every((a) => a.src.kind === "base");
  return { n: s.n, place, heading, lines, caption: s.caption, kind: s.kind, assets, leaving, fixtures, base, onlyBase, img: keptImg[s.n] || null };
});
mkdirSync(join(dir, "blocking"), { recursive: true });
writeFileSync(join(dir, "blocking", "data.json"), JSON.stringify({ title: plan.title, story: plan.story, run: name, lint: plan.lint || [], slides,
  plates: Object.entries(plan.seed || {}).map(([id, s]) => ({ id, name: (log.world?.locations || []).find((l) => l.id === id)?.name || id, img: plateImg[id], contents: s.contents || [] })),
  sheets: [...bank].filter((id) => ent[id]).map((id) => ({ id, name: ent[id].name, img: sheetImg[id] })) }));
const c = (k) => slides.flatMap((s) => s.assets).filter((a) => a.src.kind === k).length;
console.log(`${slides.length} slides · sources: base ${c("base")}, earlier frame ${c("frame")}, asset bank ${c("bank")}, generated ${c("gen")} · only-base slides ${slides.filter((s) => s.onlyBase).length}`);
