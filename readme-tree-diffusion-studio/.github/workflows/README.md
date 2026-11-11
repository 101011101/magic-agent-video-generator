# `.github/workflows`

GitHub Actions that build, sign, notarize, and publish the desktop app installers, then update the Homebrew cask.

## Parts

| Part | Role |
|---|---|
| `release.yml` | Trigger: push of a `v*` tag. Job `publish-macos` (macos-latest): checks all four `package.json` versions equal the tag, `npm ci`, copies `apps/web/.env.example` to `.env`, imports the P12 signing cert into a temp keychain, runs `npm run publish --workspace=@diffusionstudio/desktop` (sign + notarize + draft GitHub release). Job `publish-windows` (windows-latest, `needs: publish-macos`, environment `release`): same version check, OIDC login to Azure via `azure/login@v2`, locates newest `signtool.exe`, installs `Microsoft.ArtifactSigning.Client` from NuGet, writes `metadata.json`, exports `WINDOWS_SIGNTOOL_PATH`, `WINDOWS_SIGN_DLIB`, `WINDOWS_SIGN_METADATA`, then runs the same `publish` script. |
| `build-windows.yml` | Trigger: manual `workflow_dispatch`. Builds an unsigned Windows installer (`SKIP_SIGN=1`) with `npm run make --workspace=@diffusionstudio/desktop`, uploads `apps/desktop/out/make/squirrel.windows/**` as artifact `diffusion-studio-windows-<arch>`. For test builds only; no publish. |
| `bump-cask.yml` | Trigger: `release` event type `published` (skipped when `prerelease`), or manual. Step `info`: resolves tag (falls back to `releases/latest` API on manual run), rejects any tag not matching `^v[0-9]+\.[0-9]+\.[0-9]+$`, downloads `Diffusion-Studio-arm64.dmg` with retries (release event can fire before the DMG upload finishes), computes sha256. Step `Update tap`: clones `diffusionstudio/homebrew-tap` with `TAP_GITHUB_TOKEN`, `sed`-rewrites `version` and `sha256` in `Casks/editor.rb`, commits as `github-actions[bot]`, pushes. No-op if the cask already has that version. |

## How it works

- Release chain: `scripts/release.mjs` bumps versions, commits, and tags locally. A manual `git push origin HEAD vX.Y.Z` fires `release.yml`.
- Both `release.yml` jobs run the version check first. Any `package.json` version that differs from the tag fails the job.
- `publish-windows` waits for `publish-macos` so both jobs append assets to one draft release instead of racing to create it.
- The `publish` script (`apps/desktop/package.json`) builds main/preload/agent-host/native, builds web, stages cli/runtime/docs, then runs `electron-forge publish`. `forge.config.ts` sets `PublisherGithub({ draft: true })`.
- macOS signing: `forge.config.ts` enables `osxSign` unless `SKIP_SIGN` is set; `osxNotarize` reads `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`.
- Windows signing: `forge.config.ts` `windowsSign()` reads the three `WINDOWS_SIGN*` env vars set by the "Set up Artifact Signing" step and passes `/dlib` and `/dmdf` to signtool. Missing vars throw unless `SKIP_SIGN=1`.
- Squirrel output (`RELEASES`, `.nupkg`, setup exe) lands together on the release; `update-electron-app` in `apps/desktop/src/main.ts` needs all three.
- A maintainer publishes the draft release by hand (Unclear from source: no workflow does this). Publishing fires `bump-cask.yml`.
- `bump-cask.yml` refuses draft placeholder tags (`untagged-<hash>`) and prereleases.

## Interfaces

- Depends on:
  - `scripts/release.mjs` for the tag that triggers `release.yml` ([../../scripts/README.md](../../scripts/README.md)).
  - `apps/desktop/package.json` scripts `make` and `publish`; `apps/desktop/forge.config.ts` for signing, makers (DMG, ZIP, Squirrel), and GitHub publisher ([../../apps/desktop/README.md](../../apps/desktop/README.md)).
  - `apps/web/.env.example` copied to `.env` so the web build has client env.
  - Root `package.json` `postinstall: patch-package` runs during `npm ci` ([../../patches/README.md](../../patches/README.md)).
  - Secrets: `MACOS_CERT_P12`, `MACOS_CERT_PASSWORD`, `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`, `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `TAP_GITHUB_TOKEN`, `GITHUB_TOKEN`. Variables: `ARTIFACT_SIGNING_ENDPOINT`, `ARTIFACT_SIGNING_ACCOUNT`, `ARTIFACT_SIGNING_PROFILE`.
  - External: `diffusionstudio/homebrew-tap` repo, GitHub Releases API, Azure Artifact Signing, NuGet.
  - Comments cite `apps/desktop/WINDOWS.md` for Windows signing setup. That file is absent from this checkout.
- Used by:
  - `apps/desktop/src/main.ts` `updateElectronApp({ repo: "diffusionstudio/editor" })` consumes the published release assets at run time.
  - End users via the Homebrew cask `Casks/editor.rb` in `diffusionstudio/homebrew-tap`.

Up: [../README.md](../README.md)
