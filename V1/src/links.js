// Links between consecutive slides, derived from lineage (not declared by the LLM).
// connected: slide k+1 was built by editing slide k's frame — same place, same camera, a small change. Its clip interpolates
//            k → k+1 (start + end frame), so the seam is exact.
// cut:       anything else (another place, a time jump back to an older frame, a first visit). Clip k has a start frame only.
export function links(plan, tracker) {
  const out = [];
  for (const s of plan.slides) {
    const f = tracker.bySlide(s.n), next = tracker.bySlide(s.n + 1);
    if (!f) continue;
    const connected = !!next && next.base === f.id && !next.forced;
    out.push({ n: s.n, next: next ? s.n + 1 : null, type: connected ? "connected" : "cut",
      why: !next ? "last slide" : connected ? `slide ${s.n + 1} is an edit of slide ${s.n}` : next.base?.startsWith("plate-") ? `slide ${s.n + 1} starts from the plate of ${next.location}` : next.location !== f.location ? `slide ${s.n + 1} is in ${next.location}` : `slide ${s.n + 1} starts from ${next.base}, not slide ${s.n}` });
  }
  return out;
}
