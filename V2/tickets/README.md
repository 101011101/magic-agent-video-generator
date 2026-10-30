# tickets — the to-do list

One Markdown file per ticket, `T-<number>-<slug>.md`. The open tickets are the to-do list; there is no other.

Fields, in this order:

```
# T-001 · <title>
status:     open | in progress | done | dropped
priority:   high | medium | low
subsystem:  story | assets | screenplay | state | keyframes | sound | edit | lib | results
what:       what to build or change, concretely
why:        the failure or decision it comes from, with the run that showed it
acceptance: how we will know it is done; a measurement where one exists
```

Rules: a ticket names the structure that changes (a schema field, a rule, a template, a query, a gate), never a prompt to
edit by hand. A ticket that costs credits says how many. When a ticket closes, note the run that proved it and update
`../prd/09-status.md`.
