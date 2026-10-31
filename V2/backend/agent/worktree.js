// The working tree (prd/13-worktree.md): the workflow as a graph, read from the records. runTree(L) builds it from a
// run's run.json; sessionTree(S) from a session. Nodes carry type, stage, inputs (node ids with roles), params, the
// prompt file or text, outputs with attempts and the gate, credits, and an explain line assembled from the graph.
// dependents(tree, id) is the closure along the HARD edges (lib/deps.js: image 1, a pinned frame, a shot, a scene, an
// input); informed(tree, ids) is what the SOFT edges reach (the frame before, a portrait, a prop picture, the style
// sheet), kept and marked. rerun(tree, id) prices the remake from the registry at the run's profile, not the recorded
// spend with its attempts (T-046).
import { basename } from "node:path";
import { isHard } from "../lib/deps.js";
import { stillCost, videoRate } from "../lib/models.js";

export const STAGES = ["sheet", "story", "screenplay", "assets", "keyframes", "clips", "sound", "film", "job"];

export const STAGE_EXPLAIN = {
  sheet: "the universal questions: what is wanted, answered before anything creative runs",
  story: "the story the brief became; the only place after the brief where the plot is invented",
  screenplay: "the shooting script, one node per scene and one per shot; every still hangs from a shot",
  assets: "the bank: a reference per element (a photo from the record, or a generated sheet); every still that shows the element takes it",
  keyframes: "one painted still per distinct frame of the screenplay; the clips are pinned on them",
  clips: "one clip per shot or sequence of shots, pinned on its stills; the film is their join",
  sound: "the music bed and the voices mixed under the film",
  film: "the stitched cut with captions and subtitles",
  job: "a small job: one tool call on what the user supplied",
};

function explain(n, byId, deps, inf = []) {
  const names = (ids) => ids.map((i) => byId[i]?.label || i).join(", ");
  const d = deps.filter((x) => x !== n.id), dn = (d.length ? ` ${d.length} thing${d.length === 1 ? "" : "s"} depend on it (${names(d.slice(0, 4))}${d.length > 4 ? ", …" : ""}).` : " Nothing depends on it.") + (inf.length ? ` ${inf.length} more took it as a reference and would be marked (${names(inf.slice(0, 3))}${inf.length > 3 ? ", …" : ""}).` : "");
  switch (n.type) {
    case "story": return `The story written from the brief; every scene is read from it.${dn}`;
    case "scene": return `Scene ${n.scene}${n.place ? ` in ${n.place}` : ""}: ${n.shots} shot${n.shots === 1 ? "" : "s"}; a change here remakes only this scene's stills and clips.${dn}`;
    case "shot": return `Shot ${n.shot} of scene ${n.scene}${n.seconds ? `, ${n.seconds} s` : ""}: its first and last frame are the stills under it.${dn}`;
    case "plate": return `The empty place ${n.element ? `"${n.element}"` : ""}: every first still of a scene there is painted into it${n.inputs.length ? `, made from ${names(n.inputs.map((i) => i.id))}` : ""}.${dn}`;
    case "sheet": return `The reference sheet for ${n.element}: every still that shows ${n.element} takes it as a portrait.${dn}`;
    case "ref": return `A picture from the record for ${n.element || basename(n.file)} (Wikimedia Commons): the look that every still must match.${dn}`;
    case "still": { const from = n.inputs.find((i) => i.role === "image 1"); return `${n.size ? n.size + " " : ""}keyframe ${n.label} for shot ${n.shot} of scene ${n.scene}, ${from ? `painted from ${byId[from.id]?.label || from.id}` : "painted"}${n.gate ? `; gate: ${n.gate}` : ""}.${dn}`; }
    case "clip": return `The clip${n.label.startsWith("seq") ? " of a sequence" : ""} pinned on ${names(n.inputs.map((i) => i.id))}${n.seconds ? `, ${n.seconds} s` : ""}; the film joins it.${dn}`;
    case "music": return `The music bed, one track for the whole film, ducked under the voices.${dn}`;
    case "film": return `The finished cut: every clip joined, the music mixed, captions and subtitles laid over.`;
    case "material": return `Supplied by the user: the record of ${n.label}; whatever takes it must match it.${dn}`;
    case "step": return `${n.tool} on ${n.model || "the tier's model"}: takes ${n.inputs.length ? names(n.inputs.map((i) => i.id)) : "nothing"} and makes ${n.produces}.${dn}`;
    default: return `${n.type}.${dn}`;
  }
}

