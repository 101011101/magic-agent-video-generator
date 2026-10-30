# Test Machine (supervised pipeline runs)

> The real pipeline, with its real logic, stopped at every major step and every paid call until you approve it in a browser page. The gate sits before the paid call, so stopping saves the credits. Design: [07-test-machine.md](../../docs/subsystems/07-test-machine.md).

**Run a supervised pipeline:**
```
node current/prod/pipeline-state-graph/run.mjs --case p4-lighthouse --label s1 --supervised
node current/prod/pipeline-memory/run.mjs      --case p4-lighthouse --label s1 --supervised
```
The URL is printed at startup (default `http://localhost:4478`, override with `TM_PORT`). Open it and approve each step. Add `--auto` to approve everything from the start (useful for an unattended run that you still want to watch).

**On the page, per step:** what it is about to do, the input images it will use, the prompt text, the credits it will cost, and — once it has run — the image or video it produced. Plus a running total of credits approved and spent. Three buttons: **Approve**, **Approve all remaining**, **Stop the run**.

**Replay, without credits, network or ffmpeg:**
```
node current/prod/test-machine/replay.mjs --pipeline a --label v3   # drive the handshake from a recorded run
node current/prod/test-machine/replay.mjs --pipeline b --label v1
node current/prod/test-machine/replay.mjs --selftest                # automated: approve / stop / approve-all, 12 checks
```
Replay issues the same gates through the same `Supervisor` API the live pipelines use; only the work behind each gate is replayed from `run.json` instead of generated. This is how the harness is verified on a machine with no ffmpeg and no budget.

**Files:**
- `supervisor.js`: the server and the gate. `Supervisor.step()` for a major phase, `Supervisor.gate()` for a paid call, both blocking. `maybeSupervisor(args, …)` returns `null` unless `--supervised` is passed, so the pipelines are untouched without it.
- `page.js`: the page. Polls `/api/state` every second; no dependencies.
- `replay.mjs`: the recorded-run driver and the self test.

**Where the gates are wired:**
- Paid calls: `pipeline-state-graph/src/jobs.js` (`Jobs.run`) and `pipeline-memory/src/common.js` (`Run.job`). Every paid call in both pipelines goes through one of these two methods — verified by grep over all call sites — so no paid call can escape the gate. `Run.mh()` carries a second backstop gate for any future call that bypasses `job()`.
- Major steps: the two `run.mjs` files. A: timeline, each beat, stitch, audio mix. B: storyboard, anchors, each shot, stitch, audio, judge.

**A cached job does not ask.** The signature check and the estimate branch both return before the gate, so a re-run only prompts for work it will actually do.

**Status:** handshake verified in replay (12/12). Not yet exercised against a paid run; `ffmpeg` is not installed on this machine, so the clip and stitch stages cannot run here.
