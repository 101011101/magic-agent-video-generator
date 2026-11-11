# T-055 · The sheet keeps the user's words as data, and lettering is exact to the character

status:     open (drafted 2026-11-01; parts done the same day)
priority:   medium
subsystem:  agent (sheet, planner), keyframes/buildable, tools

why:
- **"direction: stated (stated)" (A06d).** The sheet's `direction` field is an enum, stated | free | needed, meaning
  "did the user state a direction". The style words themselves lived only in the field's `quote`. Our code in plan.js
  built the planner's input from `value (source)` and dropped `quote`, so the planner never saw "green and black on
  white". The sheet model did what its schema asked; our schema and our formatting lost the words.
- **Lettering (A03d).** Exactness stopped at letters. The read-back treated ’ and ' as the same, a garbled wanted line was
  "removed" as stray, and one blind fix was followed by "lettering fixed".

what:
1. **Sheet schema:** split the enum from the words. `direction_given: stated|free|needed` plus `direction: <the user's words>`.
   The same goes for every field whose value is a judgement and not the user's text. The planner input carries `value`,
   `source` and, for stated fields, the user's words verbatim (done in plan.js `sheetText`).
2. **Lettering:**
   - punctuation exact (straight vs curly apostrophe, dashes) when strict (done);
   - a wanted line is never removed (done);
   - fix, re-read, keep the better version, at most 2 rounds, flag what is left (done);
   - long strings routed by contract (T-054).
3. **Pre-flight's words check:** the user's colours and quoted strings must reach a prompt (done, T-049).

prd changes:
- `prd/11-agent.md`, "The questions come first": the field schema with `*_given` enums and the words kept separately.
- `prd/05-keyframes.md`: the lettering read-back loop as built.

code changes:
- `agent/sheet.js`: BRANCHES with split fields; `agent/plan.js` `sheetText` (done);
- `composer/keyframes/buildable.js` `misread` strict quotes, `realStray`, design-aware `fixText` (done);
- `agent/execute.js`: the read-back loop (done).

test set changes:
- `tests/agent/sheet.test.mjs`: for each stated field, the planner input contains the user's words;
- bench v1: A03d and A06d stay as regression items; add one item with a straight apostrophe and an en dash in a headline.
