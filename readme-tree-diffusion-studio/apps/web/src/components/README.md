# `apps/web/src/components`

All SolidJS view code of the editor UI: the editor surfaces (canvas, timeline, left and right sidebars, gen-AI prompt box), the dashboard views, the shared `ui/` widget kit, and app-wide overlays (upgrade dialog, purchase success, environment guards, context menu).

## Parts

| Part | Role |
|---|---|
| [ui/](ui/README.md) | Shared widget kit: shadcn-solid style wrappers over Kobalte (`Button`, `Icon`, `Tooltip`, `Dialog`, `Select`, menus) plus editor controls (`SliderInput`, `ControlledTextField`, `ColorOpacityPicker`, `Keyframe`, `FillItem`, `FloatingInspector`, `AssetThumbnail`). Imported by 444 sites across `apps/web/src`. |
| [canvas/](canvas/README.md) | Center stage: `Canvas` stacks `EngineCanvas` + `CameraController` from `@/engine` under HTML overlays (`Toolbar`, `DrawOverlay`, `SceneInitOverlay`, `ObjectMaskBar`, `ClipPathBar`, `DesktopAppBanner`). Handles drop-to-insert and tool selection via the `Tool` trait. |
| [timeline/](timeline/README.md) | Bottom strip: `Timeline` (`<canvas id="timeline-canvas">` drawn by `engine/timeline`), `Layers` (DOM row column + transport header), `time-format.ts`. Drop at pointer frame inserts assets. |
| [sidebar-left/](sidebar-left/README.md) | Left column: project header (`ProjectMenu`, rename), `Assets` panel (folders, import, drag protocol `ASSET_DRAG_TYPE`) or agent `ChatPanel` by tab. Also `EditorTitleBar` (Windows) and `FloatingProjectHeader`. |
| [sidebar-right/](sidebar-right/README.md) | Right column and mixer: `Inspector` (property panels per selection kind) and `Soundboard` (dB faders, live meters). Read `Computed`/traits, write via `editor.editProperty`. |
| [genai/](genai/README.md) | `PromptInput` and `ActionBar`: build `generate.*` / `transform.*` declarations from `@diffusionstudio/jsx` and insert elements whose `src` is that declaration. Zod `GenerationConfig` schemas and model/voice option tables. |
| [dashboard/](dashboard/README.md) | Views for `pages/dashboard.tsx`: home prompt composer, projects grid, billing/plans/invoices, AI credits, account, settings, MCP/CLI install, help. Shared layout primitives in `shared.tsx`. |
| [assets/](assets/README.md) | `file-name.ts`: `createExpandableFileName` middle-truncation primitive. No importer found in source. |
| `upgrade-dialog.tsx` | `UpgradeDialog` + module-level `showUpgradeDialog()`. Global `Dialog` on an `open` signal. Free user: `ProUpgradeContent` (yearly toggle, credit-tier `Select` over `SUBSCRIPTION_CREDIT_TIERS`, `startSubscriptionCheckout`). Pro user (`auth.isPro()`): `TopupContent` (`TOPUP_CREDIT_TIERS`, `startTopupCheckout`). Tracks `subscription_checkout_*` / `topup_checkout_*` events. |
| `purchase-success.tsx` | `PurchaseSuccess`: full-screen "Thank you for your purchase!" overlay. Shows when `?checkout=success` (browser) or when desktop delivers a `diffusion://` callback with `status=success` via `MAIN_CHANNELS.CHECKOUT_GET_PENDING_CALLBACK` / `CHECKOUT_CALLBACK`. Click clears the param. |
| `screen-too-small.tsx` | `ScreenTooSmall`: fixed overlay, class `screen-too-small`, `hidden` by default. `index.css` shows it under `@media (max-width: 719px), (max-height: 479px)`; text states the 720×480 minimum. |
| `unsupported-browser.tsx` | `UnsupportedBrowser`: shows when `navigator.userAgentData.brands` has no `Chromium` brand (`isChromium()`; server render passes). Directs to Chrome / Edge / Brave / Arc. |
| `app-context-menu.tsx` | `AppContextMenu({ children })`: wraps the whole app in a `ui/context-menu` with Undo / Redo / Cut / Copy / Paste / Select All / Fullscreen / Reload. Edit items use `document.execCommand`; Paste reads `navigator.clipboard` first. |
| `dev-auth-code-input.tsx` | `DevAuthCodeInput`: dev-only (`import.meta.env.DEV && window.desktop`) form to paste a `diffusion://` callback URL or raw code; `extractAuthCode` then `supabase.auth.exchangeCodeForSession`. |

## How it works

