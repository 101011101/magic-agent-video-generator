# 7. Edit

**Purpose.** One clip per shot between its two keyframes, gated; the stitch; the overlays; the narration mixed under.

**Modules.** `src/edit/edit.js` (`clipPrompt`, `policySafe`, `makeClips`, `stitchFilm`), `src/lib/media.js` (frames, SSIM,
the stitch), `src/lib/captions.js`, `src/sound/sound.js` (the narration mix), `src/lib/jobs.js`.

**The clip prompt** (`clipPrompt`, ported from `V1/src/prompts.js`), assembled by code:

```
FRAMES   Image 1 is the first frame and image 2 the last frame of one continuous N-second shot; the camera holds still.
         Pace, from the shot's field: still | slow | natural | fast ("everything that moves crosses the frame quickly, with
         motion blur; the air and the camera shake with speed") | frantic.
CAST     (each keeps his own face, hair, beard and glasses in every frame)
         - <Name>: <feature line>; <third> third at the start (and at the end, if it changes).
MOMENT   the shot's moment. Tone: the scene's tone. By the end: what each person is doing at the last frame, when it changed.
BEATS    (seconds from the start of the clip) - t s: actions; Name (voice descriptor) says: "…"; SFX: effects.
         Lips move with the words.
PEOPLE   N and nobody else; they move naturally and end exactly as in image 2; nothing appears that is not in the frames.
SOUND    Ambient noise: the ambience; the voices clearly; no music of any kind; no narration; no subtitles.
```

CAST exists because between two correct frames the video model put one man's face on another while inventing the motion;
the clip prompt had named the men and never said which one had the beard. Narration is never asked of the clip. A
content-filter rejection ("nsfw") is resubmitted once with a policy-safe version made by rule (`policySafe`: names and
positions only in the CAST block, nothing else touched, "they speak the lines"); the rejection of clip 6 in vanderbilt6 was not deterministic: the identical
request was accepted on the next submission. **built**.

**Rendering** (`makeClips`). `Jobs.video`: image-to-video with the start and end still, seconds from the grid, audio on; one
attempt per run; a new suffix on `--retry`; the job's prompt and inputs recorded; a clip is made only when both of its stills
exist and nothing in their chains is flagged ("waiting on s1-2" otherwise). The whole per-clip body, render and checks, is
guarded, so a failure records `{ error }` for that clip alone and the other workers finish theirs (a crash in the checks once
orphaned a render in flight); a clip without a sound track is not transcribed. A card clip is made by code only when BOTH
stills are cards; one card and one frame is an error (the screenplay check refuses it first). Clips are independent and all
render at once by default (`--parallel N` to limit; Magic Hour publishes no concurrency cap and the credit guard reserves
jobs in flight), so a set of clips takes about as long as its longest one. **built**.

**The pending-job record, and resumption.** `Jobs` writes the Magic Hour job id under `run.json` → `pending[key]` the moment
the server returns it and removes it when the download is done. On the next request for that key the pending job is
resumed (`pollJob` in `src/lib/magichour.js`), downloaded, recorded and booked once; only a job that errored on the server
is forgotten and posted anew, so an interrupted poll never pays twice. The charge is booked before the download and an empty
download is an error. In vanderbilt6 one 7-second render was lost the old way, about 670 credits possibly charged with no
local record (ticket T-007). **built and run**: a radio clip of the second film timed out on Magic Hour's side and was resumed from its pending id on the next run, charged once.

