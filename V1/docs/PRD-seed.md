# PRD — Seed: asset bank + starting seeds + ground plans

> Generated places: built (B-008), first run R-005. User uploads (A-001, A-002): not built. Tickets: `tickets/A-*`, B-008.

## 1. Thesis

- The first frame of every place must be **based on something**: a user asset, or a seed made from the natural-language request.
- A seed carries a **ground plan** (the layout of the place from its one camera). The ground plan is text the LLM can reason
  over, so the slide plan stays logically consistent with the place: who stands where, next to which item, which item changes.
- After the seed exists, the rest is the presence tracker (stage 1): the frames carry the state forward.

## 2. Flow

```
prompt + user assets (images with a note: "my grandma's kitchen", "my dog")
   │
   ▼
[A1 Cast]  one LLM call with the assets attached
   │  entities + places; each may be sourced from an asset ("upload:N"); a ground plan per place
   ▼
[A2 Roots] asset-sourced → adopted unchanged (no generation) · others → generated from look + ground plan
   ▼
[A3 Observe] vision reads every plate back into an OBSERVED ground plan (what is really in the picture)
   ▼
[S1 Sequencer] slides planned against observed ground plans: compositions name plan items ("beside the small yellow bowl")
   ▼
stage 1 (tracker, builder, verifier) — edit prompts also carry the place's ground plan
```

## 3. Ground plan

```json
{ "camera": "standing in the doorway, looking at the long table, eye level, wide",
  "items":  [ { "name": "long wooden table", "where": "centre, middle", "size": "waist high, three people long" },
              { "name": "small yellow bowl", "where": "on the table, right", "size": "palm-sized" } ],
  "light":  "morning sun through the back window" }
```
- **Intended** plan: written by A1 before the plate exists (drives the plate prompt).
- **Observed** plan: read from the plate by A3. The observed plan wins; the LLM plans against the picture, not against its intent.

## 3b. As built (B-008)

- One LLM pass after the story writes every place's plan: `camera`, `marks[{ id, name, where, size, faces, key }]` (directed parts
  are their own marks: `bed.head`, `bed.foot`), `doors[{ mark, leads_to }]`, `light`, and character `scale`. Rules: camera terms
  only (left/centre/right, near/middle/far, which wall), sizes relative to a grown person, every door leads somewhere, a clear
  floor path between the marks the story uses.
- The plate prompt is the plan, mark by mark. Vision answers per mark: visible, matches, observed_where. A missing or misplaced
  key mark regenerates the plate with the misses as a note (≤ 3 tries); the best try is kept.
- Canonical marks = the plate's answers; marks the plate does not show are dropped, so steps cannot use them.
- The seed is only for seeding: after the first frame of a place, the frames carry everything.

## 4. Decisions

- A user asset is a root as is: never regenerated, never "cleaned up". If it is unusable (grid, wrong subject), report it; do not replace it silently.
- Style follows the user's place asset when one is given (a photo story stays photographic).
- Ground plans are per place and per camera. A second camera angle is a second plate with its own plan (ties to G-001).

## 5. Risks

- Vision may miscount or misplace items; the observed plan is then wrong in a way the LLM trusts. Mitigation: the verifier checks named items too.
- A user photo at a different aspect than 16:9 must be fit (pad or crop) before it is a plate; a crop can cut out plan items.