- Two consumers assemble these parts: `app.tsx` (global overlays) and `pages/` (editor and dashboard layouts). This directory has no `index.ts`; each subdir with an `index.ts` (`canvas`, `timeline`, `sidebar-left`, `sidebar-right`, `genai`) is its public entry.
- `app.tsx` root: `ColorModeProvider` > `AppContextMenu` > `AuthProvider` > route children + `UpgradeDialog` + `PurchaseSuccess` + `EditorApi`; then `Toaster` (`ui/sonner.tsx`), `EnvironmentOverlays` (`ScreenTooSmall` + `UnsupportedBrowser`, skipped on `/checkout*` paths).
- `pages/editor.tsx` composes the editor grid: `SidebarLeft` | `Canvas` | `Inspector` on top, `Layers` + `Timeline` + `Soundboard` below, `EditorTitleBar` / `FloatingProjectHeader` for chrome. `pages/dashboard.tsx` mounts one `dashboard/*View` per `?dashboard=` value. `pages/login.tsx` embeds `DevAuthCodeInput`.
- Editor surfaces share one state source: the koota `world` (via `@diffusionstudio/koota-solid` hooks) and `useEditor()` from `@/engine`. Reads go through `Computed`, traits, `Cache`; writes go through `editor.editProperty` / `insertElement` / `remove` and `engine/keyframes.tsx`. `canvas`, `sidebar-right`, `genai`, `timeline` all follow this path; none talk to each other directly except through the world.
- Cross-surface links that do exist: `canvas/toolbar.tsx` renders `genai` `PromptInput` / `ActionBar`; `sidebar-left/folder-item.tsx` defines `ASSET_DRAG_TYPE`, read by `canvas`, `timeline`, `genai` for drops; `sidebar-right/inspector/asset-picker.tsx` reuses `sidebar-left` `LazyAssetItem`; `ui/fill-item.tsx` imports `sidebar-right/inspector/gradient-stops.ts`.
- Selection couples the sidebars: `sidebar-left` writes the `AssetSelection` trait; `sidebar-right` inspector reads it. Tool state (`Tool` trait) is set by `canvas/toolbar.tsx` and read by canvas overlays and the inspector.
- Billing loop: `lib/trpc.ts` `paymentRequiredLink` calls `showUpgradeDialog()` on a `PAYMENT_REQUIRED` error; `UpgradeDialog` starts Stripe checkout via `lib/checkout.ts`; return lands in `PurchaseSuccess` (query param in browser, deep link on desktop). `dashboard/plans-view.tsx` and `ai-credits-view.tsx` start the same checkouts from the dashboard.
- Host gating: `window.desktop` / `isDesktop()` / `isWindowsDesktop()` switch desktop-only parts (title bars, projects folder, MCP view, deep-link checkout, `DevAuthCodeInput`) and browser-only promos (`canvas/desktop-app-banner.tsx`, `dashboard/get-desktop-app.tsx`).
- Styling: every part uses Tailwind classes merged by `lib/cva.ts`; icons resolve through `ui/icon.tsx` from `apps/web/src/assets/icons/*.svg`.

## Interfaces

- Depends on:
  - `apps/web/src/engine/` (`useEditor`, `useDerived`, `useSelection`, `useTool`, `useLibrary`, `EngineCanvas`, `CameraController`, `insertAsset`, `asset-actions.ts`, `keyframes.tsx`, `timeline/`, `object-mask/`, `clip-path.ts`) — see [../engine/README.md](../engine/README.md).
  - `apps/web/src/context/` (`auth.tsx`, `prompt-input.tsx`, `layout.tsx`, `project.tsx`, `timeline.tsx`, `export.tsx`).
  - `apps/web/src/lib/` (`checkout.ts`, `trpc.ts`, `supabase.ts`, `ipc.ts` `mainBridge`, `analytics.ts` `track`, `mcp.ts`, `cva.ts`, `store/`, `desktop-app.ts`), `apps/web/src/projects/` (`host.ts`, project CRUD), `apps/web/src/agent-chat/` (`ChatPanel`, `SidebarTabs`, `startChat`, `ModelPicker`), `apps/web/src/hooks/`, `apps/web/src/utils/`, `apps/web/src/dapi/api.tsx` (`useEditorApi`).
  - `@desktop/main-channels` (`MAIN_CHANNELS.CHECKOUT_*`) from `apps/desktop/src`.
  - Packages: `@diffusionstudio/runtime`, `reconciler`, `jsx`, `assets`, `koota-solid`, `sam2`, `koota`; external `solid-js`, `@solidjs/router`, `@kobalte/core`, `somoto`, `zod`, `@diffusionstudio/api-contract` (npm, types only).
- Used by:
  - `apps/web/src/app.tsx`: `AppContextMenu`, `UpgradeDialog`, `PurchaseSuccess`, `ScreenTooSmall`, `UnsupportedBrowser`, `ui/sonner` `Toaster`.
  - `apps/web/src/pages/editor.tsx`: `canvas`, `timeline`, `sidebar-left`, `sidebar-right`. `pages/dashboard.tsx`: `dashboard/*`. `pages/login.tsx`: `DevAuthCodeInput`. `pages/not-found.tsx`, `agent-chat/*`: `ui/*`. See [../pages/README.md](../pages/README.md).
  - `apps/web/src/lib/trpc.ts`: `showUpgradeDialog`. `apps/web/src/context/export.tsx`, `context/render.ts`, `dapi/handlers/export.ts`, `dapi/handlers/models.ts`, `dapi/handlers/voices.ts`, `utils/gen-ai.ts`: option tables and export templates from `sidebar-right/inspector/` and `genai/config.ts`.

Up: [../README.md](../README.md)
