# Sub-case test matrix

> Thesis under test: if the minimal sub-cases pass, the full-length video should pass. The job is to find *which* sub-cases fail.
> Nothing here has been run. Costs are estimates: image 200 credits (nano-banana-pro 2k, as the pipelines use), video 96 credits/second (wan-3.0 720p). Written 2026-10-14. No credits spent producing this document.

**The most important finding before any new test runs:** a large part of this matrix has *already been answered* by `current/research/litmus/` (tests A–G, CAR) and by the recorded judge output in `current/tests/pipeline-memory/runs/*/run.json`. Section 4 separates what is already known from what genuinely needs generation. Roughly a third of the matrix needs no spend at all.

---

## Part 1 — logical step breakdown

Each row is one step a tool must perform. The sub-problems live where something must be **held** across a tool boundary — a value that one tool produced and a *different* tool must preserve. Every "hold" below is a place where the system can silently fail.

### 1.1 Single shot from text
| # | Step | Tool | Must HOLD | May CHANGE |
|---|---|---|---|---|
| 1 | Prompt → start frame | `/v1/ai-image-generator` | — (origin; nothing to hold) | everything |
| 2 | Start frame → clip | `/v1/image-to-video` | frame-0 content, subject identity, real size, framing, palette | pose, position, light within the shot |
| 3 | Clip → last frame | ffmpeg extract | nothing | — |

*Boundary risk:* step 2. The video model re-renders; the image model's output is only a suggestion.

### 1.2 Single shot from an uploaded photo
| # | Step | Tool | Must HOLD | May CHANGE |
|---|---|---|---|---|
| 1 | Upload | `/v1/files/upload-urls` | pixels exactly | — |
| 2 | Upload → clip | `/v1/image-to-video` | **the real person's face**, clothing, room | expression, small motion |

*Boundary risk:* step 2 only, and it is the single best-performing case on record (grandma, 96/100). An upload needs no anchor and no keyframe — pipeline B wasted 200 credits generating one anyway.

### 1.3 Two shots, continuous
| # | Step | Tool | Must HOLD | May CHANGE |
|---|---|---|---|---|
| 1 | Clip A → real last frame | ffmpeg | the exact pixels at the handoff | — |
| 2 | Last frame → clip B | `/v1/image-to-video` | identity, place, light, **and the velocity of whatever was moving** | the action continuing |
| 3 | Join A+B | ffmpeg concat | one fps, one geometry, one colour tag | — |

*Boundary risks:* step 2 carries no velocity — a still frame has no motion, so every continuous clip restarts from rest ("motion reset", measured ease-in of 4–8 frames). Step 3 is where the duplicate frame and the fps drop live.

### 1.4 Two shots, cut, same location
| # | Step | Tool | Must HOLD | May CHANGE |
|---|---|---|---|---|
| 1 | Pick a source frame | memory/graph | — | — |
| 2 | Source → new start frame | `/v1/ai-image-editor` | identity, real size, **the fixed parts of the place** (architecture, landmarks), persisted state from earlier shots | framing, angle, pose, time, weather |
| 3 | Start frame → clip | `/v1/image-to-video` | as 1.1 step 2 | — |

*Boundary risk:* step 2. An instruction editor regenerates every pixel; "keep everything else" is a soft request. This is where the lighthouse shrank, gained a building, and vanished.

### 1.5 Two shots, cut, new location
As 1.4, plus: the editor must **transplant** the held entities into a place that is not in the source frame. Must hold: identity and relative real size. May change: everything else. *Boundary risk:* whole-frame conditioning drags the old background and lighting into the new place (the EM-Vid failure mode); and the entity's size is re-estimated against unfamiliar surroundings.

### 1.6 Shot with a small held prop
Adds to any of the above: the prop's **absolute real size** must survive the image model, which has no metric sense and draws small objects large so they read. Must hold: size relative to the hand/body at the same depth, shape, material, colour. *Boundary risk:* every step. This is the single most-failed sub-case in the record.

### 1.7 Shot with a text or graphic overlay
| # | Step | Tool | Must HOLD | May CHANGE |
|---|---|---|---|---|
| 1 | Render text | headless Chrome → PNG | exact glyphs, exact position | — |
| 2 | Composite | ffmpeg overlay | the picture underneath | — |

*Boundary risk:* low — this path is deterministic and is the correct design. The *failure* is the opposite one: text the generative model invents when it was told not to (storefront signage, licence plates).

### 1.8 Shot from an image sourced online
| # | Step | Tool | Must HOLD | May CHANGE |
|---|---|---|---|---|
| 1 | URL → input | direct URL in `assets.image_file_path` (**the API accepts a URL directly; no upload step needed**) | pixels | — |
| 2 | → clip or → edit | `/v1/image-to-video` or `/v1/ai-image-editor` | as above | — |

*Boundary risk:* unknown aspect ratio and resolution entering a pipeline that assumes 16:9; licensing/content filters; and whether a photographic input mixes with a painterly style line.

---

## Part 2 — considerations checklist

A consideration that is *triggered* by a shot is where a sub-problem is likely. Each is cited to the evidence that produced it.

### Identity
- An entity returning after an absence drifts. *Keeper younger with dark hair in tower shots* — `pipeline-memory/runs/p4-lighthouse-v2-30s` judge, shot 04.
- An entity's **design** changes across a cut while its *category* stays right. *Wheels silver five-spoke → dark multi-spoke* across 3 separate joins; *"coupe changes body and grille design"* — `d1-desert-tokyo` joins 02→03, 03→04, 05→06.
- Identity copied frame-to-frame without returning to the root reference compounds drift — `DIAGNOSIS.md` defect 14; FLUX Kontext measured chained-edit drift (`multishot-video-practice.md`).
- **Passes when conditioned on a frozen reference**: litmus CAR 6/6 and G 12/12 frames fully stable.

