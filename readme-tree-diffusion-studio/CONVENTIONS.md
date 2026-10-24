# README Tree Conventions

- The README tree mirrors the source repo. Source repo (read-only clone): `/private/tmp/claude-501/-Users-ray-Coding-Side-Projects-magic-agent-video-generator/31847966-0ca3-40ec-bf74-2edbbb3394d3/scratchpad/editor`. README tree root: `/Users/ray/Coding/Side Projects/magic-agent-video-generator/readme-tree-diffusion-studio`.
- The README for source dir X lives at `<tree root>/X/README.md`. Root README: `<tree root>/README.md`.
- Each README answers the same questions at its own level of detail:
  1. What does this directory build? (its end product / role in the whole Diffusion Studio editor)
  2. What are its subsystems (child dirs and key files), and what does each do?
  3. How do these parts work together to produce the end product (data/control flow)?
  4. Interfaces: what it depends on, what uses it (with repo paths).
- Higher levels stay high-level; deeper levels get specific (name real files, functions, types).
- Format (keep headings minimal, exactly these):
  - `# \`<repo path>\``
  - One-line purpose statement.
  - `## Parts` — Table: `| Part | Role |` with child dirs linked as `[name/](name/README.md)` and key files as `` `file.ts` ``.
  - `## How it works` — Bullets describing flow between parts. Short sentences, active voice.
  - `## Interfaces` — Bullets: Depends on / Used by, with repo paths (link to other README tree nodes via relative links where useful).
  - Footer line: `Up: [../README.md](../README.md)` (omit on root).
- Style: bullets, no narrative prose, no filler, dense. Simplified Technical English.
- Every claim must be grounded in the source code you read. Do not invent. If unsure, say "Unclear from source" rather than guess.
- Pure asset folders (icons, fonts, images, brand media, vendor binaries) have no own README: describe them as one row in the parent README.
