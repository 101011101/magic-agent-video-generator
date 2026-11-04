# `apps/web/src/components/dashboard`

SolidJS views and widgets for the Diffusion Studio dashboard: the landing screen that lists projects, starts agent chats, and manages account, billing, credits, agents (MCP/CLI), settings, and help.

## Parts

| Part | Role |
| --- | --- |
| `types.ts` | `DashboardView` union (`home`, `projects`, `templates`, `ai-credits`, `billing`, `account`, `settings`, `mcp`, `preferences`, `help`), `ProjectSortOption`, `TemplateSourceOption`, `TemplateCard`. Only `DashboardView` and `ProjectSortOption` are used; template types have no consumer in source. |
| `utils.ts` | `parseTimestamp` (safe `Date.parse`), `formatEditedAt` ("Edited N minutes ago"), `cropAndResizeAvatar` (center-crop to square, max 256px, WebP via `OffscreenCanvas`). |
| `shared.tsx` | Layout primitives and project actions shared by all views. Layout: `DashboardScrollView` (max-w-3xl column), `DashboardViewSection` (title + controls + auto-fill card grid), `DashboardSurfaceCard`, `DashboardTitledSection`, `DashboardSurfaceSection`, `DashboardDividedStack` (children split by `Separator`), `DashboardInfoActionRow` (leading icon + title + description + action), `DashboardLabelValue`, `DashboardFeatureRow`, `DashboardFormModal` (dialog that auto-focuses the first text input), `DashboardPlanSummaryCard`, `DashboardPlanDetails`, `DashboardFreePlanDetails`, `DashboardProPlanDetails` (fetches `trpc.getSubscriptionSummary`). Cards: `DashboardCardButton` (keyboard: Enter opens, Space selects, Escape deselects, Backspace/Delete deletes), `DashboardCardPreview`, `DashboardCardMeta`, `DashboardProjectThumbnail` (object URL from cover `Blob`, revoked on change). Actions: `createNewProject` (desktop only, `ensureProjectsRoot` then `createProject(generateProjectName())`), `openProjectFromList` (`checkProject`; toast with "Remove from list" when folder is missing), `trashProject` (`deleteProject` + `forgetProjectBundle`), `createBackgroundClickHandler` (clears selection on clicks outside `[data-slot="card-button"]`). |
| `sidebar.tsx` | Sidebar pieces: `DashboardSidebarItem`, `DashboardSidebarHeader` (logo, name, `APP_VERSION`; extra top padding on macOS for traffic lights), `DashboardSidebarTitleBar` (Windows), `DashboardSidebarTopSpacer`, `DashboardSidebarNav`, `DashboardSidebarSection`, `DashboardSidebarConnectCard` ("Install agent tools" nudge), `DashboardSidebarUser` (avatar, name, Free/Pro label). |
| `search-bar.tsx` | `DashboardSearchBar` (top bar text input; stops key events from reaching global shortcuts), `DashboardSearchPanel` (search bar + content column). |
| `project-card.tsx` | `DashboardProjectCard`: thumbnail, name, `formatEditedAt`; context menu Open / Rename / Duplicate / Delete. Inline rename calls `renameProject`; duplicate calls `duplicateProject`; both call `onChanged` so the owner refetches. |
| `delete-project-dialog.tsx` | `DeleteProjectDialog`: alert dialog, calls `trashProject`, unclosable while deleting, then `onDeleted`. |
| `projects-folder-bar.tsx` | `DashboardProjectsFolderBar`: desktop-only footer showing `projectsRoot()`, with "Reveal in finder" (`revealPath`) and "Change..." (`pickProjectsRoot`). |
| `get-desktop-app.tsx` | `DashboardGetDesktopApp`: promo bar hidden in the desktop build; right-click "Don't show again" persists `dashboard.desktop-app-promo-hidden` via `store.define`. |
| `home-view.tsx` | `DashboardHomeView`: "What should we edit?" prompt composer + Recents row. Composer: target dropdown (`PromptTarget` = new / recent project / picked folder), attachments drop zone, `ModelPicker`, fading placeholder examples (`createFadingPlaceholder`; Tab accepts the example), Enter submits. `handleSubmit` resolves the target to a `ProjectInfo`, calls `startChat`, then navigates to `projectRoute`. |
| `projects-view.tsx` | `DashboardProjectsView`: search + sort (`SORT_OPTIONS`: last modified, alphabetical, date created) over `listProjects()`, "New project" card, up to `MAX_VISIBLE_PROJECTS` (11) cards, folder bar, delete dialog. |
| `billing-view.tsx` | `DashboardBillingView`: tab bar Plans / Billing / Invoices. Billing and Invoices tabs show only when `auth.hasStripeCustomer()`. |
| `plans-view.tsx` | `DashboardPlansView`: Free / Pro / Enterprise cards. Yearly toggle, credit-tier `Select` over `SUBSCRIPTION_CREDIT_TIERS`, price from `getSubscriptionPrice`, "Continue with Pro" calls `startSubscriptionCheckout`, "Downgrade" opens `openBillingPortal`. Exports `DashboardProPlanFeatures`. |
| `billing-info-view.tsx` | `DashboardBillingInfoView`: current plan card, then (Pro only) `BillingInfo` from `trpc.getBillingInfo` (payment method, period, email, tax ID, address); every action button opens `openBillingPortal`. |
| `invoices-view.tsx` | `DashboardInvoicesView`: `trpc.listInvoices` mapped by `toInvoiceItem` (`mapInvoiceStatus` -> Upcoming / Open / Overdue / Paid), list with status `Badge` and hosted-URL link, or empty state. |
| `ai-credits-view.tsx` | `DashboardAiCreditsView`: usage bar from `auth.creditLimit()` / `auth.remainingCredits()` / `auth.nextCreditReset()`. Pro: top-up radio grid over `TOPUP_CREDIT_TIERS` -> `startTopupCheckout`. Free: "Go Pro" section that sets `?dashboard=billing`. |
| `account-view.tsx` | `DashboardAccountView`: Personal details (name via `supabase.auth.updateUser`; avatar via `cropAndResizeAvatar` + `supabase.storage.from("avatars")`), Login & security (change email modal), Active sessions (`auth.signOut`), Linked accounts (`linkIdentity` / `unlinkIdentity` for google, github; blocks unlinking last identity), Plan, Email preferences (optimistic `trpc.updateEmailPreference`), Danger zone (`auth.deleteAccount`). |
| `settings-view.tsx` | `DashboardSettingsView`: Projects folder (`pickProjectsRoot`) and browser Permissions rows (clipboard-read, local-fonts, microphone, persistent-storage, notifications) driven by `usePermissionState`; `PermissionActionButton` renders Granted / Denied / Unavailable / request. |
| `mcp-view.tsx` | `DashboardMcpView` (desktop only): Agents section (toggle per agent from `fetchMcpStatus`, writes via `applyMcp({add, remove})`, "Enable all"), MCP Server section (copy `status().url`), CLI section (`fetchCliStatus`, `installCli`, `uninstallCli`). |
| `help-view.tsx` | `DashboardHelpView`: external links (updates, Discord, support mailto) and copy-user-id row. |

