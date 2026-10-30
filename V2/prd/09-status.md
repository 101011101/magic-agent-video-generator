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
| results | the run page (every frame, attempt, input, gate; clips with variants; sequences beside their pinned clips) and the finished-product page | — | — |

Open with the user: the Vanderbilt two-shot (accept or retry) and its film; whether CONTEXT keeps the shot's action text
(T-022); the identity half of the prop gate (T-021); the fourth Top Gun run: 18 stills painted, the load gate's verdicts on them, and the jets-flying-past problem (the side-camera line rule) that only a fifth screenplay fixes.