export function runTree(L, label = "") {
  const nodes = [], edges = []; const byFile = {}; const add = (n) => { n.inputs ??= []; nodes.push(n); if (n.file) byFile[n.file] = n.id; return n; };
  const jobs = Object.values(L.jobs || {});
  const jobFor = (file) => jobs.find((j) => j.file === file);
  // story and the quantised screenplay
  add({ id: "story", type: "story", stage: "story", label: L.story?.title || "story", text: L.story?.story || "", credits: 0 });
  for (const sc of L.script?.scenes || []) {
    add({ id: `scene-${sc.n}`, type: "scene", stage: "screenplay", label: `scene ${sc.n}`, scene: sc.n, place: sc.place, shots: (sc.shots || []).length, text: sc.synopsis || "", inputs: [{ id: "story", role: "story" }], credits: 0 });
    for (const sh of sc.shots || []) add({ id: `shot-${sc.n}-${sh.n}`, type: "shot", stage: "screenplay", label: `shot ${sh.n}`, scene: sc.n, shot: sh.n, seconds: sh.seconds, text: sh.moment || "", inputs: [{ id: `scene-${sc.n}`, role: "scene" }], credits: 0 });
  }
  // the bank: plates, sheets, refs
  const elKind = {}; for (const e of L.elements || []) elKind[e.id] = e.kind;
  for (const [id, b] of Object.entries(L.bank || {})) {
    if (!b.file) continue;
    const type = b.source === "commons" ? "ref" : elKind[id] === "place" ? "plate" : "sheet";
    const j = jobFor(b.file); add({ id: `asset:${id}`, type, stage: "assets", label: id, element: id, file: b.file, page: b.page, model: j?.model, credits: j?.credits || 0, prompt: j?.prompt || b.prompt || "", raw_inputs: j?.inputs || [] });
    if (b.file.endsWith(".png") && !byFile[b.file.replace(/\.png$/, "-nobars.png")]) byFile[b.file.replace(/\.png$/, "-nobars.png")] = `asset:${id}`;
  }
  // stills: every accepted still, with its attempts
  for (const [sid, s] of Object.entries(L.stills || {})) {
    const attempts = jobs.filter((j) => j.file && (j.file === `stills/${sid}.png` || j.file.startsWith(`stills/${sid}-r`))).map((j) => j.file);
    const j = jobFor(s.file) || jobs.find((x) => attempts.includes(x.file));
    add({ id: `still:${sid}`, type: "still", stage: "keyframes", label: sid, scene: s.scene, shot: s.shot, size: s.size, how: s.how, gate: s.gate, card: s.from === "card" || !!L.build?.painted?.[sid]?.card, file: s.file, attempts, model: j?.model, credits: jobs.filter((x) => attempts.includes(x.file)).reduce((a, x) => a + (x.credits || 0), 0), prompt: j?.prompt || "", raw_inputs: j?.inputs || [], inputs: s.scene && s.shot ? [{ id: `shot-${s.scene}-${s.shot}`, role: "shot" }] : [] });
    for (const a of attempts) byFile[a] = `still:${sid}`;
  }
  // clips and music. A clip's seconds are its shots' (the job record's `seconds` is the job's wall-clock): a sequence's
  // rendered length from the build record, a pinned clip's from its shot.
  const shotSeconds = (n) => { for (const sc of L.script?.scenes || []) for (const sh of sc.shots || []) if (sh.n === n) return sh.seconds; return null; };
  const clipSeconds = (file) => { const q = basename(file).match(/^seq-(\d+-\d+)/); if (q) { const sq = L.build?.sequences?.[q[1]]; return sq?.rendered ?? sq?.seconds ?? null; } const m = basename(file).match(/^s(\d+)/); return m ? shotSeconds(Number(m[1])) : null; };
  for (const j of jobs) if (/video/.test(j.endpoint)) add({ id: `clip:${basename(j.file)}`, type: "clip", stage: "clips", label: basename(j.file, ".mp4"), file: j.file, seconds: clipSeconds(j.file), model: j.model, credits: j.credits || 0, prompt: j.prompt || "", raw_inputs: j.inputs || [] });
  for (const j of jobs) if (/music/.test(j.endpoint)) add({ id: "music", type: "music", stage: "sound", label: "music bed", file: j.file, seconds: j.seconds, credits: j.credits || 0, prompt: j.prompt || "" });
  const clips = nodes.filter((n) => n.type === "clip");
  if (clips.length) add({ id: "film", type: "film", stage: "film", label: "film", file: L.build?.film?.file || "clips/film.mp4", credits: 0, inputs: [...clips.map((c) => ({ id: c.id, role: "clip" })), ...(byFile[nodes.find((n) => n.type === "music")?.file] ? [{ id: "music", role: "music" }] : [])] });
  // resolve raw file inputs to node ids, with roles. An attempt painted from the node's own earlier attempt (a repair,
  // a delta edit) inherits that attempt's inputs, so the edges point at what the still really came from.
  const resolveId = (f) => byFile[f] || byFile[f.replace(/-nobars\.png$/, ".png")];
  const expand = (n, files, depth = 0) => files.flatMap((f) => { const id = resolveId(f); if (id === n.id && depth < 6) return expand(n, jobFor(f)?.inputs || [], depth + 1); return [f]; });
  for (const n of nodes) {
    const seen = new Set();
    for (const [k, f] of expand(n, n.raw_inputs || []).entries()) {
      const id = resolveId(f); if (!id || id === n.id || seen.has(id)) continue; seen.add(id);
      const role = n.type === "still" ? (k === 0 ? "image 1" : byId(nodes, id)?.type === "sheet" ? "portrait" : byId(nodes, id)?.type === "ref" ? "prop" : "reference") : n.type === "clip" ? (byId(nodes, id)?.type === "still" ? "pinned still" : "reference") : "reference";
      n.inputs.push({ id, role });
    }
    delete n.raw_inputs;
  }
  for (const n of nodes) for (const i of n.inputs) edges.push([i.id, n.id, isHard(i.role) ? "hard" : "soft"]);
  // What remaking a node costs, from the registry at the run's profile: one still, a clip at its seconds, a plate or a
  // sheet or the music at its one job; never the recorded spend, which counts every attempt.
  const M = L.models || {}, priced = (fn, fallback) => { try { const v = fn(); return Number.isFinite(v) ? v : fallback; } catch { return fallback; } };
  for (const n of nodes) n.remake = n.type === "still" ? (n.card ? 0 : priced(() => stillCost(M.still, M.res), jobFor(n.file)?.credits || 0)) : n.type === "clip" ? (n.seconds ? priced(() => n.seconds * videoRate(M.video, M.vres, true), n.credits) : n.credits) : ["plate", "sheet", "ref", "music"].includes(n.type) ? n.credits : 0;
  const tree = { label, kind: "run", nodes, edges, stages: STAGES.filter((s) => nodes.some((n) => n.stage === s)).map((s) => ({ id: s, explain: STAGE_EXPLAIN[s] })) };
  finish(tree); return tree;
}
const byId = (nodes, id) => nodes.find((n) => n.id === id);

