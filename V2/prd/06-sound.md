# 6. Sound

**Purpose.** Everything heard: dialogue, narration, ambience, effects, subtitles and captions; and the question the user put
on 2026-10-30, how a voice stays the same person's voice from one clip to the next.

**Modules.** `src/sound/sound.js` (`narrationTrack`, `mixNarration`, `voiceOf`, the caption and subtitle re-exports),
the voice bank in `src/assets/assets.js`, the clip prompt in `src/edit/edit.js`, `src/lib/captions.js`.

## What exists

**Dialogue, ambience and effects inside the clips.** Performed by wan-3.0 with audio on, at no extra credit. The clip prompt
carries each line as `Name (voice descriptor) says: "…"`, effects as `SFX: …` with their second, the scene's ambience as
`Ambient noise: …`, and "lips move with the words". Every line of the vanderbilt6 film was heard correctly by the
transcription check. **built**. A voice is not stable across clips: each clip is a fresh sample, so the same man can sound
different from cut to cut; veo3.1 in the earlier dialogue test followed the descriptors and spoke every line verbatim at 120
credits a second, but did not keep one voice from clip to clip; wan-3.0 behaves the same way.

**Voice descriptors.** One performable line per character from the cast stage, from the record where it says anything
(Lincoln's high, reedy tenor and frontier accent are documented by contemporaries; Vanderbilt's blunt speech is reported, no
recording exists), with no commentary about sources. **built**.

**The voice bank** (`02-assets.md` §6). A ready-made OpenAI TTS preset per character and one for the narrator, chosen once
from the descriptor with a one-line delivery instruction, a sample rendered once for approval, stored as a property of the
asset and carried in the state manager's elements table. A preset is stable by construction. **built and run** (the third Top Gun film speaks its radio lines in the bank voices through `--voice-refs`).

**Narration.** The screenplay's `vo` beats are read by the narrator's bank voice (`gpt-4o-mini-tts`, the preset and
instructions from `bank.narrator.voice`, default `onyx` with a calm documentary instruction when the bank has none), one TTS
call per line cached by file under `runs/<label>/sound/vo-<n>.mp3`, and mixed under the stitched film at their film seconds
with the film's own sound lowered to 55% beneath them (`narrationTrack`, `mixNarration`, ffmpeg `adelay` and `amix`; a film
without a sound track gets a silent one first, and each narration file is named by its text and voice, never by position). Narration
is never generated inside a clip; the clip prompt says "no narration". The narrator is therefore one voice for the whole film.
**built, not yet exercised** by a stitched V2 film.

**Subtitles.** Made by code from the screenplay's lines (`subtitlesFromScript`): each line from its film second for its
reading time (2.5 words a second, at least 1.5 seconds, plus 0.4), cut short by the next line or the end of its shot; never
written by a model; composited at the bottom of the frame. **built**.

**Captions.** Title, date, source note from the screenplay's `captions`, as overlay cards shown for 4 seconds or until the
next caption, at the top of the frame when subtitles are on, so the two never collide. Cards are PNGs rendered by the system
text engine with word wrap, composited by ffmpeg `overlay`. **built**.

## The options, and what each trades

Two questions decide the sound of a film: where a line is made, and how a voice stays the same across clips.

**Where a line reaches a clip.**

1. *At generation time.* The video model performs the line itself from the descriptor (wan-3.0 audio free; veo3.1 and
   kling-3.0 audio paid). Lips, timing and voice arrive together; the model's own performance; a fresh voice per clip. This is
   what every clip so far did.
2. *Afterwards, by TTS plus lip sync.* The clip is made with its audio dropped, the line is produced from the character's bank
   voice by TTS, and Magic Hour's lip-sync tool takes the video clip and the audio file and returns the clip with the mouth
   re-animated to that audio, about 1 credit per frame in lite mode (a 4-second clip at 30 fps about 120 credits; a 30-second
   film about 900). Guaranteed identical voice; the video model's vocal performance is discarded; a second pass per clip.
3. *Afterwards, by speech-to-speech conversion.* Each clip keeps its own performance, lips and timing; only the timbre is
   converted to the bank voice. The cleanest path if an endpoint exists; whether Magic Hour or the OpenAI audio endpoints
   offer one is not yet established (the Magic Hour reference sheet under `V2/reference/` is being written to answer it). Confirmed 2026-10-30 in `reference/magic-hour-api-sheet.md`: Magic Hour's API has no speech-to-speech endpoint (it is a web-app-only project type), so this path needs another provider or stays design.

4. *An audio reference to the video model.* Magic Hour's text-to-video takes audio references on some models, but that is the
   unpinned path, where the first frame drifted to 0.74 against the keyframe in the earlier test. Rejected for this pipeline.

Narration is always made afterwards (option 2 without the lip sync, since nobody on screen speaks it): one voice, built.

**How a voice stays the same person.** A face holds because every keyframe gets the same portrait; a voice holds the same
way, from one fixed reference. The voice bank is that reference. On top of it, the gate and the mix that are still design:

- room tone generated once per scene and laid under every clip of it, so cuts stop having audible seams (ticket T-014);
- loudness: every part is normalised at the stitch (ffmpeg `loudnorm`, I −16 LUFS, TP −1.5 dB, single pass) so levels do
  not jump at cuts, built 2026-10-30; the two-pass measure and short fades at cuts remain (ticket T-015);
- a voice gate like the identity gate: per clip, is this the same speaker as the bank sample, were the words heard, is the
  level right; flag only (ticket T-016);
- a one-scene test of options 1, 2 and 3 with measured speaker similarity across clips, transcription and cost, so the
  decision rests on numbers (ticket T-017, and T-020 for the generation-time versus afterwards question);
- **the music bed, built 2026-10-30.** Music is a film-level asset: the screenplay's FILM header carries one cue and an arc;
  `musicBed` makes one instrumental track for the whole film from the cue through `/v1/ai-music-generator` (1 credit per
  second, 15–300 s, cached like every paid job), and `mixMusic` lays it under the stitched film at 0.3, dips it to 0.12
  while a line is spoken, and cuts it to silence from the first arc moment that says cut, stop, silence or out. The clip
  prompt says "no music of any kind". Before this each clip composed its own riff from the scene's cue, and the music
  changed at every cut of the first Top Gun film. For music-led cases the track's beat grid driving the cuts is still
  design (CASES §A cases 8 and 9).

A fourth option, built 2026-10-30 and untested: in text-to-video mode the bank's voice samples go along as audio references
(`--voice-refs`), so the clip performs the line in the chosen voice itself (`07-edit.md`).

Magic Hour's named-person voices were rejected earlier; voices come from OpenAI presets or from descriptors; no real person's
actual voice is cloned, and a reconstructed voice is said to be one in the source caption.

**Tickets.** T-005 music bed and narration (both built); T-013 voice bank; T-014 room tone per scene; T-015
loudness and the mix; T-016 voice consistency check; T-017 which voice strategy holds; T-018 preset voices; T-019 lip sync:
inputs, cost, and where it sits; T-020 matching sound to video, at generation time or afterwards.

**Checks.** Transcription of every clip with lines, reported beside the clip; no gate on sound yet.

**Cost.** Inside the clip price on wan-3.0; extra credits on veo3.1 and kling-3.0 when audio is on; TTS calls are OpenAI
usage, not credits; lip sync about 1 credit per frame.

**Status.** Dialogue, subtitles and captions built and used in the vanderbilt6 film; the voice bank and the narration track
built in V2, not yet heard in a stitched V2 film; music, room tone, loudness, the voice gate and the strategy test not
started.
