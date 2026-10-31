# 12. The frontend: a chat that shows its work, with finer control where the user wants it

Written 2026-10-31 from the user's description of that day. Nothing in this file is built except the dry prototype
noted at the end. It depends on `11-agent.md` (the loop it renders) and serves every tool the same way, the film chain
included.

## The idea

It looks like a chat. The agent is present at every step, from the first message to the last clip. As it works, what
it is about to do appears in the chat as a card with the tool, its inputs and its parameters, already filled from the
conversation; the user can let it run, pause it, change a parameter, or say no. The agent proposes; the user's silence
is consent; an objection stops the card before it is paid. Verification is a request like any other, rendered in the
form that suits the thing: a slideshow for keyframes, blocks per scene for a screenplay, a formatted page for a story.

## The three kinds of message

1. **Talk.** Bubbles: the user's on the right, the agent's on the left. The agent's bubble after every user message
   says what it understood (the sheet's values, with inferred ones marked), then either its questions or what it is
   about to do. Short.
2. **Tool cards.** One per planned step, in the order they will run, inside the agent's turn:
   - the header: the group and the tool, in words ("change content · image edit"), the endpoint small;
   - the inputs: the assets it takes, as thumbnails with their labels, and the one it will make;
   - the parameters, each a control the user can change: model (a dropdown filtered by the tier and what the tool
     needs), resolution, seconds (on the model's grid), aspect, the prompt or change as an editable line, and
     anything the endpoint needs (a language, a range);
   - the cost, from the registry, updated as controls change;
   - the state and its actions: **proposed** (Run · Pause · Skip), **running** (Pause), **paused** (Resume · Edit),
     **done** (the output inline, Retry · Change), **flagged** (the gate's finding, Retry · Accept), **skipped**.
   Natural language fills the controls; the controls stay editable; a change is written back to the plan and the
   session so the next message sees it.
3. **Views.** Larger renderings the agent sends when it asks for verification or when the user asks to see something:
   - **story**: the title, the style line, the prose; in nonfiction every paragraph with its sources;
   - **screenplay**: one block per scene (place, time, synopsis, tone), its shots as rows (seconds, size, moment,
     lines); every block and row takes a comment; a comment is a message to the agent tied to that scene or shot;
   - **keyframes**: a slideshow in the chat, one still per slide with its scene and shot, the gate's verdict, the
     attempts as thumbnails; a still can be marked "looks wrong" with a note, which is a message to the agent tied to
     that still;
   - **clips** and **the film**: the same slideshow with the video playing, the transcription under it;
   - **the sheet**: the universal questions and their answers as a compact table, editable.

## The creative-liberty toggle

A switch in the header. Off (default): the loop asks when a field is not answered with confidence. On: the agent
assumes full creative liberty, fills every open field with its default or its best guess, marks each as **assumed**
in the sheet, and does not ask; the assumed values are still shown so the user can change them after. The toggle is
per session and can be flipped mid-conversation; it never affects the cost confirmation, which is a separate rule.

## What the agent is doing, always

Between messages the loop runs the same check: for every field the current step needs, is it filled? If not, can it
be made up (a default exists, or liberty is on, or the material implies it), or must it be asked? The chat shows the
answer as the understood-line in the agent's bubble, so the user always knows what is assumed and what was asked.

## Flows

**A small job.** User: "put my logo on this mug photo" with two files. Agent bubble: understood (image, the mug,
the logo, square). One tool card: change content · image edit, inputs mug.jpg + logo.png, model flux-2-klein, 640px,
change "the logo on the mug", 5 credits, proposed. The user does nothing; it runs; the card shows the output. User:
"make it bigger". A new card: change form · upscale image, input the output, proposed.

**A film.** User: a brief. Agent: understood plus two questions. User answers. Agent: the sheet, then one card:
compose · film, with its parameters (tier, length, aspect, kind), proposed with the estimate. Run. The chain's stages
appear as cards as they start: story (a view), assets (the bank as thumbnails with provenance; a Commons pick the user
can swap), screenplay (the scene blocks), keyframes (the slideshow with the gates' verdicts; the user flags s7-2 with
"the jets face each other"), clips, the film. A flag pauses the chain at that still; the agent proposes a retry card;
the user runs it.

**Verification on request.** User: "show me the keyframes". Agent: the slideshow view for the current run. Clicking a
still opens its attempts and the prompt that made it, with the images it was sent.

**Direct control.** The user opens a tool card's model dropdown and picks nano-banana-pro; the cost updates and the
card says the tier moved for this step; the agent does not re-plan.

## Surfaces

A local web app first: a small HTTP server in `backend/agent/server.mjs` with routes for a turn, a session, a run's
views, the registry, and the run media; one page in `frontend/index.html` with no build step. Later the same routes behind
the chat workspace in `archived/frontend`.

## Look

Apple-like: the system font, a near-white ground, soft grey cards with 12 to 16 px radii, one blue accent, a frosted
header, bubbles like Messages (blue right, grey left), controls like native menus, no borders where a background will
do, generous whitespace, a dark mode that keeps the same shapes.

## Built

The dry prototype of 2026-10-31: the chat, the understood line, the questions, the tool cards with editable
parameters and the registry's models, the creative-liberty toggle, and the three views (story, screenplay with
comments, keyframe slideshow with flags) over an existing run. No tool is called; Run records the approval in the
session. Tickets T-037 to T-039.

## Hard rule: fewer words (added 2026-10-31, revised the same day)

Anything that can be an indicator is an indicator, and anything that can be hidden is hidden:

- **State is a border and an icon, never a label.** The whole block is outlined in the state's colour: blue proposed,
  amber paused, green done with a check, red flagged, grey skipped. Corners are squircles, not plain rounds. No pill,
  no "approved" line in the chat.
- **Icons, never emoji.** Every action and marker is a line icon drawn by the page (run, pause, skip, retry, accept,
  comment, flag, attach, prompt). Emoji look fake and render differently everywhere.
- **Inputs and outputs are pictures.** A material is its thumbnail; an output is its thumbnail once it exists and a
  dashed tile with its name until then. Names appear under the tile in small type.
- **Prompts are files, shown by name.** Every prompt the agent assembles is saved into the session's working memory
  as a text file and the block shows the name; a click opens it. The chat never prints a prompt.
- **Details are hidden.** One small grey affordance under the agent's bubble opens the sheet's values; closed by
  default. Only the agent's words, its questions and the next action are visible.
- **Parameters are a grid, not a stack.** Each parameter is a label-value cell in a wrapping grid; the value is an
  inline control. No block is taller than its parameters need.
- **Modes live by the composer.** The ask / auto / plan indicator sits next to the message box, where the hands are,
  and cycles with shift-tab, like a terminal's edit and auto modes. The cost confirmation applies in every mode.

## Three things on the screen, and who owns what

1. **The agent's words**, in a bubble. Every agent turn opens with one or two sentences in plain words saying what it
   understood and what it is about to do, or what it needs first. The bubble is the agent's voice and nothing else
   goes in it: no parameters, no prompts, no outputs.
2. **Tool blocks**, rectangular, one per step, under the bubble. A block is the tool: its inputs as tiles, its
   parameters as a grid, its prompt by file name, its cost, its actions, and, when it has run, **its output inside the
   same block**, because the block owns what it made. A block is also the way to talk to the agent about that step: a
   one-line note field on every block ("put the logo lower", "use the other photo") sends a message tied to the step,
   and the agent answers with a revised block.
3. **The tree**, a sidebar on the left: the session as a directory with a working tree, `materials/`, `prompts/`,
   `assets/` (every step's output, planned or made, under its turn), `runs/` (the film runs the session started, each
   with its story, screenplay, stills, clips). Folders open; any asset can be dragged onto a tool block's inputs or
   onto the composer to attach it to the next message. The tree is the working memory made visible.

## Working memory for a session

A session is a folder, `sessions/<id>/`, and everything in it is a file a person can open:

```
session.json      the record: messages, turns (sheet, questions, plan with card states), assets, mode, tier, credits
materials/        what the user supplied, by original name; each is the record of the thing it shows
prompts/          every prompt the agent assembled, one text file per call or step, named by turn and step
assets/           what the tools made (when they run), by the name the plan gave them; a parent per asset
notes.json        comments on scenes, flags on stills, with the item they are tied to
```

The chat shows names and thumbnails; the files hold the text. A reference picture and a prompt are the same kind of
thing to the session, a file with a name and a provenance, and the agent's next turn reads the session the way the
state manager reads its tables: it never re-derives from the conversation what the files already say.
