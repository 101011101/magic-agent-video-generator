# runtimeCredentials.ts

> Level 3 · Source: `server/src/runtimeCredentials.ts` · Up: [State and Scheduling](README.md)

**Purpose:** Normalize user-supplied provider keys from requests and keep them per project in process memory only.

**Role in parent:** Gives the server a credential store that is not written to disk. Later runs and chat messages on the same project reuse keys from the first request.

**Main exports:**
- `runtimeCredentialsFromRequest(request)` — Returns a full `RuntimeCredentials` object from `request.runtime_credentials`. Trims each value; empty becomes `null`. Accepts the legacy top-level `openrouter_api_key` when `runtime_credentials.openrouter_api_key` is absent. `null` request gives all-`null` result.
- `rememberProjectRuntimeCredentials(projectId, credentials)` — Merges non-empty values into the module map `PROJECT_CREDENTIALS`. A new non-empty value replaces the stored value. A `null` or empty value does not clear a stored value. Stores nothing if all values are empty.
- `projectRuntimeCredentials(projectId)` — Returns stored keys for the project, with all 9 fields present (missing fields are `null`).
- `runtimeCredentialStatus(credentials)` — Returns `has_<field>` booleans only. Use it to report key presence without leaking the key.

**Credential fields (`RuntimeCredentialsSchema` in `schemas.ts`):** `openai_api_key`, `openrouter_api_key`, `magic_hour_api_key`, `fish_audio_api_key`, `fish_audio_reference_id`, `hume_api_key`, `elevenlabs_api_key`, `elevenlabs_voice_id`, `elevenlabs_voice_name`.

**Precedence over env (applied by callers, not by this file):**
- Request/stored credential first, then `ENV.<NAME>` — for example `credentials.magic_hour_api_key ?? ENV.MAGIC_HOUR_API_KEY` in `projectContext.ts`, and `credentials.openrouter_api_key ?? ENV.OPENROUTER_API_KEY` in `agentRuntime.ts`.
- `missingConfiguration()` in `projects.ts` does not report a required env key as missing when the request supplies the matching credential.

**Depends on:** `CreateProjectRequest`, `ProjectMessageRequest`, `RuntimeCredentials` types from `schemas.ts`. No env access.

**Used by:**
- `index.ts` — `POST /api/projects/:projectId/messages` remembers the body credentials, then passes them to `runProjectMessage`.
- `runners.ts` — `queueProject`, `runProject`, `runProjectMessage` call `rememberProjectRuntimeCredentials`.
- `projectContext.ts` — `context()` reads request credentials; `contextForExistingProject()` reads `projectRuntimeCredentials`; status output uses `runtimeCredentialStatus`.
- `agentRuntime.ts` — `runtimeApiKey()` picks the OpenAI or OpenRouter key.
- `projects.ts` — `missingConfiguration()`.

**Gotchas:**
- The map is in process memory. A server restart loses all stored keys. After a restart, an existing project falls back to env keys unless the next message sends keys again.
- The map has no eviction. Entries stay until the process exits.
- Keys are never persisted: `userPreferencesForRequest()` in `projectContext.ts` removes `runtime_credentials` and `openrouter_api_key` before the request is saved as preferences.
