# Cases: what different kinds of video demand of the shooting script and the frame prompts

Written 2026-10-30 after the Vanderbilt v2 run (`V1/runs/exp-vanderbilt5`). Purpose: decide whether ONE shooting-script
prompt and ONE frame-prompt scheme can serve every kind of video we want to make, and what has to change in them. Sources
are listed at the end; conventions marked (general) are standard practice not tied to one source.

The pipeline today: story → shooting script (one call: scenes → shots → a first and last frame per shot for every element)
→ still prompts and clip prompts assembled by code → stills (image editor, portraits attached) → clips pinned on the stills
→ stitch with caption overlays. Everything below is measured against that.

## A. The cases and their demands

| case | format, length | camera | subjects and identity | environment | audio | on-screen text | inserts and other media | cut rhythm | continuity that matters |
|---|---|---|---|---|---|---|---|---|---|
| **1. Narrative drama, factual re-enactment** (Vanderbilt) | 16:9; 30 s to minutes | locked-off setups; coverage: master, singles, over-the-shoulder; the line never crossed | 2–4 people from portraits or sheets | one room or place per scene; must hold across cuts | spoken lines in the clip, ambience, music bed | title, date, source note | none, or an archival insert | cut where content turns; 3–8 s shots | sides of frame, eyelines, who holds what |
| **2. Product ad, commercial** (bakery) | 16:9 and 9:16; 15 / 30 s | locked-off plus slow push-ins; packshot at the end | 1–2 people, the product as a prop with states (raw, baked, wrapped) | kitchen / shop; product hero on a clean surface | music-led, a line or two, VO tagline | product name, CTA, end card with logo | packshot (insert), end card | 2–4 s shots, music-driven | the product's state across shots; the same product in every shot |
| **3. Social short, UGC-style ad** | 9:16; 9–30 s | handheld, phone, to-camera; jump cuts accepted | one presenter, to camera; the product in hand | home / street; changes freely | the presenter's voice (lines to camera), music | burned-in subtitles (sound-off viewing), hook text, CTA; safe margins | product close-ups, screen recordings as B-roll | hook in the first 1–3 s; 1–3 s shots | the presenter's identity and the product; little else |
| **4. Vlog, walk-and-talk** | 9:16 or 16:9; 30 s to minutes | selfie / handheld following; the camera moves WITH the subject; background changes within a shot | one vlogger facing the lens, occasional others | streets, rooms, changing continuously | the vlogger's voice (to camera), natural ambience | subtitles, location labels | B-roll cutaways (places, food, objects) | jump cuts, 2–6 s | identity, clothing for the day, time of day; the place only loosely |
| **5. Explainer, tutorial** | 16:9; 60 s to minutes | screen capture, or a presenter plus slides; zooms into regions of the screen | a presenter (optional), a cursor, UI elements | a screen (an app) or a slide; "what the screen shows" is the state | VO narration, no ambience | labels, callouts, step numbers, highlighted regions | screen recordings, diagrams | cut per step | the screen's state (what is open, what was clicked) across shots |
| **6. Documentary** | 16:9; minutes | interview: static, subject on a third with an off-axis eyeline; archival: slow pan or zoom over a still (Ken Burns) | interviewee from a portrait; historical figures from the record | an interview room; archival images are their own environment | VO narration ties A-roll and B-roll; interview sound | lower third on first appearance, opposite the subject's head; source notes; dates | archival photographs and footage with a move, maps, B-roll | cut after a thought ends; B-roll covers interview cuts | the interviewee's framing across the film; the archival image not altered |
| **7. Streamer, gameplay commentary** | 16:9; minutes | a static face-cam (20–25% of the width, a corner) over a full-screen capture | the streamer; the game is the "environment" | a layout: screen layer + face-cam layer + overlay layer | commentary voice, game audio | alerts, chat, HUD, name plate | the screen capture itself | long shots; cuts rare | the layout never moves; the face-cam framing holds |
| **8. Music video** | 9:16 or 16:9; 2–4 min | every kind: performance static, handheld, orbit, tracking | performers (lip-sync to the track), dancers | varies per section | the TRACK drives everything; no dialogue; lip-sync to it | lyrics optional, title | performance and narrative shots intercut | cuts on beats (≈ one beat per shot), faster in the chorus, lengths varied | performers' identity and wardrobe per section; beat alignment |
| **9. Trailer, teaser** | 16:9; 30–120 s | montage of the strongest setups; pushes and pulls | several characters | several places; none held for long | music bed, stingers, a few lines, VO | title cards between shots, date, tagline | title cards, logo | 1–3 s shots, music-driven, title cards as beats | identity only; places need not hold |
| **10. News report, package** | 16:9; 60–120 s | anchor to camera, static; field stand-up; B-roll with slow moves | anchor, reporter, interviewees | studio desk; field locations | VO over B-roll, soundbites, anchor lines | lower thirds, location and date, tickers | B-roll, maps, stills | VO-led, 3–6 s shots | the anchor's framing; lower thirds on every new speaker |
| **11. Animated storybook** | 16:9; 30 s to minutes | locked-off, gentle pushes | characters from character sheets, not photographs | painted places; must hold | narration VO, lines, music | title, the book's text as captions | none | 3–6 s per beat | character design across every frame; props' states |
| **12. Walkthrough: real estate, travel** | 16:9 or 9:16; 30–90 s | continuous moving camera through spaces; no cuts or few | no people | the place IS the subject; changes continuously within a shot | music, VO, ambience | room labels, prices, locations | drone or exterior inserts | long moving shots, 5–15 s | the same property across shots; light and time of day |
| **13. Presenter, lecture, slides** | 16:9; minutes | static on the presenter; slides full-screen or side by side | one presenter | a stage or desk; slides as a screen element | the presenter's voice | slide text, agenda, lower third | slides (screen element) | cut per slide or point | the presenter's framing; which slide is up |

