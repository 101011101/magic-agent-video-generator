# The one-reference rule (2026-11-02)

Decided after `01-multi-reference-image-editing.md` and the clip tests of the same day.

1. **Everything is made by video generation.** The image editors on the free tier are not used. Do not bother with them.
2. **A video call takes at most ONE reference.** For every clip after the first, that reference is the last frame of
   the previous clip (image-to-video on ltx-2.5). The video model carries identity and place forward itself.
3. **The first clip may take one reference only if it is CLEAN.** A clean reference is a picture that no free-tier
   image-editing model touched: either a photograph from the web, or a text-to-image result that received no
   reference pictures. Whether free text-to-image models are good enough to produce clean references is the open
   question; `V3/runs/reftest-4` tests it (five subjects, a generic prompt vs a VLM description of a real source).
4. Everything else (several people who must match pictures, an object that must be exact) is either carried by words
   in the video prompt, or is out of scope on the free tier.

Why: with two or more pictures the free editors fail on faces and drift on chaining; with one picture, image-to-video
held the room and the person every time today; the MCP's best clip of the day had its identity carried by the video
model, not by a composed still.

Update, same day: `03-free-text-to-image.md` answered the open question. A free text-to-image picture is allowed as
the first clip's clean reference when it was made from a full description on qwen-image-2.1 (or z-image-turbo for
landscapes) and shows a place, product or designed graphic rather than a specific face.
