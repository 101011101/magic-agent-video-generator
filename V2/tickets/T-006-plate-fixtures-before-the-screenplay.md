# T-006 · Plate fixtures into the screenplay before it is written

status:     open
priority:   medium
subsystem:  assets, screenplay

what:
The plate description (walls, floor, light, every fixture with side and depth) is produced right after a plate exists and
handed to the screenplay call in the places line ("as seen in its picture: …"), so blocking, camera placement and the
`behind` field are written around the real furniture. Built in `cleaned/src/state.js` and `cleaned/src/script.js` on
2026-10-30 but not yet exercised: the vanderbilt6 screenplay was written before it existed.

why:
That screenplay staged Vanderbilt "an arm's length from Lincoln" across a centre table it did not know was there, and
wrote "behind the people: period architectural trim" because the place record said nothing more; the painter filled the
gap with wallpaper.

acceptance:
The next screenplay written on the Vanderbilt bank names the fireplace, the door and the table in its camera and blocking
fields, and no shot asks for a distance the furniture does not allow.
