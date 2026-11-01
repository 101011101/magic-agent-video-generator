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

## Three panels (revised 2026-10-31, supersedes "Three things on the screen")

The words and the tools are separated. The screen is three panels:

1. **Left: the conversation.** Only bubbles: the user's requests, the agent's sentences, its questions, the hidden
   details line. No tool block ever appears here. The composer and the mode indicator sit at the bottom.
2. **Middle, top: the canvas.** The working tree, drawn as nodes with connection points, one cluster per request (a
   single job is a one-node cluster). The tree shows only the main ideas: the shape, the tool of each node, its state
   as a border, its output as a thumbnail once made. It is how the user navigates and controls the focus of the
   context: clicking a node focuses it below. Outputs can be pointed into other nodes or other trees by dragging
   from a node's output port to another node's input port; a material from the directory drags onto an input port
   the same way. A re-pointed input is an edit of the plan and marks dependents stale.
3. **Middle, bottom: the tool.** The focused node's tool, with the UI that tool needs: the parameter grid, the prompt
   by file name, the inputs and the output, a timestamp picker for a clip tool, a crop frame for a crop, a text box
   and placement for the overlay. When the focused node sits in a column that runs in parallel, the panel shows
   that column with numbered versions to flip through, as the carousel did.
4. **Right: the directory.** The session as a tree: materials, prompts, assets by working tree, bank, runs. Files
   drag from here onto the canvas.

The chat stays the agent's voice; the canvas is the plan; the tool panel is the hands; the directory is the memory.

## The workbench (revised 2026-10-31, later in the day; supersedes "Three panels" where they differ)

The middle panel is a **workbench**: one surface for every working tree, panned and zoomed rather than scrolled.

- **One space.** A dot grid. Every tree spawns onto it as a group: the agent's trees as it proposes them, the user's
  own trees from the plus in the header, and the run views (a story, a screenplay, a keyframe slideshow, a workflow).
  Nothing spawns on top of anything: a new group is measured and placed by a free-space search (left to right, then
  down, with a margin), and a saved spot is kept unless it collides. A tree is dragged as a whole by its title; a
  node is dragged on its own; both positions are saved. The tree the user is in is at full brightness, every other
  tree is dimmed to about forty percent and comes partway back on hover.
- **Pan and zoom.** Drag the empty space or scroll to pan; pinch or ctrl-scroll to zoom about the cursor, from a
  quarter to triple size; a small readout in the corner with minus, plus and fit-all. The grid moves and scales with
  the view. Moving, wiring and placing all account for the zoom. The view is remembered. No scrollbars anywhere.
- **The tree shows only the main ideas.** A node is its tool, its output name, its state as a border (blue proposed,
  amber paused or waiting or stale, red failed, grey skipped) and, once made, a green dot and its picture. Done is
  the dot, not a green border. The details live in the tool panel.
- **Connections.** A port on each side of a node. Drag from an output port onto a node, in the same tree or in any
  other, to make that output the node's input; drop a file from the directory onto a node for the same effect. A
  live dashed line follows the drag. A node that takes from another tree finds the file under that tree's
  directory. Wiring is an edit of the plan: the node's dependents go stale.
- **The tree's controls are universal**: one row in the canvas header, acting on the focused tree: the tree's name
  and estimate, a menu of every tool in the catalogue to add a node, run all, a plus for an empty tree of your own.
  A node has its own actions in the tool panel: run, pause, skip, remake, remove.
- **Parallel calls.** Nodes at the same depth run in parallel. Focusing one shows its column in the tool panel with
  numbered circles to flip between the calls in it, headed "parallelized · N calls".
- **Suggested local assets.** The focused tool lists the assets it could take: this tree's other outputs first, then
  the outputs of trees wired to this one, then the rest of the session and the materials, each a tile named with
  where it came from. A click adds one as an input. A button beside the list asks the agent to choose the inputs; it
  answers in the conversation with which and why.
- **LLM calls are nodes.** `write` (a text by the text model: post copy, a caption, a note) and `check` (a vision
  verdict on a picture, the gate as a node, a failing verdict is a flag and never a remake) sit in the catalogue
  beside the code tools `text-overlay` and `crop`, at zero credits. In a film tree the story and screenplay stages
  were already nodes. The planner's own sheet and plan calls stay outside the tree: they are what proposes it.
- **Focus is context.** Every message carries what the user is looking at. The loop first decides whether the
  message is about that node (a change, a question, "this one"); if so the plan changes that node and the new tree
  lands beside the one it edits, labelled with what it is about; if not, a new tree as usual.
- **The test panel floats**: dragged anywhere by its title, remembered, never part of the product.

## Two layouts: chat first, the workbench on request (revised 2026-10-31; supersedes "Three panels" and "The workbench" for the default view)

The default is the chat. The canvas and tool panel are an expansion the user opens, collapsed until then.

- **Chat only (the default).** The conversation fills the middle, with the directory on the right. Each turn's working tree appears in the chat under the agent's message: its graph (nodes, wires, ports, drag to wire), then its tool blocks, the same editable blocks the tool panel shows. Each block lets the user change the model, size, prompt and inputs, and run, pause, skip, remake or remove that step. Clicking a node opens and highlights its block. Each tree has its own "+ tool" and run controls, and a button in the chat header starts an empty tree.
- **Wide (the workbench).** A button in the chat header opens the canvas and tool panel in the middle. The trees move onto the canvas and the chat goes back to words and one-line summaries, as described under "The workbench".
- The choice is remembered per browser. Switching layouts rebuilds the session in the other one, so the trees, outputs and focus are the same in both.
- On a narrow screen only the chat shows.
