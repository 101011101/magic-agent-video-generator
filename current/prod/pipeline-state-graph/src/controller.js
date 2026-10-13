// Deterministic controller, one beat at a time: resolve the latest version of each needed entity → pick the seed frame
// (continuous: the real last frame; cut: graph.pickSeed) → plan edit/merge/new → derive the prompt from state differences →
// run the image job → verify against the wanted state → retry with the faults spelled out → fall back to the next seed →
// accept (forced acceptances are flagged, never silent) → record what the frame shows, with pointers → clip → record the real
// last frame. Every decision goes to graph.decisions and log.beats[n].
import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { firstFrame, lastFrame } from "../../state-manager/src/continuity.js";
import { framePrompt, fixText, videoPrompt, safeVideoPrompt, anchorPrompt, cm } from "./prompts.js";
import { verifyFrame } from "./verify.js";
import { COST } from "./jobs.js";

export const RETRIES = { same_seed: 1, fallback_seeds: 1 };
export const RETAKES = { per_clip: 1, max: 3 };

export class Controller {
  constructor({ runDir, graph, jobs, log, timeline, IMAGE, VIDEO, clipSound }) {
    Object.assign(this, { runDir, graph, jobs, log, timeline, IMAGE, VIDEO, clipSound });
    this.ents = graph.entities; this.style = timeline.style; this.estimate = jobs.estimate; this.retakes = 0;
    log.beats ??= {};
  }
  // Uploads are the one allowed clean standalone image: registered as accepted frames so the seed picker finds them.
  async registerUploads(uploads) {
    for (const e of Object.values(this.ents)) {
      const file = `uploads/${e.upload}.png`;
      if (!e.upload || !uploads[e.upload] || this.graph.frames.some((f) => f.op === "upload" && f.file === file)) continue;
      const beat = this.timeline.beats.find((b) => b.start.entities.some((s) => s.id === e.id) || b.end.entities.some((s) => s.id === e.id));
      if (!beat) continue;
      const role = beat.start.entities.some((s) => s.id === e.id) ? "start" : "end";
      const want = this.graph.want(beat, role); want.entities = want.entities.filter((s) => s.id === e.id || this.ents[s.id].upload === e.upload);
      const v = this.estimate ? { shows: Object.fromEntries(want.entities.map((s) => [s.id, { version: s.version, ok: true, problems: [] }])), hard: [], soft: [] } : await verifyFrame(this.runDir, file, want, this.ents, []);
      for (const s of Object.values(v.shows)) { s.ok = true; } // the upload defines the identity; its own faults are not faults
      // An upload has no verified place: it scores on its entities only, and its background is never "the same place".
      const f = this.graph.addFrame({ file, beat: beat.n, role: "upload", location: null, loc_version: null, shows: v.shows, seed: null, merged: [], op: "upload", why: `upload ${e.upload} shows ${e.id}`, accepted: true, forced: false, attempt: 0, checks: { hard: v.hard, soft: v.soft } });
      this.graph.decide({ beat: beat.n, kind: "upload", frame: f.id, entity: e.id });
    }
  }

