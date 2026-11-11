// Sign in to a competitor's MCP server once, as the account owner, and keep the token for the harness.
// The standard MCP flow: read the server's OAuth metadata, register this script as a public client, open the browser on the
// provider's own sign-in page (PKCE), catch the redirect on this machine, exchange the code, save the tokens.
// Tokens go to V2/.cache/mcp-tokens.json (gitignored, mode 600). They are never printed.
// Usage: node V2/bench/mcp/competitors/login.mjs <name> [--wait <minutes>]     sign in (opens the browser; waits 10 minutes by default)
//        node V2/bench/mcp/competitors/login.mjs --status     which servers have a token, and until when
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from "node:fs";
import { createServer } from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { execFile } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SERVERS, TOKENS, envKey, json, initialize, listTools, discover } from "./common.mjs";

const load = () => (existsSync(TOKENS) ? JSON.parse(readFileSync(TOKENS, "utf8")) : {});
const save = (all) => { mkdirSync(dirname(TOKENS), { recursive: true }); writeFileSync(TOKENS, JSON.stringify(all, null, 2)); chmodSync(TOKENS, 0o600); };
const form = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v != null && v !== ""));
const FORM = { "content-type": "application/x-www-form-urlencoded", accept: "application/json" };
async function post(url, body, headers) { const r = await fetch(url, { method: "POST", headers, body, signal: AbortSignal.timeout(30000) }), text = await r.text(); return { ok: r.ok, status: r.status, json: json(text), text }; }
const until = (ms) => (ms ? new Date(ms).toLocaleString("en-GB", { hour12: false }) : "no expiry stated");

// A usable bearer value for a server: its OAuth access token (refreshed when it is about to expire), else the API key named in
// servers.json; null when there is neither.
export async function token(name) {
  const all = load(), t = all[name];
  if (!t?.access_token) return envKey(SERVERS[name]?.key_env) || null;
  if (!t.expires_at || t.expires_at - Date.now() > 5 * 60000) return t.access_token;
  if (!t.refresh_token) { if (t.expires_at > Date.now()) return t.access_token; throw new Error(`${name}: the token expired and the server gave no refresh token; sign in again (login.mjs ${name})`); }
  const r = await post(t.token_endpoint, form({ grant_type: "refresh_token", refresh_token: t.refresh_token, client_id: t.client_id, client_secret: t.client_secret, resource: SERVERS[name].url }), FORM);
  if (!r.ok || !r.json?.access_token) throw new Error(`${name}: the token refresh failed (HTTP ${r.status}); sign in again (login.mjs ${name})`);
  all[name] = { ...t, access_token: r.json.access_token, refresh_token: r.json.refresh_token || t.refresh_token, expires_at: r.json.expires_in ? Date.now() + r.json.expires_in * 1000 : null }; save(all);
  return all[name].access_token;
}

