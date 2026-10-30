# SM-100 — Tool selection is not derived from state; models are hardcoded literals
**Status:** in-progress
**Category:** 02-state-manager
**Cost:** 0
**Approval:** not-required
**Blocked by:** none

## Problem
The state manager was designed so that tool choice follows from the state plus each tool's preservation guarantees. In both live pipelines there is no selection step at all. The model is a module-level constant and the endpoint is a one-line ternary on whether any input file exists.

- `V0/prod/pipeline-state-graph/run.mjs:27-28` — `const IMAGE = { model: "nano-banana-pro", resolution: "2k", aspect_ratio: "16:9" }` and `const VIDEO = { model: "wan-3.0", resolution: "720p", audio: true }`
- `V0/prod/pipeline-memory/src/common.js:14-15` — the same two literals
- `V0/prod/pipeline-state-graph/src/jobs.js:64` and `V0/prod/pipeline-memory/src/common.js:91` — `const endpoint = inputs.length ? "/v1/ai-image-editor" : "/v1/ai-image-generator"`

Nothing reads a tool signature, a preserved-property list, or any state field when choosing a tool. The consequence is that no tool can ever be *brought in* to satisfy a property the state is tracking — which is why `/v1/face-detection` is absent (see SM-104) and why the action-positioned video models were never considered despite action adherence being the dominant failure class.

## Evidence
`grep -rn "signatures\|solver\|atomize" V0/prod/pipeline-state-graph V0/prod/pipeline-memory` returns no import of the selection machinery. The only state-manager modules the live pipelines import are plumbing: `paths.js`, `llm.js`, `magichour.js`, `continuity.js`. Four Magic Hour generation endpoints are reachable in all of `V0/prod`; 26 of 30 are not (SM-103).

## Done when
A tool is chosen by a function whose inputs include the wanted state and the candidate tools' preservation guarantees, and changing a tracked property changes the tool chosen. A test shows two different states selecting two different tools for the same step.