### Real size / scale
- A small prop is drawn 3–7× too large and stays wrong through every retry — `compare/index.html` (A: "never fixed after 3 tries"), and every lighthouse judge shot.
- Size is re-estimated per frame, so it changes *across* a cut even when both frames are individually plausible — `p4-lighthouse-v1` join 02→03 `size_consistent: false`.
- **Solved in litmus F** by a typed absolute size plus an in-context scale anchor: *"Shell size fixed: palm-sized in every scene."* Pipelines A and B still fail this; litmus already passes it.

### Spatial relation and position
- Planned position ignored: *"ends in the lower right, not on the upper-centre stairs"*; *"shell sits near the lower center rather than the lower-right foreground"* — lighthouse judge shots 05, 09.
- A relation is broken by inventing a different one: *"places Shell on the lamp pedestal... breaking the required held-by relationship"* — v2-30s shot 04.

### Continuity of context across a join
- State that must persist does not: *"Lamp visibly lit in image 1 but extinguished in image 2"*; *"state_carried: false"* on 3 of 5 joins in `d1-desert-tokyo`.
- Removals do not stick — a stripped object is reinvented downstream — `DIAGNOSIS.md` defect 5.
- Location drifts over hops: landmark missing, then smaller, then a building appears — litmus F, scenes 2/4/5. **8 of 24 frames stable.** This is the clearest "passes small, fails long" result in the repo and is the strongest challenge to the user's thesis.

### Logic / causality
- The wrong verb is performed: *"descends toward the foreground instead of climbing"*; *"Coupe moves backward... rather than rolling forward"* — lighthouse shot 05, car shot 04.
- The action happens at the wrong time: *"lamp is already burning brightly in the planned start frame, so ignition is not shown"* — shot 07.
- An action is invented: *"reaches for and lifts bread... inventing an eating action"* — shot 04.
- Order violated: *"shot 06 resets the keeper to kneeling after shot 05 has already shown her standing and leaving"* — v2-30s film summary.
- **No gate catches any of these**: both verifiers judge *frames*, never the motion.

### Lighting and colour
- Unplanned light changes: *"headlights and front marker lights switch off, an unplanned change"*; *"signals change from green to red"* — car shots 05, 03.
- Emissive intensity overshoots: *"glow is strong yellow-orange rather than soft, restrained amber"*, in nearly every lighthouse shot.
- Colour and grain re-rendered per clip, spiking at joins — `oneshot-video-generators.md` §2.1 cause 5.

### Count
- Extra instances appear: *"additional pedestrians appear beyond the specified group of three"*; *"a second occupant appears through the windshield"* — car shots 03, 04.
- Note a live bug: `corrections()` flags any `count > 1` as a duplicate, so a legitimately plural entity is always "faulty" (found while fixing the retry rule).

### Text and graphics
- Invented text where forbidden, every time: *"readable storefront branding"*, *"licence-plate text"*, in 4 of 6 car shots. Of all fault classes this is the one that is **0-for-3 on retries** — a re-prompt never removes it.

### Tool choice (the user's hypothesis)
- Measured end-frame fidelity differs sharply by model: wan-3.0 SSIM 0.98–0.99 with real motion; kling-3.0 same but crossfades; veo3.1-lite holds a still frame and caps end frames at 8 s; seedance-1.5 0.75–0.82; gemini-omni-1.1 0.65–0.70 — `state-manager/README.md`.
- Independent check: wan-3.0's multi-shot claim is unreliable, *"shot counts often wrong; props drift before faces"* — `multishot-video-practice.md`.
- **Untested here:** whether a stronger video model removes the logic failures above. That is test T18–T20 below and is the most valuable new information in this matrix.

---

## Part 3 — the test matrix

Ordered cheapest-and-most-diagnostic first. "Changed" is the single variable; everything in "Held" is pinned so a failure is attributable.

Legend for **Need**: `R` = answerable by replaying recorded runs, no spend. `N` = needs new generation.

