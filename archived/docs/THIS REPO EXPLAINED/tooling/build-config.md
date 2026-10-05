# build-config

> Level 2 · Source: `server/package.json`, `server/tsconfig.json`, `frontend/package.json`, `frontend/tsconfig.json`, `frontend/next.config.mjs`, `frontend/postcss.config.js`, `frontend/tailwind.config.ts`, `frontend/components.json` · Up: [Tooling and Config](README.md)

**Purpose:** Package manifests and build config for the two npm projects: `server/` (Fastify + agents backend) and `frontend/` (Next.js UI).

**Role in parent:** Gives `dev.sh` the dependencies it installs, the scripts and entry points it runs, and the Next proxy that joins frontend and backend on one origin.

**Main exports:**
- `server/package.json` — package `openai-sdk-video-agent-server`, `"type": "module"` (ESM).
  - Scripts (each runs through `$npm_node_execpath`, the node binary that runs npm):
    - `dev` — `tsx watch src/index.ts` (restart on change).
    - `start` — `tsx src/index.ts`. No compile step; `tsx` runs TypeScript directly.
    - `typecheck` — `tsc --noEmit`.
    - `test` — `vitest run` over `server/tests/*.test.ts`. No vitest config file.
  - Dependencies → users in `server/src/`:
    - `fastify`, `@fastify/cors`, `@fastify/static` — HTTP server, CORS, `/media` file serving (`index.ts`).
    - `@openai/agents` — agent runtime (`agentRuntime.ts`, `agents.ts`, `usageCost.ts`).
    - `openai` — direct OpenAI calls (`agentRuntime.ts`, `youtubeShort.ts`, `youtubeSubagents.ts`).
    - `magic-hour`, `@msgpack/msgpack` — Magic Hour media SDK (`media.ts`).
    - `execa` — child processes, e.g. ffmpeg (`media.ts`, `mediaSync.ts`, `projects.ts`, `projectContext.ts`, `youtubeShort.ts`).
    - `zod` — schemas (`agents.ts`, `schemas.ts`).
    - `dotenv` — env loading (`config.ts`).
  - Dev: `typescript` ^6, `tsx`, `vitest` ^4, `@types/node`.
- `server/tsconfig.json` — `target`/`lib` `ES2023`, `module`/`moduleResolution` `NodeNext`, `strict`, `noUncheckedIndexedAccess`, `noEmit`. Includes `src/**/*.ts` and `tests/**/*.ts`. Type check only; `outDir: dist` is unused because `noEmit` is set.
- `frontend/package.json` — package `openai-sdk-video-agent-frontend`.
  - Scripts: `dev` (`next dev`), `build` (`next build`), `start` (`next start`). No `test`, `lint`, or `typecheck` script.
  - Dependencies → users:
    - `next` 16.2.6, `react` / `react-dom` 18.3.1 (pinned versions).
    - `@tanstack/react-query` — server state (`components/providers.tsx`, `hooks/use-project.ts`, `hooks/use-project-events.ts`).
    - `sonner` — toasts (`app/layout.tsx`, `app/page.tsx`).
    - `lucide-react` — icons (`components/chat-workspace.tsx`, `components/youtube-review-workspace.tsx`).
    - `@radix-ui/react-slot`, `class-variance-authority` — shadcn `Button` (`components/ui/button.tsx`).
    - `clsx`, `tailwind-merge` — `cn()` class helper (`lib/utils.ts`).
    - `tailwindcss-animate` — Tailwind plugin (loaded in `tailwind.config.ts`).
  - Dev: `typescript` ^5, `tailwindcss` ^3, `postcss`, `autoprefixer`, `@types/*`.
- `frontend/tsconfig.json` — `moduleResolution: bundler`, `jsx: react-jsx`, `strict`, `noEmit`, Next TS plugin. Path alias `@/*` → `./*` (used as `@/components/...`, `@/lib/...`, `@/hooks/...`).
- `frontend/next.config.mjs` — `nextConfig`:
  - `reactStrictMode: true`.
  - `allowedDevOrigins: ["127.0.0.1"]` — permits dev assets when the page loads from `127.0.0.1`.
  - `outputFileTracingRoot` — set to `frontend/`.
  - `rewrites()` — proxies `/api/:path*` and `/media/:path*` to `${BACKEND_INTERNAL_URL}` (default `http://127.0.0.1:8000`).
- `frontend/postcss.config.js` — runs `tailwindcss` then `autoprefixer`.
- `frontend/tailwind.config.ts` — `darkMode: ["class"]`; scans `pages/`, `components/`, `app/`, `src/` for `.ts`/`.tsx`; container centered, `2xl` = `1400px`; shadcn color tokens (`border`, `primary`, `muted`, `card`, ...) as `hsl(var(--token))`; `borderRadius` from `--radius`; accordion keyframes; plugin `tailwindcss-animate`.
- `frontend/components.json` — shadcn/ui CLI config: style `new-york`, `rsc: true`, `tsx: true`, base color `zinc`, CSS variables on, CSS file `app/globals.css`, aliases `@/components` and `@/lib/utils`.

**Internal flow:**
1. `dev.sh` runs `npm install` in `server/` and `frontend/` when `node_modules/` is missing.
2. `dev.sh` starts the backend with `node node_modules/tsx/dist/cli.mjs src/index.ts` (same command as `npm start`, not via npm).
3. `dev.sh` starts the frontend with `node node_modules/next/dist/bin/next dev --hostname ... --port ...` (same as `npm run dev` plus host/port flags).
4. Next compiles `app/globals.css` through PostCSS → Tailwind (using `tailwind.config.ts`) → Autoprefixer.
5. On a same-origin request to `/api/*` or `/media/*`, the Next rewrite forwards it to the backend.

**Depends on:** Node `>=21`, `20.5+`, or `18.18+` (enforced by `dev.sh`); env `BACKEND_INTERNAL_URL` (Next rewrite).

**Used by:** `dev.sh` (install and launch); developers (`npm run typecheck`, `npm test` in `server/`); shadcn CLI (`components.json`); `frontend/lib/api.ts` same-origin mode relies on the rewrites.

**Gotchas:**
- The two projects use different TypeScript majors: `server/` ^6, `frontend/` ^5.
- `frontend/lib/clarifying-questions.test.ts` uses `node:test`, but `frontend/package.json` has no `test` script to run it.
- `tailwind.config.ts` maps colors to CSS vars (`--border`, `--primary`, `--radius`, ...), but `app/globals.css` does not define them. Utility classes that use these tokens resolve to invalid colors.
- Rewrites apply only when the frontend calls same-origin, i.e. `NEXT_PUBLIC_API_BASE_URL` is empty (`SINGLE_ORIGIN_DEMO=true` in `dev.sh`).
