# T-033 · Small jobs through conversation: one image, an edit, a swap, captions, an upscale

status:     open
priority:   high
subsystem:  agent (T-034), lib

what:
The simple requests the film chain does not serve, each as one tool the agent layer can call, with the questions it
needs and the cheapest model that can do it.

1. **Tools from the sheet.** Every Magic Hour endpoint in `V2/reference/magic-hour-api-sheet.md` becomes a tool
   definition in `src/lib/tools.js`: name, what it is for in one line, the fields, the models and their plan and cost
   from `src/lib/models.js`, the inputs it needs (an image, a clip, a face, an audio file). First set: image generate,
   image edit, face swap (photo and video), character replace, background remover, upscale (image and video), auto
   subtitles, lip-sync, talking photo, voice generate, music. All calls go through `lib/jobs.js` so the cache, the cap
   and the ledger apply.
2. **Questions per tool.** Each tool lists what it must know and what it may infer: an edit needs the picture and the
   change; a swap needs the source face and the target; captions need the clip and the language. The agent asks only
   for what is missing (T-034), never a form.
3. **Cheapest model that can.** Each tool resolves its model by tier: free first (flux-2-klein, qwen for images;
   ltx-2.5 and minimax-h3 for video); up only when the request needs a resolution or a feature the free model lacks,
   or when the gate fails twice, and then the agent says what it is about to spend.
4. **Show, then edit.** Every result is recorded in the session (T-034) as an asset with its job; the next message
   ("now make the background white") is an edit of that asset, paid once more only for the new job.
5. **Checks.** A vision call against the instruction for images and swaps ("does the output show the requested change
   and nothing else"), the people gate for identity on swaps, duration and track checks for captions and upscales.

why:
The feedback of 2026-10-31: "what if user just wants to face swap/character swap, or generate an ad, or generate an
image." The original server's capability catalogue covered these; V2 dropped them. On the free tier these jobs are 5
to 50 credits each, so they are also where the benchmark can run often.

acceptance:
Five scripted conversations in the benchmark (T-031: `image-one`, `image-edit`, `swap-face`, `captions`, and one
upscale), each resolving in at most two questions, each paid at the free rate, each passing its check; a sixth where
the second message edits the first result and pays only for the edit. About 300 credits for the set.
