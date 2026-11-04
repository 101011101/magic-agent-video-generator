# T-056 · Layered designs: logos and posters as separate parts, cut-outs that keep every mark

status:     open (drafted 2026-11-01)
priority:   medium
subsystem:  tools, agent

why:
The Mooncrumb logo (A06c) lost its name because Magic Hour's background remover keeps the main object and drops thin
lettering. It's fixed for flat designs by keying out the plain ground in code (filter, look: transparent, with edge
un-mixing). Two cases are not covered:
- a design on a textured or photographic ground, where a colour key fails;
- a user who wants the mark and the lettering as separate pieces (to move, recolour or reuse the crescent alone).

what:
1. **Union cut-out:** for a lettered design on a non-plain ground, take the remover's mask OR an ink mask (pixels far from the
   local ground, from a blurred copy), so lettering the remover dropped is kept.
2. **Layers:** a design is planned as parts:
   - the mark (image, plain ground, keyed by code);
   - the wordmark: exact text by code in a chosen font and colour, or qwen lettering keyed by code;
   - a compose node that places them.

   Output: the parts as separate transparent PNGs, plus the composed logo. The parts are elements in the state store
   (T-052), so a later "make the moon bigger" changes one part.
3. **The check:** the step check's "kept vs ink" measure (T-049) flags any cut-out that loses marks.

prd changes:
- `prd/11-agent.md`, "Text, and what the planner knows about tools": transparency routes (code key, union cut-out,
  remover for photos); layered designs as a tree shape.

code changes:
- `tools/filter.js`: the union mode;
- `tools/compose.js`: place parts by position;
- `agent/plan.js`: the layered-design pattern when the user asks for parts or a logo kit.

test set changes:
- bench v1: A06c stays; add "logo with the mark and the name as separate files" and "transparent logo from a photo of a
  printed logo".
