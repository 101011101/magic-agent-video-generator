# Approach 2 — shots: first frame + video + environment + asset bank (draft PRD, 2026-10-29)

> The approach run on the Vanderbilt film on 29 Oct (`experiments/fact-shots.mjs`, `fact-onepass.mjs`, `fact-pinned2.mjs`).
> The unit is the shot, timed by the screenplay; the bank holds identity; the state manager holds environments and
> transformations as text; the video model does the acting.

## 1. Pipeline

```
prompt ─► research gate (small call) ─► research round (web search) when needed ─► story from the facts, cited
      ─► screenplay with TIME: scenes, action lines, dialogue, seconds per scene
      ─► element table ─► asset bank: identity references (portraits / sheets) and environments WITH their declared fixtures;
                           real things from the record (Commons), generated only where nothing is on record
      ─► declared-elements check (code): every element a shot names exists in the bank, or the bank is extended
      ─► shot list: at most MAX seconds per shot; when time is up, a CUT to a new framing in the same environment
      ─► per shot: START frame painted (environment + portraits + the moment), END frame painted the same way;
         the next shot's start = the same instant reframed (painted from the previous end frame + portraits)
      ─► per shot: image-to-video pinned on start and end, the shot's action and lines in the text, audio on
      ─► stitch (ambience and effects from the clips; voices in the clips; music as one bed after)
```

## 2. Rules

- **Identity from the bank, always.** Every frame that contains a person is painted with that person's portrait attached and
  named by image number with the telling features ("image 3: white side-whiskers, no glasses"). Identity never comes from a
  previous frame or a previous clip. Each painted frame is checked against the portraits (one vision call) before use; one retry.
- **Environment from the plate or the last frame.** The place's picture (plate, or a period photograph of the real place) is
  image 1 of a scene's first frame; a later shot in the same place starts from the previous shot's end frame, which carries the
  state. The environment may transform (a new angle, a pan): the reframing is painted as a still from the previous frame.
- **Transformations are text.** The state manager records what changed (held, opened, wrapped, positions) and the clip prompts
  say the current state in words; nothing is extracted from the middle of a video.
- **Time rules the cuts.** The screenplay carries seconds per scene; a shot is at most MAX seconds (10 for wan, 8 for veo with
  an end frame); when a shot's time is up, the next shot is a cut with a real change of framing (shot size or 30 degrees), given
  as an IMAGE (the reframed still), not as an adjective. Cut where the content turns, not per line.
- **Every element named is declared.** The shot list returns ids and plain-noun mentions; code checks them against the bank
  (ids, names, a place's fixture list); undeclared mentions are added to the environment (its plate regenerated) or reported.
- **Dialogue.** Lines are spoken in the clip (wan-3.0, veo3.1 with audio) with a voice descriptor per speaker; transcription
  checks the words. One voice per character across clips is not guaranteed by the models; TTS + lip sync remains the fallback.

## 3. What it proved (measured, Vanderbilt scene 2)

| test | result |
|---|---|
| one-pass text-to-video with 7 @references, 15 s | whole scene staged in order, caption rendered, 3 of 5 lines heard; first frame 0.74 to @key1; Stanton shook hands instead of Vanderbilt (two bearded references) |
| six shots chained on last frames, 28 s | room, treatment, faces held across every cut; all lines heard; "reverse angle" shots copied the previous framing (jump cuts); an extra man from shot 4 inherited by 5–7 |
| two pinned clips (A→B wide 10 s, cut, C→D medium 20 s) | clips start and end on their stills; the cut is a real reframing; identity only as good as the stills (first run inherited the swap; second run paints every still with the portraits and checks it) |
| dialogue at video time, veo3.1 8–16 s | all lines verbatim; voice descriptors followed; voice not stable across clips; 120 credits/s |

## 4. Costs (wan-3.0 720p with audio)

- stills 200 each (two per shot, one shared at a cut); clips 96 per second; a 30-second film of 4–6 shots ≈ 1,600–2,400 in
  stills and 2,880 in clips; research, story, screenplay, shot list and checks are text.

## 5. Open

- Minimum seconds per action in the shot list (a walk-in and a handshake need ~4 s, not 3).
- Treatment: a period photograph as the environment pulls the whole film to its tone; say colour or monochrome once and give
  the style reference to every still.
- Reference pick: reject mounts, stereograph cards, two-up images; prefer a single clean view.
- Music: one bed from `/v1/ai-music-generator` under the stitched film; voices: TTS + lip sync when a character speaks in more
  than one clip.
