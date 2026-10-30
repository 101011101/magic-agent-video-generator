# B-002 — Roots: entity sheets and location plates
**Status:** done
**Cost:** 200 per root
**Blocked by:** B-001

## Problem
Every entity and location needs a clean, never-edited root image (PRD §5 S2).

## Done when
One text-to-image job per entity and location runs (in parallel), is cached by signature, and is registered: plates as tracker frames with `present = []`.
