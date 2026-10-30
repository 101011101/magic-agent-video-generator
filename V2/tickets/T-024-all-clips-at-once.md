# T-024 · Render every clip at once

status:     done 2026-10-30 (code and PRD); to be confirmed on the next full run
priority:   medium
subsystem:  edit

what:
The clip stage sends every clip of the film to Magic Hour at the same time by default (`--parallel 0`, the new default);
`--parallel N` limits it when wanted. A set of clips then takes about as long as its longest render, four to five minutes,
instead of a chain of three-at-a-time batches. The same rule applies to any later stage that renders independent items
(the keyframes of one place are a chain and stay sequential; keyframes of different places could go in parallel, open).

why:
The first Top Gun film rendered its nine clips three at a time, about twenty minutes, because the clip stage was written
with a cautious default. Magic Hour publishes no concurrency cap (sheet, "Rate limits: not published"), API jobs do not
count against the web app's limits, and the credit guard reserves every job in flight before it is posted, so a burst of
eleven cannot overshoot the cap. The user asked whether production should be all at once; it should.

acceptance:
A full run's clip stage finishes within about one longest-clip time of its start; the ledger's in-flight reservation
equals the sum of the posted clips while they render; no job is lost or paid twice. Then: keyframes of different places in
parallel, measured the same way.
