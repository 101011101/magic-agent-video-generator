# T-021 · A prop identity gate

status:     half done 2026-10-30: the LOAD half is built (`loadCheck`, the structured `on` field); the IDENTITY half is open
priority:   medium
subsystem:  state

what:
A gate for the props in frame, like the people gate. Two halves:
1. Load (built): for every host that carries something (from the screenplay's `on` field, through chains), what the picture
   shows attached to or hanging from it against what the screenplay puts on it; `extra` flags. One vision call per still
   that has anything carried; nothing for crops; `absent` hosts are not enforced.
2. Identity (open): one vision call per painted still with each prop's reference picture, answering whether the named prop
   is present and is the same object as its picture (shape, build, markings), with a short note. Flag only.

why:
In the first Top Gun run the warship on the cockpit screen (s6-1) was a different class of ship from the one in the wide
(s5-1), and the edit of that screen (s6-2) changed it again; the room gate passed both. In the fourth run the attack
approach was painted four times with extra bombs and missiles on the jets while every gate passed: nothing looked at the
loads, and a prose rule in the prompt did not hold on its own.

acceptance:
Load: on the fourth run's stills as painted, the gate flags the approach and the bank frame (s7-1, s7-2) for extra stores
and passes the impact frames. Identity: on the first Top Gun stills, flags s6-1 and s6-2 for the warship and passes s5-1;
on the vanderbilt6 fixture it passes every still whose steamship matches its Commons picture.
