# T-002 · Portraits only where needed

status:     open
priority:   high
subsystem:  state, keyframes

what:
A `needsPortrait(person, still)` query in the state manager: true when the person is not in image 1, or when this still
frames the person much closer than image 1 shows him (his face in image 1 is below a size threshold from the gate's boxes).
The keyframe template attaches and names a portrait only when the query says so. A three-shot cropped from the master
sends no portraits; a single sends one.

why:
The v2 build sends every in-frame portrait every time, following the "identity from the bank, always" rule written after a
chain carried an identity swap. The user's rule, and PRD v4's state-manager line, is that image 1 carries whoever is
already in it and a sheet is sent only for whoever enters. Resending three portraits for a frame that already holds the
three men is redundant and invites the painter to re-render faces that were right.

acceptance:
On the vanderbilt6 plan: s1-1 sends three portraits (from the plate), s1-2 none (edit), the two singles one each, the
three-shot none; the people gate still passes on the painted results.
