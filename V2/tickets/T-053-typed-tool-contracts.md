# T-053 · Typed tool contracts: what each tool takes, guarantees and honours, enforced at plan time and at run time

status:     open (drafted 2026-11-01)
priority:   high
subsystem:  agent, tools, executor, catalogue

why:
Most failures we own came from a tool silently not doing something the plan asked:
- voice ignored `seconds` (C17a, 5 s instead of 8);
- face swap ignored "only the woman on the right" because the adapter hard-coded all faces (C14b);
- assemble ignores dissolves and per-piece timing;
- text-overlay ignored colour and box until T-049.

The planner writes free text in `params.extra`. Only some tools read it, and nothing says which. The catalogue describes
tools in prose (well / poorly / cannot), so limits such as "exact lettering up to about 40 characters" live in sentences,
not in anything code can check.

what:
1. **A contract per tool** in code (`backend/tools/contracts.js`):
   - `takes`: typed inputs (picture, clip, sound, text, face picture…, with counts);
   - `makes`: the output kind;
   - `params`: the settings it honours, each with a type and range;
   - `guarantees`: properties of the output, e.g. `length = params.seconds`, `background: exact | approximate | regenerated`, `lettering: exact up to N chars per line`, `alpha: yes`, `elements: kept | changed(attr)`;
   - `limits`: what it cannot do.
2. **The planner fills only contract params**: a structured params object per tool from the contract, not free `extra`.
   A setting with no slot is refused at plan time, with the reason, instead of being written and ignored.
3. **The adapter consumes every param it declares.** A unit test per tool feeds each param and checks the output (or the
   API body) changed accordingly. An adapter that ignores a declared param fails the test.
4. **Pre-flight uses the contracts** instead of its hand-written rules (preflight.js `predict` becomes contract-driven).

prd changes:
- `prd/11-agent.md`, "The tools, in groups" and "Text, and what the planner knows about tools": tools as contracts; the
  planner fills typed params; no free-text settings.
- `prd/13-worktree.md`: a node's params are typed by its tool's contract and shown as such in the tree.

code changes:
- new `backend/tools/contracts.js`;
- `agent/catalogue.js` generates the planner's tool text from the contracts;
- `agent/plan.js`: the STEP schema per tool from contracts;
- `agent/execute.js`: each adapter reads typed params; the generic endpoint table moves into the contracts;
- tools: voice (seconds: done), assemble (per-piece seconds, transition: cut|dissolve, fit, voice-over mix),
  text-overlay (several cards with times; colour, font, align, box: done), face-swap (mappings: done), captions (style).

test set changes:
- new `tests/tools/contract.test.mjs`: every declared param changes the output; every guarantee holds on fixtures;
- bench v1: tag failures "param-ignored" when a step's measured facts contradict a declared param (from T-049's step check).

done when: no tool accepts a setting it doesn't apply, and the bench shows zero "param-ignored" flags.