## B. Demands → what the script and the prompts must carry

| demand | who needs it (cases) | script field or rule | still-prompt consequence | renderer (code) | status today |
|---|---|---|---|---|---|
| format: aspect ratio, length, safe margins | 2, 3, 4, 8 (9:16); all (length) | FILM header: aspect, seconds, safe margins for vertical | stills and clips at the aspect; text away from edges | image editor and video model take 16:9 / 9:16 / 1:1 (Magic Hour supports all three on most models) | missing: aspect is hard-coded 16:9 |
| medium and deliverable kind | all | FILM header: medium sentence (from the story), kind (drama, ad, vlog, ...) | medium sentence in every still | none | partial: medium exists; "live-action film" is hard-coded in the script prompt |
| camera motion within a shot | 4, 8, 9, 12, 2 (push-ins), 6 (archival moves) | SHOT: motion kind (static, pan, tilt, dolly, track, handheld, zoom, orbit) with a path; camera_last for where it ends | a moving shot's last still is "the same place a moment later from the camera's new position"; image 1 gives the look, not the exact view | pinned clip with the motion in the model's vocabulary | missing: a shot has one camera and no motion |
| to-camera address, selfie | 3, 4, 10, 13 | camera: held_by (a character) or "to camera"; frame: facing "the lens" | subject near, facing the lens, background from the place | pinned clip; the model performs the speech | missing: facing can say "the camera" but nothing marks the shot kind |
| coverage patterns for dialogue | 1, 11 | a coverage rule: a shot looks at its speaker; singles and over-the-shoulder allowed; the line fixed per scene | per still: the camera fields | pinned clips | partial: the line and the size/angle rule exist; the model chose punch-ins only |
| cut rhythm | 1 (content), 2, 8, 9 (beat), 5 (step), 3, 4 (jump cuts) | FILM header: cutting rule; music videos: a beat grid from the track | none | stitch on beats for 8 and 9 | partial: only "where the content turns" |
| hook | 3, 2 (short), 9 | FILM header: hook required; check: shot 1 carries it within 3 s | none | none | missing |
| spoken lines in frame | 1, 2, 3, 4, 10, 11, 13 | lines with speaker and second; voice descriptors from the cast stage | none | the clip speaks them (wan-3.0, veo3.1); transcription check | done |
| narration (VO) | 2, 5, 6, 9, 10, 11, 12 | beats: vo [{at, text}] with a voice; not a character in frame | none | TTS → mixed under the stitched film; or the video model's narration track | missing |
| music | 2, 8, 9, 12, 11 | scene music cue, or a supplied track for 8 | none | music generator bed, or the given track, mixed at the stitch | partial: cue text exists, nothing is generated or mixed |
| sound effects and ambience | all | sfx per beat, ambience per scene | none | in the clip (audio on), labelled `SFX:` / `Ambient:` as the Veo guide recommends | done (labels to adopt) |
| on-screen text, by kind | 1 (title, date, source), 2 (CTA, end card), 3, 4 (subtitles, hook text), 5 (labels, callouts), 6, 10 (lower thirds), 8 (lyrics), 9 (title cards) | overlays [{at, kind, text, anchor}] with kinds: title, caption, subtitle, lower-third, label, CTA, end-card, title-card; subtitles generated from lines by code | NEVER painted into a still ("no text") | caption cards composited at the stitch; lower thirds anchored opposite the subject; safe margins on 9:16 | partial: title/date/source captions only |
| inserts: packshots, archival stills, title cards, B-roll | 2, 6, 9, 10, 3, 4 | SHOT kind: insert (a bank item or a product still) with a move; broll (a place with no people) | no painting for an archival image; a product still painted from the product reference | Ken Burns pan/zoom by ffmpeg; a title card by the caption renderer; B-roll as a one-pass text-to-video with @references | missing |
| screens as content | 5, 7, 13 | element kind: screen, with `shows` as its state per frame; SHOT kind: screen | no painting; the screen is captured or rendered separately | composite by ffmpeg: screen layer, face-cam layer, overlay layer | missing |
| product states | 2, 3 | PROP frame: where, condition (exists) | one line per prop | pinned clips | done |
| identity across the film | all with people | the bank: portraits / sheets; cast feature lines | portraits attached to every still, named by feature | the still check by feature and third | done |
| environment across cuts | 1, 2, 11, 12, 6 (interview room) | the plate, then the latest still of the place | image 1 = plate or previous still; "same room" | SSIM gate | done for static; the moving case needs the "look only" branch |
| the line (180°) | 1, 2, 11; one-person cases: subject ↔ camera; no-people cases: none | scene line: between two subjects, or a subject and the camera, or none | thirds explicit per still | the still check by third | partial: the line assumes two characters |
| time of day and light | 1, 2, 4, 11, 12 | scene time (optional for interiors and screens); a style reference per film | medium sentence + time in the heading | none | partial: time is required even where meaningless |
| no invented business | 1, 6, 10 (factual); 2, 3, 11 (the story IS the invention) | rule: the script adds no events to the story; the story stage is where business is written | none | none | done; the wording ("no handshakes") is Vanderbilt-specific and should be general |

