# Architecture gaps

> Logical gaps found by interrogating the concepts, not the code. Parent: [vision.md](vision.md)
> **Architectural** = the thesis or heuristic is wrong; closing it means rethinking the PRD.
> **Structural** = the thesis is right and the code does something else; closing it is a code change.
> Already recorded elsewhere and not repeated here: no temporal dimension in the type model ([PRD-010](../tickets/01-prd/)), no negation in the atom vocabulary.
> Written 2026-10-15. Every entry carries a citation or a recorded instance. Hypotheses are labelled.

## Architectural

### A1. The type model is binary; the system ships "unsatisfied" as its normal outcome
[vision.md](vision.md): *"The only question for a goal: is it satisfied? A goal is satisfied only when it is proven satisfied. Until then, it remains a goal."*

Across the five recorded state-graph runs, **18 of 24 accepted frames (75%) were accepted with faults already recorded against them**. The implementation calls this `accept-forced`. The phrase appears nowhere in the PRD: it is a third state the theory does not allow, and it is the majority outcome.

Two things are missing from the thesis, not from the code:
- **No degree.** A condition is true or false. The recorded faults are continuous: a shell at 2.9× its size, an identity that is nearly right. There is no way to say "within tolerance" or to set a tolerance per condition.
- **No remedy.** [vision.md](vision.md) says *"On failure, the system traces backward through the chain to the tool that failed."* Tracing is diagnosis. The PRD never says what the system does next, so the implementation invented accept-forced.

**To close:** a third satisfaction state with an explicit per-condition tolerance, and a remedy policy (retry / re-source / substitute tool / surface to the user) chosen by the condition's priority. [post-mvp.md](post-mvp.md) anticipates priority but defers it; it is now load-bearing.

### A2. Tool specs are treated as proofs; generative tools give no guarantees
[vision.md](vision.md): *"A tool is a proof. Its signature proves that its input types produce its output type."* and *"A tool spec states which properties the tool maintains."*

A diffusion model maintains nothing deterministically. Its spec is a prior, not an inference rule. The Lean metaphor assumes sound rules; chaining "proofs" that each hold probabilistically compounds error with no term in the model for it.

Evidence: after the re-anchor fix attached root references to 31 generations that previously had none, run `p4-lighthouse-fixed30` still recorded `shell identity differs`, `beacon identity differs` and `trawler identity differs`. The reference was supplied and the property was not maintained.

**To close:** per-property retention probabilities measured from runs rather than declared, and a solver that reasons about compounding probability over a chain instead of boolean satisfaction. The repo already assumes this is needed — [post-mvp.md](post-mvp.md) *"how confident it is that it maintains the others"* — but the core model has no place to put the number.

### A3. `kind` is per-entity, but a location is routinely also a visible object
Entities carry one `kind` of `character | prop | location` ([01-types.md](subsystems/01-types.md), `timeline.js` schema). `kind` decides anchoring, versioning and whether `want()` lists the entity at all.

In `p4-lighthouse-fixed30`, `lighthouse` and `reef` are `kind: location` and appear as objects **in frame in 6 of 6 beats** while the beat's own location is `beach`, `cottage` or `tower`. The title object of the film is a place in three beats and a distant object in six, and it has one kind for both roles.

**To close:** role is a property of an entity *in a beat*, not of the entity. The same binding can be the setting in one beat and a visible object in another, and it needs the object treatment (anchor, identity check) in the second.

### A4. Beat duration is fixed at five seconds, so pacing is inexpressible
`seconds: { type: "integer", enum: [5] }` — `pipeline-state-graph/src/timeline.js:20` and `pipeline-memory/src/storyboard.js:14`. Both pipelines.

A 1.5-second reaction cut and a 12-second hold cannot be represented. Pacing is the primary expressive device of editing, and the repo's own research cannot be applied because of this: [oneshot-video-generators.md](../research/oneshot-video-generators.md) records an average shot length of about 2.5 s in practice and recommends cutting on action.

This reads as a simplification but it is a constraint on the representation: no amount of correct implementation produces a varied cut.

**To close:** duration becomes a free parameter with the model's supported range as the bound.

