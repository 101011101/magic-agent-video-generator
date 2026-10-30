# E-001 — Story editor and the state manager's question loop
**Status:** open
**Cost:** 0 (LLM only)
**Blocked by:** none

## Problem
The state manager can only be as consistent as the story. custom-rrh4's story never said where the stones came from, so the
rule "used without being brought in → always there" painted six rocks on the cottage floor. The story writer leaves holes.

## Done when
1. Right after the story, an editor LLM reads it for logic holes (objects from nowhere, unclear who-does-what, impossible
   actions) and makes minimal edits.
2. After the state manager runs, code turns its findings into questions: props inferred as always there, tagged assets never on
   screen, untagged mentions, entry/exit repairs, props seen where never carried. The editor answers all of them at once with
   minimal edits (it may answer "it was always there"), then ids and states rerun. At most 2 rounds; open questions go to the user.
3. The run page shows each question, the edit that answered it, and the state that resulted.
