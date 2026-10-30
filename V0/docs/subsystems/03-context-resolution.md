# Subsystem 3: Context Resolution (Inferred vs. Missing)

> Status: problem statement only. Design is not started. Parent: [vision.md](../vision.md)
> Depends on: [01-types.md](01-types.md)

**Problem:**
- A request rarely carries every parameter a tool needs.
- The system must know when a parameter is absent, and what to do about it.
- There are two sub-cases:
  - **Inferred context:** the system can supply the value. Example: the user says "reel", so the implied length is under one minute.
  - **Missing context:** only the user can supply the value. Example: a specific real person must be in frame, and the system has no photo of that person.
- The system needs an atomic level for context, so it can decide per unit whether that unit is present, inferable or missing.

**Decided in chat:**
- Inference is a question to an LLM. Example: "Do you know how long this video should be?"
- The LLM returns a value or "no".
- A "no" means the context is missing.
- Contradictions are not handled here. The creative director exposes them. See [02-creative-director.md](02-creative-director.md).

**Questions to answer:**
- What is the atomic unit of context?
- How does the system detect that a parameter is absent?
- What signal invokes the inference call (check existing context, or spawn a research agent)?
- What signal invokes the missing-context tool (talk to the user)?
- When does resolution run: before solving, during solving, or at the very end?

**Observed in tests** ([tests/creative-director/](../../tests/creative-director/README.md)):
- Missing context surfaces in the creative director's output. Example: the birthday chunks are blocked until a photo of the father is uploaded.
- A vague request ("make something cool for my insta") gets an invented concept, not a question.

**Idea raised (not decided):**
- Tools try to work with what exists first. A missing parameter draws from existing context. Inference runs at the very end, only for what is still absent.

**Inputs:** user request, uploads, existing context, tool specs.

**Outputs:** filled parameters, research results, or questions to the user.
