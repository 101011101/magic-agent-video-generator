# ui-primitives (button.tsx, utils.ts)

> Level 3 · Source: `frontend/components/ui/button.tsx`, `frontend/lib/utils.ts` · Up: [Workspaces](README.md)

**Purpose:** Shared shadcn-style `Button` component and `cn` Tailwind class-merge helper.

**Role in parent:** Gives the workspace components one styled button and one safe way to combine conditional Tailwind classes.

**Main exports:**
- `cn(...inputs: ClassValue[])` (`lib/utils.ts`) — joins class values with `clsx`, then resolves Tailwind conflicts with `twMerge` (the last class wins).
- `buttonVariants` (`button.tsx`) — `cva` recipe. Base classes: dark theme (`ring-offset-zinc-950`), emerald focus ring, `active:scale-[0.98]`, disabled opacity.
  - `variant`: `default` (white), `destructive` (red tint), `outline` (bordered, blurred zinc), `secondary`, `ghost`, `link` (emerald text).
  - `size`: `default` (`h-10`), `sm` (`h-9`, `text-xs`), `lg` (`h-12`), `icon` (`h-10 w-10`).
  - Defaults: `variant="default"`, `size="default"`.
- `ButtonProps` — native `<button>` attributes + `VariantProps<typeof buttonVariants>` + `asChild?: boolean`.
- `Button` — `React.forwardRef` component. Renders `<button>`, or Radix `Slot` when `asChild` is true (the child element gets the button classes).

**Internal flow:**
1. `Button` takes `variant`, `size`, `className`, `asChild`.
2. It calls `buttonVariants({ variant, size, className })` to build the class string.
3. It passes that string through `cn` so a caller `className` overrides conflicting variant classes.
4. It renders `Slot` or `"button"` with the `ref` and the remaining props.

**Depends on:** `@radix-ui/react-slot`, `class-variance-authority`, `clsx`, `tailwind-merge`. Path alias `@/lib/utils` is set in `frontend/components.json` (shadcn config: style `new-york`, base color `zinc`).

**Used by:**
- `Button`: `frontend/components/chat-workspace.tsx`, `frontend/components/youtube-review-workspace.tsx`. Callers use the default variant or `variant="outline"`, and the default size, `size="sm"`, or `size="icon"`. Most callers override colors with `className`. No caller uses `asChild`.
- `cn`: `frontend/components/youtube-review-workspace.tsx` (status-tone badges, conditional list-item classes) and `button.tsx`.

**Gotchas:**
- `button.tsx` is the only file in `frontend/components/ui/`. Other shadcn primitives are not installed.
- Colors are hard-coded Tailwind classes (zinc, emerald, red), not the CSS-variable tokens that `components.json` (`cssVariables: true`) implies.