  async runBeat(beat, prev) {
    const { graph, jobs, log } = this, n = beat.n, L = (log.beats[n] ??= { attempts: [] });
    const want = graph.want(beat, "start");
    L.want_start = want; L.link = beat.link;
    if (want.conflicts.length) graph.decide({ beat: n, kind: "timeline-conflict", conflicts: want.conflicts });
    let start, startFrame;
    if (beat.link === "continuous" && prev?.lastFrame) ({ start, startFrame } = await this.continuousStart(beat, prev, want));
    else ({ start, startFrame } = await this.cutStart(beat, want));
    L.start_file = start; L.start_frame = startFrame?.id || null;
    // Clip, from the start frame only (no end frame: wan freezes then snaps). The real last frame is verified against the end
    // state; a character whose identity fails there (the model invented someone else) gets one retake, run-wide cap RETAKES.max.
    const continuous = beat.link === "continuous" && !!prev?.lastFrame;
    const prompt = videoPrompt(beat, this.clipSound[n], this.ents, { continuous });
    L.video_prompt = prompt; L.sound = this.clipSound[n] || "";
    const wantEnd = graph.want(beat, "end");
    const refs = startFrame ? [{ file: startFrame.file, ids: Object.keys(startFrame.shows).filter((id) => startFrame.shows[id].ok) }] : [];
    wantEnd.placeRef = startFrame && startFrame.location === beat.location ? 0 : null;
    const takes = [];
    for (let take = 1; ; take++) {
      const file = `b${n}-t${take}.mp4`, key = `clip:b${n}${take > 1 ? `:t${take}` : ""}`;
      try {
        await jobs.run(key, file, { prompt, seconds: beat.seconds, video: this.VIDEO, take }, [start], COST.video_per_s * beat.seconds,
          () => jobs.video(`${log.run} b${n} t${take}`, prompt, start, beat.seconds, file, this.VIDEO));
      } catch (e) {
        if (!/nsfw|content policy/i.test(String(e))) throw e;
        const safe = safeVideoPrompt(beat); L.video_prompt_rejected = prompt; L.video_prompt = safe;
        graph.decide({ beat: n, kind: "prompt-rejected", key, error: String(e.message).slice(0, 200), fallback: safe });
        console.log(`  ${key}: prompt rejected by the content filter → bare action prompt`);
        await jobs.run(`${key}:safe`, file, { prompt: safe, seconds: beat.seconds, video: this.VIDEO, take }, [start], COST.video_per_s * beat.seconds,
          () => jobs.video(`${log.run} b${n} t${take} safe`, safe, start, beat.seconds, file, this.VIDEO));
      }
      if (this.estimate) break;
      firstFrame(join(this.runDir, file), join(this.runDir, `b${n}-t${take}-first.png`));
      lastFrame(join(this.runDir, file), join(this.runDir, `b${n}-t${take}-last.png`));
      const v = await verifyFrame(this.runDir, `b${n}-t${take}-last.png`, wantEnd, this.ents, refs);
      const chars = wantEnd.entities.filter((e) => e.kind === "character").map((e) => e.id);
      const identity = v.hard.filter((h) => chars.some((id) => h.startsWith(`${id} `)) && /identity differs|missing|appears \d+ times/.test(h));
      takes.push({ take, file, v, identity });
      graph.decide({ beat: n, kind: "clip-last-check", take, ok: Object.fromEntries(Object.entries(v.shows).map(([id, s]) => [id, s.ok])), faults: [...v.hard, ...v.soft], identity });
      if (!identity.length || take > RETAKES.per_clip || this.retakes >= RETAKES.max) break;
      this.retakes++; console.log(`  b${n}: retake (${identity.join(" | ")})`);
    }
    const clip = `b${n}.mp4`;
    if (this.estimate) { if (jobs.dirty.has(`b${n}-t1.mp4`)) jobs.dirty.add(`b${n}-last.png`); return { start, startFrame, lastFile: `b${n}-last.png`, lastFrame: { id: `est-b${n}`, file: `b${n}-last.png`, shows: {} }, clip }; }
    const best = [...takes].sort((a, b) => a.identity.length - b.identity.length || a.v.hard.length - b.v.hard.length || a.take - b.take)[0];
    for (const [from, to] of [[best.file, clip], [`b${n}-t${best.take}-first.png`, `b${n}-first.png`], [`b${n}-t${best.take}-last.png`, `b${n}-last.png`]]) { copyFileSync(join(this.runDir, from), join(this.runDir, to)); jobs.forget(to); }
    L.clip = clip; L.takes = takes.map((t) => ({ take: t.take, file: t.file, chosen: t === best, hard: t.v.hard, soft: t.v.soft }));
    const v = best.v;
    const lf = graph.addFrame({ file: `b${n}-last.png`, beat: n, role: "last", location: beat.location, loc_version: wantEnd.location.version, shows: v.shows,
      seed: startFrame?.id || null, merged: [], op: "clip-last", why: `real last frame of clip b${n} take ${best.take} (started from ${startFrame?.id || start})`, accepted: !v.hard.includes("not a single frame (grid, collage or text)"), forced: false, attempt: best.take, checks: { hard: v.hard, soft: v.soft } });
    L.last_file = lf.file; L.last_frame = lf.id; L.last_checks = { hard: v.hard, soft: v.soft };
    graph.decide({ beat: n, kind: "clip-last", frame: lf.id, take: best.take, ok: Object.fromEntries(Object.entries(v.shows).map(([id, s]) => [id, s.ok])), faults: [...v.hard, ...v.soft] });
    jobs.save();
    return { start, startFrame, lastFile: lf.file, lastFrame: lf, clip };
  }

