// S2 Roots: one clean text-to-image per entity (reference sheet) and per location (empty plate). Never edited afterwards.
const SINGLE = "One single image, not a grid, collage or storyboard. No text or labels.";

export function rootPrompt(plan, thing, kind) {
  if (kind === "location") return `${plan.style}. ${SINGLE} Establishing view of ${thing.name}: ${thing.look} Empty of people and animals.`;
  if (thing.kind === "prop") return `${plan.style}. ${SINGLE} Reference image of ${thing.name}: ${thing.look} Centred, whole object visible, plain light grey background, even soft light.`;
  const who = thing.kind === "group" ? "all of them together, side by side, at their true relative sizes" : "full body";
  return `${plan.style}. ${SINGLE} Character reference of ${thing.name}: ${thing.look} ${who}, front view, standing, neutral pose, plain light grey background, even soft light.`;
}

// places: false when the seed makes the plates (S0); entity sheets are made here either way.
export async function makeRoots(plan, jobs, tracker, { places = true } = {}) {
  const work = [
    ...plan.entities.map((e) => ({ id: e.id, kind: "entity", file: `roots/${e.id}.png`, prompt: rootPrompt(plan, e, "entity") })),
    ...(places ? plan.locations : []).map((l) => ({ id: l.id, kind: "location", file: `roots/${l.id}.png`, prompt: rootPrompt(plan, l, "location") })),
  ];
  await Promise.all(work.map(async (w) => {
    await jobs.image(`root-${w.id}`, w.file, w.prompt);
    if (w.kind === "entity") tracker.roots[w.id] = w.file;
    else tracker.addPlate(w.id, w.file);
  }));
  tracker.save();
}
