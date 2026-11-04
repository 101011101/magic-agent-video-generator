# T-042 · Quantise the text stages so dependencies are drawn at the right grain

status:     dry prototype 2026-10-31 (the tree reads scenes and shots from the screenplay as nodes); the pipeline writing per-quantum records is to build
priority:   high
subsystem:  screenplay, story, state, agent

what:
1. **Screenplay**: one node per scene and one per shot (today: in the tree, from `script.scenes[].shots[]`). To
   build: the screenplay call and its revisions record which scenes and shots changed between versions
   (`script_revisions` becomes a list of diffs by scene and shot), so a revision invalidates only the stills of the
   shots that changed.
2. **Story**: one node, plus one per numbered fact in nonfiction (a fact's source changing invalidates the
   paragraphs that cite it, which the story already marks).
3. **The sheet**: one node per universal field; a changed answer invalidates the stages that read it (platform →
   screenplay and every still; audience → story; materials → the bank entry it is the record of).
4. **Assets**: already one node per element; a changed element invalidates the stills it appears in (the state
   manager knows which) and the clips pinned on them.
5. **The state manager** stays the micro record; the tree reads its tables (`stills[].scene`, `shot`, `from`,
   `in[]`) rather than re-deriving them.

why:
The user's request of 2026-10-31: quantise the screenplay and the like so the dependencies are drawn better. A
screenplay as one node makes every change remake every still; a scene as a node makes a change to scene 7 remake
scene 7.

acceptance:
In the Workflow view for `topgun9`, scene 7 is a node whose dependents are exactly scene 7's shots, their stills,
the sequence of shots 6 to 9 and the film; a sheet field `platform` is a node whose dependents are every still and
clip; then, to build, a screenplay revision that changes only scene 7 marks only scene 7's stills stale.
