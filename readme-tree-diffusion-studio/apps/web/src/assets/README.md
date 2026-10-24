# `apps/web/src/assets`

Static media bundled into the editor UI: the SVG icon set, the two UI typefaces, and PNG images. No code lives here; every file is consumed by Vite at build time.

## Parts

| Part | Role |
|---|---|
| `icons/` | 282 SVG icons, one file per icon name (no README; pure assets). Most are 24x24 `viewBox="0 0 24 24"` with `fill="none"` paths that use `currentColor` (266 of 282), so CSS text color tints them. Naming groups by prefix: `tool.*` (canvas tools), `text.*` (text alignment/spacing), `anchor-align-*`, `corner-radius-*`, `keyframe-*`, `controls-*` (transport bar), `prop-*` (inspector fields), `object-mask.*`, `fill.*`, `aspect-ratio-*`, `cursor-rotate-*`, `bar-*` (panel toggles), `agent.*` (MCP agent logos: Claude Code, Codex, Cursor, Windsurf, Antigravity, Gemini CLI, OpenCode, VS Code Copilot), `large-*` (gen-AI provider logos: BFL, ByteDance, ElevenLabs, Google, Hailuo, Kling, OpenAI, Wan; 32x32), `social.*` (Apple, GitHub, Google sign-in), `diffusion-logo*` / `ds-mark-vector` / `logo-black` (brand). |
| `fonts/` | 3 variable TTF files (no README; pure assets). `Inter-VariableFont_opsz,wght.ttf` and `Inter-Italic-VariableFont_opsz,wght.ttf` (UI sans, weight 100-900, optical sizing). `JetBrainsMono-VariableFont.ttf` (mono, weight 100-900). |
| [images/](images/README.md) | PNG images imported by URL: the desktop-app promo banner, 18 voice-picker avatars in `voice-thumbnails/`, and two unreferenced placeholder frames. |

## How it works

- Icons:
  - `apps/web/src/components/ui/icon.tsx` calls `import.meta.glob('/src/assets/icons/*.svg', { eager: true })`. `vite-plugin-solid-svg` (`apps/web/vite.config.ts`, `defaultAsComponent: true`) turns each SVG into a SolidJS component, so all 282 icons ship in the main bundle.
  - `<Icon name="play" />` looks up `/src/assets/icons/${name}.svg` in the glob map and renders it with `size-6 shrink-0` plus the caller's `class`. An unknown name renders nothing (no error).
  - The `name` string is the file basename without `.svg`, including dots (`"agent.claude-code"`, `"tool.ellipse"`). Config tables store these names as data: `AGENT_ICONS` in `apps/web/src/lib/mcp.ts` (agent id -> `agent.*` icon), model entries `icon: "large-*"` in `apps/web/src/components/genai/config.ts`, `CURSOR_TOOLS` in `apps/web/src/components/canvas/toolbar.tsx`, mask ops in `canvas/object-mask-bar.tsx`, alignment/aspect items in `sidebar-right/inspector/*.tsx`.
  - 78 source files import `Icon`; nothing imports an SVG file directly.
- Fonts:
  - `apps/web/src/index.css` declares three `@font-face` rules with relative `url('./assets/fonts/...')`. Vite hashes and emits the TTFs.
  - Tailwind 4 `@theme inline` maps `--font-sans` to `'Inter'` and `--font-mono` to `'JetBrains Mono'`, so `font-sans` / `font-mono` utilities resolve to these files. JetBrains Mono sets `font-feature-settings: 'zero' 1` (slashed zero).
- Images: consumers build URLs with `new URL("@/assets/images/<file>", import.meta.url).href`; `@` -> `src` alias in `vite.config.ts`. See [images/README.md](images/README.md).
- Build: no file here is served as-is. Vite emits hashed copies into `dist/` (`build`) or `../desktop/web/` (`build:desktop`). Files that must keep a fixed path (favicon, OG image, logo marks) live in `apps/web/public/` instead.

## Interfaces

- Depends on:
  - Vite asset pipeline, `@` alias, `vite-plugin-solid-svg` (`apps/web/vite.config.ts`).
  - Tailwind 4 theme tokens in `apps/web/src/index.css`.
- Used by:
  - `apps/web/src/components/ui/icon.tsx` (icons). See [../components/ui/README.md](../components/ui/README.md).
  - `apps/web/src/index.css` (fonts).
  - `apps/web/src/components/canvas/desktop-app-banner.tsx`, `apps/web/src/components/genai/config.ts` (images). See [../components/canvas/README.md](../components/canvas/README.md), [../components/genai/README.md](../components/genai/README.md).
  - Icon-name tables: `apps/web/src/lib/mcp.ts` (`AGENT_ICONS`), `apps/web/src/components/genai/config.ts` (`icon: "large-*"`).
- Sibling: `apps/web/public/` holds static files copied unhashed (see [../../public/README.md](../../public/README.md)).

Up: [../README.md](../README.md)
