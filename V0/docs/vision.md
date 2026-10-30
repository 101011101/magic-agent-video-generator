# Magic Agent Vision: Type-Proof Architecture

Inspiration: Lean. A request is a goal. The system proves the goal or keeps it open.

- Position: this system is the engine behind the Magic Hour MCP. A general agent (Codex or Magic Hour chat) calls it through the MCP.
- This is a ground-up rebuild. The LLM role changes, so the current agent loop cannot be adapted.

## Problem with the current repo

- An LLM writes the plan. A deterministic check then validates only the content.
- Errors leak from the LLM context into the plan. The checks catch them late or never.
- A regex router decides intent. It matches words, not meaning.

## Core model

- Everything is a type. The goal is a type.
- A type is a record of typed parameters.
  - Closed parameter: a value set. Example: `gender` (includes LGBTQ+ values).
  - Open parameter: any value. Example: `location`.
- The only question for a goal: is it satisfied? A goal is satisfied only when it is proven satisfied. Until then, it remains a goal.
- A tool is a proof. Its signature proves that its input types produce its output type.
- A split tool proves equivalence. It breaks a type into equivalent pieces. A matching join tool (example: stitch) assembles the pieces back into the type.
- An original input (upload, prompt text) is also a type. It has properties. It must be transformed to connect to the chain.
- Hard passes are part of the type. When all types connect, all hard passes hold.
- A property can be held constant through a transform.
- A property can be mutated by a transform. The type keeps the original value.

## Field types

- **Rigid:** the user requested it. The system must not change it.
- **Fluid:** the user did not specify it. The AI can set it within reason.
- **Unconstrained:** no rule fixes the value.
  - An LLM fills the value. Its inputs are the context slug and the tool definition.
  - Or the system asks the user in natural language.
- An original (absolute) input must always connect to the chain.

## Search

1. Try the highest level first. If a tool or theorem accepts the full goal type, apply it.
2. If none accepts it, split the goal type into sub-types. Each sub-type becomes a sub-goal.
3. Recurse on each sub-goal with step 1.
4. Recursion stops at one of two leaves:
   - an original input, or
   - an unconstrained field (filled by the LLM or the user).
5. Save each solved structural path as a theorem. A later goal of the same type invokes the theorem.
6. After the chain is complete, make the tool calls.

- A full context is rarely accepted whole. The first tool is usually the split.
- A pipeline for a large context is a theorem. It takes the type and passes it down to its sub-components.
- The LLM reads context and fills values. It does not run the pipeline.

## Split

- An LLM performs the split. It reads the user context.
- The split gives each piece:
  - the necessary context,
  - its dependencies. Examples: a previous scene, a starting frame, an environment matrix description.
- If context is missing, the split asks the user or does research based on the context.

## Context

- Context is a type.
- Context holds everything the model ingests that no standard type catches, plus creative elements.
- Context is kept as complete as possible.
- Context passes down to sub-types and splits into pieces with dependencies. Example: performance indicators, rubrics and tasks are assembled coherently, then broken into pieces.
- Context has an ID. A component unfolds its parameters and uses the context ID. Example: `Clip(Video(Person, Scene, context34879453), filter(colour_matrix(RGB), crop(9:16)))`.
- Types stack. A component unfolds any of its parameters.
- Exact wording can be a type that a tool accepts.
- Abstraction rule:
  - A property that needs a standard behavior becomes a structured type. Example: hair colour becomes a character feature.
  - A creative element stays context. An LLM orchestrates it. Example: action phrases.

## Identity propagation

- Identity is a parameter. It passes along the full chain.
- If a middle step damages identity, a later tool that accepts the identity parameter corrects it.

## Tool specs

- A tool spec states its input types and its output type.
- A tool spec states which properties the tool maintains.
- Most tools are straightforward.
- Magic Hour tools are assumed to meet a high standard.
- Tool failures are tracked retrospectively, per tool.

## Selection

- Two theorems cannot match a goal exactly.
- When more than one candidate fits, the system selects by dimensions such as accuracy and cost.
- The context and the position of the tool in the chain set the weights. A crucial position weights accuracy higher.

## Verification

- The final product keeps its parts. The solved term is the trace.
- At the end, the system verifies the final product against the requested type and its hard passes.
- The sweep is deterministic or uses a VLM.
- On failure, the system traces backward through the chain to the tool that failed.
- Per-step check: each tool compares its input type and its output type.

## MVP scope

- MVP first. Add the checker later, for production.
- Ontology cost is acceptable. A Magic Hour repo holds the full tool definitions.

## Open gaps

- Which Magic Hour repo is the ontology source?
- Which fields are rigid by default when the user does not mention them?
- Which tools and request types are in the MVP?
- Which SLM resolves context meaning?
- Selection method: "JEV" is not defined yet. Candidate reading: expected value (success probability × criticality − cost).
- Ask or research: does the split LLM decide, or does a fixed rule per parameter decide (example: research facts, ask preferences)?
- Split and join pairs: hand-written per type (`Video`, `Clip`, `Narration`), or LLM-generated with a required matching join?
- Goal parse: does the calling agent send the typed goal through the MCP input schema, or does this system parse raw text?
- Proposals not yet confirmed:
  - Hard passes split with context: duration divides across pieces, aspect copies to each piece, identity copies to pieces where the entity appears.
  - Theorems store parameters, not concrete values, so they match later goals.
  - A hole-fill LLM call gets only the context projection its type needs, not the full context.
  - Criticality computed from the chain: number of dependent nodes and number of rigid properties maintained.
  - Two primitive classes: deterministic tools (crop, filter; exact, free) and generative tools (Magic Hour; probabilistic, paid).
