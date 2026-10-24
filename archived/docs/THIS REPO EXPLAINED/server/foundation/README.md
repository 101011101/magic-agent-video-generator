# Foundation

> Level 2 · Up: [Server](../README.md)

**End product:** The shared base layer that every server subsystem imports. It supplies environment values and constants, the per-project settings shape (`ProjectContext`), and the Zod schemas for HTTP bodies and agent plans. It has no business logic and makes no provider calls.

**Parts:**
- [config.md](config.md) — `config.ts`: merges `.env` and `process.env` into `ENV`, creates `OUTPUT_DIR`, lists required keys and commands, holds model defaults, TTS pace constants, and OpenAI pricing.
- [context.md](context.md) — `context.ts`: the `ProjectContext` interface (project identity, output format, API keys, agent/image/video/audio/voice choices) and `PROJECT_CONTEXT_DEFAULTS`.
- [schemas.md](schemas.md) — `schemas.ts`: Zod request schemas, `VideoPlanSchema` / `SceneSchema`, YouTube script plan schemas, enum lists, and Magic Hour model capability tables.

**How the parts work together:**
1. The three files do not import each other. `config.ts` and `context.ts` have no internal imports. `schemas.ts` imports only `VOICE_KEYS` from `voices.ts`.
2. `index.ts` (api-and-transport) validates each request body with a schema from `schemas.ts` (for example `CreateProjectRequestSchema`).
3. `projectContext.ts` (state-and-scheduling) joins the three parts. `context(projectId, request)` takes a parsed `CreateProjectRequest`, reads fallbacks from `ENV` and model defaults from `config.ts`, checks resolutions against `MAGIC_IMAGE_MODEL_RESOLUTIONS`, and returns a `ProjectContext`.
4. `projects.ts` (state-and-scheduling) uses `REQUIRED_ENV_KEYS` and `REQUIRED_SYSTEM_COMMANDS` for readiness checks, and `PROJECT_CONTEXT_DEFAULTS` for `bareContext()`.
5. Downstream modules (agents, workflows, media, prompts) receive the `ProjectContext` and use `VideoPlan` / `Scene` types. Agents use plan schemas as tool parameters and output types. `workflows.ts` parses plans with `VideoPlanSchema` and snaps values to the capability tables.

**Key contracts:**
- Import paths: `./config.js`, `./context.js`, `./schemas.js`.
- Env precedence: per-request `runtime_credentials` > `process.env` > `<ROOT>/.env`. `ENV` is a snapshot at import time.
- Importing `config.ts` has side effects: it creates `OUTPUT_DIR` (default `<ROOT>/outputs`) and edits `process.env`.
- `ProjectContext` is built in `projectContext.ts`, not here. Its defaults exist in two places (`PROJECT_CONTEXT_DEFAULTS` and an inline literal in `contextForExistingProject`), and they already differ.
- Plan schemas follow the Agents SDK strict-schema rule: optional fields are `.nullable().default(null)`.
- A `ZodError` from a route `.parse()` returns HTTP 500, not 400.
