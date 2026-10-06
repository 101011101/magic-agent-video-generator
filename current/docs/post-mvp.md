# Post-MVP Considerations

> Items deferred from the MVP. The MVP assumes tool specs are good enough. Parent: [architecture.md](architecture.md)

**Order and clobbering (from the state model, [05-solver.md](subsystems/05-solver.md)):**
- A later tool can break a condition that an earlier tool made true. Example: an image-to-video tool drifts the face.
- Each tool spec must state which elements it changes, and how confident it is that it maintains the others.
- Priority can set how sensitive the solver is to a condition. A high-priority condition (example: a real person's identity) needs a tool with high confidence.
- The solver must order tools so that later tools do not break high-priority conditions.

**Verification:**
- At planning time, a condition is true because a tool spec says so.
- After execution, a check must verify each condition. Failures trace back to the tool that broke them (see [vision.md](vision.md)).
- Tool failures are tracked per tool and per condition, and feed back into confidence.

**Soft credit (nature field):**
- Soft credit is an LLM judgment from a tool's `nature` text. It can be wrong.
- Failure tracking must confirm or reject each cached soft-credit answer (tool + atom).
- Confirmed answers can become hard credit in the signature.