### A5. An entity may not enter during a beat
`timeline.js` template: *"Every character and prop that appears anywhere in a beat is already visible in the beat's start frame … Nothing with an identity enters during a beat, because the video model would invent it."*

A character walking into frame is among the most basic actions in film and is structurally unrepresentable. A real limitation of the video model has been promoted into a rule of the type system, where it now constrains every future tool too.

**To close:** keep it as a per-tool constraint, not a property of the representation. A tool that can accept an entrant (a reference-conditioned model, or a composite) should be selectable for that beat.

## Structural

### S1. `link` is a free variable that the state already determines
Over 29 beat boundaries in five runs, the predicate *start(N+1) equals end(N) on description, framing, entities and location* separates `continuous` from `cut` in **28 of 29**. The 29th is `p4-lighthouse-fixed30` b3→b4: all four equal, labelled `cut`. The pipeline paid 200 credits to regenerate an identical picture and the clip had nothing to do; the seam gate then reported *"cut did not cut (0.787)"* after the money was spent.

[01-types.md](subsystems/01-types.md) says *"Scenes are state machines."* In a state machine the transition follows from the states. Here it is declared independently and can contradict them.

**To close:** derive `link` from the state comparison, or lint the timeline before any generation. Zero credits; removes this class permanently.

### S2. The retake mechanism has never fired
`RETAKES = { per_clip: 1, max: 3 }` (`controller.js:15`). The trigger is character identity only — `chars = wantEnd.entities.filter((e) => e.kind === "character")` at `controller.js:75`, filtered again to `identity differs | missing | appears N times`.

Recorded across all five runs: **2 clip-last identity faults, both on props, and 0 retakes.** A coded, capped remedy that cannot reach the faults that actually occur. Every non-character fault and every non-identity fault is verified, recorded, and ignored.

**To close:** trigger on the condition's priority rather than on `kind === "character"`. Depends on A1 for what priority means.

### S3. Anchors are keyed on physical size, not on the need to preserve identity
Anchor creation follows the scale-partner rule (`controller.js`, `isSmall`). In `p4-lighthouse-fixed30` exactly **one anchor was created** — `shell`, partner `keeper`. The `beacon` failed identity verification twice (*"Missing large optical lens"*) and never got one, because it is person-sized.

[01-types.md](subsystems/01-types.md) ties anchoring to bindings — *"Every condition on that entity must trace back to the same binding"* — and says nothing about size.

**To close:** anchor every bound entity whose identity is a condition, and keep the scale partner as an additional reason, not the only one.

### S4. `beat.continues` is dead data
The `timeline.js` template asks for it per entity per beat and calls it *"the pointer the system follows."* Nothing reads it: the only `.continues` references in the pipeline are `v.continues`, the version record's own field, in `page.js:89`. The LLM computes it on every run at token cost, and the documented mechanism does not exist.

**To close:** wire it or drop it from the schema. The lineage it describes is already carried by frame records.

## Already recorded, not repeated here

Found in an earlier pass and ticketed; they overlap this set and should be read with it.
- **PRD-030** — verification has no quarantine: nothing expresses "ship this frame, but never seed another from it". The missing half of A1.
- **PRD-031** — no completion-aware budgeting: the guard asks whether the next call fits, never whether the remaining work fits. Run `p4-lighthouse-fixed30` stopped at beat 5 of 6 for this reason.
- **PRD-032** — no closed loop: both pipelines verify and neither acts. S2 is the concrete instance.
- **PRD-033** — the verifier shares a failure mode with the generator: a VLM judging real-world size is the same judgement the generator failed.

## Examined and sound

- **`changes` vs. the real start→end diff.** `changes` is stored alongside the full start and end states and is used for versioning while prompts use start/end, so the two could disagree. Checked across 29 beats in five runs: **0 disagreements in either direction.** Unenforced redundancy and a latent hazard, but no evidenced failure — not ticketed.
- **End-state verification exists and runs.** `controller.js:74` verifies the clip's real last frame against the beat's end state. The weakness is the remedy (S2), not the check.
- **Bindings are pointers, not copies.** Confirmed in both pipelines; frame records carry `seed`/`merged`/`op` lineage and entity versions carry anchor paths.