## C. Audit of the current shooting-script prompt, clause by clause

| clause (as sent for vanderbilt5) | verdict | why | change |
|---|---|---|---|
| "for a 30-second live-action film" | too restrictive | the medium is a property of the story (animated, documentary, phone-shot); the deliverable kind changes the cutting rule and the overlays | inject the FILM header: kind, medium, aspect, seconds, cutting rule |
| "Code paints the first and the last frame of every shot ... and makes the clip between them" | fits, with a gap | true for live shots; false for inserts, screens, one-pass B-roll | "for every live shot"; the shot kind decides the renderer |
| Elements: characters, props, places, fixtures | fits, incomplete | no screens, no archival items, no product-as-hero, no audio track | add element kinds: screen, item (an image shown as-is), track |
| SCENES: one place, one stretch of time | fits | continuity unit | keep |
| time: DAY / NIGHT / DAWN / DUSK, required | too restrictive | meaningless for interiors without windows, screens, studios | optional ("" allowed) |
| captions: title, date, source note; never dialogue | too restrictive | ads need CTAs and end cards; shorts need subtitles; docs need lower thirds; explainers need labels | overlays with kinds; subtitles made by code from lines, never written by the model |
| line: between two characters; camera_side | ambiguous for one or zero people | a vlogger's line is subject ↔ camera; a walkthrough has none | between: two subjects, or "subject and camera", or "none" |
| blocking for every character and prop | fits | the running world state | keep; add screens' initial `shows` |
| SHOTS: "one continuous take from one camera" | fits, incomplete | one camera, yes; but no motion and no end position | add motion {kind, path} and camera_last; static means camera_last = camera_first |
| seconds on the grid; contiguous | fits | the grid must come from the chosen model's table | keep; grid per model from the Magic Hour table |
| "a new shot only where the content turns ... size or 30°" | too restrictive for 3, 4, 8, 9 | music and trailers cut on beats; vlogs jump-cut on purpose | cutting rule from the FILM header; keep the 30° rule only for narrative coverage |
| lines at 2.5 words a second; actions 2 s | fits | timing sanity; models speak a little slower | keep; add a second of air per shot as a note |
| camera: stands, height, looks_at, behind, same_as | fits | a shot-list row (size, angle, placement, subject) | add motion; lens optional (wide / normal / long) for push-ins and selfie distortion |
| frames for EVERY element, in or off frame | fits | the running state; the single most useful rule for continuity | keep; add SCREEN frames (`shows`) |
| painter's words: screen and body terms, never metres | fits | the consumer is an image model; the Nano Banana guide says narrative, concrete, composition terms | keep |
| continuity: copy word for word; third and depth only with the camera | fits | made the continuity notes empty | keep; with motion, "or because the camera moved" |
| action, lines, sfx, changes with film seconds | fits, incomplete | no VO, no overlays per shot, no beat markers | add vo [{at, text}], overlays [{at, kind, text}], beats for 8 and 9 |
| "no handshakes or gestures the story does not mention" | fits in spirit, specific in wording | written for Vanderbilt | "no business the story does not contain" |
| "each place keeps its declared fixtures" | fits | fixtures are the vocabulary for camera and facing | keep |

