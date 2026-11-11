# renderState.ts

> Level 3 · Source: `server/src/renderState.ts` · Up: [State and Scheduling](README.md)

**Purpose:** Read and write per-project JSON artifacts and `project_state.json` in `ctx.project_dir`. Merge scene asset lists and scene failure lists for retries.

**Role in parent:** The single file-state layer for one project. Other modules call it and do not touch the JSON files directly.

**Main exports:**
- `artifactPath(ctx, name)`: Returns `<ctx.project_dir>/<name>.json`. The name `manifest` maps to `manifest.json`.
- `readJsonArtifact(ctx, name, defaultValue = null)`: Parses the file. Returns `defaultValue` if the file does not exist.
- `writeJsonArtifact(ctx, name, payload)`: Creates the directory, writes pretty JSON (2-space indent), and returns `payload`.
- `removeJsonArtifact(ctx, name)`: Deletes the file. Ignores all errors.
- `PROJECT_STATE_VERSION` (`1`), `utcNow()` (ISO timestamp), `JsonDict` (`Record<string, any>`).
- `defaultProjectState(ctx, { user_preferences, provider_settings })`: Builds the initial state shape:
  - `version`, `project_id`, `created_at`, `updated_at`
  - `status { stage: "initialized", progress: 0, message }`
  - `user_preferences`, `provider_settings`, `current_plan: null`, `timeline: null`
  - `scene_assets { voiceover, images[], videos[], final_video_path, final_image_path, manifest_path }`
  - `failures[]`, `decisions[]`, `messages[]`
- `normalizeProjectState(ctx, state)`: Fills missing keys from the defaults. Forces `project_id = ctx.project_id`. Shallow-merges `status` and `scene_assets`. Runs `normalizeTimeline` on `timeline`. Copies the arrays.
- `initializeProjectState(ctx, options)`: Writes the default state to `project_state.json`.
- `readProjectState(ctx)`: Returns the normalized state. Returns the defaults if the file does not exist. It does not write the file.
- `writeProjectState(ctx, state)`: Normalizes the state, sets `updated_at`, and writes it.
- `updateProjectState(ctx, options: UpdateProjectStateOptions)`: Does read, patch, and write in one call (see Internal flow).
- `appendProjectDecision(ctx, { decision, rationale?, scene_id?, tool?, metadata? })`: Appends an entry to `decisions` through `updateProjectState`. Returns the new entry.
- `appendProjectMessage(ctx, { role, content, metadata? })`: Appends `{ created_at, role, content }` to `messages`. Returns the entry.
- Scene retry helpers. These are pure functions on arrays keyed by `scene_id`:
  - `upsertSceneAssets(existing, replacements)`: Replaces or adds assets by `scene_id`.
  - `orderedSceneAssets(plan, assets)`: Sorts assets in `plan.scenes` order. Drops assets whose scene is not in the plan.
  - `clearSceneFailures(failures, sceneIds, stages = null)`: Removes the failures that match the scene IDs and, if `stages` is given, the stages.
  - `recordSceneFailures(existing, failures)`: Removes old failures for the same scene and stage pairs, then appends the new failures.

**Internal flow (`updateProjectState`):**
1. Call `readProjectState` to get the normalized state.
2. `status`: Merge into the state. If the new status has `status === "succeeded"` or `stage === "complete"` and no `error` key, delete `status.error`.
3. `user_preferences` and `provider_settings`: Merge when the value is not null.
4. `current_plan`, `voiceover`, `images`, `videos`, `failures`, `final_video_path`, `final_image_path`, `manifest_path`, and `timeline`: Set when the key is present in `options` (`hasOwnProperty`). An explicit `null` or `undefined` value clears the field.
5. `manifest`: Copy `manifest_path`, `final_video_path`, and `final_image_path` into `scene_assets`. Set `failures` to `failed_scenes`.
6. `decision`: Append the entry with `created_at`.
7. Call `writeProjectState`.

**Depends on:**
- `node:fs`, `node:path`
- `ProjectContext` from `./context.js`
- `VideoPlan` from `./schemas.js`
- `normalizeTimeline` from `./timeline.js`
- `ctx.project_dir` normally resolves under `OUTPUT_DIR` (`outputs/` by default, set in `config.ts`).

**Used by:**
- `workflows.ts`: Artifacts, state updates, decisions, and all scene retry helpers. Image and video generation, recovery, and single-scene regeneration use the helpers in the pattern `orderedSceneAssets(plan, upsertSceneAssets(...))` plus `clearSceneFailures` and `recordSceneFailures`. Reset calls `removeJsonArtifact`.
- `projectContext.ts`: `initializeProjectState`, `readProjectState`, `artifactPath`
- `runners.ts`, `agents.ts`, `projects.ts`, `prompts.ts`, `index.ts`: Read and update state, and append messages.
- `timings.ts`: `readJsonArtifact` and `writeJsonArtifact`
- `usageCost.ts`: `JsonDict` type only

**Gotchas:**
- There is no file locking. Each read-modify-write is not atomic, so concurrent writers to the same project can lose updates.
- `readJsonArtifact` throws on invalid JSON. Only a missing file returns the default.
- In `updateProjectState`, `status`, `user_preferences`, `provider_settings`, `manifest`, and `decision` use a `!= null` check. The other keys use presence, so `{ images: undefined }` clears `images`.
- `appendProjectMessage` does not call `updateProjectState`. It reads and writes the state directly.
