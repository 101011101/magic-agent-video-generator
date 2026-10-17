# Subsystem 7: Test Machine (supervised pipeline runs)

> Status: built and verified in replay; not yet exercised against a paid run. Parent: [../architecture.md](../architecture.md)
> Code: [../../prod/test-machine/](../../prod/test-machine/README.md). Applies to both live pipelines.

**Problem:**
- A full run costs about 8,000 credits and 40 minutes, and the operator sees nothing until it ends.
- Most of that spend is decided by steps that are cheap to judge and expensive to get wrong: the plan, the anchors, a keyframe decision. A bad plan at minute two is paid for all the way to minute forty.
- Reading a run page afterwards tells you what went wrong. It does not let you stop it.

**The idea:**
- The real pipeline runs with its real logic. Nothing is mocked, stubbed or simplified.
- The only difference is that it halts at each major step and at each paid call, shows its state in a browser page, and continues when the operator approves.
- The gate sits **before** the paid call, so stopping actually saves the credits.

**Where the step boundaries are, and why:**
- Two kinds of gate, because two different things are worth catching.
  - **Step gate** — a major phase boundary, placed in each pipeline's `run.mjs`. Some of these are free (stitch, mix). They are gates because they are the points where a human can see whether the run is still on course.
  - **Job gate** — every paid Magic Hour call, placed in the job runner itself (`Jobs.run` in A, `Run.job` in B). Both pipelines funnel every paid call through that one method, so gating there cannot be bypassed by a later code path that forgets to ask.
- A planning step is gated **after** it produces its artifact, so the operator approves a plan they can read. A paid call is gated **before** it is made, so the operator approves a price they have not yet paid.
- A cached job does not gate. The cache check and the estimate branch both return before the gate, so a re-run only asks about work it is actually going to do.

**Steps, pipeline A (state graph):**

| # | Gate | Kind | Why it is a boundary |
|---|---|---|---|
| 1 | `timeline` | step | The whole run derives from it; it is free to reject and expensive to accept wrongly. |
| 2 | `beat N` | step | One per beat. The last point before that beat's images and clip are paid for. |
| 3 | `frame:bN:aK` | job | Each keyframe attempt, with its prompt and seed inputs. 200 credits. |
| 4 | `clip:bN` | job | The clip. 96 credits per second — the largest single spend. |
| 5 | `stitch` | step | Picture assembly; free, but the point where seam faults become visible. |
| 6 | `audio mix` | step | Cue sheet, beds and score. |

**Steps, pipeline B (memory bank):**

| # | Gate | Kind | Why it is a boundary |
|---|---|---|---|
| 1 | `storyboard` | step | As with A's timeline: everything derives from it. |
| 2 | `anchors` | step | The frozen references. A wrong anchor propagates into every later shot. |
| 3 | `anchor:<name>` | job | Each anchor image. 200 credits. |
| 4 | `shot NN` | step | One per shot. |
| 5 | `frame:NN`, `frame:NN:retry`, `repair:NN` | job | Keyframe, the gated retry, and the in-place repair. |
| 6 | `clip:NN` | job | The clip. |
| 7 | `stitch`, `audio`, `judge` | step | The three post phases, already separate in the code. |

**How the handshake works:**
- `--supervised` starts a local HTTP server in the pipeline's own process and prints its URL.
- At each gate the pipeline records the step, marks it pending, and awaits a promise.
- The page polls the state and shows the pending step: what it is about to do, its inputs, the prompt, the cost, and a running credit total.
- Approve resolves the promise and the pipeline continues. Stop rejects it with `StopRun`, which both runners treat as a clean halt. "Approve all remaining" sets an auto flag and the rest of the run proceeds unattended.
- Without `--supervised` no server starts and no gate exists; both pipelines behave exactly as before.

**Verified:** the full approve / stop / approve-all handshake, driven over HTTP against the recorded `p4-lighthouse-v3` run, 12/12 checks (`replay.mjs --selftest`). Confirmed that a stop leaves every later paid job unrun.

**Not yet verified:** behaviour during a real paid run — no run has been made since the harness was written, and `ffmpeg` is not installed on this machine, so the clip and stitch stages cannot execute here at all.

**Open:**
- Should a rejected step offer "retry with an edited prompt" rather than only stop? The page already has the prompt text; editing it in place is the natural next feature.
- Per-step credit ceilings, so the operator can pre-approve "anything under 200" and only be asked about clips.