| id | name / hypothesis | tool(s) | HELD CONSTANT | CHANGED | pass criterion (yes/no) | cr | need | prereq |
|---|---|---|---|---|---|---|---|---|
| T01 | **Start-frame adherence.** The video model honours frame 0. | `image-to-video` wan-3.0 | prompt, image, model, 5 s | — (replay) | SSIM(clip frame 0, start image) ≥ 0.97 | 0 | R | — |
| T02 | **End-frame adherence.** Supplying `end_image_file_path` lands the last frame. | `image-to-video` wan-3.0 | as T01 | end frame supplied | SSIM(raw last, end image) ≥ 0.95 | 0 | R | — |
| T03 | **A cut actually cuts.** Two shots across a cut are visually distinct. | ffmpeg measure | — | — (replay) | join jump > 50 | 0 | R | — |
| T04 | **Identity across a cut to a new place.** | `ai-image-editor` + `image-to-video` | entity ref, size, style | location | VLM: same entity, yes/no | 0 | R | — |
| T05 | **Typed size fixes a small prop.** An absolute size + scale partner holds the prop across scenes. | `ai-image-generator` 2k | style, entity set | size stated absolutely vs. not | VLM: prop within 2× its stated size in every frame | 0 | R | — |
| T06 | **Location stability over hops.** A landmark survives N chained scenes. | `ai-image-editor` | entity, style, landmark | number of hops (2 → 9) | landmark present and same scale at every hop | 0 | R | — |
| T07 | **Online image as input.** A direct URL is accepted and usable. | `image-to-video`, `assets.image_file_path` = URL | prompt, model, 5 s | input origin: URL vs uploaded | job succeeds and frame 0 matches the URL image | 480 | N | — |
| T08 | **Non-16:9 online image.** A 4:3 or portrait URL entering a 16:9 pipeline. | `image-to-video` | prompt, model | input aspect ratio | output is 16:9 with no stretch or black bars | 480 | N | T07 |
| T09 | **Photographic input, painterly style line.** | `ai-image-editor` qwen-edit | prompt, entity | input is a photo, not a generation | VLM: style line applied, identity kept | 10 | N | T07 |
| T10 | **Context transfer, continuous, 2 clips.** Does clip 2 from clip 1's real last frame keep identity, place and light? | `image-to-video` ×2 wan-3.0 | entity, place, model, 5 s each | — | VLM: same entity+place; seam SSIM ≥ 0.98 | 1,160 | N | — |
| T11 | **Motion carries across a continuous join.** | as T10 | as T10 | prompt says "already in motion" vs not | motion does not visibly reset at the join | 480 | N | T10 |
| T12 | **Context transfer, cut, same place.** | `ai-image-editor` + `image-to-video` ×2 | entity, place, style | framing (wide → close) | VLM: same place, same entity, same prop size | 1,360 | N | T10 |
| T13 | **Context transfer, cut, new place.** The hardest join. | as T12 | entity, style, prop size | location | VLM: entity identical, prop size identical, no bleed of the old background | 1,360 | N | T12 |
| T14 | **Small held prop across a cut.** | as T13 | entity, place, prop ref | prop present vs absent in source frame | prop within 2× stated size in both shots | 1,360 | N | T05, T13 |
| T15 | **Scale anchor vs. no scale anchor.** Isolates B's `scale_partner` mechanism. | `ai-image-generator` ×2 | prop, entity, prompt | prop drawn alone vs. in the palm | anchored version within 2×; unanchored not | 400 | N | T05 |
| T16 | **Count discipline.** "Exactly three" stays three. | `ai-image-generator` | style, place | stated count 1 / 3 / 7 | VLM counts exactly N | 600 | N | — |
| T17 | **No-text instruction.** Can a signage-heavy scene be generated clean? | `ai-image-generator` | place, style | "no text" phrasing, 3 variants | VLM: zero readable glyphs | 600 | N | — |
| T18 | **Model swap, logic.** Does a stronger model perform the stated verb? | `image-to-video`, same prompt | start frame, prompt, 5 s, resolution | **model**: wan-3.0 / kling-3.0 / seedance-2.5 / veo3.1 | VLM: the stated verb happens, and only it | ~2,000 | N | T10 |
| T19 | **Model swap, end frame.** Re-verify the measured end-frame table. | `image-to-video` + end frame | start+end frames, prompt | **model** ×4 | SSIM(last, end) ≥ 0.95 | ~2,000 | N | T02 |
| T20 | **Model swap, prop scale.** Is oversized-prop a model weakness or a prompt weakness? | `ai-image-generator` | prompt with absolute size | **model**: nano-banana-pro / seedream-v5-pro / gpt-image-2 / flux-2-klein | prop within 2× stated size | ~350 | N | T05 |
| T21 | **Reference mode vs. frame mode.** `text-to-video` `references[]` (named, up to 10) vs. image-to-video from a keyframe. | `text-to-video` w/ refs | entity refs, prompt, model | conditioning mechanism | VLM: identity held as well or better | 480 | N | T04 |
| T22 | **Multi-entity merge limit.** How many references can one edit hold before identity degrades? | `ai-image-editor` nano-banana-pro (max 9) | style, place | number of refs: 2 / 4 / 6 | every entity recognisable | 600 | N | T13 |
| T23 | **Persisted state across a cut.** A state set in shot 1 (lamp lit) must hold in shot 3. | `ai-image-editor` ×3 | entity, place | state changed in shot 2 | VLM: shot 3 shows the persisted state | 600 | N | T12 |
| T24 | **Unplanned change detection.** Does anything change that was not asked to? | VLM diff, any clip | all | — | VLM lists zero unplanned changes | 0 | R+N | T10 |
| T25 | **Text overlay composite.** Deterministic path end-to-end. | headless Chrome + ffmpeg | clip | overlay on/off | glyphs exact, position exact, picture unchanged | 0 | N* | — |

`*` T25 costs no credits but **requires ffmpeg**, which is not installed.

**Totals.** Full matrix ≈ **16,400 credits** of new generation (T07–T25), of which the model-comparison block T18–T20 is ~4,350. Six tests (T01–T06) cost nothing.

