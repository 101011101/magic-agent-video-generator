# T-028 · Declare the realistic loadout instead of fighting the model's prior

status:     open 2026-10-30
priority:   high
subsystem:  assets, screenplay

what:
When a vehicle on record customarily carries several things (an F-35C on a strike carries a bomb AND an air-to-air
missile on the outboard station), the assets stage puts each customary store on record as a prop with its own picture,
and the screenplay attaches them with `on`. The painter is then told the whole, plausible loadout and the load gate
checks for it, instead of the prompt forbidding what every photograph of the aircraft shows.

why:
Across five runs, two still models and nine attempts, every attack approach grew a slender missile beside the bomb; a
prose rule ("carries exactly one thing"), a structured `on` field with a store rule, and a removal edit (repair) all
failed to take it off. The model's prior for "F-35 with external stores" includes the missile, and fighting a prior with
negatives is the most expensive thing the pipeline does. The screenplay's constraint was the unrealistic one.

acceptance:
On the Top Gun story the record lists the GBU-12 and an AIM-9X per jet; every approach frame passes the load gate on
the first paint, and the missile stays on the wing after the bombs fall (continuity through `on`).