## How it works

- `pages/dashboard.tsx` owns the page shell. It reads `?dashboard=<DashboardView>` from the URL, builds the sidebar from `sidebar.tsx` parts, and mounts one `*View` component per view.
- Views do not share state with each other. Each view reads app state from `@/context/auth`, `@/projects`, `@/lib/mcp`, or `@/lib/trpc` and renders with `shared.tsx` primitives.
- Cross-view navigation uses the URL: `ai-credits-view.tsx` and `account-view.tsx` call `setParams({ dashboard: "billing" })`.
- Project lists: `home-view.tsx` and `projects-view.tsx` each create a `createResource(projectsRevision, listProjects)`. Card actions (`project-card.tsx`, `delete-project-dialog.tsx`) mutate disk through `@/projects`, then call `refetch` on the owner.
- Project open flow: `openProjectFromList` -> `checkProject` -> `navigate(projectRoute(projectKey(project)), { state: returnHere() })`.
- Home prompt flow: `resolveTarget` (new project, recent project, or any picked folder via `openProjectFolder`) -> `startChat({ project, text, attachments, model })` -> navigate to the editor with the reply streaming.
- Billing flow: `plans-view.tsx` starts Stripe checkout via `@/lib/checkout`; `billing-info-view.tsx` and `invoices-view.tsx` read Stripe-backed data via `@/lib/trpc`; changes go through `openBillingPortal`.
- Agent flow: `mcp-view.tsx` toggles write agent configs through `@/lib/mcp`; `pages/dashboard.tsx` shows `DashboardSidebarConnectCard` while `connectedAgents() === 0`.
- Desktop gating: `isDesktop()` guards project creation, folder bar, and MCP/CLI sections; `get-desktop-app.tsx` shows only in the browser build.

