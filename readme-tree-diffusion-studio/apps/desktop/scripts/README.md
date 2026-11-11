# `apps/desktop/scripts`

Build-time helper scripts for the Electron app: compile the macOS native addon, stage app resources (CLI, runtime deps, docs) for electron-forge, and regenerate platform icons/installer art.

## Parts

| Part | Role |
|---|---|
| `build-native.mjs` | `npm run build:native`. macOS only (exits 0 elsewhere). Runs `clang` on `src/native/corner_radius.m` to produce `dist/corner_radius.node`: universal (`arm64` + `x86_64`), `-dynamiclib`, `-undefined dynamic_lookup` (Node-API symbols resolve from the Electron binary), `-fobjc-arc`, AppKit + QuartzCore frameworks, `-mmacosx-version-min=11.0`, `-DNAPI_VERSION=8`, `-Wall -Werror`. |
| `stage-cli.mjs` | `npm run stage:cli` (after `apps/cli` build). Deletes and recreates `apps/desktop/cli/`. Copies `apps/cli/dist/index.js` to `cli/dapi.js`. Writes `cli/bin/dapi` (POSIX sh wrapper, mode 0755): resolves symlinks, exports `DIFFUSION_APP_PATH`, runs `../../../MacOS/Diffusion Studio` with `ELECTRON_RUN_AS_NODE=1` on `dapi.js`. Writes `cli/bin/dapi.cmd` (Windows batch wrapper) that runs `..\..\..\Diffusion Studio.exe` the same way. Host platform picks which wrapper; `--all` writes both. |
| `stage-runtime.mjs` | `npm run stage:runtime`. Deletes and recreates `apps/desktop/runtime/`. Parses `--external:<name>` flags out of the `build:main` script in `package.json` (drops `electron`), pins each to the installed workspace version via `require(name + '/package.json').version`, writes `runtime/package.json` (`name: desktop-runtime`), runs `npm install --omit=dev --no-audit --no-fund --no-package-lock` via `scripts/lib/npm.mjs`. On macOS (unless `SKIP_SIGN`) finds a `Developer ID Application` identity with `security find-identity` and `codesign --options runtime --timestamp` every Mach-O `esbuild` binary (`node_modules/esbuild/bin/esbuild`, `node_modules/@esbuild/*/bin/esbuild`); `isMachO()` checks the 4-byte magic. |
| `stage-docs.mjs` | `npm run stage:docs`. Deletes and recreates `apps/desktop/docs/`. Recursively copies repo `docs/` as-is (filters `.DS_Store`, `.gitkeep`) so relative links between pages keep working. |
| `make-icns.sh` | `npm run make:icns`. Uses `sips` to resize `assets/icon.png` (1024x1024) into a `.iconset` at 16/32/128/256/512 plus `@2x`, then `iconutil -c icns` to write `assets/icon.icns`. |
| `win-assets.py` | `npm run make:ico` / `npm run make:spinner` (no arg: both). Pillow script. `make_ico()`: from `assets/icon-win.png` (must be 1024x1024) builds `assets/icon.ico` with sizes 256..16; >=40px are Lanczos downscales (`scaled_frame`, unsharp mask <=128px), <=32px are drawn from scratch (`drawn_frame`: red rounded square, white hexagon ring); 256px entry is PNG, others 32-bit BGRA DIB (`dib()`). `make_spinner()`: renders `assets/install-spinner.gif` (440x280, 20fps, 2.4s loop): white background, 88px icon, label "Installing Diffusion Studio" in Geist Medium (`WIN_ASSETS_FONT` or `~/Library/Fonts/Geist-Medium.ttf`), eased indeterminate bar in `BLUE (0,140,255)`; single shared 128-color palette, background slot pinned to exact white. |

## How it works

- `npm run build` in `apps/desktop` ends with `build:native` -> `build-native.mjs` writes `dist/corner_radius.node`.
- `npm run package` / `make` / `publish` run `build`, `build:web`, then `stage:cli`, `stage:runtime`, `stage:docs` before `electron-forge`.
- The three `stage-*.mjs` scripts each wipe and refill a sibling folder (`cli/`, `runtime/`, `docs/`) under `apps/desktop`.
- `forge.config.ts` `packagerConfig.extraResource: ['./cli', './runtime', './docs']` ships those folders as `Contents/Resources/{cli,runtime,docs}` (macOS) / `resources\{cli,runtime,docs}` (Windows).
- The packaged main process has no `node_modules`; everything bundles into `dist/main.js` except the `build:main` externals. `stage-runtime.mjs` derives its dependency list from that same script string so the two cannot drift.
- Icon scripts are manual, run only when a source PNG changes; outputs are committed under `assets/`.

## Interfaces

- Depends on:
  - `apps/desktop/package.json` (`build:main` externals string, npm script entry points).
  - `apps/desktop/src/native/corner_radius.m` (addon source, `NAPI_MODULE(corner_radius, Init)`).
  - `apps/cli/dist/index.js` (bundled CLI; built by `apps/cli` `npm run build`). See [../../cli/README.md](../../cli/README.md).
  - Repo `docs/` tree (staged verbatim). See [../../../docs/README.md](../../../docs/README.md).
  - `scripts/lib/npm.mjs` (repo root; cross-platform `npm` exec wrapper). See [../../../scripts/README.md](../../../scripts/README.md).
  - `apps/desktop/assets/icon.png`, `assets/icon-win.png` (icon sources).
  - System tools: `clang` (macOS SDK), `sips`, `iconutil`, `security`, `codesign`, `python3` + Pillow, Geist Medium font.
- Used by:
  - `apps/desktop/forge.config.ts` (`extraResource`, `setupIcon: ./assets/icon.ico`, `loadingGif: ./assets/install-spinner.gif`, `icon: ./assets/icon.icns`). See [../README.md](../README.md).
  - `apps/desktop/src/main.ts:88` loads `dist/corner_radius.node`; `main.ts` `docsDir()` reads `process.resourcesPath/docs` when packaged and passes it to `DapiServer`.
  - `apps/desktop/src/projects.ts` `load()` creates a `require` from `process.resourcesPath/runtime/package.json` to load `esbuild` and babel when packaged.
  - `apps/desktop/src/mcp-install.ts` `dapiBinary()` registers `process.resourcesPath/cli/bin/dapi` as the agents' MCP command (macOS).
  - `apps/desktop/src/cli-install.ts` `installCliDarwin()` symlinks `cli/bin/dapi` into PATH.
  - `apps/desktop/src/cli-windows.ts` `stagedScript()` points Windows shims at `resources\cli\dapi.js` (Squirrel moves the install folder, so `cli/bin/dapi.cmd` is not used for PATH there).
  - CI: `.github/workflows/release.yml` (`npm run publish --workspace=@diffusionstudio/desktop`), `.github/workflows/build-windows.yml` (`npm run make`, `SKIP_SIGN=1`).

Up: [../README.md](../README.md)
