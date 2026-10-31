# T-036 · The manual baseline: a person on the Magic Hour tools against the agent from natural language

status:     open
priority:   high
subsystem:  bench, agent

what:
For every benchmark case (T-031, `V2/bench/cases/`), two runs of the same request and one comparison:

1. **Manual.** A person (or Claude working the API by hand with the sheet open) makes the thing the case asks for,
   picking the tools, the models and the parameters themselves and asking the proxy user whatever they need. The
   record: which endpoints were called with which parameters, how many questions were asked, credits, wall time, and
   the output. This is what a capable user of Magic Hour does today; it is the bar.
2. **Agent.** The same brief into the agent (T-034), with the proxy user answering from the same answer sheet. The
   record is the transcript: the sheet as filled, the questions, the tools planned with their parameters, and when
   tools are allowed to run, the output, credits and time.
3. **Compare**, per case, side by side on one page: tools chosen (same group? same endpoint? same count?),
   parameters (model, resolution, length, aspect), questions (count, and whether each was necessary), credits, time,
   and the output when both made one. A difference in tools is a finding, not automatically a fail: the page shows
   both and the person decides which was right; the decision is written back into the case's expectations.

The dry form runs first: both sides plan without calling a paid tool (`--dry`), so the comparison of tools and
parameters costs nothing and can run on every change. The paid form runs on demand under the benchmark's cap.

why:
The user's framing of 2026-10-31: the benchmark is "Claude or something manually running Magic Hour tools versus the
pipeline running it from the natural-language stuff which simulates a person." Without the manual side there is no
bar; the agent could pass its own expectations and still be worse than a person with the API open.

acceptance:
`V2/bench/baseline/<case>.json` for every case (the manual record, written once and kept until the tools change);
`node V2/bench/run.mjs --dry` producing the comparison page with the agent's transcript beside the manual record for
all twenty cases; then one paid run of the ten cheapest cases on the free tier under 1,000 credits with outputs on
both sides.