  // Continuous: the start is the previous clip's real last frame, never edited (an edit re-renders the frame and breaks the
  // seam: measured SSIM 0.43–0.96 repaired vs 0.99 untouched). If an entity the action needs is missing or wrong in that
  // frame, the beat becomes a cut (seeded from the graph as any cut). Size or condition faults are carried on record.
  async continuousStart(beat, prev, want) {
    const { graph, jobs, log } = this, n = beat.n, L = log.beats[n];
    const last = prev.lastFrame, bad = want.entities.filter((e) => !last.shows[e.id]?.ok && last.shows[e.id]?.problems.some((p) => /missing|identity differs|appears \d+ times/.test(p))).map((e) => e.id);
    const wrong = bad.filter((id) => !last.shows[id].problems.some((p) => p === `${id} missing`)), missing = bad.filter((id) => !wrong.includes(id));
    L.carried_faults = want.entities.filter((e) => !last.shows[e.id]?.ok && !bad.includes(e.id)).flatMap((e) => last.shows[e.id]?.problems || []);
    L.carry = { from: last.id, missing, wrong, repaired: false };
    if (!bad.length || this.estimate) { graph.decide({ beat: n, kind: "continuous-start", frame: last.id, missing, wrong }); return { start: last.file, startFrame: last }; }
    beat.link_planned = "continuous"; beat.link = "cut"; L.link = "cut";
    L.link_changed = { from: "continuous", to: "cut", reason: `${last.id} lacks ${bad.join(", ")}` };
    graph.decide({ beat: n, kind: "continuous-to-cut", frame: last.id, missing, wrong });
    console.log(`  b${n}: continuous → cut (${last.id} lacks ${bad.join(", ")})`);
    return this.cutStart(beat, want);
  }
  // Small props (≤ 30 cm): their first appearance is an anchor frame beside their scale partner, registered as the root
  // of the prop's graph; a size fault is retried with the prop re-sourced from that anchor, not from the same seed.
  // A small prop gets an anchor only when its state is carried across beats (it appears in 2 or more).
  isSmall(id) { const e = this.ents[id]; return e?.kind === "prop" && cm(e.size) > 0 && cm(e.size) <= 30 && this.timeline.beats.filter((b) => [...b.start.entities, ...b.end.entities].some((x) => x.id === id)).length >= 2; }
  anchorOf(id) { return this.graph.frames.find((f) => f.op === "anchor" && f.shows[id]) || null; }
  hasOk(id) { return this.graph.frames.some((f) => f.accepted && f.shows[id]?.ok); }
  async anchor(beat, want, e) {
    const { graph, jobs, log } = this, n = beat.n, L = log.beats[n], id = e.id;
    const partner = (e.interacting_with || []).find((x) => this.ents[x]?.kind === "character") || want.entities.find((x) => x.kind === "character")?.id;
    if (!partner) { graph.decide({ beat: n, kind: "anchor-skipped", entity: id, reason: "no scale partner (character) in this frame" }); return null; }
    if (this.estimate) { if (!(this.estAnchored ??= new Set()).has(id)) { this.estAnchored.add(id); await jobs.run(`anchor:${id}`, `anchor-${id}.png`, { anchor: id }, [], COST.image, () => null); } return null; }
    // Partner frame: the latest accepted frame that shows the partner; else the beat frame without the small props.
    let pf = [...graph.frames].reverse().find((f) => f.accepted && f.shows[partner]?.ok);
    if (!pf) {
      const w0 = { ...want, entities: want.entities.filter((x) => !this.isSmall(x.id)) };
      graph.decide({ beat: n, kind: "partner-frame", entity: id, partner, why: "no earlier frame shows the partner: the beat frame is drawn first without the small props" });
      pf = (await this.cutStart(beat, w0, { tag: "-partner", role: "partner" })).startFrame;
    }
    const w = { beat: n, role: "anchor", location: { id: pf.location || beat.location, version: pf.loc_version || 1 }, placeRef: 0,
      entities: [{ ...want.entities.find((x) => x.id === partner), pose: `Holding ${id} in an open palm, looking at it`, interacting_with: [id] },
        { ...e, pose: "Resting in the open palm", position: `In ${partner}'s open palm, filling less than the palm`, interacting_with: [partner] }] };
    const prompt0 = anchorPrompt({ style: this.style, prop: id, partner, ents: this.ents, condition: e.condition });
    const attempts = [];
    for (let k = 1; k <= 2; k++) {
      const file = `anchor-${id}-a${k}.png`, prompt = prompt0 + (k > 1 ? fixText(attempts[0].v.hard.concat(attempts[0].v.soft)) : "");
      await jobs.run(`anchor:${id}:a${k}`, file, { prompt, image: this.IMAGE }, [pf.file], COST.image, () => jobs.image(`${log.run} anchor ${id} a${k}`, prompt, [pf.file], file, this.IMAGE));
      const v = await verifyFrame(this.runDir, file, w, this.ents, [{ file: pf.file, ids: [partner] }]);
      attempts.push({ k, file, prompt, v });
      graph.decide({ beat: n, kind: "anchor-verify", entity: id, attempt: k, hard: v.hard, soft: v.soft });
      if (!v.hard.length) break;
      console.log(`  anchor ${id} attempt ${k} faults: ${[...v.hard, ...v.soft].join(" | ")}`);
    }
    const best = [...attempts].sort((a, b) => a.v.hard.length - b.v.hard.length || a.k - b.k)[0], forced = best.v.hard.length > 0;
    // The anchor is the root of the prop's graph even when the size check still fails: nothing better exists, and it is on record.
    best.v.shows[id].ok = true; best.v.shows[id].root = true;
    const f = graph.addFrame({ file: best.file, beat: n, role: "anchor", location: pf.location, loc_version: pf.loc_version, shows: best.v.shows, seed: pf.id, merged: [],
      op: "anchor", why: `first appearance of ${id}: drawn in ${partner}'s palm from ${pf.id} (scale partner)`, accepted: true, forced, attempt: best.k, checks: { hard: best.v.hard, soft: best.v.soft } });
    this.ents[id].versions[0].root = f.id;
    (L.anchors ??= []).push({ entity: id, partner, partner_frame: pf.id, frame: f.id, file: best.file, attempts: attempts.map((a) => ({ k: a.k, file: a.file, prompt: a.prompt, checks: { hard: a.v.hard, soft: a.v.soft } })), forced });
    graph.decide({ beat: n, kind: "anchor", entity: id, partner, frame: f.id, forced, faults: [...best.v.hard, ...best.v.soft] });
    jobs.save();
    return f;
  }

