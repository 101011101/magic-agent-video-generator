# Cleaned — presence-tracked keyframe pipeline

> Prompt → story → seed (ground plans, verified plates) → blocking → keyframes made by editing the latest frame of each place → slideshow. The frame is the state; the
> tracker only knows which entities each frame shows. Design: [docs/PRD.md](docs/PRD.md) (stage 1), [docs/PRD-video.md](docs/PRD-video.md) (stage 2, clips), [docs/PRD-seed.md](docs/PRD-seed.md) (stage 0, seeds: generated places built; uploads not built). Work: [tickets/](tickets/README.md).

**Run:**
```
node cleaned/run.mjs --case goldilocks --label v1 --estimate   # plan + job list, no image credits
node cleaned/run.mjs --case goldilocks --label v1              # paid run
node cleaned/run.mjs --prompt "a fox steals a pie" --label t1  # any prompt (case id "custom")
node cleaned/run.mjs --prompt "…" --label t2 --entities-from custom-t1 --first-frames  # reuse sheets; seed + first frame per place
node cleaned/run.mjs --case goldilocks --label v1 --video [--clips 2,8]  # stage 2: clips (+ final.mp4 when all exist)
```
- Keys: `OPENAI_API_KEY`, `MAGIC_HOUR_API_KEY` from the env or the repository root `.env`.
- Output: `cleaned/runs/<case>-<label>/index.html` (slideshow + lineage + presence matrix), `run.json`, `tracker.json`, `roots/`, `frames/`.
- Re-running the same label reuses every finished job (signature = spec + input hashes) and the cached plan, so a stopped run resumes.
- `--slides N` builds the first N slides only. `CLEANED_CAP` (default 8000) caps lifetime credits in `runs/ledger.json`. `CLEANED_MODEL` overrides the LLM.

**Files:**
| file | subsystem |
|---|---|
| `src/seed.js` | S0: ground plans → plates → per-mark vision check → canonical marks |
| `src/sequencer.js` | S1: world + story; blocking records folded into state (lint); slides |
| `src/roots.js` | S2: entity sheets and location plates |
| `src/tracker.js` | S3: frames by location and presence; base = latest frame at the place |
| `src/builder.js` | S4: edit loop (1 + k, then 1 + 1 on a partial success) |
| `src/verify.js` | S5: presence; per changed actor mark / pose / expression; physical sense |
| `src/clips.js` | framing gate (SSIM, border), clip QA, stitch |
| `experiments/` | E1 verifier sensitivity (LLM only); E2–E5 image-editor tests (paid, not run) |
| `src/page.js` | S6: slideshow page |
| `src/jobs.js`, `src/magichour.js`, `src/llm.js`, `src/env.js` | paid-call gate and ledger, clients, keys |