async function login(name) {
  const s = SERVERS[name]; if (!s?.url) throw new Error(`${name}: ${s ? s.note || "no remote URL" : "not in servers.json"}`);
  const first = await initialize(s.url, null), challenge = first.headers.get("www-authenticate") || "", d = await discover(s.url, challenge);
  if (!d.as) throw new Error(`${name}: no OAuth metadata found at ${new URL(s.url).origin}`);
  if (!d.as.registration_endpoint) throw new Error(`${name}: the server does not let a client register itself; it needs a client id from its developer console`);
  // scopes: what the server asked for in its challenge, else what its resource document lists, else the basic identity scopes; plus
  // offline_access where offered, so the token can be refreshed without another sign-in
  const offered = d.as.scopes_supported || [], asked = (challenge.match(/scope="([^"]+)"/) || [])[1];
  // servers.json may pin `scopes` where the server lists more than the harness needs (write or paid-job scopes are never asked for)
  const scopes = s.scopes ? s.scopes.split(" ") : asked ? asked.split(" ") : d.prm?.scopes_supported?.length ? [...d.prm.scopes_supported] : ["openid", "profile", "email"].filter((x) => offered.includes(x));
  if (!s.scopes && offered.includes("offline_access") && !scopes.includes("offline_access")) scopes.push("offline_access");

  // the redirect lands on this machine only: one listener on each loopback address, same port
  let done; const got = new Promise((res) => { done = res; });
  const handler = (req, res) => {
    const u = new URL(req.url, "http://localhost"); if (u.pathname !== "/callback") { res.writeHead(404).end(); return; }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(`<!doctype html><meta charset="utf-8"><title>${name}</title><body style="font:16px system-ui;padding:40px">${u.searchParams.get("error") ? `Sign-in failed: ${u.searchParams.get("error")}` : `Signed in to ${name}. You can close this tab.`}</body>`);
    done(u.searchParams);
  };
  const srv4 = createServer(handler); await new Promise((res, rej) => srv4.once("error", rej).listen(0, "127.0.0.1", res));
  const port = srv4.address().port, srv6 = createServer(handler); await new Promise((res) => srv6.once("error", res).listen(port, "::1", res));
  try {
    // register as a public client; a server that refuses the loopback address is asked again with "localhost"
    let redirect = `http://127.0.0.1:${port}/callback`, reg;
    for (const r of [redirect, `http://localhost:${port}/callback`]) {
      reg = await post(d.as.registration_endpoint, JSON.stringify({ client_name: "Benchmark harness (local)", redirect_uris: [r], grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none", application_type: "native", ...(scopes.length ? { scope: scopes.join(" ") } : {}) }), { "content-type": "application/json", accept: "application/json" });
      redirect = r; if (reg.ok && reg.json?.client_id) break;
    }
    if (!reg.ok || !reg.json?.client_id) throw new Error(`${name}: client registration failed (HTTP ${reg.status}): ${reg.text.replace(/\s+/g, " ").slice(0, 300)}`);
    const client = reg.json, verifier = randomBytes(48).toString("base64url"), state = randomBytes(16).toString("base64url");
    const url = `${d.as.authorization_endpoint}${d.as.authorization_endpoint.includes("?") ? "&" : "?"}${form({ response_type: "code", client_id: client.client_id, redirect_uri: redirect, state, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256", scope: scopes.join(" "), resource: s.url })}`;
    console.log(`${name}: opening the browser to sign in. If it does not open, paste this address:\n${url}\n`);
    execFile("open", [url], () => {});
    const back = await Promise.race([got, new Promise((_, rej) => setTimeout(() => rej(new Error(`${name}: no sign-in within ${WAIT} minutes`)), WAIT * 60000))]);
    if (back.get("error")) throw new Error(`${name}: the provider answered "${back.get("error")}" ${back.get("error_description") || ""}`);
    if (back.get("state") !== state || !back.get("code")) throw new Error(`${name}: the redirect did not carry the expected state and code`);
    const basic = client.client_secret && client.token_endpoint_auth_method === "client_secret_basic";
    const tok = await post(d.as.token_endpoint, form({ grant_type: "authorization_code", code: back.get("code"), redirect_uri: redirect, client_id: client.client_id, code_verifier: verifier, resource: s.url, ...(client.client_secret && !basic ? { client_secret: client.client_secret } : {}) }),
      { ...FORM, ...(basic ? { authorization: `Basic ${Buffer.from(`${client.client_id}:${client.client_secret}`).toString("base64")}` } : {}) });
    if (!tok.ok || !tok.json?.access_token) throw new Error(`${name}: the code exchange failed (HTTP ${tok.status}): ${String(tok.json?.error_description || tok.json?.error || tok.text).replace(/\s+/g, " ").slice(0, 300)}`);
    const all = load();
    all[name] = { access_token: tok.json.access_token, refresh_token: tok.json.refresh_token || null, expires_at: tok.json.expires_in ? Date.now() + tok.json.expires_in * 1000 : null, scope: tok.json.scope || scopes.join(" "), client_id: client.client_id, client_secret: client.client_secret || null, token_endpoint: d.as.token_endpoint, issuer: d.issuer, obtained: new Date().toISOString() };
    save(all);
    const { init, tools } = await listTools(s.url, all[name].access_token);
    console.log(`${name}: signed in · token valid until ${until(all[name].expires_at)}${all[name].refresh_token ? " (refreshes itself)" : ""} · ${tools ? `${tools.length} tools` : `tools not listed (HTTP ${init.status})`}`);
  } finally { srv4.close(); srv6.close(); }
}

const flags = process.argv.slice(2), WAIT = flags.includes("--wait") ? Number(flags[flags.indexOf("--wait") + 1]) : 10;   // minutes to wait for the browser
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = flags.find((a, i) => (a === "--status" || !a.startsWith("--")) && flags[i - 1] !== "--wait");
  if (!arg) { console.error(`usage: node login.mjs <${Object.keys(SERVERS).filter((k) => SERVERS[k].url).join(" | ")}>   |   node login.mjs --status`); process.exit(1); }
  if (arg === "--status") {
    const all = load();
    for (const [name, s] of Object.entries(SERVERS)) console.log(`${name.padEnd(9)} ${!s.url ? "local only" : all[name]?.access_token ? `signed in · until ${until(all[name].expires_at)}${all[name].refresh_token ? " (refreshes itself)" : ""}` : envKey(s.key_env) ? `API key ${s.key_env} set` : "not signed in"}`);
  } else await login(arg).then(() => process.exit(0), (e) => { console.error(e.message); process.exit(1); });   // exit at once: the wait timer would keep the process alive
}