Ambiguities the v2 run surfaced and how they were closed: camera in metres and compass points (closed by the painter's-words
rule); a person's distance changing because someone else moved (closed in the template: "stays exactly as in image 1");
"mid depth" in a shot taken "a room's width away" (open, harmless: the framing words win).

## D. The scheme to build (gist)

**Shooting script v3, one call, media-agnostic.** The prompt is: FILM header (kind, medium, aspect, seconds, cutting rule,
hook) → elements (characters, props, places with fixtures, screens, items, tracks) → SCENE rules (place, time optional,
line optional, blocking, tone, ambience, music) → SHOT rules (kind: live / to-camera / insert / screen / broll; size;
camera_first; motion; camera_last; moment; first and last frames for every element, each person with a `doing` line; beats:
action, lines, vo, sfx, overlays; changes) → the continuity and vocabulary rules → the story. The interpretive layer
(`tone`, `moment`, `doing`) is already built (2026-10-30, run vanderbilt6): it is what gives a keyframe its feel without
pasting events into it; see `V1/docs/approach-shots/PRD.md` §1b. Checks in code: timing on the model's grid; every element in every frame; thirds
move only with an action or a camera move; static shots have camera_last = camera_first; the line never crossed; beats inside
their shots; overlays inside safe margins on 9:16; a hook in shot 1 when the header asks for one; no undeclared fixtures.

**Still prompts, one template per branch, chosen by code from the data.** Common chunks: FRAME (heading, size, camera,
one line per subject) · REFERENCES mapped to details (the room from image 1; each person from a portrait; a product from its
reference; the look from a style reference) · RULES (count, medium, no text). Branches: from-plate (first still in a place) ·
edit (same camera: CHANGES list) · reframe (new camera, same instant) · advance (the camera moved within the shot: same place
a moment later; image 1 is the look only) · to-camera (subject near, facing the lens) · insert (no painting: the item itself,
moved by ffmpeg) · screen (no painting: composed by ffmpeg). Two writing styles to test on the same frames: sectioned list
(KF1) and narrative prose (the Nano Banana guide's preference), with references first (Google's formula) or details first
(KF2).

**Clip prompts.** FRAMES (pinned start and end, or start only) · CAMERA (the motion in the video model's own words, phrased
positively: "the camera holds static", "the camera tracks left with him") · BEATS (timed action; lines as `Name says, "..."`;
`SFX:`) · PEOPLE (count) · SOUND (`Ambient:`, music or none, no subtitles). Durations from the model's grid.

**Renderers (code, by shot kind).** pinned clip (image-to-video, start and end) · one-pass clip (text-to-video with @references,
for B-roll with no people) · Ken Burns (ffmpeg zoompan over an item) · composite (ffmpeg overlay for screens and face-cams) ·
overlays (caption cards by kind: title, caption, subtitle, lower-third, label, CTA, end-card) · VO (TTS, mixed under the film)
· music bed (generated or supplied; beat grid for cases 8 and 9).

