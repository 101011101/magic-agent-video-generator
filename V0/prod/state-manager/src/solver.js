// Step 4: the state solver. Backward search over true/false conditions (current/docs/subsystems/05-solver.md).
// Each epoch: try non-join tools that make every condition true given perfect inputs; the join tool is the last pick.
// Each chosen tool's inputs become nested goals. Recurse until every condition ends at a leaf.
import { REFERENCE_ONLY, AUDIO_ATOMS } from "./signatures.js";

const MAX_DEPTH = 10;
const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const words = (s) => new Set(norm(s).split(" ").filter((w) => w.length > 2));
const similar = (a, b) => {
  if (norm(a) === norm(b)) return true;
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return false;
  let n = 0; for (const w of A) if (B.has(w)) n++;
  return n / Math.min(A.size, B.size) >= 0.6;
};
export const condKey = (c) => `${c.subject}.${c.atom}=${norm(c.value)}${c.from != null ? `<-${norm(c.from)}` : ""}`;
export const condText = (c) => c.from != null ? `${c.subject}.${c.atom}: ${c.from} → ${c.value}` : `${c.subject}.${c.atom} = ${c.value}`;

export function solve({ spec, sigs, judge }) {
  const nodes = [];       // tool nodes, leaves, unsolved
  const log = [];         // solver epochs
  const memo = new Map(); // goal key -> node id (shared nodes)
  const choiceMemo = new Map(); // goal key -> cheapest tool (cost search result)
  const boundAt = new Map(); // fictional binding -> node id of the first frame that created it
  const bindings = Object.fromEntries(spec.bindings.map((b) => [b.name, b]));
  const add = (n) => { n.id = `n${nodes.length + 1}`; n.uses = 1; nodes.push(n); return n.id; };
  const pending = []; // soft-credit questions, resolved before solving (see run order below)

  // ---- Build the top goal from the state spec ---------------------------------------------
  const segs = spec.segments.filter((s) => s.duration_s > 0 || spec.segments.length === 1);
  const groups = [];
  for (const s of segs) {
    const prev = groups[groups.length - 1];
    const continues = prev && s.type === "continuous" && (s.depends_on.includes(prev.segments.at(-1).id) || s.depends_on.length === 0);
    if (continues) prev.segments.push(s); else groups.push({ segments: [s] });
  }
  const groupGoals = groups.map((g, i) => {
    // A group's duration is the sum of its chunks; a duration condition inside a chunk (often the film's total) is dropped.
    const conds = mergeConds(g.segments.flatMap((s) => s.conditions).filter((c) => c.atom !== "duration"));
    const duration = g.segments.reduce((n, s) => n + s.duration_s, 0);
    conds.push({ subject: "format", atom: "duration", value: `${duration} s`, from: null, rigid: false });
    if (!conds.some((c) => c.atom === "aspect")) conds.push({ subject: "format", atom: "aspect", value: spec.format.aspect, from: null, rigid: false });
    return {
      media: spec.format.media, conds, duration, label: `Segment group ${i + 1}: ${g.segments.map((s) => s.name).join(" + ")}`,
      segmentIds: g.segments.map((s) => s.id), quote: g.segments.map((s) => s.quote).join(" "),
    };
  });
  const absent = (v) => /^(none|no\b|silent|n\/a|absent)/i.test(String(v).trim());
  const layerConds = spec.layers.filter((l) => !absent(l.value)).map((l) => ({ subject: l.subject, atom: l.atom, value: `${l.value} (${l.start_s}–${l.end_s} s)`, from: null, rigid: l.rigid, layer: true }));
  const top = {
    media: spec.format.media, label: "Operational PRD (whole video)", groups: groupGoals,
    conds: [...groupGoals.flatMap((g) => g.conds), ...layerConds], duration: spec.format.total_duration_s,
    quote: groupGoals.map((g) => g.quote).join(" "),
  };

  // ---- Leaves -----------------------------------------------------------------------------
  function uploadFor(goal) {
    if (goal.media === "text") return null;
    for (const u of spec.uploads) {
      if (u.media !== goal.media && !(goal.media === "image" && u.media === "image")) continue;
      const ok = goal.conds.every((c) => c.from == null && u.satisfies.some((s) => s.subject === c.subject && s.atom === c.atom && similar(s.value, c.value)));
      if (ok) return u;
    }
    return null;
  }
  function originalOnly(goal) {
    // A goal that needs a reference-only atom of a binding that only the user (ask) or a public source (research) can supply.
    const c = goal.conds.find((c) => REFERENCE_ONLY.has(c.atom) && ["ask", "research"].includes(bindings[c.subject]?.source));
    return c ? { kind: bindings[c.subject].source, binding: bindings[c.subject], cond: c } : null;
  }

  // ---- Coverage of a goal by one non-join tool ---------------------------------------------
  function coverage(tool, goal) {
    const assign = {}; const sets = []; const passes = []; const uncovered = [];
    // Array slots (several reference images) let each entity bring its own reference input.
    const arraySlot = tool.inputs.find((i) => i.media === "image" && /\[1\.\.\]|^references$|\[\]/.test(i.slot) && i.provides.includes("identity"))?.slot;
    const refSubjectSlot = {};
    const put = (slot, c) => {
      if (REFERENCE_ONLY.has(c.atom) && bindings[c.subject] && arraySlot) {
        const owner = Object.entries(refSubjectSlot).find(([, sl]) => sl === slot)?.[0];
        if (!refSubjectSlot[c.subject]) refSubjectSlot[c.subject] = owner && owner !== c.subject ? `${arraySlot}#${c.subject}` : slot;
        slot = refSubjectSlot[c.subject];
      }
      (assign[slot] ||= []).push(c); passes.push({ cond: c, slot: slot.split("#")[0] });
    };
    for (const c of goal.conds) {
      const a = c.atom;
      const bound = bindings[c.subject];
      const refOnly = REFERENCE_ONLY.has(a) && bound;
      // A fictional entity is bound by the first image that makes it (a full keyframe or a reference); later goals pass it through.
      const creatingBinding = goal.refFor === c.subject || (goal.media === "image" && bound?.source === "generate" && !boundAt.has(c.subject));
      const canSet = (tool.makes.has(a) || tool.passOrSet.has(a)) && (!refOnly || creatingBinding);
      const pass = tool.passes[a] || (tool.passOrSet.has(a) && tool.mainSlot ? { slot: tool.mainSlot } : null);
      if (c.from == null) {
        if (pass && (refOnly || !canSet || tool.passes[a])) put(pass.slot, c);
        else if (canSet) sets.push(c);
        else uncovered.push(c);
      } else {
        // The segment starts in the "from" state: a tool with a start frame gets the from-value in that frame,
        // and the prompt animates it to the "to" value.
        const startSlot = tool.mainSlot && tool.inputs.find((i) => i.slot === tool.mainSlot && i.media === "image" && i.provides.includes(a));
        if (canSet && !refOnly && startSlot && tool.mediaOut.includes("video")) { put(tool.mainSlot, { ...c, value: c.from, from: null, phase: "start" }); sets.push(c); }
        else if (canSet && !refOnly) sets.push(c);
        else if (pass?.endSlot) { put(pass.slot, { ...c, value: c.from, from: null, phase: "start" }); put(pass.endSlot, { ...c, from: null, phase: "end" }); }
        else if (pass && refOnly) put(pass.slot, { ...c, from: null });
        else uncovered.push(c);
      }
    }
    // Every required non-text input slot must receive at least one condition (otherwise the tool needs an input we have no goal for).
    const missing = tool.inputs.filter((i) => i.required && i.media !== "text" && !assign[i.slot] && !/^segments|^layers/.test(i.slot)).map((i) => i.slot);
    // An input that would carry only format atoms (duration, aspect...) has no content goal: the tool is the wrong fit.
    const FORMAT = new Set(["duration", "aspect", "resolution", "frame_rate"]);
    for (const [slot, cs] of Object.entries(assign)) if (cs.every((c) => FORMAT.has(c.atom))) missing.push(`${slot.split("#")[0]} (format only)`);
    return { tool, assign, sets, passes, uncovered, missingSlots: missing };
  }

  // ---- Solve one goal ---------------------------------------------------------------------
  function solveGoal(goal, depth, ancestors) {
    const key = `${goal.media}|${goal.refFor || ""}|${goal.conds.map(condKey).sort().join(";")}`;
    // A goal equal to one of its own ancestors would loop: that tool path makes no progress.
    if (depth > MAX_DEPTH || ancestors.has(key)) return add({ type: "unsolved", goal: brief(goal), depth, reason: depth > MAX_DEPTH ? "max depth" : "cycle: this input is the same goal as an ancestor, so the tool makes no progress" });
    if (memo.has(key)) { const id = memo.get(key); nodes.find((n) => n.id === id).uses++; log.push({ depth, goal: brief(goal), decision: `shared node ${id}` }); return id; }
    if (goal.refFor && boundAt.has(goal.refFor)) {
      const id = boundAt.get(goal.refFor); nodes.find((n) => n.id === id).uses++;
      log.push({ depth, goal: brief(goal), decision: `reference = the frame that created ${goal.refFor} (${id})` }); return id;
    }
    if (goal.base) { const id = deriveFrame(goal, depth, ancestors); if (id) return id; }
    const anc = new Set(ancestors).add(key);
    const entry = { depth, goal: brief(goal), candidates: [] };
    log.push(entry);
    let id;

    // Leaves first.
    if (goal.media === "text") { id = add({ type: "leaf", leaf: "authored", label: goal.label, conds: goal.conds, quote: goal.quote, depth }); entry.decision = "authored (prompt or spec text)"; }
    else if (goal.audioUnbound) { /* handled by tools */ }
    if (!id) {
      const u = uploadFor(goal);
      if (u) { id = add({ type: "leaf", leaf: "given", label: `upload: ${u.name}`, conds: goal.conds, depth }); entry.decision = `given input (${u.name})`; }
    }
    if (!id) {
      const o = originalOnly(goal);
      if (o && goal.conds.every((c) => c.subject === o.cond.subject)) {
        id = add({ type: "leaf", leaf: o.kind, label: `${o.kind}: ${o.binding.description}`, conds: goal.conds, depth });
        entry.decision = `${o.kind} (original-only: ${o.binding.name})`;
      }
    }
    if (id) { memo.set(key, id); return id; }

    // Non-join tools.
    const multiGroup = (goal.groups?.length || 0) > 1;
    const hasLayers = goal.conds.some((c) => c.layer) && goal.conds.some((c) => !c.layer);
    // Landmark-first policy: a video goal with bound entities is animated from landmark frames (image-to-video family),
    // not invented from text. Text-only video tools are kept for pure scenery.
    const hasBoundEntity = goal.conds.some((c) => REFERENCE_ONLY.has(c.atom) && bindings[c.subject]);
    const candidates = multiGroup || hasLayers ? [] : sigs.tools.filter((t) => t.kind !== "join" && t.mediaOut.includes(goal.media)
      && !(goal.media === "video" && t.maxDuration && goal.duration > t.maxDuration)
      && !(goal.media === "video" && hasBoundEntity && t.kind === "from_scratch"));
    const scored = [];
    for (const t of candidates) {
      const cov = coverage(t, goal);
      const soft = [];
      for (const c of [...cov.uncovered]) {
        if (c.rigid || cov.uncovered.length > 4) continue;
        const ans = judge.lookup(t, c);
        if (ans?.can) { soft.push({ cond: c, confidence: ans.confidence }); cov.uncovered = cov.uncovered.filter((x) => x !== c); cov.sets.push(c); }
        else if (!ans) judge.request(t, c);
      }
      cov.soft = soft;
      const subgoalSlots = Object.keys(cov.assign).length;
      // Progress rule: a non-join tool must make at least one condition true; pure pass-through tools loop.
      const progress = cov.sets.length > 0;
      scored.push({ cov, ok: progress && cov.uncovered.length === 0 && cov.missingSlots.length === 0, rank: [soft.length, cov.passes.length, subgoalSlots, /Magic Hour|unbound/.test(t.provider) ? 1 : 0] });
    }
    scored.sort((a, b) => (b.ok - a.ok) || cmp(a.rank, b.rank) || (a.cov.uncovered.length - b.cov.uncovered.length));
    entry.candidates = scored.slice(0, 6).map((s) => ({
      tool: s.cov.tool.name, ok: s.ok, sets: s.cov.sets.length, passes: s.cov.passes.length, soft: s.cov.soft.length,
      uncovered: s.cov.uncovered.map(condText), missingSlots: s.cov.missingSlots,
    }));
    // Try qualifying tools in rank order. Backtrack when a tool's inputs end unsolved; keep the best attempt.
    const ok = scored.filter((x) => x.ok).slice(0, 4);
    const build = (choice) => {
      const t = choice.cov.tool;
      const node = { type: "tool", tool: t.name, provider: t.provider, proposed: t.proposed, depth, label: goal.label, refFor: goal.refFor || null, goalConds: goal.conds,
        sets: choice.cov.sets, passes: choice.cov.passes, soft: choice.cov.soft, inputs: [] };
      const nid = add(node); memo.set(key, nid);
      for (const c of choice.cov.sets) if (REFERENCE_ONLY.has(c.atom) && bindings[c.subject]?.source === "generate" && !boundAt.has(c.subject)) boundAt.set(c.subject, nid);
      const promptSlot = t.inputs.find((i) => i.media === "text");
      if (promptSlot && (choice.cov.sets.length || promptSlot.required))
        node.inputs.push({ slot: promptSlot.slot, node: solveGoal({ media: "text", conds: choice.cov.sets, label: `${t.name} prompt`, quote: goal.quote }, depth + 1, anc) });
      const slotGoals = {};
      for (const [slot, conds] of Object.entries(choice.cov.assign)) {
        const base = slot.split("#")[0];
        const endOf = Object.values(t.passes).find((p) => p.endSlot === base)?.slot;
        if (endOf && slotGoals[endOf]) {
          // End frame = start frame + the changes (an edit of the shared start frame), not a fresh image.
          const changes = conds.filter((c) => c.phase === "end");
          node.inputs.push({ slot: base, node: solveGoal({ media: "image", base: slotGoals[endOf], changes, conds: applyChanges(slotGoals[endOf].conds, changes), label: "End frame = start frame + changes", quote: goal.quote }, depth + 1, anc) });
          continue;
        }
        const input = t.inputs.find((i) => i.slot === base) || { media: "image" };
        const subRef = conds.every((c) => REFERENCE_ONLY.has(c.atom)) && new Set(conds.map((c) => c.subject)).size === 1 && bindings[conds[0].subject]?.source === "generate" ? conds[0].subject : null;
        const sub = { media: input.media, conds: dedupe(conds), refFor: subRef, label: subRef ? `Reference for ${subRef}` : `${t.name} → ${base}`, quote: goal.quote };
        slotGoals[base] = sub;
        const childId = solveGoal(sub, depth + 1, anc);
        // One frame that created several bindings is one reference input, not several.
        if (node.inputs.some((i) => i.slot === base && i.node === childId)) { nodes.find((n) => n.id === childId).uses--; continue; }
        node.inputs.push({ slot: base, node: childId });
      }
      return nid;
    };
    const snapshot = () => ({ n: nodes.length, l: log.length, memo: new Map(memo), uses: nodes.map((x) => x.uses), bound: new Map(boundAt) });
    const restore = (sn) => { nodes.length = sn.n; log.length = sn.l; memo.clear(); for (const [k, v] of sn.memo) memo.set(k, v); sn.uses.forEach((u, i) => (nodes[i].uses = u)); boundAt.clear(); for (const [k, v] of sn.bound) boundAt.set(k, v); };
    if (ok.length) {
      // Cost search: build each qualifying tool's full subtree, count what it really costs, keep the cheapest.
      // The choice is cached per goal, so nested goals are searched once.
      if (choiceMemo.has(key)) {
        const c = ok.find((x) => x.cov.tool.name === choiceMemo.get(key).tool) || ok[0];
        entry.decision = `tool: ${c.cov.tool.name}`; entry.costs = choiceMemo.get(key).costs;
        return build(c);
      }
      const before = snapshot();
      const costs = [];
      for (const choice of ok) {
        build(choice);
        const added = nodes.slice(before.n);
        costs.push({ tool: choice.cov.tool.name, cost: added.reduce((n, x) => n + nodeCost(x), 0), unsolved: added.filter((x) => x.type === "unsolved").length });
        restore(before);
      }
      const bestC = costs.reduce((a, b) => (b.cost < a.cost ? b : a));
      choiceMemo.set(key, { tool: bestC.tool, costs });
      entry.decision = `tool: ${bestC.tool}`; entry.costs = costs;
      return build(ok.find((x) => x.cov.tool.name === bestC.tool));
    }

    // Join tools: the last pick.
    const join = pickJoin(goal);
    if (join) {
      entry.decision = `join: ${join.tool}`;
      const node = { type: "tool", tool: join.tool, provider: sigs.byName[join.tool]?.provider, proposed: sigs.byName[join.tool]?.proposed, join: true, depth, label: goal.label, goalConds: goal.conds, sets: [], passes: [], soft: [], inputs: [] };
      id = add(node); memo.set(key, id);
      if (join.tool === "stitch") { for (const [i, v] of solveChain(goal.groups, depth + 1, anc).entries()) node.inputs.push({ slot: `segments[${i}]`, node: v }); return id; }
      for (const part of join.parts) node.inputs.push({ slot: part.slot, node: solveGoal(part.goal, depth + 1, anc) });
      return id;
    }
    entry.decision = "unsolved";
    const best2 = scored[0];
    id = add({ type: "unsolved", goal: brief(goal), depth, reason: best2 ? `closest: ${best2.cov.tool.name}; uncovered: ${best2.cov.uncovered.map(condText).join("; ")}${best2.cov.missingSlots.length ? `; missing inputs: ${best2.cov.missingSlots.join(", ")}` : ""}` : "no tool for this media" });
    memo.set(key, id);
    return id;
  }

  // ---- Scene chain (decided in chat): each group starts from the end frame of the group it depends on, ----
  // because that frame already has the held conditions right. Only conditions that differ are flipped by the editor.
  // Every group gets an end frame (start frame + its changes) so the next group can start from it.
  // Only the first group, or a group with no dependency, gets a fresh landmark (text-to-image).
  function solveChain(groups, depth, anc) {
    const FRAME_SKIP = new Set(["duration"]);
    const startConds = (g) => g.conds.filter((c) => !FRAME_SKIP.has(c.atom)).map((c) => (c.from != null ? { ...c, value: c.from, from: null, phase: "start" } : c));
    const endConds = (g) => g.conds.filter((c) => !FRAME_SKIP.has(c.atom)).map((c) => (c.from != null ? { ...c, from: null, phase: undefined, seq: undefined } : c));
    const videos = [];
    let prev = null; // { node, state, lastSegment, loc }
    const locations = new Map(); // location id -> { node: last frame made there, state, loc }
    // The state of a frame accumulates: everything true in the previous frame stays true unless this scene flips it.
    // Scene-wide atoms (background, lighting, camera, style) have one value per frame, so a new value replaces the old one.
    const SCENE_WIDE = new Set(["background", "lighting", "camera", "style"]);
    const apply = (state, conds) => {
      let out = [...state];
      for (const c of conds) out = out.filter((o) => !(o.subject === c.subject && o.atom === c.atom) && !(SCENE_WIDE.has(c.atom) && o.atom === c.atom));
      return [...out, ...conds];
    };
    for (const [i, g] of groups.entries()) {
      const firstSeg = spec.segments.find((s) => s.id === g.segmentIds[0]);
      const dependsOnPrev = prev && firstSeg?.depends_on?.includes(prev.lastSegment);
      const sConds = startConds(g), eConds = endConds(g);
      let startNode, base, baseState, handoff;
      const loc = locationOf(sConds);
      const seen = loc ? [...locations.values()].find((l) => sameLocation(l.loc, loc)) : null;
      const startLog = (decision) => log.push({ depth, goal: brief({ ...g, conds: sConds, label: `${g.label} — start frame` }), decision });
      if (dependsOnPrev && (!loc || !prev.loc || sameLocation(prev.loc, loc))) {
        // Same location, continuing: start on the previous end frame, flip only what differs.
        base = prev.node; baseState = prev.state;
        startNode = flipFrom(base, baseState, sConds, `Start of ${g.label} = end of previous scene, flipping only what differs`, depth, anc);
        handoff = startNode === base ? "exact" : "edited";
        startLog(startNode === base ? `handoff: exact end frame of the previous scene (${base})` : `handoff: edit of the previous end frame (${base}), flipping only differing conditions`);
      } else if (seen) {
        // Back to a location seen before: its last frame is the basis; entities merge in from their references.
        base = seen.node; baseState = seen.state;
        startNode = flipFrom(base, baseState, sConds, `Start of ${g.label} = back at ${loc.key}: last frame there (${base}) + entities merged`, depth, anc);
        handoff = "return";
        startLog(`return to location ${loc.key}: basis = last frame there (${base}); entities merged from references`);
      } else {
        // New location: a fresh plate of the location (text-to-image; may create new fictional entities), then bound entities merge in.
        const plateConds = sConds.filter((c) => { const b = bindings[c.subject]; return !b || ["scene", "style"].includes(b.kind) || (b.source === "generate" && !boundAt.has(c.subject)); });
        base = solveGoal({ media: "image", conds: plateConds, label: `${g.label} — location plate${loc ? ` (${loc.key})` : ""}`, quote: "" }, depth, anc);
        baseState = plateConds;
        startNode = flipFrom(base, baseState, sConds, `Start of ${g.label} = new location plate + entities merged`, depth, anc);
        handoff = "new";
        startLog(`new location${loc ? ` ${loc.key}` : ""}: fresh plate (${base})${startNode !== base ? `, entities merged (${startNode})` : ""}`);
      }
      const changes = g.conds.filter((c) => c.from != null);
      // The state drops exactly what the frame stripped; everything else stays, listed or not.
      const stripped = startNode !== base ? nodes.find((n) => n.id === startNode)?.strip || [] : [];
      const startState = apply(baseState.filter((c) => !stripped.includes(c.subject)), sConds);
      // A change always counts as a flip: a scene with changes always gets a real end frame.
      const endNode = changes.length ? flipFrom(startNode, startState, eConds, `End of ${g.label} = start frame + changes`, depth, anc, changes) : startNode;
      const i2v = sigs.byName["Image-to-Video"];
      // handoff: exact | edited = same scene (continues the previous shot); return | new = a cut (new scene).
      const video = { type: "tool", tool: i2v.name, provider: i2v.provider, depth, label: g.label, goalConds: g.conds, handoff, startBase: base,
        sets: changes.length ? changes : g.conds.filter((c) => ["camera", "pose_action", "expression"].includes(c.atom)), passes: sConds.filter((c) => c.from == null && c.phase !== "start").map((c) => ({ cond: c, slot: "assets.image_file_path" })), soft: [], inputs: [] };
      const vid = add(video);
      video.inputs.push({ slot: "style.prompt", node: add({ type: "leaf", leaf: "authored", label: `Image-to-Video prompt (motion from start to end frame)`, conds: video.sets, depth: depth + 1 }) });
      video.inputs.push({ slot: "assets.image_file_path", node: startNode });
      if (endNode !== startNode) video.inputs.push({ slot: "assets.end_image_file_path", node: endNode });
      log.push({ depth, goal: brief(g), decision: `Image-to-Video ${vid}: start ${startNode}${endNode !== startNode ? `, end ${endNode}` : ""}` });
      videos.push(vid);
      const endState = apply(startState, eConds);
      prev = { node: endNode, state: endState, lastSegment: g.segmentIds.at(-1), loc: locationOf(eConds) || loc };
      const endLoc = prev.loc;
      if (endLoc) { const k = [...locations.keys()].find((key) => sameLocation(locations.get(key).loc, endLoc)) || endLoc.key; locations.set(k, { node: endNode, state: endState, loc: endLoc }); }
    }
    return videos;
  }

  // A frame's location: the subject of its background condition when it is a scene binding, else the background value.
  function locationOf(conds) {
    const c = conds.find((x) => x.atom === "background");
    if (!c) return null;
    const b = bindings[c.subject];
    return b && b.kind === "scene" ? { key: c.subject, binding: true, value: c.value } : { key: norm(c.value).split(" ").slice(0, 4).join("_"), binding: false, value: c.value };
  }
  function sameLocation(a, b) {
    if (a.binding && b.binding) return a.key === b.key;
    return similar(a.value, b.value);
  }

  // Edit a frame into a target state: keep every condition it already has, flip only the ones that differ.
  // A new entity (reference-only atom not in the frame) enters through a clean reference image of that entity alone.
  function flipFrom(frameNode, frameConds, target, label, depth, anc, forced = []) {
    const isForced = (c) => forced.some((f) => f.subject === c.subject && f.atom === c.atom);
    const has = (c) => !isForced(c) && frameConds.some((f) => f.subject === c.subject && f.atom === c.atom && similar(f.value, c.value));
    const diff = target.filter((c) => !has(c));
    // Components of the frame that are not in the target scene are stripped (entities, and props that are no longer listed).
    // Not listed is not the same as gone: characters and products leave when they are not in the next scene;
    // props and scenery leave only when the location changes.
    const targetSubjects = new Set(target.map((c) => c.subject));
    const locationChanged = target.some((c) => c.atom === "background" && !has(c));
    const strip = [...new Set(frameConds.filter((f) => {
      const k = bindings[f.subject]?.kind;
      if (!k || ["scene", "style"].includes(k) || targetSubjects.has(f.subject)) return false;
      return ["character", "product"].includes(k) || locationChanged;
    }).map((f) => f.subject))];
    if (!diff.length && !strip.length) { nodes.find((n) => n.id === frameNode).uses++; return frameNode; }
    const editor = sigs.byName["AI Image Editor"];
    const newEntities = [...new Set(diff.filter((c) => REFERENCE_ONLY.has(c.atom) && bindings[c.subject]).map((c) => c.subject))];
    const sets = diff.filter((c) => !REFERENCE_ONLY.has(c.atom));
    const node = { type: "tool", tool: editor.name, provider: editor.provider, depth, label, goalConds: target, sets, strip,
      passes: target.filter((c) => has(c)).map((c) => ({ cond: c, slot: "assets.image_file_paths[0]" })).concat(diff.filter((c) => REFERENCE_ONLY.has(c.atom)).map((c) => ({ cond: c, slot: "assets.image_file_paths[1..]" }))), soft: [], inputs: [] };
    const id = add(node);
    node.inputs.push({ slot: "style.prompt", node: add({ type: "leaf", leaf: "authored", label: "AI Image Editor prompt (flip only what differs)", conds: sets, depth: depth + 1 }) });
    node.inputs.push({ slot: "assets.image_file_paths[0]", node: frameNode }); nodes.find((n) => n.id === frameNode).uses++;
    for (const e of newEntities) {
      const refConds = diff.filter((c) => c.subject === e && REFERENCE_ONLY.has(c.atom));
      node.inputs.push({ slot: "assets.image_file_paths[1..]", node: cleanReference(e, refConds, depth + 1, anc) });
    }
    return id;
  }

  // A reference must show only its entity. An entity first bound inside a full frame gets a clean reference
  // isolated from that frame (same look, nothing else); it is made once and reused.
  const cleanRefs = new Map();
  function cleanReference(e, refConds, depth, anc) {
    if (cleanRefs.has(e)) { const id = cleanRefs.get(e); nodes.find((n) => n.id === id).uses++; return id; }
    const b = bindings[e];
    const boundNode = boundAt.has(e) ? nodes.find((n) => n.id === boundAt.get(e)) : null;
    let id;
    if (boundNode && boundNode.refFor !== e) {
      const editor = sigs.byName["AI Image Editor"];
      const node = { type: "tool", tool: editor.name, provider: editor.provider, depth, label: `Clean reference for ${e}, isolated from ${boundNode.id}`, refFor: e, goalConds: refConds,
        sets: [{ subject: e, atom: "background", value: "plain neutral background, nothing else", from: null, rigid: false }], passes: refConds.map((c) => ({ cond: c, slot: "assets.image_file_paths[0]" })), soft: [], inputs: [] };
      id = add(node);
      node.inputs.push({ slot: "style.prompt", node: add({ type: "leaf", leaf: "authored", label: `Isolate ${e}`, conds: node.sets, depth: depth + 1 }) });
      node.inputs.push({ slot: "assets.image_file_paths[0]", node: boundNode.id }); boundNode.uses++;
      log.push({ depth, goal: brief({ media: "image", conds: refConds, label: `Reference for ${e}` }), decision: `clean reference: isolate ${e} from the frame that created it (${boundNode.id})` });
    } else {
      id = solveGoal({ media: "image", conds: refConds, refFor: b?.source === "generate" ? e : null, label: `Reference for ${e}`, quote: "" }, depth, anc);
    }
    cleanRefs.set(e, id);
    return id;
  }

  // An end frame is an edit of its start frame: the image editor keeps the start frame and sets only the changes.
  function deriveFrame(goal, depth, ancestors) {
    const editor = sigs.byName["AI Image Editor"];
    const settable = goal.changes.every((c) => !REFERENCE_ONLY.has(c.atom) && (editor.makes.has(c.atom) || editor.passOrSet.has(c.atom)));
    if (!settable) return null;
    const key = `derive|${goal.base.conds.map(condKey).sort().join(";")}|${goal.changes.map(condKey).sort().join(";")}`;
    if (memo.has(key)) { const id = memo.get(key); nodes.find((n) => n.id === id).uses++; return id; }
    log.push({ depth, goal: brief(goal), decision: "derive: AI Image Editor on the start frame (sets only the changes)" });
    const node = { type: "tool", tool: editor.name, provider: editor.provider, depth, label: goal.label, goalConds: goal.conds,
      sets: goal.changes.map((c) => ({ ...c, phase: undefined })), passes: goal.base.conds.filter((b) => !goal.changes.some((c) => c.subject === b.subject && c.atom === b.atom)).map((c) => ({ cond: c, slot: "assets.image_file_paths[0]" })), soft: [], inputs: [] };
    const id = add(node); memo.set(key, id);
    const anc = new Set(ancestors).add(key);
    node.inputs.push({ slot: "style.prompt", node: solveGoal({ media: "text", conds: node.sets, label: "AI Image Editor prompt (changes only)", quote: goal.quote }, depth + 1, anc) });
    node.inputs.push({ slot: "assets.image_file_paths[0]", node: solveGoal(goal.base, depth + 1, anc) });
    return id;
  }

  function pickJoin(goal) {
    const audio = goal.conds.filter((c) => AUDIO_ATOMS.has(c.atom));
    const visual = goal.conds.filter((c) => !AUDIO_ATOMS.has(c.atom));
    if (audio.length && visual.length && goal.media === "video") {
      const parts = [{ slot: "video", goal: { ...goal, conds: visual, label: `${goal.label} — picture` } }];
      for (const [slot, atoms] of [["speech", ["speech_audio", "voice"]], ["music", ["music"]], ["sfx", ["sfx"]]]) {
        const cs = audio.filter((c) => atoms.includes(c.atom));
        if (cs.length) parts.push({ slot, goal: { media: "audio", conds: cs, label: `${goal.label} — ${slot}`, quote: goal.quote } });
      }
      return { tool: "audio_mix_mux", parts };
    }
    const text = goal.conds.filter((c) => c.atom === "text" && c.layer);
    if (text.length && visual.length > text.length) {
      return { tool: "text_overlay", parts: [
        { slot: "base", goal: { ...goal, conds: goal.conds.filter((c) => !text.includes(c)), label: `${goal.label} — without text` } },
        { slot: "text", goal: { media: "text", conds: text, label: "Text overlay spec (content, typography, timing)", quote: goal.quote } },
      ] };
    }
    if ((goal.groups?.length || 0) > 1) {
      return { tool: "stitch", parts: goal.groups.map((g, i) => ({ slot: `segments[${i}]`, goal: { ...g } })) };
    }
    const layered = goal.conds.filter((c) => c.atom === "visibility" || c.atom === "layer_position");
    if (layered.length) {
      const elements = [...new Set(layered.map((c) => c.subject))];
      const parts = [{ slot: "base", goal: { media: goal.media, conds: goal.conds.filter((c) => c.subject === "format" || ["background"].includes(c.atom)), label: `${goal.label} — canvas`, quote: goal.quote } }];
      for (const [i, el] of elements.entries()) {
        let lc = dedupe(goal.conds.filter((c) => c.subject === el && !["visibility", "layer_position"].includes(c.atom)).map((c) => ({ ...c, from: null })));
        if (!lc.length) lc = [{ subject: el, atom: "identity", value: bindings[el]?.description || el, from: null, rigid: false }];
        parts.push({ slot: `layers[${i}]`, goal: { media: "image", conds: lc, refFor: bindings[el]?.source === "generate" ? el : null, label: `Layer: ${el}`, quote: goal.quote } });
      }
      parts.push({ slot: "keyframes", goal: { media: "text", conds: layered, label: "Keyframes (visibility and position over time)", quote: goal.quote } });
      return { tool: "layer_composite", parts };
    }
    return null;
  }

  return {
    top, prepare() { solveGoal(top, 0, new Set()); return pending; },
    finish() { const root = nodes.length ? nodes[0].id : null; return { root, nodes, log, schedule: schedule(nodes) }; },
    reset() { nodes.length = 0; log.length = 0; memo.clear(); choiceMemo.clear(); boundAt.clear(); cleanRefs.clear(); },
  };
}

