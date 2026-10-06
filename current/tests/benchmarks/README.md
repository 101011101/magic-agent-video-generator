# Benchmarks

- Purpose: compare final output of Magic Agent against other AI video generators. Test is the output: quality and speed.
- Quality: judged by eye. Refine the method after the first runs.
- Metrics: track every mainline metric below on each run.

**Files:**
- `README.md`: this index.
- [long-video-prompts.md](long-video-prompts.md): 8 long-video prompts (5–20 min).
- `runs.csv`: one row per system per prompt. Header holds all metric columns.
- `probe.mjs`: reads a video file with ffprobe and prints spec metrics as a CSV fragment.
- `runs/<system>/<prompt-id>.<ext>`: output files. Not committed if large.
- `assets/`: fixed upload pack. Every system gets the same files. Not built yet.

**Systems:**

| Key | System | Kind |
|---|---|---|
| `magic-agent` | Magic Agent (`current/`) | system under test |
| `archived` | Archived agent (`archived/`) | baseline |
| `focalml` | https://focalml.com/ | one-shot video generator |
| `invideo` | https://invideo.io | one-shot video generator |
| `videogen` | https://videogen.io | one-shot video generator |
| `genspark` | https://www.genspark.ai/ | general agent, tool calling |
| `manus` | https://manus.im/ | general agent, tool calling |

**Metrics** (columns in `runs.csv`):
- Speed:
  - `wall_s`: seconds from submit to final file.
  - `first_preview_s`: seconds to first visible preview. Blank if the system has none.
- Cost:
  - `cost_usd`: dollars per run (credits converted).
  - `credits`: native credits used.
- Reliability:
  - `completed`: `y` or `n`. A final file exists.
  - `retries`: re-submits needed to get a file.
  - `error`: error text if the run failed.
- Interaction:
  - `user_turns`: messages the operator sent after the first prompt.
  - `asked_blocking`: `y` if the system asked for a missing input before it generated.
- Spec (from `probe.mjs`):
  - `duration_s`, `width`, `height`, `aspect`, `fps`, `has_audio`, `size_mb`.
  - `duration_err_pct`: `|duration_s − requested| / requested × 100`. Blank if no duration was requested.
- Adherence (by eye):
  - `checklist_pass` / `checklist_total`: items from the prompt's expected handling that hold.
  - `text_exact`: `y` / `n` / blank. Rigid on-screen text is verbatim.
  - `identity_hold`: 1–5. Character or product stays the same across shots.
  - `shot_count`: shots in the output. Compare to the requested count.
- Quality (by eye):
  - `quality`: 1–5 overall.
  - `notes`: free text.

**Prompt tiers** (IDs from [prompt-set/video-prompts.md](../prompt-set/video-prompts.md)):
- P1 one-shot generation. Priority. Runs on all systems.
  - No upload: 1.1, 1.3, 3.1, 3.2, 3.3, 4.3, 6.1, 6.2, 6.3, 7.1, 7.2, 9.1, 10.2, 10.3.
  - Static upload (needs `assets/`): 2.1, 2.3, 4.2, 8.1, 9.2, 11.3, 13.3.
- P2 one-shot from footage or many inputs. Run after P1.
  - 1.2, 2.2, 7.3, 8.2, 8.3, 13.1, 13.2, 14.1, 14.2, 14.3, 16.1, 16.2, 16.3, 17.1, 17.3.
- P3 not one-shot. Skip for competitors. Run on `magic-agent` and `archived` only.
  - Edits and iteration: 5.1, 5.2, 5.3, 9.3, 11.1, 11.2, 15.1, 15.2, 15.3, 17.2.
  - Not video generation: 12.1, 12.2, 12.3.
  - Vague complaint, no output target: 10.1.
- L long video. Tests the claim that the architecture scales to 20 min.
  - L1–L8 in [long-video-prompts.md](long-video-prompts.md). Also 4.1 (5 min).

**Run rules:**
- Paste the prompt verbatim. Attach only the listed uploads.
- If a system asks a question, answer from the prompt's expected handling. Count each answer in `user_turns`.
- Use default settings. Record any non-default setting in `notes`.
- Run `node current/tests/benchmarks/probe.mjs <file>` and paste the output into the spec columns.

**Open gaps:**
- `assets/` pack: dad photo (2.1), blue and red bottle photos (2.3), energy drink can (4.2), grandma photo (8.1), dog photo (9.2), portrait (11.3), competitor ad and product photo (13.3), plus P2 footage.
- Plan tier per system. Record which plan each competitor run used.
