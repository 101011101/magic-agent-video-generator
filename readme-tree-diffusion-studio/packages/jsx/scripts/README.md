# `packages/jsx/scripts`

npm lifecycle hooks that swap `package.json` `exports` from `src/*.ts` to `dist/*.js` for the published tarball, then restore them.

## Parts

| Part | Role |
|---|---|
| `prepack.mjs` | Runs on `npm pack`/`npm publish` (`prepack` script). Copies `package.json` to `package.json.orig`. Rewrites `exports` for `.`, `./jsx-runtime`, `./jsx-dev-runtime` to `{ types: ./dist/*.d.ts, default: ./dist/*.js }`. Writes `package.json` back. |
| `postpack.mjs` | Runs after the tarball is built (`postpack` script). Renames `package.json.orig` back to `package.json`, restoring the `src` exports. |

## How it works

- Workspace consumers (Vite in `apps/web`, `apps/desktop`) import `@diffusionstudio/jsx` straight from `src/*.ts`, so the committed `package.json` points `exports` at `./src/index.ts` and `./src/jsx-runtime.ts`.
- npm ignores `publishConfig` overrides of `exports`, so `prepack.mjs` rewrites the field in place before the tarball is read.
- `prepublishOnly` runs `tsc -p tsconfig.build.json` first, which emits `dist/*.js` and `dist/*.d.ts` (`declaration: true`, `rootDir: src`, `outDir: dist`).
- The tarball ships only `dist` (`files: ["dist"]`) with `exports` pointing at it.
- `postpack.mjs` restores the original file so the workspace keeps resolving `src`.

## Interfaces

- Depends on: `node:fs` only. Reads/writes `packages/jsx/package.json` and `packages/jsx/package.json.orig`.
- Used by: npm lifecycle (`prepack`, `postpack` in `packages/jsx/package.json`). No other repo code imports these files.
- Sibling: [../src/](../src/README.md) is what `tsc` builds into `dist`.

Up: [../README.md](../README.md)
