# SM-103 — 26 of 30 endpoints never called, and the uncalled ones are the transformation tools
**Status:** in-progress
**Category:** 02-state-manager
**Cost:** 0
**Approval:** not-required
**Blocked by:** SM-100

## Problem
Production reaches four Magic Hour generation endpoints: `/v1/ai-image-generator`, `/v1/ai-image-editor`, `/v1/image-to-video`, `/v1/ai-voice-generator` (plus `/v1/files/upload-urls`). The other 26 are never called. The uncalled set is disproportionately the cheap, narrow, **transformation** tools — precisely the ones SM-102 says are missing.

| uncalled tool | cost | property it supplies | recorded fault it addresses |
|---|---|---|---|
| `/v1/face-detection` | not stated | locates faces; feeds the face-swap tools | uploads become identity anchors unvalidated (SM-104) |
| `/v1/image-background-remover` | 5 | isolates a subject for compositing | enables paste-back instead of regeneration (SM-102) |
| `/v1/face-swap-photo` | 10 | restores a specific face onto a frame | A: 11 `identity` faults; B: "Keeper looks younger with dark hair in the tower shots" |
| `/v1/head-swap` | 10 | restores head + hair | same identity class |
| `/v1/ai-face-editor` | not stated | targeted facial edit | identity drift without a full redraw |
| `/v1/ai-clothes-changer` | 25 | wardrobe only | A: 1 `wardrobe` fault — thin, honestly |
| `/v1/ai-image-upscaler` | 25–200 | resolution | no recorded fault |
| `/v1/character-replace` | not stated | replaces a character in **video** | would act after the clip, where no tool acts today |
| `/v1/video-to-video` | not stated | restyle/repair an existing clip | would let a bad clip be repaired instead of re-rolled |
| `/v1/photo-colorizer`, `/v1/ai-meme-generator`, `/v1/ai-qr-code-generator`, `/v1/ai-gif-generator`, `/v1/ai-headshot-generator`, `/v1/body-swap`, `/v1/animation`, `/v1/audio-to-video`, `/v1/auto-subtitle-generator`, `/v1/lip-sync`, `/v1/ai-talking-photo`, `/v1/ai-video-editor`, `/v1/ai-video-translator`, `/v1/ai-voice-cloner`, `/v1/text-to-video`, `/v1/face-swap` | — | — | **no recorded fault** — listed for completeness, not advocacy |

## Evidence
`grep -rnE "/v1/[a-z0-9/-]+" current/prod` — the complete set of endpoints appearing anywhere in production code is the four above plus `files/upload-urls` and the two status-poll paths. Fault counts from A's `checks.hard`/`checks.soft` across `current/tests/pipeline-state-graph/runs/*/run.json`: position 43, size 24, pose 24, identity 11, interaction 6, place 4, condition 3, wardrobe 1.

## Done when
Each tool in the top half of the table is either wired behind a state-driven selection (SM-100) or has a one-line note in the tool spec saying why it is rejected. A tool is not "unused" — it is either selected or explicitly ruled out.
