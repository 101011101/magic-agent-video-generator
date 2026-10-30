# T-008 · Content-filter rejections

status:     open
priority:   low
subsystem:  edit, lib

what:
A Magic Hour rejection with code `nsfw` returns nothing to review, so it is the one automatic resubmission the pipeline
keeps: once more with the policy-safe prompt made by rule (CAST reduced to names and positions, "they speak the lines",
the historical lines untouched). Built. Add a counter in the run record of rejections and of which prompt was accepted,
and surface it on the results page, so the pattern can be seen.

why:
Clip 6 of vanderbilt6, "I accept her.", was rejected once and accepted on the next submission of the identical request;
the rejection was not deterministic. Without a count there is no way to tell a flaky filter from a prompt that trips it.

acceptance:
The run record lists every rejection with the clip, the attempt and whether the original or the policy-safe prompt was
accepted; the results page shows the count.
