# `.github`

GitHub Actions CI: builds and signs the desktop installers into a draft GitHub release on a version tag, and updates the Homebrew cask after the release is published.

## Parts

| Part | Role |
| --- | --- |
| [workflows/](workflows/README.md) | Three workflows. `release.yml`: on `v*` tag push, build + sign + notarize macOS DMG, then build + sign Windows Squirrel installer, both into one draft GitHub release. `bump-cask.yml`: on release published (non-prerelease) or manual dispatch, download the arm64 DMG, compute sha256, commit new version/sha to `diffusionstudio/homebrew-tap` `Casks/editor.rb`. `build-windows.yml`: manual dispatch, unsigned Windows installer (`SKIP_SIGN=1`) uploaded as a workflow artifact for testing. |

## How it works

- `scripts/release.mjs` creates the `vX.Y.Z` tag locally; pushing it triggers `release.yml`.
- `release.yml` `publish-macos`: verifies `version` in `package.json`, `apps/desktop`, `apps/cli`, `apps/web` equals the tag; `npm ci`; copies `apps/web/.env.example` → `.env`; imports `MACOS_CERT_P12` into a temp keychain; runs `npm run publish --workspace=@diffusionstudio/desktop` with `APPLE_ID`/`APPLE_PASSWORD`/`APPLE_TEAM_ID` for notarization.
- `release.yml` `publish-windows` (`needs: publish-macos`, environment `release`, OIDC `id-token: write`): same version check and env copy; `azure/login@v2`; locates newest SDK `signtool.exe`, installs `Microsoft.ArtifactSigning.Client` dlib, writes `metadata.json`; exports `WINDOWS_SIGNTOOL_PATH`, `WINDOWS_SIGN_DLIB`, `WINDOWS_SIGN_METADATA`; runs the same `npm run publish`. Sequencing avoids two jobs racing to create the draft release.
- `apps/desktop/forge.config.ts` reads those env vars (`windowsSign()`), skips `osxSign`/Windows signing when `SKIP_SIGN` is set, enables `osxNotarize` only when all three Apple vars exist, and publishes with `draft: true`.
- `bump-cask.yml`: refuses tags not matching `^v[0-9]+\.[0-9]+\.[0-9]+$`; retries the DMG download (release event can fire before upload completes); `sed`s `version` and `sha256` into the cask; pushes with `TAP_GITHUB_TOKEN`; no-op if unchanged.
- A maintainer publishes the draft release by hand (no workflow does this). Publishing fires `bump-cask.yml`.
- `build-windows.yml`: `npm run make --workspace=@diffusionstudio/desktop` with `SKIP_SIGN=1`; uploads `apps/desktop/out/make/squirrel.windows/**`.

## Interfaces

- Depends on: `apps/desktop/package.json` scripts (`make`, `publish`), `apps/desktop/forge.config.ts` (signing, makers, GitHub publisher), `apps/web/.env.example`, root and app `package.json` versions, root `postinstall: patch-package` during `npm ci` ([../patches/README.md](../patches/README.md)), secrets (`MACOS_CERT_P12`, `MACOS_CERT_PASSWORD`, `APPLE_*`, `AZURE_*`, `TAP_GITHUB_TOKEN`, `GITHUB_TOKEN`) and repo vars (`ARTIFACT_SIGNING_ENDPOINT|ACCOUNT|PROFILE`). Workflows cite `apps/desktop/WINDOWS.md` for setup; that file is not present in this clone.
- Used by: GitHub release pipeline; `apps/desktop/src/main.ts` `updateElectronApp()` (reads the published release assets); `diffusionstudio/homebrew-tap` (external repo); [../scripts/README.md](../scripts/README.md) (`release.mjs` produces the triggering tag).
- Related tree nodes: [../apps/desktop/README.md](../apps/desktop/README.md).

Up: [../README.md](../README.md)
