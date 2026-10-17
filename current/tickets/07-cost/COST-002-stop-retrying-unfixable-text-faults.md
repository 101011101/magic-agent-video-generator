# COST-002 — Stop retrying the fault class that retries never fix
**Status:** open
**Category:** 07-cost
**Cost:** 0
**Approval:** not-required
**Blocked by:** none

## Problem
`current/tests/subcases/MATRIX.md` §"Text and graphics" records that invented/hallucinated text (storefront branding, licence-plate text) is "0-for-3 on retries — a re-prompt never removes it," observed in 4 of 6 car shots. `current/tests/pipeline-memory/ledger.json` shows retries cost real credits at the same 200-cr `nano-banana-pro` rate as any other keyframe call: `p4-lighthouse-v1` alone spent 1,200 credits on retries. If any of those retries were attempting to fix a hallucinated-text fault, that spend was never going to succeed — the fault class is measured as unfixable by re-prompting the same model.

Neither pipeline currently distinguishes "this fault class is worth retrying" from "this fault class has a 0% retry success rate on record." Every retry currently costs the same whether it is attacking a fixable fault (e.g. size, position) or an unfixable one (invented text).

## Evidence
MATRIX.md §"Text and graphics": "readable storefront branding", "licence-plate text", in 4 of 6 car shots, "0-for-3 on retries". `ledger.json` `p4-lighthouse-v1` retries total 1,200 credits (verified by summing the duplicate-named `a1`/`a2` editor calls beyond the first attempt per shot). The retry mechanism itself is not yet instrumented to log *which fault* triggered a given retry, so we cannot yet compute exactly how many of those 1,200 credits went after text specifically — that gap is itself worth closing before this can be sized precisely (see Done when).

## Done when
Before this can be marked done, the retry logic must log which fault class (per the verifier's own vocabulary — HARD/SOFT in pipeline A, or `primary_fault` in pipeline B) triggered each retry, so future ledger entries can be attributed to a fault class. Once that is in place: a retry is skipped (and the shot is flagged for manual/alternate handling instead) whenever the triggering fault is in a class with a recorded 0% retry-success rate (text/branding hallucination, per the evidence above) — verified by checking that the next run with a text-hallucination fault present does not spend a retry on it.
