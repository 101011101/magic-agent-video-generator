# 9. What is built and what is not

Status as of the end of 2026-10-30. Three V2 films exist from one brief, each a full pass through the pipeline; the
Vanderbilt run reached its keyframes. Every rule below is in `V2/src`, documented in this directory, and covered by
`node V2/tests/state.test.mjs`, `node V2/tests/edit.test.mjs` and `node V2/tests/audit.test.mjs` (no network).

| film | run | what it proved | what it showed was missing |
|---|---|---|---|
| first | `topgun` | the chain end to end: story, sheets, 16 stills, 9 pinned clips, subtitles, captions | music per clip; nine references made a collage; a camera move inside a shot; no pace; thin letterbox bars |
| second | `topgun2` | film-level music, 2–4 s pacing, the still camera, reference cap, props pictured, the first sequence | pinned ends from two viewpoints pivot; far pilots demanded visible people; no size, no orientation |
| third | `topgun3` | size, heading, view, theme, treatment, relations; sequences across scenes with the bank voices; the style gate | texture over nine generations; the climb painted from the approach; no scene synopsis, no motion cues |

| subsystem | built and run | built, not yet exercised | design only |
|---|---|---|---|
| story | the two-question gate, research, fact and fiction stories, the film `kind`, story reuse with the brief | — | — |
| assets | elements, medium (no widescreen words), Commons with the pick and the plate check, reuse by id / map / name with voice samples, generation of characters, plates and props with the sheet check and bar stripping, cast lines, the voice bank | `--retry root-<id>` on a flagged sheet | items, screens, tracks |
| screenplay | film-wide numbering; theme, music cue and arc, scene synopsis, tone; per shot: moment, treatment, pace, motion cues, camera view and move; per element: size, heading, facing, relations; pacing by kind; the checks (structured fields error, prose patterns note); the writer's revision loop | — | the rest of v3 (aspect, overlays by kind, screens) |
| state | the single pass; image 1 by continuity (latest wide scored by presence and state), never a card; memory (scene so far, previous frame); the style sheet; reference cap by prominence; the people, room, bars, style and clip gates; crops with guards; depth; `--retry`, `--accept`, `--recheck`, `--dry` | — | the identity half of T-021 (the same object as its picture); the load half is built |
| keyframes | the template with CONTEXT (synopsis, memory, theme, moment, treatment, tone), FRAME (motion cues, view), PEOPLE and PROPS (size, heading), RELATIONS, CHANGES, REFERENCES (what image 1 shows, the style sheet), RULES (the medium words); far people as figures; painting with attempts kept, stale ids flagged, a retried crop painted | — | — |
| sound | the voice bank; voice references in text-to-video; the music bed and its mix with ducking and arc cuts; subtitles; captions; loudness per part | narration under a film (the Vanderbilt film has not been made) | lip sync, room tone, the voice gate |
| edit | four clip modes (pinned, start, t2v, seq), sequences across scenes with a frame cap and faster playback, variants kept per mode and model, all clips at once, the guarded loop, resumed jobs, the ledger lock, the stitch (bars cropped, highest rate, silent tracks, cards once) | — | beat cutting, inserts, screen composites |
| models | the registry (14 still models, 11 video models, 3 tiers): costs, grids, reference caps, clip-mode support, `--tier`, `--script-from` | — | prices marked estimate until a job pays them; a compact prompt rendering for low-capacity models (T-027) |
| stage | the stage model (T-029): positions and headings in metres per frame, camera placed, derived screen words, the WORLD block, the geometry checks and the geometry gate; the film synopsis and scene situation; the place setting in plates; the previous frame across continuous scenes | — | the first staged screenplay and paint (topgun9) |
| results | the run page (every frame, attempt, input, gate; clips with variants; sequences beside their pinned clips), the finished-product page, and the comparison page (two runs of one screenplay side by side, `compare.js`) | — | — |

Open with the user: the Vanderbilt two-shot (accept or retry) and its film; whether CONTEXT keeps the shot's action text
(T-022); the identity half of the prop gate (T-021); T-026 physical scale; T-027 compact prompt for small models; T-028
declare the realistic loadout (the missile the painter will not drop).

**Films on the free-flagged video model (2026-10-31):** `topgun4-film` (nano stills, minimax-h3 @480p, the free plan's
resolution; about 1,000 credits of video) and `topgun8-film` (nano stills on the fifth screenplay, minimax-h3 @720p). The
qwen arm (`topgun7`) is the cheap-still experiment: see `compare-topgun7-vs-topgun8`. minimax takes nine references, not
ten; the registry says so.

**2026-10-31 (later).** The ninth film's attack wide (s7-2) is open: see T-029, "After the first full run". New
pipeline surface: `--retry` with `--only` (remake only the named dependents, mark the rest), `--restore id:n` (an
earlier attempt becomes the still again). Spend on the label: 7,400 credits.

**2026-10-31 (later still).** The ninth film repainted on a clean plate: 20 stills passing or accepted, every jet
heading the right way (T-029, last section). Spend on the label: 12,000 credits. Next on the user's word: sequences
and the film.

**2026-10-31 (film).** The ninth film finished on the free video model: minimax-h3 at 480p, three sequences across
scenes with the bank voices and a 1.4 speed-up, the music bed under it, 774 credits. `V2/results/topgun9-film/`.
Label total 12,774.

