# T-037 · The persistent loop: fill-or-ask at every step, and the creative-liberty toggle

status:     dry prototype 2026-10-31 (`src/agent/`: the sheet with `liberty`, assumed values marked); the loop between a run's stages is design
priority:   high
subsystem:  agent

what:
1. **Fill-or-ask as one function**, `src/agent/sheet.js`: for every field the next step needs: filled (stated,
   session)? else can it be made up (a default in the tree, an inference above the threshold, the material implies
   it, or liberty is on) → fill and mark `inferred` or `assumed`; else ask. Called between messages (today) and
   between a run's stages (to build: `pipeline.mjs` calls it before story, assets, screenplay, keyframes, clips, film
   with that stage's needs, and stops with questions the way `--until` stops).
2. **The creative-liberty toggle**: `liberty: true` on the session; the sheet fills every open field with its default
   or best guess, marks it `assumed`, asks nothing; the assumed values are shown in the understood line and the
   sheet view, editable. It never bypasses the cost confirmation (`11-agent.md`).
3. **The understood line**: every agent bubble opens with what it took from the message: stated values plainly,
   inferred ones marked, assumed ones marked, so the user sees what was made up before anything runs.
4. **Per-stage needs**: each stage of the film chain declares the fields it needs (story: kind, direction, audience,
   message; assets: materials for every `user`-sourced element; screenplay: platform, length; keyframes: none new;
   clips: tier) so the loop asks at the stage where the answer matters, not all at the start.

why:
The user's design of 2026-10-31: the chat bot is persistent in all the steps; it constantly checks whether something
is filled and whether it can make it up or should ask; a toggle for AI creative liberty assumes full liberty and does
not check.

acceptance:
The bench cases `ex-free-rein` and `tool-wrong-verb` pass with liberty off (no creative questions where free rein is
stated); every extraction case passes with liberty on with zero questions and every open field marked assumed; a film
run with liberty off stops before assets to ask for a `user`-sourced element's picture and nowhere else.