// A film node that started a run pulls that run's whole tree in under it (the bank with its provenance, the stills,
// the clips), so the session's tree shows where the research-sourced and generated references came from.
export function sessionTree(S, { loadRun = null } = {}) {
  const nodes = [], edges = []; const add = (n) => { n.inputs ??= []; nodes.push(n); return n; };
  const runs = new Set();
  for (const m of S.materials || []) add({ id: `mat:${m}`, type: "material", stage: "assets", label: m, file: `materials/${m}`, credits: 0 });
  const produced = {};
  S.turns.forEach((t, ti) => {
    for (const f of t.sheet?.fields || []) if (f.value && f.source !== "not_applicable") add({ id: `sheet:${ti}:${f.field}`, type: "field", stage: "sheet", label: f.field, text: f.value, source: f.source, credits: 0 });
    (t.plan?.steps || []).forEach((st, i) => {
      const id = `step:${ti}:${i}`;
      add({ id, type: "step", stage: "job", label: `${st.tool}`, tool: st.tool, model: st.model, produces: st.produces, state: st.state, run: st.run, credits: st.credits || 0, prompt_file: st.prompt_file, params: st.params, inputs: st.inputs.map((x) => ({ id: produced[x] || `mat:${x}`, role: "input" })) });
      produced[st.produces] = id; if (st.run) runs.add(st.run);
    });
  });
  for (const label of runs) {
    const L = loadRun?.(label); if (!L) continue;
    const rt = runTree(L, label); const pre = `run:${label}:`;
    for (const n of rt.nodes) add({ ...n, id: pre + n.id, inputs: n.inputs.map((i) => ({ ...i, id: pre + i.id })), run: label, dependents: undefined, explain: undefined });
    const storyStep = nodes.find((n) => n.type === "step" && n.tool === "story" && n.run === label); if (storyStep) { const st = nodes.find((n) => n.id === pre + "story"); if (st) st.inputs.push({ id: storyStep.id, role: "the brief sheet" }); }
    for (const m of S.materials || []) { const rec = rt.nodes.find((n) => n.file && basename(n.file) === m); if (rec) { const rn = nodes.find((n) => n.id === pre + rec.id); if (rn) rn.inputs.push({ id: `mat:${m}`, role: "the user's record" }); } }
  }
  for (const n of nodes) n.inputs = n.inputs.filter((i) => nodes.some((x) => x.id === i.id));
  for (const n of nodes) for (const i of n.inputs) edges.push([i.id, n.id, isHard(i.role) ? "hard" : "soft"]);
  const tree = { label: S.id, kind: "session", nodes, edges, stages: STAGES.filter((s) => nodes.some((n) => n.stage === s)).map((s) => ({ id: s, explain: STAGE_EXPLAIN[s] })) };
  finish(tree); return tree;
}

