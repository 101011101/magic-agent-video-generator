# Tickets

One ticket per file: `<category>/<ID>-<slug>.md`. IDs are stable; never renumber.

**Categories**
| dir | holds |
|---|---|
| `01-prd/` | PRD elements not yet designed or written down |
| `02-state-manager/` | state manager: build gaps, design errors, tool selection |
| `03-tests/` | sub-case tests to run (from `../tests/subcases/MATRIX.md`) |
| `04-bug-hunting/` | hunts to perform — find bugs, not fix them |
| `05-bug-fixes/` | confirmed defects awaiting a fix |
| `06-runs/` | paid runs, each with its credit estimate and approval state |
| `07-cost/` | spend reduction work |

**Ticket format** — every ticket has all of these, no exceptions:

```markdown
# <ID> — <title>
**Status:** open | in-progress | blocked | done
**Category:** <dir>
**Cost:** <credits, or 0>
**Approval:** not-required | required-not-given | approved
**Blocked by:** <IDs, or none>

## Problem
What is wrong or missing, with file:line or a cited record. No speculation.

## Evidence
The data that proves it. If there is none, say so — that makes it a hunt, not a fix.

## Done when
A check someone else can run and get the same answer.
```

**Rules**
- A ticket with no evidence is a `04-bug-hunting` ticket, never an `05-bug-fixes` one.
- A ticket that spends credits states the figure and carries `Approval:`.
- Never mark done without the `Done when` check actually run.
