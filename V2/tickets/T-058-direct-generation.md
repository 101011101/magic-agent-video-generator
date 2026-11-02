# T-058 · Direct generation: the video model composes; keyframes only when the state demands them

Status: proposed 2026-11-01, from the MCP baseline's film pairs (T-048). Owner: the pipeline (composer); the bench measures it.

## The user's rule, verbatim (2026-11-01)

> so it looks like the mcp just does straight text to video which is good, I think we should do that more instead of the
> long pipeline, we will only do text to video directly for one case, if there are no input restraints then that means the
> video generator can make the whole thing on its own. No input restraint could mean that the user only gave text, that
> means that we dont need to generate key frames per say, if there are references we can just provide the references then
> directly generate the video, if there are constraints, which can be looked at from the state manager, it is likely from a
> super long video with multiple clips to consider from etc, in that case instead of generating key frames we will provide
> key references and let the video generator figure it out, we just gotta provide the environment plus whatever other, we
> dont need to assemble it that much per say for each key frame, which just need to provide references from the previous
> clips which are tracked by the state manager, etc and provide references if the previous frames doesnt have the
> necessary context

## What the data says

- Four film briefs on the free tier: the MCP's one `create_video_from_text` call (ltx-2.5 three times, minimax-h3 once,
  480p, `audio: true`, one prose prompt of 900 to 2,300 characters with timed beats and the exact words) won all four
  against the chain story → assets → screenplay → keyframes (flux-2-klein) → pinned clips (minimax-h3) → stitch.
- The chain's clip is only as good as its stills; every flaw in a still is in the clip, every cut can break continuity.
  The narration generated inside the video model was right (I46a, I47a); the chain's 3-second clips each generate gibberish
  speech under the narration.
- The podcast (I90a) was ONE 30-second generation: the prompt asked for "a single continuous two-shot, no cuts" with the
  four lines timed (0–8 s Maya, 8–17 s Leo, …). Nothing was fed forward between clips; there was one clip. The first
  attempt failed on the API's limit of 2,000 characters for `style.prompt`; the second, at 1,640, ran. The model held both
  hosts for 30 seconds but spoke only Maya's first line: the model's native audio is the weak part of a long single shot.
- On the micro items the agent's own text-to-video calls hold up (D19a, D19b, D19c, J55a won); the chain loses where it
  paints first.

## The three cases

1. **No input constraints (the user gave text only).** One text-to-video call from the brief. The planner writes prose:
   the scene, timed beats, the exact on-screen words, the lines to be spoken, the constraints (no cuts, consistent
   people, no other text). Within the model's grid (ltx-2.5 1–60 s, minimax-h3 1–30 s at 480p on the free tier) and the
   2,000-character prompt limit. Audio on. No story stage beyond the research the brief needs; no assets, no keyframes.
2. **References given (pictures, a logo, a face, a voice sample).** The same call with the references attached: the
   registry's `refs` / `maxRefs` per model (minimax-h3 nine images, videos or audio; wan-3.0 ten; ltx-2.5 undocumented,
   to be probed). No keyframes.
3. **Constraints from the state (a long piece in several clips; the same people, room and props across them; what
   the last clip ended on).** Per clip, references instead of painted keyframes: the environment root (the plate), the
   sheets of the people and props the shot needs, the previous clip's last frame (the pipeline already extracts
   `clips/<clip>-last.png`; the state manager tracks it), and extra references when the last frame lacks the context
   (a new place → its plate; a new character → their sheet). The prompt is the shot's prose (synopsis, moment, beats,
   lines), not the FRAMES block that describes two given pictures.

## What already exists, and what is new

- `--clips t2v`: text-to-video per shot with references = the start and end stills, the sheets of the people in frame,
  the bank voices (`--voice-refs`), up to ten. `--clips seq`: one generation across several shots, references = the
  pinned stills first, then portraits and voices, capped by the model's `maxRefs`; identity checked on the frames.
  Both still paint keyframes first and reference them.
- New: a `direct` clip mode (cases 1 and 2: one generation from the brief; case 3: references from the bank and the
  previous clip, no paint stage). The story and screenplay stages stay as the source of the prose in case 3; in cases
  1 and 2 the planner's prompt is the screenplay.