function finish(tree) {
  const map = Object.fromEntries(tree.nodes.map((n) => [n.id, n]));
  for (const n of tree.nodes) { const d = dependents(tree, n.id); n.dependents = d; n.informed = informed(tree, d); n.rerun_credits = d.reduce((a, id) => a + (map[id]?.remake ?? map[id]?.credits ?? 0), 0); n.explain = explain(n, map, d, n.informed); }
}

// The closure along the hard edges: what must be remade when `id` changes. A soft edge does not carry.
export function dependents(tree, id) {
  const out = new Set([id]); let grew = true;
  while (grew) { grew = false; for (const [a, b, kind] of tree.edges) if (kind !== "soft" && out.has(a) && !out.has(b)) { out.add(b); grew = true; } }
  return [...out];
}
// What the remade set reaches through soft edges: kept, marked as built with an older reference.
export function informed(tree, ids) { const set = new Set(ids), out = new Set(); for (const [a, b, kind] of tree.edges) if (kind === "soft" && set.has(a) && !set.has(b)) out.add(b); return [...out]; }
export const rerun = (tree, id) => { const map = Object.fromEntries(tree.nodes.map((n) => [n.id, n])); const ids = dependents(tree, id); return { ids, informed: informed(tree, ids), credits: ids.reduce((a, i) => a + (map[i]?.remake ?? map[i]?.credits ?? 0), 0) }; };
