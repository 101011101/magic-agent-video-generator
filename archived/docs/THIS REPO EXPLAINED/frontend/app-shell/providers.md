# providers.tsx

> Level 3 · Source: `frontend/components/providers.tsx` · Up: [App shell](README.md)

**Purpose:** Client component that gives the whole app one shared React Query client.

**Role in parent:** Wraps every page (and the `sonner` `Toaster`) in `RootLayout`, so all hooks can use the React Query cache.

**Main exports:**
- `Providers({ children })` — renders `QueryClientProvider` with one `QueryClient` around `children`.

**Internal flow:**
1. `"use client"` marks the file as a client component. `RootLayout` (a server component) can render it.
2. `useState(() => new QueryClient(...))` creates the client once per browser session. Re-renders keep the same client and cache.
3. Default query option: `staleTime: 60 * 1000` (60 s). Queries do not refetch until 60 s after their last fetch, unless code invalidates them.
4. `QueryClientProvider client={queryClient}` exposes the client to all children.

**Depends on:** `@tanstack/react-query` (`^5.100.5`), `react` (`useState`).

**Used by:**
- `frontend/app/layout.tsx` — `RootLayout` renders `<Providers>` inside `<body>`.
- Indirectly, all React Query consumers: `frontend/hooks/use-project.ts` (`useQuery`, `useMutation`, `useQueryClient`) and `frontend/hooks/use-project-events.ts` (`useQueryClient`).

**Gotchas:**
- The file sets only query defaults. Mutations use React Query defaults.
- Hooks can set their own options. Example: `refetchInterval` in `use-project.ts` polls every 2000 ms while review providers run, independent of `staleTime`.