### Cheapest useful subset — 3,000 credits
`T01–T06` (free replay) + `T15` (400, isolates the scale anchor) + `T10` (1,160, the core two-clip context transfer) + `T20` (~350, is oversized-prop the model's fault?) + `T07` (480, unlocks online images) + `T09` (10) + `T17` (600, the 0-for-3 fault class).
This answers: does context transfer at all; is scale a model or a prompt problem; can text be suppressed; do online images work. It is the smallest spend that could change the architecture.

---

## Part 4 — what is already answered

**Already PASSING, by replay — do not pay to re-test:**
- Start-frame adherence: `first_vs_start` 0.987–0.996 across litmus A, B, C, D, E, F, G, CAR. Solid.
- End-frame adherence: `raw_last_vs_end` 0.972–0.995 where an end frame was supplied.
- Cuts genuinely cut: measured join jumps 64.6, 69.6, 94.3, 97.6.
- Identity across a cut to a new place: litmus CAR **6/6 frames fully stable** (car, desert → Tokyo).
- Two assets with a `part_of` relation across four interleaved scenes: litmus G **12/12 fully stable** (car + keychain).
- **Typed absolute size fixes the prop-scale problem**: litmus F — *"Shell size fixed: palm-sized in every scene."*

**Already FAILING, by replay:**
- Location stability over many hops: litmus F, **8/24 frames fully stable**; landmark missing → smaller → gains a building.
- Kept-last-frame divergence: `kept_last_vs_end` falls to 0.52–0.72 with tail jumps up to 18.3.
- Action/verb adherence, unplanned changes, invented text, count: pervasive in the pipeline-memory judge records; no gate watches for any of them.

### The two findings that matter most

1. **The thesis is half-supported, and the exception is specific.** Small sub-cases *do* pass: 2-scene (CAR) and 4-scene (G) runs are 100% stable. The failure is not in any single join — it is in *accumulation*. Litmus F degrades to 8/24 over 9 scenes on the same mechanism that was flawless at 2 and 4. So "if the sub-cases pass, the full version is fine" does **not** hold as stated; what the evidence supports is "sub-cases pass, and failure is a function of chain length." The matrix should therefore include **hop count as an explicit variable** (T06), because that — not the individual operation — is the thing that breaks.

2. **Litmus already solved the prop-scale problem that both production pipelines still fail.** F holds the shell palm-sized in all nine scenes using a typed absolute size; pipelines A (3.8× → 2.9× after a dedicated fix) and B (oversized in nearly every judged shot) do not. The mechanism exists in this repo and has not been ported. That is a free, already-validated fix, and it is worth more than any new test on this list.

*Noted outside scope:* the credit rates for video models other than wan-3.0 are not in `sources/magic-hour-openapi.json` (it documents per-image credits but not per-second video credits), so the T18/T19 estimates assume the wan-3.0 rate of 96/s and could be materially wrong for veo3.1 or seedance-2.5.

---

## Part 5 — logic and causality

> Appended 2026-10-14 by the sub-problem hunter. Parts 1–4 cover *what things look like*. This part covers *whether the right thing happens*. Every failure mode below is quoted from a recorded run; none is hypothetical.

### 5.1 The structural finding that frames this whole part

**Neither pipeline has a logic check. Not a weak one — none at all.**

Pipeline A's verifier (`pipeline-state-graph/src/verify.js:9-10`) declares its entire fault vocabulary:

```
HARD = present, count, identity, size, wardrobe, condition, location, single
SOFT = position, interaction, pose
```

Every one is a property of a **single still frame**. The recorded fault histogram across all A runs confirms nothing else is ever raised — 43 `position`, 24 `size`, 24 `pose`, 11 `identity`, 6 `interaction`, 4 `place`, 3 `condition`, 1 `wardrobe`, and **zero** motion or action faults. Not because motion was correct, but because no check exists that could fail.

Pipeline B does see these failures — its judge names them precisely — but only **after** the clip is paid for. The judge is a scorer, not a gate.

Consequence: every mode L01–L11 below is invisible to A at any price, and visible to B only retrospectively. This is why `end_state_ok` is **false in 15 of the 16 lighthouse shots** while both pipelines reported their frames as acceptable.

A second already-recorded signal the matrix does not yet exploit: B's judge emits `primary_fault` per shot, attributing the failure to `keyframe` or `video`. Across the lighthouse runs that splits 9 keyframe / 7 video. Logic modes divide along the same seam — L04 (state present too early) is a *keyframe* fault, L01–L03 are *video* faults — so the attribution is free evidence for which stage to fix.

### 5.2 Logic failure taxonomy

| id | mode | what goes wrong | quoted instance (source) |
|---|---|---|---|
| L01 | **Inverted vector** | the action runs in the opposite direction | "Keeper **descends** toward the foreground instead of climbing the stairs" (lighthouse-v1 sh05) · "Coupe moves **backward**, away from its left-facing nose, rather than rolling forward" (car sh04) · "Train moves **left** rather than right" (car sh03) |
| L02 | **Null action** | the specified action simply does not occur | "does not visibly **ascend** the first stairs" (v2-30s sh02) · "The hand leaving the wheel, **pressing Stop**, and resting on the lap are not clearly shown" (car sh05) · "the specified gentle **increase in cruising speed** is not clearly demonstrated" (car sh01) |
| L03 | **Invented action** | an action nobody asked for is performed | "Keeper reaches for and **lifts bread** from the meal, inventing an eating action instead of only turning her gaze" (v1 sh04) · "Keeper **stands and walks out of frame** after placing Shell, inventing substantial additional action" (v2-30s sh05) · "Keeper lowers her hands and **steps back**, adding motion beyond the specified action" (v1 sh07) |
| L04 | **State arrives early** | the end state is already true in the start frame, so the action is unshowable | "Lamp is **already burning brightly in the planned start frame**, so ignition is not shown" (v1 sh07) · "Lamp **ignites with a large flame**, although the planned action only brings Shell beside the dark burner" (v1 sh06) |
| L05 | **State never reached** | the clip ends without the required end state | "Lamp dims but **retains a visibly luminous amber centre** in the last frame; full extinction is not established" (v1 sh04) · "Lamp **remains visibly lit** in the last frame" (v2-30s sh02) · join 04→05: "Shot 04 visibly shows the lamp still lit, **contradicting its required persisted extinguished state**" |
| L06 | **Narrative regression** | a later shot undoes an earlier shot's completed state | "shot 06 **resets the keeper to kneeling** after shot 05 has already shown her standing and leaving, breaking continuity and repeating the departure" (v2-30s film) |
| L07 | **Uncommanded third-party change** | something not named in the action changes anyway | "Pedestrian and traffic signals **change from green to red**, an unplanned action" (car sh03) · "Headlights and front marker lights **switch off**, an unplanned change" (car sh05) · "Ships **visibly advance** during a shot whose only planned motion is the keeper's ignition" (v2-30s sh03) · "Front licence plate **changes from blank to detailed lettering** during the clip" (car sh06) |
| L08 | **Count violation** | instances appear or multiply mid-clip | "A **second occupant** appears through the windshield in the final frame" (car sh04) · "**Additional pedestrians** appear beyond the specified group of three" (car sh03) |
| L09 | **Relation broken** | a required `held_by` / `interacting_with` is dropped or replaced | "places Shell **on the lamp pedestal**... breaking the required held-by relationship" (v2-30s sh04) · "Shell remains in an **extended hand** rather than held against Keeper's chest" · "Keeper's free hand **does not grip Railing**" (v2-30s sh02) |
| L10 | **Form morph under motion** | the object's shape or size changes *during* the clip (distinct from being wrong at the keyframe) | "Shell **morphs** from a compact rounded spiral into an elongated, pointed conch" (v1 sh03) · "Shell **enlarges substantially during placement**" (v1 sh03) · "Lamp's concentric optic **disappears as the housing opens**" (v1 sh06) · "Housing door **shifts from the right side to the left** during the clip" (v1 sh07) |
| L11 | **Camera disobedience** | framing moves when it was told to hold | "Framing **shifts toward a side view and crops the car's nose** by the last frame" (car sh01) · "The camera **widens and shifts** toward a more frontal view rather than holding the starting framing" (car sh02) · "**Slight camera reframing** occurs despite Keeper's movement being the only planned motion" (v1 sh01) |

### 5.3 Test design — four clips answer eleven modes

The variable under test here is **the question asked of a fixed clip**, not the generation. Ten of these modes are observable in the same footage, so generating eleven separate tests would be waste. Four generation units carry the whole taxonomy.

**Generation units** (all: wan-3.0, 720p, 5 s, `audio:false`, one static camera instruction, nano-banana-pro 2k start frames — matching production exactly, because changing duration or model would change the thing under test):

| unit | start frame | prompt | cr |
|---|---|---|---|
| G1 | figure at the foot of a staircase holding a palm-sized ridged shell | "She climbs the stairs, holding the shell against her chest. Camera static." | 200 + 480 |
| G2 | lantern room, burner clearly **unlit** | "She opens the housing and ignites the burner. Camera static." | 200 + 480 |
| G3 | *(reuses G2's real last frame)* | "She lowers her hands. The burner stays lit. Camera static." | 480 |
| G4 | street corner, exactly three pedestrians, one green signal, parked car | "The car rolls forward one metre. Camera static." | 200 + 480 |

**Logic probes** — each a yes/no a VLM can answer from frame 0 vs the last frame (plus the mid strip where noted):

| id | probe | unit | HELD CONSTANT | CHANGED | pass criterion (yes/no) | cr | need |
|---|---|---|---|---|---|---|---|
| L00 | **Can the questions even be scored?** Validate every criterion below against the *recorded judge text*, which already contains all eleven modes in natural language. | — | — | — | each mode is unambiguously identifiable in the existing `issues` arrays | 0 | R |
| L01 | Inverted vector | G1 | frame, prompt, model, 5 s | — | subject is **higher** in the last frame than in frame 0 | 0* | N |
| L02 | Null action | G1 | " | — | subject's feet are on a **different step** at the end | 0* | N |
| L03 | Invented action | G1 | " | — | VLM lists every action; the list contains **only** climbing | 0* | N |
| L09 | Relation held | G1 | " | — | shell is **in contact with the chest** in every sampled frame | 0* | N |
| L10 | Form morph | G1 | " | — | shell outline and size are the **same** in frame 0 and the last frame | 0* | N |
| L11 | Camera obedience | G1 | " | — | background framing drift < 3 % (measurable in ffmpeg, free) | 0* | N |
| L04 | State arrives early | G2 | frame, prompt, model, 5 s | — | burner is **unlit in frame 0** | 0* | N |
| L05 | State reached | G2 | " | — | burner is **fully lit** in the last frame | 0* | N |
| L06 | Narrative regression | G3 | as G2 + handoff frame | shot index | burner is **still lit** at the end of G3; no reversion to the G2 start state | 0* | N |
| L07 | Uncommanded change | G4 | frame, prompt, model, 5 s | — | signal colour, pedestrian poses and headlights are **unchanged** | 0* | N |
| L08 | Count discipline | G4 | " | — | exactly **three** pedestrians and **one** occupant, in frame 0 and the last frame | 0* | N |

`*` the probe itself is free; the cost sits in its generation unit. **Logic block total: 600 (frames) + 1,920 (4 clips) = 2,520 credits**, covering all eleven modes.

**Prerequisite:** L00 runs first and costs nothing. If the eleven criteria cannot be scored reliably against text that already describes these exact failures, the probes will not be scorable against video either, and the block should be redesigned before spending.

---

## Part 6 — tool strength A/B

> Testing the hypothesis in the user's words: *"some video generation tools are just not as strong and leads to some logic issues."*

### 6.1 What is actually callable

From `current/research/sources/magic-hour-openapi.json` — the enum on `/v1/image-to-video` and `/v1/text-to-video` carries **22 values**, but only **14** have documented duration, audio and end-frame support. Treat the rest as legacy.

**Documented and safe to design around:**

| model | max duration | end frame | audio | vendor's own positioning |
|---|---|---|---|---|
| `wan-3.0` ← **production** | 2–30 s | 480p/720p/1080p | free | "High-quality video with native audio, long clips, and **end-frame control**" |
| `wan-2.2` | 3–15 s | **not supported** | **not supported** | "Best for **physical motion, action**, and camera movement" |
| `kling-3.0` | 3–15 s | 720p/1080p/4k | extra credits | "cinematic stories, references, optional audio" |
| `kling-2.6` | 5, 10 | 1080p | not supported | "Best for **action, motion blur**, and controlled camera moves" |
| `seedance-1.5` | 4–12 s | 480p/720p/1080p | extra credits | "smooth, consistent **motion with an end frame**" |
| `seedance-2.0` | 4–15 s | up to 4k | free | "reference-led clips with precise subject control" |
| `seedance-2.0-mini` | 4–15 s | 480p/720p | free | faster reference-led |
| `seedance-2.5` | 4–30 s | 480p/720p/1080p | free | "premium realism, detail, and **natural motion**" |
| `veo3.1` | 4,6,8,16…56 | 720p/1080p, **≤8 s only** | extra credits | "**expressive action**, realistic detail" |
| `veo3.1-lite` | as veo3.1 | as veo3.1 | extra credits | balanced, cheaper |
| `gemini-omni-1.1` | 3–10 s | up to 4k | **not supported** | "precise short clips, first/last frames" |
| `minimax-h3` | 1–30 s | **not supported** | free | reference-driven, native audio |
| `ltx-2.5` | **1–60 s** | 480p/720p/1080p | free | "fastest, long clips, rapid iteration" |

**In the enum but undocumented — do not design around:** `sora-2`, `kling-2.5`, `kling-1.6`, `ltx-2`, `ltx-2.3`, `seedance`, and the deprecated `kling-2.5-audio` / `veo3.1-audio` aliases (the spec states a `-audio` suffix is just `audio:true`).

⚠ **`sora-2` contradiction.** It is in the live enum, but `current/research/multishot-video-practice.md` records "Sora 2: discontinued (API closed 2026-09-24) [E] — do not design around it." Either the spec is stale or Magic Hour proxies it. Resolve with one 480-credit probe before trusting it; excluded from the tests below.

### 6.2 The hypothesis this raises on its own

**We selected the production model on the wrong axis.** `wan-3.0` was chosen for end-frame SSIM (0.98–0.99) and free native audio — both real engineering needs. But the vendor positions it as *"high-quality video with native audio, long clips, and end-frame control"*; it is **not** positioned for action fidelity. Meanwhile `wan-2.2` is "best for physical motion, **action**", `kling-2.6` is "best for **action**, motion blur", and `veo3.1` is "expressive **action**".

Our dominant failure class is action adherence (Part 5). So the production model may have been chosen on exactly the axis that is not failing, and scored on exactly the axis that is not the problem. That is cheap to test and would be the highest-value single result in the programme.

Note the tension this exposes: `wan-2.2` supports **no end frame and no audio**, so if it wins on logic, the pipeline must choose between action fidelity and the end-frame/audio machinery it is currently built around. That is an architectural decision, not a parameter change — worth knowing before more is built on wan-3.0.

### 6.3 Video model A/B

Every row holds the G1 start frame, the G1 prompt, 5 s, 720p and `audio:false` constant, and changes **only `model`**. One sweep yields the full L01/L02/L03/L09/L10/L11 profile per model, because the probes are questions, not generations.

| id | name / hypothesis | tool | HELD CONSTANT | CHANGED | pass criterion | cr | need | prereq |
|---|---|---|---|---|---|---|---|---|
| M01 | **Action fidelity by model.** A model positioned for action performs the verb more reliably. | `image-to-video` | G1 frame, G1 prompt, 5 s, 720p, audio off | **model**: wan-2.2 / kling-2.6 / seedance-2.5 / veo3.1 (wan-3.0 baseline = G1, already paid) | L01 **and** L02 pass | 1,920 | N | G1, L00 |
| M02 | **Invented-action rate by model.** | — | as M01 | — (same clips, different question) | L03 passes | 0 | N | M01 |
| M03 | **Form stability by model.** Does the prop morph less under a stronger model? | — | as M01 | — (same clips) | L10 passes | 0 | N | M01 |
| M04 | **Camera obedience by model.** | — | as M01 | — (same clips) | L11 passes; drift < 3 % | 0 | N | M01 |
| M05 | **Relation retention by model.** | — | as M01 | — (same clips) | L09 passes | 0 | N | M01 |
| M06 | **End-frame adherence, re-measured.** Confirm or refute the `state-manager` README table on current model versions. | `image-to-video` + `end_image_file_path` | start + end frame, prompt, 5 s, 720p | **model**: wan-3.0 / seedance-1.5 / seedance-2.5 / kling-3.0 | SSIM(last frame, end image) ≥ 0.95 | 2,120 | N | T02 |
| M07 | **The action-vs-end-frame trade-off.** If wan-2.2 wins M01 but cannot take an end frame, is the loss acceptable? | both | prompt, frame | pipeline mechanism available | decision, not pass/fail: does the M01 winner support what the pipeline needs | 0 | N | M01, M06 |

### 6.4 Image model A/B — the large, unexploited economy

The pipelines use `nano-banana-pro` at 2k, **200 credits an image**. The spec documents far cheaper models that may hold the properties we keep failing:

`z-image-turbo` 5 · `flux-2-klein` 5 · `flux-schnell` 5 · `krea-2` 10 · `qwen-edit` 10 (editor) · `seedream-v4` 40 · `gpt-image-2` 50 · `nano-banana` 50 · `nano-banana-2-lite` 50 · `seedream-v4.5` 50 (editor) · `seedream-v5-pro` 75 · `gpt-image-2.5-flare` 100 · `nano-banana-2` 100 · `nano-banana-pro` 150+ (200 at 2k)

**A prop-scale or text-suppression sweep across six image models costs less than two production keyframes.** Sweep cheap and broad to find which models hold the property, then confirm the winner at production settings.

| id | name / hypothesis | tool | HELD CONSTANT | CHANGED | pass criterion | cr | need | prereq |
|---|---|---|---|---|---|---|---|---|
| M08 | **Prop scale by image model.** Is oversized-prop a model weakness or a prompt weakness? | `ai-image-generator` | the absolute-size prompt (litmus F phrasing), aspect, 1k | **model** ×6: z-image-turbo / flux-2-klein / krea-2 / seedream-v4 / gpt-image-2 / nano-banana-pro | prop within 2× its stated real size | ~310 | N | T05 |
| M09 | **Text suppression by image model.** The one fault class that is 0-for-3 on retries. | `ai-image-generator` | a signage-heavy scene prompt + "no text", 1k | **model** ×6 as M08 | zero readable glyphs | ~310 | N | T17 |
| M10 | **Count discipline by image model.** | `ai-image-generator` | "exactly three", 1k | **model** ×6 as M08 | VLM counts exactly three | ~310 | N | T16 |
| M11 | **Identity-preserving edit by editor model.** The 1.4 / 1.5 boundary, where the lighthouse shrank and gained a building. | `ai-image-editor` | source frame, edit instruction, 1k | **model** ×4: qwen-edit (10) / flux-2-klein (5) / seedream-v4.5 (50) / nano-banana-pro (200) | entity identical; fixed parts of the place unchanged | ~265 | N | T04 |

### 6.5 Costs

| block | credits |
|---|---|
| Logic generation units G1–G4 (covers L01–L11) | 2,520 |
| Video model A/B — M01 sweep (M02–M05, M07 ride free on it) | 1,920 |
| Video model A/B — M06 end-frame re-measure | 2,120 |
| Image model A/B — M08–M11 | ~1,195 |
| **Parts 5 + 6 total** | **≈ 7,755** |

**Cheapest decisive subset — ≈ 2,015 credits:** `L00` (0) + `G1` (680) + `M01` restricted to the two action-positioned models, wan-2.2 and kling-2.6 (960) + `M08` (~310) + `M11` (~265, drop nano-banana-pro from the sweep to save 200).
This answers the two questions that could redirect the architecture: *is the dominant failure class a model-selection error?* and *is prop scale a model weakness or a prompt weakness?* — for about a quarter of what one lighthouse run costs.

**Caveat, unchanged from Part 4:** the spec documents per-image credits but **not per-second video credits**. Every video figure above assumes wan-3.0's measured 96/s and could be materially wrong for `veo3.1`, `kling-2.6` or `seedance-2.5` — three of the four models in the M01 sweep. Confirm the rate with a single short probe, or read it off the first job's response, before committing to the full sweep.

---

## Part 7 — external and uploaded inputs

> Appended by the input-edge hunter. Ids use the `X` prefix. Does not restate T07–T09 (URL accepted, non-16:9, photo-into-painterly); these are the cases those three leave open.

### 7.1 What the spec actually says

**Direct URLs are documented on every `assets.*_file_path` field**, verified in `sources/magic-hour-openapi.json`: the boilerplate "This value is either — a direct URL to the video file — `file_path` field from the response of the upload urls API" appears on `/v1/image-to-video` `image_file_path`, `/v1/ai-image-editor` `image_file_paths` (max 10), `ai-face-editor`, `ai-headshot-generator`, `ai-talking-photo`, `ai-clothes-changer`, `ai-image-upscaler`, `ai-video-editor`, `ai-video-translator`. So the first agent's finding holds for image **and** video endpoints, and the "no upload step needed" shortcut is real.

Three qualifications that matter:

- **The description is copy-pasted boilerplate.** It says "a direct URL to the *video* file" even on fields that take an image. The wording is sloppy, which means URL support for images is documented but not *carefully* documented — worth one cheap probe before any test depends on it (X01).
- **`/v1/text-to-video` `references[]` is the exception.** Its items are `{name, file_path}` with `minItems 1, maxItems 10` and **no description at all** on `file_path` — the direct-URL affordance is not documented there. T21 depends on this path, so it needs its own probe (X02).
- **`/v1/ai-image-generator` has no `assets` property.** It is pure text-to-image, no reference input. Any "reference" behaviour in the pipelines comes from `/v1/ai-image-editor`. Worth stating because the matrix cites `ai-image-generator` for reference-bearing tests (T15, T20).

### 7.2 Two gaps found in the code, read-only

**There is no crop/fit step in either production pipeline.** `--fit-frames` (centre-crop a video input image to the output aspect before upload) exists **only** in the legacy `state-manager/execute.mjs:11,35,170-173`. Neither A nor B has any equivalent: an input image of arbitrary aspect goes to `image-to-video` as-is and the model decides what to do with it. For generated keyframes this is harmless — they are produced at 16:9. For an external image it is the single most likely breakage, and it is the reason X05 is worth running even though T08 looks similar: T08 asks what the *model* does with a 4:3 input, X05 asks what *our pipeline* does when it has no fit path at all.

**The upload-anchor waste is fixed; upload *quality* is ungated.** `pipeline-memory/src/keyframes.js` `anchors()` now short-circuits for uploads — `if (e.upload) { copy(...); memory.setAnchor(...); return file; }` — with no paid job. The 200-credit waste the compare page flagged is genuinely gone. But the upload is copied **verbatim** as the entity's anchor: no resize, no crop, no validation, and no quality gate. `memory.record()` observes it but nothing rejects it. Magic Hour exposes `/v1/face-detection`, and **neither pipeline calls it** (grep across `current/prod`: zero hits). So a full-body shot with a 40-pixel face becomes the identity sheet for the whole film, and nothing notices. That is what X07–X11 probe.

*Noted in passing, outside my scope:* `anchors()` now uses `Promise.allSettled` with an explanatory comment, so the "one rejection abandons paid siblings" half of that defect is handled — but the function still `throw`s at the end and `run.mjs:79` still calls it as a bare `await`, so an anchor failure still escapes uncaught. The second half is unfixed.

### 7.3 Tests

| id | name / hypothesis | tool(s) | HELD CONSTANT | CHANGED | pass criterion (yes/no) | cr | need | prereq |
|---|---|---|---|---|---|---|---|---|
| X01 | **URL probe, image asset.** The boilerplate "direct URL" really works on an image field. | `image-to-video` wan-3.0 | prompt, model, 5 s, image content | input is a URL, not an uploaded `file_path` | job returns 200 and frame 0 matches the hosted image | 480 | N | — |
| X02 | **URL probe, `references[]`.** Undocumented on this field; T21 depends on it. | `text-to-video` + `references[]` | prompt, model, 5 s | reference supplied as URL vs uploaded path | job accepts it; the named entity appears | 480 | N | X01 |
| X03 | **EXIF rotation.** A portrait JPEG with an orientation flag. | `image-to-video` | prompt, model, pixels | EXIF orientation tag set vs stripped | subject is upright in frame 0 | 480 | N | X01 |
| X04 | **No fit path.** Our pipelines have no `--fit-frames`; what geometry comes out? | `image-to-video` via pipeline B | prompt, model, 5 s | input aspect 4:3 / 9:16 / 21:9 | output exactly 1280×720, no stretch, no bars, no 1-px edge | 1,440 | N | X01 |
| X05 | **Resolution floor.** A small or heavily compressed source. | `image-to-video` | prompt, model | source 256 px / 1024 px / 4k | no visible upscaling artefact; identity readable | 1,440 | N | X01 |
| X06 | **Source-borne text travels.** A watermarked or signed photo. | `image-to-video` ×2 across a cut | entity, place, model | source carries a watermark vs clean | watermark absent from both clips | 960 | N | C01 |
| X07 | **Unknown subject scale.** An external photo whose hero prop sits at an arbitrary scale the storyboard never set. | `ai-image-editor` + `image-to-video` | style, entity, stated `size` string | prop scale in the source image | prop within 2× its stated size in the output | 1,360 | N | T05, X01 |
| X08 | **Upload, multiple faces.** Which person becomes the anchor? | pipeline B `anchors()` + `image-to-video` | prompt, model | upload has 1 face vs 3 | the intended person is the anchor; others absent | 680 | N | — |
| X09 | **Upload, small face.** Full-body source, then a close-up shot. | as X08 | prompt, model, framing plan | face occupies ~40 px vs ~400 px | VLM: same person at the close-up | 680 | N | X08 |
| X10 | **Upload, non-frontal.** Profile or 3/4 source. | as X08 | prompt, model | head angle: frontal / 3-4 / profile | identity holds in a frontal output shot | 680 | N | X08 |
| X11 | **Upload, poor light.** Underexposed or noisy source. | as X08 | prompt, model | source exposure | identity holds; grade does not follow the source | 680 | N | X08 |
| X12 | **Real person across a cut.** The *only* recorded upload case (`p1-grandma`, 96/100) is a single clip — this path has never been tested across a join. | pipeline B, 2 shots, cut | entity, style, model | shot 2 is a cut, not a continuation | VLM: same real person, both shots | 1,360 | N | X08 |

**Part 7 total: 10,720 credits.** Cheapest diagnostic subset: **X01 + X04 + X08 + X12 = 3,960**, which answers does-a-URL-work, does-the-missing-fit-path-break-geometry, is-an-upload-anchor-safe, and does-a-real-face-survive-a-cut.

---

## Part 8 — text, compositing and audio

> Ids use the `C` prefix. Two distinct problems are kept apart: text the model **hallucinates into** the frame, which the retry record shows is 0-for-3 prompt-fixable, and text we **composite on top**, which is deterministic and should be provably exact.

### 8.1 What the spec says about audio

Confirmed against `sources/magic-hour-openapi.json`: of 30 POST endpoints, the only Audio-tagged ones are **`/v1/ai-voice-cloner`** and **`/v1/ai-voice-generator`**. `/v1/audio-to-video` consumes audio, it does not make it. **There is no music or sound-effect generation endpoint**, so both pipelines' synthetic placeholder score is a genuine platform gap, not an oversight — a real score needs an outside provider key. Worth noting that `ai-voice-generator` exists and **neither pipeline uses it**, while `storyboard.js` already emits a `voiceover` array that is currently planned and never rendered.

Also confirmed: `/v1/text-to-video` has an `audio` boolean whose description lists per-model support, and it is not uniform — `gemini-omni-1.1` and `kling-2.6` do not support audio at all, `kling-3.0` charges extra for it, `ltx-2.5` and `minimax-h3` do not. Any model-swap test (T18) that assumes clip-native sound will silently lose audio on two of the candidates.

### 8.2 Tests

| id | name / hypothesis | tool(s) | HELD CONSTANT | CHANGED | pass criterion (yes/no) | cr | need | prereq |
|---|---|---|---|---|---|---|---|---|
| C01 | **Hallucinated text persists across a cut.** `d1-desert-tokyo` showed readable branding in 4 of 6 shots despite a no-text requirement. | `ai-image-editor` + `image-to-video` ×2 | place, entity, style, "no text" phrasing | shot 1 vs shot 2 across a cut | VLM: zero readable glyphs in both | 960 | N | T17 |
| C02 | **Unasked branding on a plain object.** The judge found "emblems on an unbranded car". | `ai-image-generator` ×2 | prompt, style | object stated as unbranded vs not stated | VLM: no logo, emblem or wordmark | 400 | N | — |
| C03 | **Overlay timecode survives the chain.** A layer at t=3.0–6.0 s must still be at 3.0–6.0 s after trims, stitch, mix and the final encode. | headless Chrome + ffmpeg overlay | clip set, layer spec | — (replay recorded run) | glyphs present at the planned frame ±1 | 0 | R | — |
| C04 | **Overlay contrast branch.** `run.mjs` picks dark text when the luma under the layer is > 150. | ffmpeg `signalstats` + overlay | layer text, position | background luma either side of 150 | text legible in both; the branch flips | 0 | R | — |
| C05 | **Overlay spanning a cut.** A layer whose window crosses a clip boundary. | as C03 | layer spec | layer within one clip vs across a join | no flicker, no re-fade at the join | 0 | R | C03 |
| C06 | **Clip-native sound across a cut.** Is wan-3.0's per-clip audio consistent enough to cut on? | `image-to-video` audio=true ×2 | place, prompt ambience, model | shot 2 is a cut | no audible level or timbre jump at the join | 960 | N | — |
| C07 | **One bed per location prevents the reset.** | `cues.json` + ffmpeg mix | clip set | bed looped per location vs per clip | ambience does not restart at each clip | 0 | R | C06 |
| C08 | **Voice generator as VO.** `storyboard.js` plans `voiceover` and nothing renders it. | `/v1/ai-voice-generator` | script line | VO present vs absent | audio returned, duration fits the shot | ~50 | N | — |
| C09 | **Audio support is not uniform across models.** Two of T18's candidates cannot return audio at all. | `text-to-video` audio=true | prompt, 5 s | model ×4 | audio stream present, or the gap is recorded | 0 | R* | T18 |

`R*` = answerable from the spec alone; no generation needed, but it must be checked **before** T18 runs or two of its four arms will be silently mute.

**Part 8 total: 2,370 credits** across 9 rows — but **5 of the 9 cost nothing** (C03, C04, C05, C07, C09), so the whole deterministic side is free. The deterministic overlay path is fully testable today at zero spend — and it is the one part of the system that should be provably exact rather than probabilistically good, so it is the cheapest place to find a real bug.

**Parts 7 + 8 combined: 13,090 credits; 0-credit rows: C03, C04, C05, C07, C09.**

---
