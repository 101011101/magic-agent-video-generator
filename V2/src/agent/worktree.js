// The working tree (prd/13-worktree.md): the workflow as a graph, read from the records. runTree(L) builds it from a
// run's run.json; sessionTree(S) from a session. Nodes carry type, stage, inputs (node ids with roles), params, the
// prompt file or text, outputs with attempts and the gate, credits, and an explain line assembled from the graph.
// dependents(tree, id) is the transitive closure; rerun(tree, id) is that set with its cost.
import { basename } from "node:path";

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

function explain(n, byId, deps) {
  const names = (ids) => ids.map((i) => byId[i]?.label || i).join(", ");
  const d = deps.filter((x) => x !== n.id), dn = d.length ? ` ${d.length} thing${d.length === 1 ? "" : "s"} depend on it (${names(d.slice(0, 4))}${d.length > 4 ? ", …" : ""}).` : " Nothing depends on it.";
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
    add({ id: `still:${sid}`, type: "still", stage: "keyframes", label: sid, scene: s.scene, shot: s.shot, size: s.size, how: s.how, gate: s.gate, file: s.file, attempts, model: j?.model, credits: jobs.filter((x) => attempts.includes(x.file)).reduce((a, x) => a + (x.credits || 0), 0), prompt: j?.prompt || "", raw_inputs: j?.inputs || [], inputs: s.scene && s.shot ? [{ id: `shot-${s.scene}-${s.shot}`, role: "shot" }] : [] });
    for (const a of attempts) byFile[a] = `still:${sid}`;
  }
  // clips and music
  for (const j of jobs) if (/video/.test(j.endpoint)) add({ id: `clip:${basename(j.file)}`, type: "clip", stage: "clips", label: basename(j.file, ".mp4"), file: j.file, seconds: j.seconds, model: j.model, credits: j.credits || 0, prompt: j.prompt || "", raw_inputs: j.inputs || [] });
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
      const role = n.type === "still" ? (k === 0 ? "image 1" : byId(nodes, id)?.type === "sheet" ? "portrait" : byId(nodes, id)?.type === "ref" ? "prop" : "reference") : n.type === "clip" ? "pinned still" : "reference";
      n.inputs.push({ id, role });
    }
    delete n.raw_inputs;
  }
  for (const n of nodes) for (const i of n.inputs) edges.push([i.id, n.id]);
  const tree = { label, kind: "run", nodes, edges, stages: STAGES.filter((s) => nodes.some((n) => n.stage === s)).map((s) => ({ id: s, explain: STAGE_EXPLAIN[s] })) };
  finish(tree); return tree;
}
const byId = (nodes, id) => nodes.find((n) => n.id === id);

export function sessionTree(S) {
  const nodes = [], edges = []; const add = (n) => { n.inputs ??= []; nodes.push(n); return n; };
  for (const m of S.materials || []) add({ id: `mat:${m}`, type: "material", stage: "assets", label: m, file: `materials/${m}`, credits: 0 });
  const produced = {};
  S.turns.forEach((t, ti) => {
    for (const f of t.sheet?.fields || []) if (f.value && f.source !== "not_applicable") add({ id: `sheet:${ti}:${f.field}`, type: "field", stage: "sheet", label: f.field, text: f.value, source: f.source, credits: 0 });
    (t.plan?.steps || []).forEach((st, i) => {
      const id = `step:${ti}:${i}`;
      add({ id, type: "step", stage: "job", label: `${st.tool}`, tool: st.tool, model: st.model, produces: st.produces, state: st.state, credits: st.credits || 0, prompt_file: st.prompt_file, params: st.params, inputs: st.inputs.map((x) => ({ id: produced[x] || `mat:${x}`, role: "input" })) });
      produced[st.produces] = id; if (!nodes.some((n) => n.id === `mat:${st.produces}`)) {}
    });
  });
  for (const n of nodes) n.inputs = n.inputs.filter((i) => nodes.some((x) => x.id === i.id));
  for (const n of nodes) for (const i of n.inputs) edges.push([i.id, n.id]);
  const tree = { label: S.id, kind: "session", nodes, edges, stages: STAGES.filter((s) => nodes.some((n) => n.stage === s)).map((s) => ({ id: s, explain: STAGE_EXPLAIN[s] })) };
  finish(tree); return tree;
}

function finish(tree) {
  const map = Object.fromEntries(tree.nodes.map((n) => [n.id, n]));
  for (const n of tree.nodes) { const d = dependents(tree, n.id); n.dependents = d; n.rerun_credits = d.reduce((a, id) => a + (map[id]?.credits || 0), 0); n.explain = explain(n, map, d); }
}

export function dependents(tree, id) {
  const out = new Set([id]); let grew = true;
  while (grew) { grew = false; for (const [a, b] of tree.edges) if (out.has(a) && !out.has(b)) { out.add(b); grew = true; } }
  return [...out];
}
export const rerun = (tree, id) => { const map = Object.fromEntries(tree.nodes.map((n) => [n.id, n])); const ids = dependents(tree, id); return { ids, credits: ids.reduce((a, i) => a + (map[i]?.credits || 0), 0) }; };
