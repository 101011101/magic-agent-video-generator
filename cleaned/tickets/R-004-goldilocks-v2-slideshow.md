# R-004 — Paid run: Goldilocks v2 slideshow (step script)
**Status:** blocked
**Cost:** ≈ 4,800 (24 slides) + retries; roots reused from v1 (0)
**Blocked by:** cap raise (ledger 9,760; `CLEANED_CAP` 11,000 approved → needs ≈ 16,000)

## Done when
`CLEANED_CAP=16000 node cleaned/run.mjs --case goldilocks --label v2 --world goldilocks-v1` finishes; compare with v1: acting faults, position faults, retries, and whether exits/entries read correctly as frames.
