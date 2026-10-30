# Edge cases: what the system does when reality does not match its assumptions

> Traced read-only against `current/prod/` on 2026-10-15. Every recorded run is one of four happy paths
> (p4-lighthouse, d1-desert-tokyo, p1-grandma, f1-red-riding-hood). The system has essentially never met an
> awkward input. Severity is likelihood × damage: silently wrong film > wasted credits > clear crash.

## Confirmed mishandled

| # | Case | What happens now | Severity | Needs |
|---|---|---|---|---|
| 1 | A continuous beat is downgraded to a cut at runtime | `controller.js:106` flips `beat.link` and **nothing touches `beat.start.description`**. That description was authored to mean "carry straight on"; `prompts.js:23` renders it verbatim, so the cut redraws the same moment. | **silently wrong film + wasted credits** | Re-derive the start description on downgrade, or merge the beats |
| 2 | A job completes with an empty `downloads[]` | `magichour.js:45` yields `downloads: []`; every caller does `download(r.downloads[0], …)` (15 call sites) → `fetch(undefined)` TypeError. The job **was charged by Magic Hour** but `jobs.js:52` records the call with no `credits` field. | **crash + ledger under-counts real spend** | Guard `downloads[0]`; record the charge before the download |
| 3 | A download returns 0 bytes or a truncated body | `magichour.js:54` writes it unchecked. `jobs.js:43` caches on `existsSync` alone, so the empty file is a valid cached output **forever**. ffmpeg fails downstream with no link to the cause. | **poisoned cache, manual deletion is the only exit** | Size/decode check before accepting an output |
| 4 | Two entities share a name | `graph.js:13`, `memory.js:22`, `storyboard.js:84` all build `Object.fromEntries(entities.map(e => [e.id, e]))`. The **first silently vanishes**; no validation anywhere. | **silently wrong film** | Reject duplicate ids at plan load |
| 5 | The plan names an upload that is not on disk | `run.mjs:45` copies only if `existsSync`; `registerUploads` (`controller.js:26`) then `continue`s on the missing key. The entity is **generated from scratch** with no warning. | **silently wrong film** — the one thing the user supplied is ignored | Fail loudly when a declared upload is absent |
| 6 | Resuming any run whose link was downgraded | The downgrade mutates the live timeline object, which is `log.timeline`, which is saved. `fixed30` now persists `b4.link: "cut"` with `link_planned: "continuous"`. A resume **never re-attempts continuous**. | run is not reproducible | Keep the plan immutable; record the downgrade beside it |
| 7 | A prop whose `size` string does not parse | `isSmall` requires `cm(e.size) > 0`, so the prop is silently excluded from anchoring. | silently wrong scale | Treat an unparseable size as an error, not as "not small" |
| 8 | A story with no characters | `anchor()` needs a character scale partner (`controller.js:127`); with none it returns `null` and **no prop is ever anchored**. | silently wrong scale on every prop | A non-character scale reference |
| 9 | Two runs of the same label at once | No lockfile anywhere in `current/prod`. Both hold `log` in memory and `writeFileSync` the whole of `run.json`; last writer wins. | lost job records → **re-paying for work already done** | A lock, or an append-only job log |
| 10 | A filename rewritten within one run, then used as an input | `jobs.js:29` `forget()` clears `hashes` but **not `upCache`**, so the stale uploaded URL is reused. `pipeline-memory/src/common.js:56` `touch()` clears both — pipeline A is the one missing it. | latent: no current filename collides | Clear `upCache` in `forget()` |

## Handled well

- **The 10-asset cap.** `graph.js` `reAnchor({slots:10})` ranks characters → anchored props → locations → other, fills to the cap and records `roots_skipped`. Explicit priority, nothing silently dropped.
- **Zero beats.** `beats: []` runs the loop zero times, `parts.length` is 0, stitch is skipped, the page still renders. No crash, no video, honest output.
- **Anchor recursion.** `anchor()` can call `cutStart()`, which anchors — but it passes `w0` with every small entity filtered out, so it cannot recurse.
- **Ledger on resume.** `spent()` sums an append-only `log.calls`, and `charge()` recomputes `led.runs[run]` rather than incrementing, so a re-run cannot inflate the lifetime total.
- **POST retries.** `magichour.js:19` retries GET only; a 429/5xx POST is never repeated, so a paid job cannot be bought twice.
- **Unknown `--case`.** `run.mjs:32` throws a clear named error.

## Could not determine without executing

- Disk full mid-run, a missing ffmpeg codec, and real 402/429/500 timing at each stage: all reachable only by running. The 402 path converts to `StopError` (`jobs.js:53`) and looks right by inspection.
- Whether a clip can come back shorter than the trim about to be applied. `seamFix` has a clip-length guard; the trim arithmetic in `cutClip` was not exercised against a sub-second clip.
