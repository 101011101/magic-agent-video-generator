# B-009 — Blocking records replace the STE step script
**Status:** in-progress
**Cost:** 0 (LLM only)
**Blocked by:** B-008

## Problem
The STE step script (B-007) made sentences clear but kept positions as free prose, and asked the LLM to restate every entity's place and acting on every step: two descriptions of one state that can disagree (G-005), and long edit prompts that restate everything, so the editor re-paints more than the change.

## Done when
Each step is a record, like stage blocking: `beats[{ actor, action, to, via, object, pose, expression }]`, `change{ mark, state }`, `caption`. `to` / `via` / `change.mark` must be marks of the step's place (from B-008). Only changes are written; code folds them into the full state (who is where, holding what, feeling what). Lint (code): marks exist, ≤ 2 beats and ≤ 2 characters changing per step, enter/exit at door marks, exit before a character on screen appears elsewhere, pose and expression on arrival, pick-up/put-down consistency. One rewrite on violations. The action sentence is generated from the record; the caption is the only free text and never drives images. The edit prompt names only the changed actors (mark, path, pose, expression) and keeps everything else "as in image 1".
Kept from STE as lint: one change per step, exact names, exit/entry. Dropped: the dictionary and the STE label.