  async cutStart(beat, want, { tag = "", role = "start" } = {}) {
    const { graph, jobs, log } = this, n = beat.n, L = log.beats[n];
    for (const e of want.entities) if (this.isSmall(e.id) && !this.hasOk(e.id) && !this.anchorOf(e.id)) await this.anchor(beat, want, e);
    let plan = graph.pickSeed(want), seedF = plan.seed ? graph.get(plan.seed) : null;
    if (!tag) L.plan = plan;
    graph.decide({ beat: n, kind: "seed", tag, ...plan });
    // The upload itself is the frame when it already shows the wanted state (animate this photo): no edit, no credits.
    if (!tag && seedF?.op === "upload" && !plan.merges.length && !plan.fresh.length && want.entities.length && want.entities.every((e) => seedF.shows[e.id]?.ok && seedF.shows[e.id].version === e.version) && Object.keys(seedF.shows).every((id) => want.entities.some((e) => e.id === id))) {
      const file = `b${n}-start.png`; copyFileSync(join(this.runDir, seedF.file), join(this.runDir, file)); jobs.forget(file);
      const f = graph.addFrame({ file, beat: n, role: "start", location: beat.location, loc_version: want.location.version, shows: seedF.shows, seed: seedF.id, merged: [], op: "upload-direct", why: "the upload is the start frame", accepted: true, forced: false, attempt: 1, checks: { hard: [], soft: [] } });
      L.attempts.push({ k: 1, file, inputs: [seedF.file], prompt: "(upload used directly)", checks: { hard: [], soft: [] }, accepted: true, forced: false, frame: f.id, seed: seedF.id, fallback: false });
      L.start_frame = f.id; return { start: file, startFrame: f };
    }
    const attempts = [];
    let extra = "", fallback = false, resourced = false;
    for (let k = 1; k <= 1 + RETRIES.same_seed + RETRIES.fallback_seeds; k++) {
      const seed = plan.seed ? graph.get(plan.seed) : null;
      const prompt = framePrompt({ style: this.style, want, plan: { ...plan, seed }, ents: this.ents, frames: (id) => graph.get(id) }) + extra;
      const inputs = [...(seed ? [seed.file] : []), ...plan.merges.map((m) => graph.get(m.frame).file)];
      const file = `b${n}${tag}-start-a${k}.png`;
      await jobs.run(`frame:b${n}${tag}:a${k}`, file, { prompt, image: this.IMAGE }, inputs, COST.image, () => jobs.image(`${log.run} b${n}${tag} a${k}`, prompt, inputs, file, this.IMAGE));
      if (this.estimate) { L.attempts.push({ k, file, inputs, prompt, estimated: true, tag }); break; }
      const refs = [...(seed ? [{ file: seed.file, ids: plan.kept }] : []), ...plan.merges.map((m) => ({ file: graph.get(m.frame).file, ids: m.ids }))];
      want.placeRef = seed && seed.location === want.location.id ? 0 : null;
      const v = await verifyFrame(this.runDir, file, want, this.ents, refs);
      const f = graph.addFrame({ file, beat: n, role, location: beat.location, loc_version: want.location.version, shows: v.shows, seed: seed?.id || null, merged: plan.merges.map((m) => m.frame),
        op: seed ? (plan.merges.length ? "merge" : "edit") : "generate", why: plan.why + (k > 1 ? ` (attempt ${k}${fallback ? ", fallback seed" : resourced ? ", re-sourced from anchor" : ""})` : ""), accepted: false, forced: false, attempt: k, checks: { hard: v.hard, soft: v.soft } });
      const a = { k, file, inputs, prompt, checks: { hard: v.hard, soft: v.soft }, accepted: false, forced: false, frame: f.id, seed: seed?.id || null, fallback, resourced, tag, plan: { seed: plan.seed, kept: plan.kept, merges: plan.merges, fresh: plan.fresh } };
      attempts.push(a); L.attempts.push(a); jobs.save();
      graph.decide({ beat: n, kind: "verify", tag, frame: f.id, attempt: k, hard: v.hard, soft: v.soft });
      if (!v.hard.length && !v.soft.length) break;
      console.log(`  b${n}${tag} attempt ${k} faults: ${[...v.hard, ...v.soft].join(" | ")}`);
      // Size retry: a small prop drawn at the wrong size is re-sourced from its anchor (a different source), once.
      const sized = v.hard.filter((h) => /wrong size/.test(h)).map((h) => h.split(" ")[0]).filter((id) => this.anchorOf(id) && !plan.merges.some((m) => m.ids.includes(id) && m.frame === this.anchorOf(id).id));
      if (sized.length && !resourced && k < 1 + RETRIES.same_seed + RETRIES.fallback_seeds) {
        plan = graph.pickSeed(want, { prefer: Object.fromEntries(sized.map((id) => [id, this.anchorOf(id).id])) }); resourced = true; extra = fixText(v.hard);
        graph.decide({ beat: n, kind: "size-retry-from-anchor", entities: sized, ...plan }); continue;
      }
      if (k === 1 + RETRIES.same_seed) {
        // Fallback: the next best seed (and its own merges). With no other seed, a retry that reproduced every earlier fault stops
        // here (another attempt would not fix it); otherwise the last attempt repeats the fix on the same plan.
        const alt = graph.pickSeed(want, { exclude: [plan.seed].filter(Boolean) });
        if (alt.seed && alt.seed !== plan.seed) { plan = alt; fallback = true; extra = ""; L.fallback_plan = alt; graph.decide({ beat: n, kind: "fallback-seed", ...alt }); continue; }
        const same = attempts[0].checks.hard.every((h) => v.hard.some((x) => x.split(":")[0] === h.split(":")[0]));
        if (same) { graph.decide({ beat: n, kind: "stop-retrying", reason: "the retry reproduced the same faults and no other seed exists" }); break; }
      }
      extra = fixText([...v.hard, ...v.soft]);
    }
    if (this.estimate) { if (jobs.dirty.has(`b${n}${tag}-start-a1.png`)) jobs.dirty.add(`b${n}${tag}-start.png`); return { start: `b${n}${tag}-start.png`, startFrame: null }; }
    const best = attempts.find((a) => !a.checks.hard.length && !a.checks.soft.length)
      || [...attempts].sort((a, b) => a.checks.hard.length - b.checks.hard.length || a.checks.soft.length - b.checks.soft.length || a.k - b.k)[0];
    best.accepted = true; best.forced = best.checks.hard.length + best.checks.soft.length > 0; if (best.plan && !tag) L.plan = { ...plan, ...best.plan, why: graph.get(best.frame).why };
    const f = graph.get(best.frame); f.accepted = true; f.forced = best.forced; graph.save();
    const file = `b${n}${tag}-start.png`; copyFileSync(join(this.runDir, best.file), join(this.runDir, file)); jobs.forget(file);
    graph.decide({ beat: n, kind: best.forced ? "accept-forced" : "accept", tag, frame: f.id, attempt: best.k, faults: [...best.checks.hard, ...best.checks.soft] });
    if (best.forced) console.log(`  b${n}${tag}: accepted attempt ${best.k} with faults on record`);
    return { start: file, startFrame: f };
  }
}
