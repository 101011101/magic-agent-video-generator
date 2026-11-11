# layout.tsx + globals.css

> Level 3 · Source: `frontend/app/layout.tsx`, `frontend/app/globals.css` · Up: [App shell](README.md)

**Purpose:** Root HTML frame and global styles for every page of the Next.js app.

**Role in parent:** Wraps [`page.tsx`](page.md) in [`Providers`](providers.md) (React Query) and mounts the `sonner` toast host. Supplies the global CSS and the custom utility classes that the workspace components use.

**Main exports:**
- `metadata: Metadata` — page title `"Local Video Composer"`, description `"Conversational video agent with generated and YouTube clip workflows"`.
- `RootLayout({ children })` (default) — renders `<html lang="en" className="bg-[#fff7fd]" suppressHydrationWarning>` → `<body>` → `<Providers>` → `children` + `<Toaster position="top-right" theme="light" richColors />`.
- `globals.css`:
  - `@tailwind base/components/utilities` directives.
  - `:root` vars `--font-sans` (Inter stack), `--font-mono` (SF Mono stack); `color-scheme: light`.
  - Base rules: `body` background `#f4f6f8`, text `#17202a`; `box-sizing: border-box` on all elements; `min-height: 100%` on `html, body, main`; form controls inherit font; `textarea` resizes vertically only; global 8px WebKit scrollbar.
  - Custom classes: `.custom-scrollbar` (6px scrollbar), `.bg-workspace-grid` (36px grid background), `.bg-brand-mark` (dark gradient), `.shadow-soft-panel` (soft drop shadow), `.glass-panel` (translucent white panel with border, shadow, `backdrop-filter: blur(16px)`), `.bg-cinematic` (32px grid background).

**Internal flow:**
1. Next.js App Router loads `layout.tsx` as the root layout. The import of `./globals.css` applies global styles.
2. `Providers` creates one `QueryClient` for the client tree.
3. The route content (`page.tsx`) renders inside `Providers`.
4. `Toaster` renders the toasts that `page.tsx` fires with `toast.success` / `toast.error`.

**Depends on:** `next` (`Metadata`), `sonner` (`Toaster`), `@/components/providers` (`Providers`), Tailwind (via PostCSS, `frontend/tailwind.config.ts`).

**Used by:**
- Next.js App Router (root layout for `frontend/app/page.tsx`).
- `components/chat-workspace.tsx`, `components/youtube-review-workspace.tsx` — use `.custom-scrollbar`, `.bg-workspace-grid`, `.bg-brand-mark`, `.shadow-soft-panel`, `.glass-panel`.
- `frontend/components.json` — points shadcn at `app/globals.css`.

**Gotchas:**
- `.bg-cinematic` has no users in `app`, `components`, `hooks`, or `lib`.
- `html` background (`#fff7fd`, pink tint) and `body` background (`#f4f6f8`) differ.
- The scrollbar thumbs use white at 10–25% alpha. They are almost invisible on the light backgrounds.
- `tailwind.config.ts` maps colors to `hsl(var(--border))`, `hsl(var(--primary))`, etc. `globals.css` does not define these shadcn variables, so those Tailwind color classes resolve to invalid values.
