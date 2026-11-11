// Shared by probe.mjs, login.mjs and the runner: the server list, where tokens are kept, one JSON-RPC call to a remote MCP server,
// and the discovery of a server's OAuth metadata.
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url)), V2 = join(HERE, "../../.."), REPO = join(V2, "..");
export const SERVERS = JSON.parse(readFileSync(join(HERE, "servers.json"), "utf8"));
export const TOKENS = join(V2, ".cache", "mcp-tokens.json");   // V2/.cache is gitignored
export const CLIENT = { name: "bench-mcp", version: "1" };
// An API key named in servers.json: from the process env, else the repository root .env.
export const envKey = (name) => { if (!name) return null; if (process.env[name]) return process.env[name].trim(); const f = join(REPO, ".env"), m = existsSync(f) && readFileSync(f, "utf8").match(new RegExp(`^${name}=(.+)$`, "m")); return m ? m[1].trim().replace(/^["']|["']$/g, "") : null; };
export const json = (s) => { try { return JSON.parse(s); } catch { return null; } };
export const get = async (url, init = {}) => { try { const r = await fetch(url, { ...init, signal: AbortSignal.timeout(30000) }); return { status: r.status, headers: r.headers, text: await r.text() }; } catch (e) { return { status: 0, headers: new Headers(), text: String(e.cause?.code || e.message) }; } };
const rpcBody = (text) => json(text) || json((text.match(/^data: (\{.*\})\s*$/m) || [])[1] || "");   // a plain JSON reply, or the first SSE data line
export async function rpc(url, token, method, params, session) {
  const headers = { "content-type": "application/json", accept: "application/json, text/event-stream", ...(token ? { authorization: `Bearer ${token}` } : {}), ...(session ? { "mcp-session-id": session } : {}) };
  const r = await get(url, { method: "POST", headers, body: JSON.stringify({ jsonrpc: "2.0", ...(method.startsWith("notifications/") ? {} : { id: 1 }), method, params }) });
  return { ...r, body: rpcBody(r.text), session: r.headers.get("mcp-session-id") || session };
}
export const initialize = (url, token) => rpc(url, token, "initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: CLIENT });
// The server's tools, or null: initialize, the initialized notice, then tools/list on the same session.
export async function listTools(url, token) {
  const r = await initialize(url, token); if (r.status !== 200 || !r.body?.result) return { init: r, tools: null };
  await rpc(url, token, "notifications/initialized", undefined, r.session);
  const t = await rpc(url, token, "tools/list", {}, r.session);
  return { init: r, tools: t.body?.result?.tools || null, list: t };
}
// The OAuth metadata behind a server: the protected-resource document (from the 401 challenge, else the well-known paths), then
// the authorization server's own document.
export async function discover(url, challenge = "") {
  const u = new URL(url), hinted = (challenge.match(/resource_metadata="?([^",\s]+)"?/) || [])[1];
  let prm = null, prmUrl = null;
  for (const c of [hinted, `${u.origin}/.well-known/oauth-protected-resource${u.pathname === "/" ? "" : u.pathname}`, `${u.origin}/.well-known/oauth-protected-resource`].filter(Boolean)) { const r = await get(c); if (r.status === 200 && json(r.text)?.authorization_servers) { prm = json(r.text); prmUrl = c; break; } }
  const issuer = prm?.authorization_servers?.[0] || u.origin, i = new URL(issuer);
  let as = null, asUrl = null;
  for (const c of [`${i.origin}/.well-known/oauth-authorization-server${i.pathname === "/" ? "" : i.pathname}`, `${i.origin}/.well-known/oauth-authorization-server`, `${issuer.replace(/\/$/, "")}/.well-known/openid-configuration`, `${i.origin}/.well-known/openid-configuration`]) { const r = await get(c); if (r.status === 200 && json(r.text)?.authorization_endpoint) { as = json(r.text); asUrl = c; break; } }
  return { prm, prmUrl, issuer, as, asUrl };
}
