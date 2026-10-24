# SM-303 — Pipeline A retries on the presence of a fault, with no stop rule
**Status:** open
**Category:** 02-state-manager
**Cost:** 0
**Approval:** not-required
**Blocked by:** none

## Problem
A retry costs 200 credits and is triggered by a fault existing, not by any estimate that a retry will clear it. Pipeline B gained a stop rule (`retryPlan` in `pipeline-memory/src/keyframes.js`) that classifies faults as prompt-fixable or needing a reference before spending. Pipeline A has no equivalent: its only guard compares fault classes *after* the second attempt has already been paid for.

## Evidence
`current/prod/pipeline-state-graph/src/controller.js:198` — the same-fault-class check runs at `k === 1 + RETRIES.same_seed`, after attempt 2.

With attempt ratios of 2.5–2.83, retries are roughly 60% of frame spend on multi-shot runs. In `p4-lighthouse-fixed30` that is 9 of 14 frame attempts, ~1,800 credits, and 4 of 5 beats still ended forced.

## Done when
Pipeline A classifies a fault before spending on a retry, declining where the class is not addressable by another attempt on the same plan; a replay over recorded runs reports credits that would have been saved and any fix that would have been lost.
