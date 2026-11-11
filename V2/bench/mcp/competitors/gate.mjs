// The gate: approve or refuse one call by a service's rules (servers.json), the way the account there would.
//   rule    { tool, when?, arg, allow, say }    the argument must match `allow`
//           { tool, when?, arg, forbid, say }   the argument must stay unset
//           { tool, when?, forbid_text, say }   nothing in the whole call may match
//   when    { arg, equals | matches | not_matches }   picks the calls a rule applies to
//   deny         tools that are refused outright
//   max_creates  cap on the approved creation calls of one item (a creation call: any tool a rule names)
//   budget       { count: [{ tool, when?, arg, default }], say, tell, failed? }: cap on one summed argument (seconds of generated
//                video) across the item's approved calls, the stand-in for the credit the account has left. The cap is a number
//                the run supplies (--budget); without one there is no budget.
// A creation call that comes back with an error made nothing, and a job later read as failed made nothing: what such a call took
// from both caps goes back (settle), so the driver can correct a bad input the way a user's assistant would.
import { json } from "./common.mjs";

export const at = (o, path) => path.split(".").reduce((x, k) => (x == null ? x : x[k]), o);
const hit = (re, v) => new RegExp(re, "i").test(String(v ?? ""));
const picks = (w, a) => !w || (w.equals != null ? String(at(a, w.arg)) === w.equals : w.matches != null ? hit(w.matches, at(a, w.arg)) : w.not_matches != null ? !hit(w.not_matches, at(a, w.arg)) : true);

export function makeGate(P, max = null) {
  const rules = P.rules || [], B = P.budget && max != null ? P.budget : null;
  const creates = (name) => rules.some((r) => new RegExp(r.tool).test(name));
  let made = 0, spent = 0, held = [];   // held: what each approved creation call took, kept until the call is known to have made nothing

  function decide(name, a, id = null) {
    const deny = (reason) => ({ approve: false, reason });
    if (P.deny && new RegExp(P.deny).test(name)) return deny(`${name}: ${P.deny_say || "not available on the free plan"}`);
    if (P.max_creates && creates(name) && made >= P.max_creates) return deny(`${name}: the account's spending limit for this request is reached (${P.max_creates} jobs)`);
    for (const r of rules) {
      if (!new RegExp(r.tool).test(name) || !picks(r.when, a)) continue;
      if (r.forbid_text) { if (new RegExp(r.forbid_text, "i").test(JSON.stringify(a))) return deny(r.say); continue; }
      const v = at(a, r.arg);
      if (r.forbid) { if (v != null && v !== "") return deny(r.say.replace("{value}", String(v))); continue; }
      if (v == null || !new RegExp(r.allow, "i").test(String(v))) return deny(r.say.replace("{value}", String(v ?? "default")));
    }
    let cost = 0;
    const c = B && (B.count || []).find((c) => new RegExp(c.tool).test(name) && picks(c.when, a));
    if (c) {
      cost = Number(at(a, c.arg) ?? c.default); if (!Number.isFinite(cost) || cost <= 0) cost = c.default;
      if (spent + cost > max) return deny(B.say.replace("{left}", String(Math.max(0, max - spent))).replace("{value}", String(cost)));
    }
    if (creates(name)) { made++; spent += cost; held.push({ id, name, args: JSON.stringify(a), cost, job: null }); }
    return { approve: true, reason: "" };
  }

  // One finished tool call, as the driver's API reports it: { approval_request_id?, name, arguments (JSON text), output, error }.
  function settle(c) {
    const a = json(c.arguments) || {}, out = String(c.output || "");
    const i = held.findIndex((h) => !h.job && (c.approval_request_id && h.id ? h.id === c.approval_request_id : h.name === c.name && h.args === JSON.stringify(a)));
    if (i >= 0) {
      const err = c.error ? (typeof c.error === "string" ? c.error : JSON.stringify(c.error)) : "";
      if (err && !/time.?out|timed out|\b50[234]\b/i.test(err)) { made--; spent -= held[i].cost; held.splice(i, 1); }   // refused by the service itself: nothing was made (a timeout says nothing either way, so it keeps what it took)
      else held[i].job = (out.match(/"id"\s*:\s*"([^"]+)"/) || [])[1] || "?";   // the job it started
      return;
    }
    const F = B?.failed;   // { tool, id_arg, status }: a read of a job that ended without making anything
    if (!F || !new RegExp(F.tool).test(c.name)) return;
    const j = held.findIndex((h) => h.job && h.job === String(at(a, F.id_arg)));
    if (j >= 0 && new RegExp(F.status, "i").test(out)) { made--; spent -= held[j].cost; held.splice(j, 1); }
  }

  return { decide, settle, reset() { made = 0; spent = 0; held = []; }, state: () => ({ creates: made, spent, max: B ? max : null }) };
}
