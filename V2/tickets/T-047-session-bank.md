# T-047 · The session bank: references that persist across runs, with provenance, as files plus an index

status:     open
priority:   high
subsystem:  agent, assets, state

what:
A bank at the session level, so a reference made or found once is reused by every later run and every small job in
the session, and so the agent can fill it by research before a film or a composed job starts.

1. **Where it lives: files on disk, with one index file. Not a database.** `sessions/<id>/bank/<element-id>/`
   holds the reference picture(s), the voice sample, the look line and the provenance (`record.json`: source
   `user | research | generated`, the Commons page, licence, artist and date for a found picture, the prompt and
   style reference for a generated one, the material name for a user record, the hash of the file). `bank.json` at
   the session root indexes the elements (id, kind, name, aka, look, files, source, when, which runs used it).
   The reasons: every reference IS a file the tools must upload; the job layer keys its cache on file hashes, so
   the file is the identity; a person can open the folder and see what the agent believes; git tracks the index and
   the records and ignores the media, as the run folders already do. A database adds nothing for one session and
   costs the audit. If a later version needs search across many sessions (every F-35C reference ever picked), a
   SQLite index over the same files is the step, and nothing in the folder layout changes.
2. **How it fills.** The assets stage (`02-assets.md`) runs against the session bank first: an element with a
   matching id or name takes the bank's record instead of searching or generating; a miss falls through to the
   three-way source (research → Commons with the vision pick and provenance; user → ask for the material; invented
   → generate with the style reference) and the result is written into the bank. A small job that supplies a
   picture of a person or a product writes it as that element's user record. The film run's `refs/` and `roots/`
   become links or copies from the session bank, so the run folder stays self-contained for the results pages.
3. **In the tree and the directory.** `bank/` is a folder in the sidebar between `materials/` and `assets/`; each
   element a node typed ref, plate or sheet with its provenance in the explain line; a still takes the bank node,
   not a run-local copy, so the dependents of a reference span runs. Replacing a reference in the bank marks every
   still that took it stale across the runs that used it (T-045), and re-run remakes only those.
4. **Research before the job.** For a composed job or a film, the sheet's `materials` answer and the elements the
   plan names are checked against the bank before planning; what is missing and researchable is fetched (zero
   credits for Commons) and shown as bank nodes in the proposed tree, so the user audits the references before
   anything is painted.

why:
The user's question of 2026-10-31: the directories need a section for the asset bank the model may fill by
research, especially for the film composer; today the bank lives only inside each run folder and is rebuilt or
reused by id from one earlier run (`--reuse`), never shared across the session's jobs.

acceptance:
Two film runs in one session share the character sheets and plates through the bank with no second generation
(the ledger shows the saving); a small job's supplied product photo appears as a user record and the next
composed job takes it without asking; the sidebar shows `bank/` with provenance on every node; replacing one
sheet marks the right stills stale in both runs.
