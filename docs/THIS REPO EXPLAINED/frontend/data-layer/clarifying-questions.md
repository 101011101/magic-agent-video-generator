# clarifying-questions.ts

> Level 3 · Source: `frontend/lib/clarifying-questions.ts`, `frontend/lib/clarifying-questions.test.ts` · Up: [Data layer](README.md)

**Purpose:** Define the static clarifying questions for a new video brief, and merge the user's answers into the prompt text.

**Role in parent:** Gives the composer a client-side question set and one pure function that turns (brief + answers) into the final prompt string sent at project creation. No server call. No state.

**Main exports:**
- `type ClarifyingQuestionId` — `"goal" | "tone" | "visual_direction" | "source_strategy"`.
- `type ClarifyingOption` — `{ id, label, summary, value }`. `value` is the text that goes into the prompt.
- `type ClarifyingQuestion` — `{ id, label, question, helper, options: ClarifyingOption[] }`.
- `type ClarifyingAnswer` — `{ questionId, label, value }`.
- `buildClarifyingQuestions(workflow: WorkflowMode)` — Returns 3 questions: shared `goal` ("Primary outcome") and `tone` ("Tone and pacing"), then `source_strategy` when `workflow === "youtube_clips"`, else `visual_direction`.
- `composeClarifiedPrompt(basePrompt, questions, answers)` — Returns the trimmed brief plus a `Clarifying answers:` block.

**Internal flow (`composeClarifiedPrompt`):**
1. Trim `basePrompt`.
2. For each answer, find the question by `questionId`. Skip the answer if no question matches.
3. Format each line as `- <question.label>: <answer.value>`.
4. No lines → return the trimmed brief unchanged.
5. Else → return `<brief>\n\nClarifying answers:\n<lines>`.

**Depends on:** `WorkflowMode` from [`types.ts`](types.md) (`"generated" | "youtube_clips"`).

**Used by:**
- `frontend/components/chat-workspace.tsx` — `ClarificationSession` state holds `questions` and `answers`; `answerClarification` records an option; `useCustomClarificationAnswer` records free text as option `{ id: "custom", label: "Something else" }`; `startClarifiedProject` calls `composeClarifiedPrompt` and then `createInitialProject`; `skipClarification` sends the raw brief.
- `frontend/lib/clarifying-questions.test.ts` — `node:test` + `node:assert/strict`. Checks: both workflows return 3 questions with the correct third `id`; the composed prompt starts with the brief and contains the label/value lines, including a custom answer.

**Gotchas:**
- Questions are hard-coded in the frontend. The backend does not send them.
- `chat-workspace.tsx` imports `buildClarifyingQuestions` but does not call it. Every `setClarificationSession` call sets `null` or updates an existing session, and `submitInitial` calls `createInitialProject` directly. The clarification UI is effectively unreachable in the current code.
- The answer `label` field is not used in the composed prompt. Only `question.label` and `answer.value` go in.
- `frontend/package.json` has no `test` script. Run the test file with a TypeScript-capable Node runner by hand.