// Cost of one plan node: a generative or unbound call = 1, our deterministic call = 0.5, unsolved = 100, leaves free.
function nodeCost(n) {
  if (n.type === "unsolved") return 100;
  if (n.type !== "tool") return n.leaf === "ask" || n.leaf === "research" ? 2 : 0;
  return /ours/.test(n.provider || "") ? 0.5 : 1;
}
function applyChanges(conds, changes) {
  const out = conds.filter((c) => !changes.some((x) => x.subject === c.subject && x.atom === c.atom));
  return [...out, ...changes.map((c) => ({ ...c, phase: undefined }))];
}
function brief(goal) { return { label: goal.label, media: goal.media, conds: goal.conds.map(condText), refFor: goal.refFor || null }; }
function cmp(a, b) { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; }
function dedupe(conds) { const seen = new Set(); return conds.filter((c) => { const k = condKey(c) + (c.phase || ""); if (seen.has(k)) return false; seen.add(k); return true; }); }

// Merge the conditions of consecutive continuous segments: held conditions dedupe; a sequence of changes on one
// subject.atom becomes one change from the first "from" to the last value, keeping the sequence for the prompt.
function mergeConds(conds) {
  const out = []; const changes = new Map();
  for (const c of conds) {
    if (c.from == null) { if (!out.some((o) => o.from == null && o.subject === c.subject && o.atom === c.atom && norm(o.value) === norm(c.value)) && !changes.has(`${c.subject}.${c.atom}`)) out.push({ ...c }); continue; }
    const k = `${c.subject}.${c.atom}`;
    if (!changes.has(k)) { const m = { ...c, seq: [c.from, c.value] }; changes.set(k, m); out.push(m); }
    else { const m = changes.get(k); m.seq.push(c.value); m.value = c.value; m.rigid = m.rigid || c.rigid; }
  }
  // A held condition on an atom that also changes in the group is the change's start state, not a separate condition.
  return out.filter((c) => c.from != null || !changes.has(`${c.subject}.${c.atom}`)).map((c) => c.seq && c.seq.length > 2 ? { ...c, value: c.seq.slice(1).join(" → ") } : c);
}

// Execution order: leaves are level 0; a tool runs one level after its latest input.
function schedule(nodes) {
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const level = {};
  const lv = (id) => {
    if (level[id] != null) return level[id];
    const n = byId[id];
    level[id] = n.type === "tool" ? 1 + Math.max(0, ...n.inputs.map((i) => lv(i.node))) : 0;
    return level[id];
  };
  nodes.forEach((n) => lv(n.id));
  const max = Math.max(0, ...Object.values(level));
  return Array.from({ length: max + 1 }, (_, i) => nodes.filter((n) => level[n.id] === i).map((n) => n.id));
}