- Exact on-screen text: the video models letter short strings well and garble long ones (dates and venues in H44a,
  H44b, H44c); long strings keep the code overlay after the generation.

## Open

- Which free video model carries the mode: ltx-2.5 (the MCP's pick, won three of four) or minimax-h3 (the registry's
  free default, nine references documented). Probe ltx-2.5's reference support first.
- A continuity check on the generated clip's frames (the identity gate from `seq`) and what happens when it fails:
  retry with more references, or fall back to the pinned chain for that clip.
- The prompt budget: 2,000 characters per call; a 30-second piece needs the beats compressed.

## Bench

The four film briefs (`bench/mcp/film/items`, the I-group items) on `--clips direct`, graded and compared pairwise against
`results/compare-film-1/` (the MCP) and against the chain; then the ads and composed pieces (H, G) that make a clip.
About 250 to 750 credits a film on the free tier. Acceptance: on the free tier the direct films beat or tie the MCP's
single call on the pairwise judge, the chain runs only when case 3's constraints are present, and nothing regresses on
D and H.

## Built (2026-11-01, commits 20105ce, 374cb21, 162badc, 77a33b3)

- `backend/composer/direct/direct.js`, hooked into `pipeline.mjs`: a whole film from a brief (`--until film`) now goes
  story → direct generation by default; the chain runs only when a constraint forces it: `--chain` or a chain clip mode
  (`--clips pinned|start|t2v|seq`), a stage short of the film, an existing run edited (`--retry`, `--accept`, `--recheck`,
  `--restore`, `--only`, `--script-from`), a reused bank. Flags: `--clips direct`, `--refs a.png,b.jpg`, `--aspect`,
  `--max-seg 30`, `--dry` (prints the requirements and every prompt, pays nothing).
- The planner (`direct-plan-v2`): the BRIEF is the contract. It lists the requirements in the brief's own words first
  (medium, exact on-screen strings, exact spoken lines, the events in order, the length, every "no"), then writes one
  prose prompt per segment of 1,100 to 1,700 characters with timed beats, the quoted words, and the closing constraints;
  the research's facts serve what is shown; the story stage's rewrite is flavour. The first planner (v1) planned from
  the story's rewrite and lost the brief: a live-action documentary for "simple animation", no end card for the ad that
  ends on one. v1 scored 34/23/42/39 on the four films, v2 34/37/58/58 (the chain 29/37/42/58, the MCP 34/100/42/58).
- Segments: as few generations as the model's grid allows (ltx-2.5 up to 60 s, minimax-h3 up to 30 s), each later one
  continuing from the previous one's last frame. **The API binds a reference by its `@name` in the prompt** (422 "The
  prompt must include @previous" otherwise; the chain's `@start`/`@end`/`@id` is the same rule). On minimax-h3 the
  hand-off is near exact: segment 2's first frame reproduces segment 1's last frame, labels included
  (`runs/direct-I92a-mm`). The drift that remains is inside a 30-second generation, the model's own continuity.
- Records: `build.direct` (the plan with its requirements), `build.made[n]` per generation (prompt, refs, the previous
  frame as `start`), `build.film`; `bench/mcp/film/record.mjs --out <arm>` writes the bench record (`film/direct-v1`,
  `film/direct`, `film/direct-mm`); the comparison page's pathway shows the generations and their frames.
- What the model still gets wrong at 480p, read off the grader: speech nobody asked for (Japanese in the silent coffee
  ad, "You call 391 soon?" in the podcast), garbled captions where the brief said no text, dense diagrams lettered
  wrongly over 60 seconds (the MCP's and ours both 24 on the citric acid cycle on ltx-2.5). Next levers, in order:
  mute the generated track when the brief asks for no speech (room tone or the music bed instead); narration by the
  voice tool mixed by code for explainers and documentaries, the model asked for ambience only (dialogue stays with the
  model, it needs the lips); the exact on-screen strings by the code overlay at the planned times instead of by the
  model; minimax-h3 for lettered diagrams (its labels were legible), ltx-2.5 for live action.
