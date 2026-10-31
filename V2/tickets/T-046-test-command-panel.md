# T-046 · The floating test command panel: scripts that drive the chat, pause on any click, simulated or real credits

status:     built 2026-10-31 (`ui/scripts.js`, the panel in `ui/index.html`; the real executor `src/agent/execute.js` behind the Run buttons)
priority:   high
subsystem:  frontend, agent, bench

what:
1. **The panel**: floating bottom-left, not part of the product; a script picker, play, pause, one-step, a
   simulated | real switch for credits, a small log. Collapsible.
2. **Scripts** (`ui/scripts.js`): a list of actions (import a material from a run folder, send a message with
   materials, run the current turn, wait). Two today: `micro ×4` (two single jobs, two trees, in one go) and
   `film` (a 10-second ad on the free tier). A turn that asks questions is answered with "your call" in auto mode.
3. **Pause on audit**: any mouse-down on the product outside the panel pauses the script; scrolling does not.
   Play resumes from the next action.
4. **Real credits**: with the switch on `real`, Run and run-all call `src/agent/execute.js`, which walks the plan
   through `lib/jobs.js` (cap, ledger, cache, resumption) and the wired endpoints: image generate and edit,
   image-to-video, text-to-video, music, face swap photo, background remover, image upscaler, auto subtitles; the
   six film nodes hand off to `pipeline.mjs` as one run under `runs/session-<id>-<stamp>` and follow its record.
   Unwired tools make a placeholder and say so on the block. The session's `exec.json` is the job log; the ledger
   books it under `session-<id>`.

why:
The user's request of 2026-10-31: test scripts selectable from a floating command panel, with play and pause, any
interaction with the screen pausing because it means auditing; hook up the paid products and connect the tools.

acceptance:
`micro ×4` on `real` makes four outputs inside their blocks for under 60 credits on the free tier; `film` on `real`
produces a run folder, a results page linked from the film block and the film inside it; a click on a block during
play pauses the script and play resumes it.
