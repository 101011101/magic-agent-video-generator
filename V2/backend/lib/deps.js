// The one rule of dependency (T-046), shared by the state manager (State.dependents, behind --retry, --only and
// --restore) and the working tree (agent/worktree.js): what a change to one thing does to the things that took it.
// HARD: the taker must be remade, because it was made INTO or ONTO the thing: a still painted into it as image 1, a clip
// or a sequence pinned on it, a still of a shot, a scene of a story, a step on its input. SOFT: the taker was only
// informed by it and is kept, marked as built with an older reference: the frame before, a portrait, a prop picture,
// the style sheet, a voice sample. An unknown role is hard: remaking too much costs credits, keeping too much costs the
// film. The pipeline's --only already drew this line by hand; this makes it the rule.
export const SOFT_ROLES = new Set(["reference", "portrait", "prop", "the frame just before", "style", "voice"]);
export const isHard = (role) => !SOFT_ROLES.has(String(role || "").toLowerCase());
