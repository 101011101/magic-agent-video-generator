# App Shell

> Level 2 · Up: [Frontend](../README.md)

**End product:** The single Next.js route `/` ("Local Video Composer"): a root HTML frame with global styles, one shared React Query cache, a toast host, and a `HomePage` that owns app state and renders the active workspace.

**Parts:**
- [layout.md](layout.md) — `layout.tsx` + `globals.css`: root `<html>`/`<body>`, page `metadata`, global Tailwind styles and custom utility classes (`.glass-panel`, `.custom-scrollbar`, etc.), mounts `Providers` and the `sonner` `Toaster`.
- [providers.md](providers.md) — `providers.tsx`: client component that creates one `QueryClient` (`staleTime` 60 s) and exposes it with `QueryClientProvider`.
- [page.md](page.md) — `page.tsx`: `HomePage` holds `mode`, `loadedProjectId`, and `savingTarget`; calls the data hooks; passes data and `on*` handlers to `ChatWorkspace` or `YoutubeReviewWorkspace`.

**How the parts work together:**
1. Next.js loads `RootLayout` (server component). It imports `globals.css` and renders `<Providers>` inside `<body>`.
2. `Providers` (`"use client"`) creates the `QueryClient` once with `useState`. All hooks below it share this cache.
3. Inside `Providers`, `RootLayout` renders the route content (`HomePage`) and `<Toaster position="top-right" theme="light" richColors />`.
4. `HomePage` (`"use client"`) reads `?project_id=` from the URL, calls React Query hooks from the [Data Layer](../data-layer/README.md), and derives `currentJob`, `projectJobs`, and `isBusy`.
5. `HomePage` returns `YoutubeReviewWorkspace` when `mode === "review"`, else `ChatWorkspace` (see [Workspaces](../workspaces/README.md)). Both get `onModeChange={setMode}`, so the workspace UI switches modes.
6. Each `HomePage` handler fires `toast.success` / `toast.error`. The `Toaster` from `RootLayout` shows them.
7. Workspace components use the custom CSS classes from `globals.css`.

**Key contracts:**
- One route only: `frontend/app/page.tsx` at `/`. No code imports `HomePage`.
- Project selection state = component state plus `?project_id=` URL query, written with `window.history.replaceState` (no navigation, no `popstate` handling).
- `mode`: `"compose"` (default) | `"review"`. The project list query runs only in compose mode. The latest review batch query runs only in review mode.
- Query default: `staleTime: 60 * 1000`. Hooks override with their own `refetchInterval`. SSE invalidation happens in `ChatWorkspace`, not in the shell.
- Toast id `"polling-error"` prevents duplicate project-status error toasts.

**Gotchas:**
- `tailwind.config.ts` maps colors to shadcn vars (`hsl(var(--border))`, `hsl(var(--primary))`, etc.). `globals.css` does not define them, so those color classes resolve to invalid values.