**What to test first, in order.** (1) KF1 vs KF2 on the Vanderbilt stills (framing and order; 800 credits each). (2) Camera
motion: a walk-and-talk story through two places, the `advance` branch, the motion vocabulary (does the end still land on the
right view; does the clip move the camera). (3) To-camera: a 15-second vertical UGC ad with subtitles and a CTA (hook, safe
margins, the selfie branch). (4) Inserts and VO: a 30-second documentary beat with an archival photograph and narration.
Screens and music videos after those.

## E. Sources

- Google Cloud, "Ultimate prompting guide for Veo 3.1": prompt formula, dialogue in quotes, `SFX:` and `Ambient noise:` labels, camera vocabulary, first-and-last-frame and ingredients guidance, timestamp prompting, 4/6/8 s clips — https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-veo-3-1
- Google Cloud, "Ultimate prompting guide for Nano Banana": narrative prompts, edit mindset (what changes, what stays), reference formula, camera and lighting terms, positive phrasing, 14 reference images — https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-nano-banana
- Magic Hour API, image-to-video: per-model durations, resolutions, audio, end-frame support — https://docs.magichour.ai/api-reference/video-projects/image-to-video.md
- Magic Hour API, text-to-video: references (1–10, @name), aspect ratios, per-model limits — https://docs.magichour.ai/api-reference/video-projects/text-to-video.md
- MovieAgent (arXiv 2503.07314): director → scene → shot hierarchy; shot fields (characters, plot, camera movement, shot type, subtitles); character bank; failure modes — https://arxiv.org/html/2503.07314v1
- FilmAgent (arXiv 2501.12909) and the VideoDirectorGPT / Anim-Director line: LLM planning of scenes with entity layouts — https://ar5iv.labs.arxiv.org/html/2501.12909
- Runway Gen-4 prompting (third-party summaries of the help article): camera terms, positive phrasing, short prompts, subject/camera/scene motion order — https://www.atlabs.ai/blog/how-to-prompt-with-runway-gen-4-image-to-video-a-comprehensive-guide , https://runware.ai/docs/models/runway-gen-4-5/guides/directing-motion
- Kling start/end frames and camera wording — https://www.rundiffusion.com/introducing-kling-o1-start-end-frame-precision-control-for-video-sequences , https://help.scenario.com/articles/kling-video-models-the-essentials
- Wan 2.5 prompting: describe how the image's elements move; camera presets — https://www.veed.io/learn/wan-2-5-prompting-guide , https://higgsfield.ai/blog/WAN-AI-Camera-Control-Your-Guide-to-Cinematic-Motion
- Shot list fields — https://www.studiobinder.com/blog/shot-list-template/ , https://ltx.studio/glossary/film-shot-list
- Coverage, the 180° and 30° rules, inserts vs cutaways — https://www.shootfirst.art/the-triangle-system , https://cloud.wikis.utexas.edu/wiki/spaces/rtf318/pages/80023274 , https://howtofilmschool.com/dictionary/180-degree-rule/
- Script supervisor continuity (eyelines, crossing the line, props) — https://nofilmschool.com/what-does-script-supervisor-do , https://cloud.wikis.utexas.edu/wiki/spaces/rtf318/pages/80022254
- Documentary conventions: lower thirds, B-roll, Ken Burns — https://soundstripe.com/blogs/a-documentarians-guide-to-lower-thirds , https://www.premiumbeat.com/blog/12-video-editing-tips-cutting-documentary/ , https://www.masterclass.com/articles/how-to-use-the-ken-burns-effect-in-a-documentary
- Streamer layouts: face-cam size and placement — https://wildandfreetools.com/blog/pip-video-gaming-streaming-free/ , https://docs.elgato.com/obs/overlays/stream-overlays
- UGC and short-form: hook, captions, safe margins, lengths — https://www.lemonlight.com/blog/ugc-videos-the-best-practices-for-filming-user%E2%80%91generated-content/ , https://www.capcut.com/create/short-form-video-hooks , https://www.capcut.com/create/short-form-video-distribution-across-platforms
- Music video cutting on beats (study) — https://arxiv.org/pdf/2108.00970
- Google Flow: ingredients, frames to video, extend — https://labs.google/fx/en-gb/tools/flow/faq , https://blog.google/technology/ai/flow-video-tips/
