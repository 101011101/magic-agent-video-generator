# V4 tickets

| # | Ticket | Files | Done when |
|---|---|---|---|
| V4-01 | Catalogue: the MCP's tools + our extras, each with its parameters, types, model grid, cost | `agent/catalogue.js` | every tool the tests need is listed with required parameters |
| V4-02 | Intent + sheet: one LLM call per turn → tier, tool, parameters with sources, plain questions | `agent/intent.js` | vague brief → right tool + the missing parameters named |
| V4-03 | Question bank: parameter → plain question; answer parsing (platform → aspect, etc.) | `agent/questions.js` | "Instagram story" and "9:16" both fill aspect |
| V4-04 | Guards: types, grid, one reference with priority, exact text, audio strip, cap, refusals | `agent/guards.js` | each guard has a unit case in `tests/guards.test.mjs` |
| V4-05 | Make (tier 1/2): guide → prompt → call → review; image, image edit (1 ref), clip, image-to-video, music, voice, overlay, trim/cut/fade | `agent/make.js`, `agent/guides.js` | the eleven simple items run end to end |
| V4-06 | Video (tier 3): story with setting + paragraphs + per-clip dependency; questions; per-clip calls; last-frame handoff; the independent-clip reference slot; join + voice-over | `agent/video.js` | the three video items run end to end |
| V4-07 | Runner + proxy user: dry (answer sheet, strange scripts, direction change) and full | `agent/run.mjs`, `tests/run.mjs`, `tests/proxy.js` | both modes write records |
| V4-08 | Test items: 11 simple + 3 video, each with vague brief, answer sheet, strange script, full brief, expected tool | `tests/items/*.json` | all 14 present |
| V4-09 | Pages: per item (conversation, sheet with sources, calls, outputs, review) and an index | `tests/page.mjs` | opens in a browser |
| V4-10 | Cost estimate from the catalogue before any full run | `tests/estimate.mjs` | prints per item and total |
