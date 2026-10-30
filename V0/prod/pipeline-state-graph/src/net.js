// Network retry for the OpenAI calls (vision and timeline): "fetch failed", resets and 5xx/429 are retried with backoff.
const TRANSIENT = /fetch failed|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|EPIPE|socket hang up|network|HTTP 5\d\d|HTTP 429|other side closed/i;
export async function retry(fn, { tries = 4, base = 5000, label = "call" } = {}) {
  for (let a = 1; ; a++) {
    try { return await fn(); } catch (e) {
      if (a >= tries || !TRANSIENT.test(String(e?.message || e) + String(e?.cause?.message || ""))) throw e;
      console.log(`  ${label}: ${String(e.message).slice(0, 80)} → retry ${a}/${tries - 1}`);
      await new Promise((r) => setTimeout(r, base * a));
    }
  }
}
