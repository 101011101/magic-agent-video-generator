# V-005 — Choose the video model per clip
**Status:** open
**Cost:** a sweep: same 2 clips × 4 models ≈ 2,000–4,000
**Blocked by:** V-002

## Problem
One model (wan-3.0) for every clip. Models differ in end-frame support, length options, motion fidelity and price (PRD-video §5; `current/tickets/06-runs/RUN-003`).

## Done when
The probe clips are re-made with kling-3.0, seedance-1.5 and veo3.1-lite and scored with the same QA; the clip stage picks a model per clip from its needs.
