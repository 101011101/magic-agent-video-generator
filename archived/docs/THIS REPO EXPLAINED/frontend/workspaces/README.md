# Workspaces

> Level 2 · Up: [Frontend](../README.md)

**End product:** The two full-screen UI surfaces of the app: the video composer (`"compose"` mode) and the YouTube prompt review (`"review"` mode), built on one shared button and class helper.

**Parts:**
- [chat-workspace.md](chat-workspace.md) — `ChatWorkspace`: writes the brief, uploads media, sets models and keys, shows the project queue, live activity, artifacts, and the editable timeline.
- [youtube-review-workspace.md](youtube-review-workspace.md) — `YoutubeReviewWorkspace`: shows a batch of eval prompts, plays each provider video, saves reviewer comments.
- [ui-primitives.md](ui-primitives.md) — `Button` (`cva` variants) and `cn` (`clsx` + `twMerge`) used by both workspaces.

**How the parts work together:**
1. `frontend/app/page.tsx` (`HomePage`) holds `mode`. It renders `YoutubeReviewWorkspace` when `mode === "review"`, else `ChatWorkspace`.
2. Both workspaces get `activeMode` and `onModeChange={setMode}`. Each header draws the same Review/Composer toggle, so either surface can switch to the other.
3. Both workspaces are presentational. `HomePage` gives data (`job`/`jobs` or `batch`) and `on*` callbacks. The workspaces call those callbacks for every server write.
4. Only `ChatWorkspace` calls the Data Layer directly: `uploadInputMedia`, `getOpenRouterModels`, and `useProjectEvents` (SSE activity).
5. Both workspaces load server media through `mediaUrl()` and style controls with `Button` and `cn`.

**Key contracts:**
- `AppMode = "review" | "compose"` — declared separately in each workspace file (not shared).
- `ChatWorkspace` callbacks: `onCreate(CreateProjectPayload)`, `onMessage(message, runtimeCredentials)`, `onTimelineEdit(TimelineEditPayload)`, `onSelectProject(id)`, `onNewCreate()`.
- `YoutubeReviewWorkspace` callbacks: `onCreateBatch()`, `onNewReview()`, `onSaveComment(reviewId, provider, comments)`.
- Workspace settings and comment drafts are local React state. They reset on reload. API keys go out per request as `runtime_credentials`.
- `frontend/components/ui/` holds only `button.tsx`. No other shadcn primitive is installed.