**Other models.** `--model` picks the clip model; the duration grid and the price per second come from the sheet (`GRID`
in `screenplay.js`, `VIDEO_RATE` and `AUDIO_EXTRA` in `jobs.js`): wan-3.0 96 with sound; ltx-2.5 and minimax-h3 48 with
sound, 1 to 60 and 1 to 30 seconds; kling-3.0 48 plus 24 for sound, 3 to 15 seconds; veo3.1 96 plus 24, 8 seconds at most
with references; seedance-2.5 336. The screenplay's grid follows the chosen model, so an ad's 2-second shots rule out kling
and veo. Only wan-3.0 has been measured on real material; ltx-2.5 is the challenger to test (half the price, sound included,
one of the three models Magic Hour's own scripted-speech tool runs on).

**Voice references** (`--voice-refs`, text-to-video mode only): the bank's voice sample of each speaker goes along as an
audio reference (@vega_voice) and the line says "in the voice of @vega_voice", on the models that take audio references
(wan-3.0, seedance 2.x, minimax-h3). Untested; the cheapest route to one voice per character without any post work.

**Duration grid, per model, from the Magic Hour table** (end frame support in brackets): wan-3.0 2–10, 15, 20, 25, 30 s [yes;
audio free]; kling-3.0 3–15 [yes; audio extra]; veo3.1 and veo3.1-lite 4, 6, 8, 16, 24, 32, 40, 48, 56 [only up to 8 s; audio
extra]; seedance-2.5 4–30 [yes]; ltx-2.5 1–60 [yes]; minimax-h3 1–30 [yes]. Text-to-video takes 1–10 named references
(`@name`) and needs an aspect ratio; 16:9, 9:16 and 1:1 are available on most models. The screenplay call receives the grid,
so a shot never asks for a length no model renders (the v1 screenplay asked for 11 seconds). **built**.

**Checks.** The clip gate (`04-state.md`); SSIM of the pinned ends; the transcription. **built**.

**Three ways to render a shot** (`--clips pinned|start|t2v`, built 2026-10-30, ticket T-023 for the measured choice):
`pinned` is image-to-video on the first and last stills, as built; `start` is image-to-video on the first still only (the
end still is painted and used by the gates, not pinned); `t2v` is text-to-video on wan-3.0 with the two stills and the
portraits as named references (@start, @end, @vega), the scene as text (`t2vPrompt`: the shot and its pace, the context,
the cast, the beats, the sound), so the frames guide the model instead of pinning it, and a clip may run to 30 seconds.
Every rendered variant is kept under `build.variants[n][mode]` and shown on the run page; `build.made[n]` is the variant of
the mode last asked for, and `--only clip-7` renders one shot without stitching. The user's reading of the first film: a
pinned end frame fights the physics of a fast shot.

**Sequences** (`--clips seq`, built 2026-10-30 after the second Top Gun film). The user's reading, confirmed on clip 7
of that film: two stills pinned from two camera positions made the jets pivot mid-clip, and a 3-second clip has no room
to move. A sequence is ONE text-to-video clip for a run of consecutive shots of a scene, up to `--max-seq` seconds (15),
rendered at the smallest grid length that holds them and trimmed at the stitch; every keyframe of those shots goes along
as an ordered named reference (@f1, @f2, …, frames before portraits, ten at most, the bank voices after them with
`--voice-refs`), and the text states the hard cuts at their seconds, each shot's size and pace, its frames, its moment and
its beats at clip seconds. Nothing is pinned, so the model keeps its own motion through the frames it is shown. With `--speed-up 1.4` a sequence whose shots are all fast or frantic is rendered 1.4 times longer and played back faster
at the stitch (video time-compressed, sound tempo-corrected in pitch), the lever we have for motion the model makes too
slow; it costs the extra render seconds on fast shots only. With `--seq-across` a sequence may run across scene boundaries as further hard cuts, each shot then carrying its own
heading, so a film of one-shot scenes (the radio exchange between two cockpits) still becomes a few long clips. A title
card is its own sequence by code. The gates run per sequence (pinned ends against the first and last stills, identity
across the frames, the transcription); `--retry seq-7-10` and `--accept seq-7-10` name one. The film is then a few
10-to-15-second parts instead of eleven 3-second clips. **built and run**: the third Top Gun film is three sequences and a card; the attack as one clip kept one direction of flight and real speed, and took the liberties text-to-video takes (an extra bomb or two, a runway behind one cockpit).

**No music in a clip.** Music is the film's one bed (`06-sound.md`), mixed after the narration; a clip told the scene's
cue composed its own, different at every cut.

**The stitch** (`stitchFilm`). Each clip's thin black bars (a painter's letterbox carried through the clip, up to 10% of the
frame; found by cropdetect) cropped off, then the clip normalised to 1280×720 at the highest frame rate among the clips (forcing 24 on
30-fps clips dropped one frame in five; a 24-fps card never drags a 30-fps clip down), AAC, every part normalised to one loudness (`loudnorm`), a silent track added to a part
without sound; concatenated; the captions (top) and subtitles (bottom) composited for their seconds, a caption that a title
card already shows not overlaid again, two subtitle lines at one second on one card. Output `clips/film.mp4` with a video and a stereo audio stream (vanderbilt6: 30.4 s,
mean level −12.6 dB). **built**.

**The narration mix** (in `src/pipeline.mjs` after the stitch). The screenplay's `vo` lines are rendered by the narrator's
bank voice and mixed under `clips/film.mp4` at their film seconds, the film's own sound lowered beneath them; the result is
`clips/film-narrated.mp4`, which becomes the film when narration exists. **built, not yet exercised**.

**Design only.** Beat cutting from a track; inserts (an item with a push-in or pan by ffmpeg, no video model); screen
composites (screen layer, face-cam clip, overlay layer); camera motion within a shot (the `advance` branch: the end still is
the same place a moment later from the camera's new position; the clip prompt carries the move in the model's own words);
a one-pass text-to-video clip with references for B-roll with nobody in it; dialogue by TTS plus lip sync and the rest of
`06-sound.md`.

**Cost.** 96 credits a second on wan-3.0 at 720p (4 s = 384, 5 s = 480, 7 s = 672, 8 s = 768, 2 s = 192, all measured).

**Status.** Built for the static case and used to make the vanderbilt6 film in `V1/`; the V2 port with the narration mix,
the guarded clip loop, the resumption of pending jobs and the stitch rules has not yet made a clip (the audit cases pass in
`V2/tests/audit.test.mjs`); the design items are not started.
