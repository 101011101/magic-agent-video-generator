# T-027 · A compact prompt rendering for low-capacity models

status:     open 2026-10-30
priority:   medium
subsystem:  keyframes (template), state

what:
The keyframe template renders the same state in a shorter form when the still model is a small one (flux-2-klein, qwen,
krea): rules first, then the frame, the elements in one line each, no memory paragraph, no treatment, the change list only
for edits; about a third of the length. The choice is read from the model registry (a `compact: true` flag per model), so
switching models switches the rendering with nothing else touched. The gates stay the same.

why:
Our prompts run about 5,000 characters in eight sections, written for nano-banana-pro. Cheaper editors follow long
constraint lists worse; the first free-tier run (topgun6) measures how much worse. If its masters flag more than the paid
run's did on the same screenplay, the compact rendering is the structural answer, not retries.

acceptance:
On the topgun5 screenplay, the free tier's flagged-still count with the compact rendering is no higher than the paid run's
(2 of 21); the audit test renders both forms from one state and checks that every element and every rule is in both.
