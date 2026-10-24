# `apps/web/public`

Static files Vite copies verbatim to the web build root (`/`): brand marks, social preview image, and two browser-to-desktop deep-link bridge pages.

## Parts

| Part | Role |
|---|---|
| `mark.svg` | Favicon. 120x120 rounded square, brand red `#EC4021`, white hexagonal ring mark. Linked from `apps/web/index.html:5` (`<link rel="icon">`). |
| `og-default.png` | 1200x630 social preview. Set as `og:image` and `twitter:image` in `apps/web/index.html:62,67`. |
| `mark-macos-small.png` | 128x128 macOS-style app icon. Shown in the Pro upgrade dialog (`apps/web/src/components/upgrade-dialog.tsx:102`) and the dashboard "Get desktop app" footer (`apps/web/src/components/dashboard/get-desktop-app.tsx:45`). |
| `mark-large.png` | 80x80 logo mark. No reference found in source. |
| `permission-dialog-header.png` | 537x455 image. No reference found in source. |
| `vite.svg` | Vite scaffold logo. No reference found in source. |
| `auth/electron-callback.html` | OAuth/OTP return page for the desktop app. Merges URL query params and `#hash` params, then redirects to `diffusion://auth/callback?<params>`. |
| `checkout/electron-callback.html` | Stripe return page for the desktop app. Forwards URL query params (`status=success` or `status=cancel`) to `diffusion://checkout/callback?<params>`. |

## How it works

- Vite serves this dir at the site root. Code references files by absolute path (`/mark.svg`, `/og-default.png`, `/mark-macos-small.png`). No import or hashing.
- `apps/web/vercel.json` rewrites only dot-free paths to `index.html`. `*.html` paths here bypass the SPA rewrite and load as static pages.
- Both callback pages exist because the desktop app (Electron) cannot receive an HTTPS redirect. External services redirect to `https://app.diffusion.studio/...` in the system browser; the page then hands off to the `diffusion://` custom scheme, which the OS routes to the desktop app.
- Auth flow (desktop only):
  - `apps/web/src/context/auth.tsx:63` sets `ELECTRON_AUTH_REDIRECT = 'https://app.diffusion.studio/auth/electron-callback.html'`.
  - `signInWithOAuth` passes it as `redirectTo` with `skipBrowserRedirect: true`, then opens the Supabase URL in the system browser via `MAIN_CHANNELS.APP_OPEN_EXTERNAL`. `signInWithOtp` passes it as `emailRedirectTo`.
  - Supabase redirects to `auth/electron-callback.html`. The page merges query and hash params (Supabase can return `code` in either) and redirects to `diffusion://auth/callback?...`. A fallback "Open the app" link carries the same target.
  - `apps/desktop/src/main.ts` registers `diffusion` via `app.setAsDefaultProtocolClient`. `deepLinkChannel()` maps hostname `auth` to `MAIN_CHANNELS.AUTH_CALLBACK`. `deliverDeepLink()` parks the URL in `pendingDeepLinks` while the window is loading, else emits it over `mainBridge`.
  - `auth.tsx` `handleAuthCallbackUrl` reads `code` from search or hash, calls `supabase.auth.exchangeCodeForSession(code)`. It pulls parked links on mount via `MAIN_CHANNELS.AUTH_GET_PENDING_CALLBACK`.
- Checkout flow (desktop only):
  - `apps/web/src/lib/checkout.ts:75` sets `ELECTRON_CHECKOUT_REDIRECT`. `successAndCancelUrls()` returns `?status=success` / `?status=cancel` variants when `window.desktop` is set. These go to `trpc.createSubscription` / `trpc.createTopup` as Stripe success/cancel URLs.
  - Stripe redirects to `checkout/electron-callback.html`. The page forwards the query to `diffusion://checkout/callback?...`.
  - `main.ts` `deepLinkChannel()` maps hostname `checkout` to `MAIN_CHANNELS.CHECKOUT_CALLBACK`.
  - `apps/web/src/components/purchase-success.tsx` reads `status === "success"` from the deep link (via `CHECKOUT_GET_PENDING_CALLBACK` and `CHECKOUT_CALLBACK`) and shows the "Thank you for your purchase" overlay.

## Interfaces

- Depends on:
  - Vite default `publicDir` (no override in `apps/web/vite.config.ts`).
  - Desktop protocol handler and deep-link routing: `apps/desktop/src/main.ts` (`AUTH_PROTOCOL`, `deepLinkChannel`, `deliverDeepLink`), `apps/desktop/src/main-channels.ts` (`AUTH_CALLBACK`, `CHECKOUT_CALLBACK`, `*_GET_PENDING_CALLBACK`). See [../../desktop/README.md](../../desktop/README.md).
  - Public deploy host `app.diffusion.studio` (hard-coded in `auth.tsx` and `checkout.ts`).
- Used by:
  - `apps/web/index.html` (favicon, OG image).
  - `apps/web/src/context/auth.tsx` (auth redirect target).
  - `apps/web/src/lib/checkout.ts` (Stripe success/cancel target).
  - `apps/web/src/components/upgrade-dialog.tsx`, `apps/web/src/components/dashboard/get-desktop-app.tsx` (logo mark).
  - `apps/web/src/components/purchase-success.tsx` (consumes the checkout deep link).
  - See [../src/README.md](../src/README.md).

Up: [../README.md](../README.md)
