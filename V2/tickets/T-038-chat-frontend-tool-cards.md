# T-038 · The chat frontend: bubbles, tool cards with editable parameters, propose-then-run

status:     dry prototype 2026-10-31 (`src/agent/server.mjs`, `ui/index.html`); running a tool is design
priority:   high
subsystem:  agent, frontend (new)

what:
A local web app over the agent (`12-frontend.md`):

1. **Server**, `src/agent/server.mjs`, no dependencies: `POST /turn` (messages, materials, liberty, tier → the sheet
   and either questions or the plan), `GET/POST /session/:id`, `GET /models` (the registry by kind and tier),
   `GET /run/:label` (story, screenplay, stills, clips of a run folder), `POST /run/:label/comment` and `/flag`,
   static `ui/` and the run media.
2. **The page**, `ui/index.html`, one file: the chat (user right, agent left), the understood line, the questions
   with a reply box, the tool cards (header, inputs, the parameter controls with the registry's models filtered by
   kind and tier, seconds on the grid, aspect, the editable prompt line, the cost updated live), the card states
   (proposed · running · paused · done · flagged · skipped) and their actions, the creative-liberty toggle, the tier
   picker.
3. **Run**: dry today (Run records the approval and the final parameters in the session and shows what would be
   called); to build: the card posts to `/run-step`, which calls the tool through `lib/jobs.js` and streams the
   state back; Pause before the POST holds it; after the POST the job id is shown and polled.
4. **Direct control**: a parameter changed by hand is written to the plan step; the agent does not re-plan; a
   changed model shows the tier move and the new cost on the card.

why:
The user's design of 2026-10-31: the tool calls are shown in chat with a UI wrapper so the user can pause and alter
them; the agent gives suggestions and runs when there is no objection; parameters are exposed as dropdowns that
natural language fills.

acceptance:
Every bench case can be walked through the page: the same questions and the same plan as the dry runner, the cards
editable, the session saved; then one paid small job (an image edit on the free tier, 5 credits) run from a card end
to end with its output inline.
