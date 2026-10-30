# Diagnosis: state-manager pipeline (2026-10-07)

> Read-only code review by a subagent: code, plan (out/p4-lighthouse.json, re-solved offline to the same 132 nodes) and real prompts/requests in run.json files. No API calls, no edits. Paths relative to current/prod/state-manager/.

**Confirmed defects (priority order):**
1. **Cuts treated as continuous** — `src/solver.js:273-284`, `execute.mjs:91-105` never read `segment.type`. Segments 2–4 are `cut` but get `exact` handoffs; shot 3 morphs wide → close-up inside one clip. Fix: a cut never shares a frame; fresh start frame in the "to" state; previous frame only as a look/identity reference.
2. **From-values across a cut leak the previous shot's state** — `src/solver.js:258` (startConds), `:293` (plates). Camera conditions go into every plate: n73 tower plate "offshore viewpoint: ships and a reef"; n21 cottage plate invents a hand and shell; n75 puts "eating alone" in the stairwell; n113 puts the lantern booth on the beach. Fix: on a cut drop camera from-values and from-values of other locations; check from against accumulated state.
3. **Location = binding name, first background only** — `src/solver.js:325-334`. `cottage` covers both the approach and the kitchen → kitchen items outdoors (n33). Segments 10 and 16 have two backgrounds; offshore never registered. Fix: background value change = location change; handle or reject multiple backgrounds.
4. **Entity entering without identity conditions gets no reference** — `src/solver.js:354`. Segment 17 has `keeper.pose_action` but no `keeper.identity`; n101 prompt says "the keeper" with no reference → bearded man. Fix: any condition on a bound entity not in the frame pulls its clean reference.
5. **End-frame removals stay in the state** — `src/solver.js:302-303, 316`. n109 removes lamp+shell, n113 still "passes" the shell → shell reinvented. Fix: subtract endNode.strip from endState.
6. **Any background value change = location change, strips all props** — `src/solver.js:346-351`. n109 ("storm passed", same beach) removes lamp and shell.
7. **mergeConds loses and distorts conditions** — `src/solver.js:467-477`: held conditions dropped when the atom also changes (group 4 loses dawn light and shell glow); separate changes chained into one arrow string used as a still-frame state (n43 lighting); duplicate held values survive (n123).
8. **similar() equates opposites** — `src/solver.js:9-15` (0.6 overlap, filler words count): "beam goes out" ≈ "beam present"; "Operating" ≈ "Extinguished"; "close view of hand and shell" ≈ "close view of shell on table". With exact matching, shots 4, 7, 13 need edits instead of exact handoffs.
9. **Atomizer lists things not visible; solver renders them all** — `src/atomize.js:83,89`. Lamp "burns" on the beach in shot 1 (n3); its reference is isolated from that frame and pasted into the kitchen and lantern room. Fix: a "visible in frame" list in the schema.
10. **Scene-chain moves planned start-frame changes into the end-frame edit** — `execute.mjs:121-129`; framing/location changes happen during the clip. Fix: such a change is a cut.
11. **Video prompt states the planned duration, not the one sent** — `execute.mjs:202` vs `:262-264` ("Over 9s" with 3 s sent).
12. **Reuse ignores model, resolution, duration, content; run page misreports models** — `execute.mjs:218-222`. Seedance 4 s clip reused in a wan-3.0 2 s run; header says 4k for 2k frames; key = positional node ids. Fix: hash of request + input file hashes.
13. **Scene-chain passes describe the wrong image; props never get references** — `execute.mjs:139`, `:132` (only character/product kinds).
14. **Identity copied frame to frame without the root reference** — breaks the 05-solver re-anchor rule (n5→n9→n13→n17, n29, n43, n47 use only the previous generated frame).
15. **Prompts lose the story; editor guide conflicts with location changes; "add nothing" conflicts with camera conditions naming objects** — `execute.mjs:199-203`, `src/prompts.js`.
16. **A failure leaves sibling jobs running, uncounted and unsaved** — `execute.mjs:296-311`.
17. **Silent duration clamping; incomplete model table** — `execute.mjs:50` (wan-3.0 also allows 15/20/25/30 s); groups 11 and 18 shortened unnoted.
18. **Continuity numbers miss the real failures** — `src/continuity.js`: only first/last frames, grayscale SSIM; the n15 morph scores 0.99/0.994/0.976 (all green); no identity or colour check; seam counted twice in chain mode; `check.mjs` mislabels handoffs and ignores fitFile; frame cache never invalidated.
19. Minor: plate `uses` over-counted; `--scene-chain --frames-only` crashes (`execute.mjs:242`); plan lacks handoff fields (executor matches label text).

**Suspicions:** choiceMemo/memo keys ignore boundAt and restore() does not roll back choiceMemo/cleanRefs; POST retried on 5xx may duplicate a paid job; signed URLs expire after 24 h; frame shape 2752×1536 vs 1280×720 last frames; clean references isolated from frames where the entity is small.

**Evidence frames:** current/tests/state-manager/runs/p4-lighthouse-frames-v4-frames-2k/ — n101.png (man), n113.png (glass booth on the beach), n33.png (kitchen items outdoors).