## Interfaces

- Depends on:
  - `apps/web/src/projects/` (`listProjects`, `createProject`, `checkProject`, `deleteProject`, `renameProject`, `duplicateProject`, `forgetProject`, `openProjectFolder`, `pickProjectFolder`, `pickProjectsRoot`, `ensureProjectsRoot`, `projectsRoot`, `projectsRevision`, `projectKey`, `isDesktop`, types `ProjectInfo`, `ProjectRecord`) — see [../../projects/README.md](../../projects/README.md)
  - `apps/web/src/agent-chat/` (`startChat`, `ModelPicker`, `currentModel`, `setStoredModel`, `createDropZone`, `AttachmentTile`, `DropOverlay`, `mergeAttachments`, `attachmentPaths`) — see [../../agent-chat/README.md](../../agent-chat/README.md)
  - `apps/web/src/context/auth.tsx` (`useAuth`: `user`, `isPro`, `hasStripeCustomer`, `creditLimit`, `remainingCredits`, `nextCreditReset`, `productUpdatesEnabled`, `marketingAnnouncementsEnabled`, `signOut`, `deleteAccount`, `refreshSession`)
  - `apps/web/src/lib/trpc.ts` (`getSubscriptionSummary`, `getBillingInfo`, `listInvoices`, `updateEmailPreference`)
  - `apps/web/src/lib/checkout.ts` (`SUBSCRIPTION_CREDIT_TIERS`, `SUBSCRIPTION_VOLUME_DISCOUNT`, `TOPUP_CREDIT_TIERS`, `getSubscriptionPrice`, `getTopupPrice`, `startSubscriptionCheckout`, `startTopupCheckout`, `openBillingPortal`)
  - `apps/web/src/lib/mcp.ts` (`fetchMcpStatus`, `applyMcp`, `fetchCliStatus`, `installCli`, `uninstallCli`, `AGENT_ICONS`)
  - `apps/web/src/lib/supabase.ts`, `apps/web/src/lib/db.ts` (`generateProjectName`, `forgetProjectBundle`), `apps/web/src/lib/analytics.ts` (`track`), `apps/web/src/lib/shell.ts` (`revealPath`), `apps/web/src/lib/desktop-app.ts`, `apps/web/src/lib/store/` (`createStoredSignal`), `apps/web/src/init.ts` (`store`)
  - `apps/web/src/hooks/use-avatar.ts`, `use-permission.ts`, `use-project-route.ts`
  - `apps/web/src/components/ui/` (button, dialog, alert-dialog, context-menu, dropdown-menu, select, switch, text-field, tooltip, badge, icon, kbd, separator) — see [../ui/README.md](../ui/README.md)
  - External: `solid-js`, `@solidjs/router`, `somoto` (toasts), `@diffusionstudio/api-contract` (types `SubscriptionCredits`, `TopupCredits`; npm package, not in repo)
- Used by:
  - `apps/web/src/pages/dashboard.tsx` — the only importer. Imports every `*View`, `DashboardGetDesktopApp`, all `sidebar.tsx` parts, and `DashboardView` from `types.ts`. See [../../pages/README.md](../../pages/README.md).

Up: [../README.md](../README.md)
