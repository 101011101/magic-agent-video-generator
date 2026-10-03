# inputMedia.ts

> Level 3 · Source: `server/src/inputMedia.ts` · Up: [API and Transport](README.md)

**Purpose:** Store user-uploaded image or audio files on disk and resolve an upload id back to its file path.

**Role in parent:** Gives the `POST /api/input-media` route its storage step. Gives the workflow tools a safe id-to-path lookup for uploaded inputs.

**Main exports:**
- `storeInputMedia(body, name, mimeType)` — Validates the upload, writes it to `<OUTPUT_DIR>/input_media/<id><ext>`, returns an `InputMedia` record (`id`, `kind`, `name`, `mime_type`, `url`).
- `inputMediaPath({ id })` — Checks `id` against `/^[a-f0-9]{32}$/`, finds the matching file in `<OUTPUT_DIR>/input_media/`, returns its absolute path.
- Internal helper `extensionFor(name, mimeType)` — Uses the file name extension if it matches `/^\.[a-z0-9]{1,8}$/`. Else it builds the extension from the MIME subtype (non-alphanumeric characters removed, max 8 chars). Else it returns no extension.

**Internal flow (`storeInputMedia`):**
1. Reject an empty body or a body larger than 30 MB (`MAX_INPUT_BYTES`).
2. Set `kind` from the MIME prefix: `image/` → `"image"`, `audio/` → `"audio"`. Reject all other types.
3. Make `id` from `randomUUID()` with dashes removed (32 hex chars).
4. Create `<OUTPUT_DIR>/input_media/` if missing. Write the file as `<id><ext>`.
5. Return `name` as the basename of the given name, cut to 200 chars (fallback: stored file name). Return `url` as `/media/input_media/<filename>`.

**Internal flow (`inputMediaPath`):**
1. Reject an `id` that is not 32 lowercase hex chars (blocks path traversal).
2. Find a directory entry equal to `id` or that starts with `<id>.`.
3. Throw `Uploaded media <id> is no longer available.` if no entry matches.

**Depends on:** `OUTPUT_DIR` from `./config.js` (env `OUTPUT_DIR`, default `<ROOT>/outputs`). `InputMedia` type from `./schemas.js` (`InputMediaSchema`).

**Used by:**
- `server/src/index.ts` — `POST /api/input-media` calls `storeInputMedia` with the raw body, the decoded `x-file-name` header, and the `content-type` header. Frontend caller: `uploadInputMedia(file)` in `frontend/lib/api.ts`.
- `server/src/workflows.ts` — `generateVoiceoverImpl` calls `inputMediaPath` for the first uploaded audio and copies it to `<project>/voiceover/uploaded<ext>`. `generateSceneImagesImpl` calls `inputMediaPath` to map each uploaded image id to its path.

**Gotchas:**
- `url` works because `index.ts` serves `OUTPUT_DIR` statically under `/media/`.
- The functions throw plain `Error`, not `HttpError`. The server error handler returns these as HTTP 500 with `{ detail }`.
- The 30 MB check duplicates the `bodyLimit` of the `image/*` and `audio/*` content-type parsers in `index.ts`.
- No cleanup exists. Files stay in `input_media/` until removed by hand. `inputMediaPath` throws if a file was removed.
- Project requests reference uploads through `input_media` (max 10 items per `CreateProjectRequest`).
