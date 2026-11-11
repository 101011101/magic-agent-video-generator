// What does a remote MCP server need before the harness can drive it? For each server: the answer to `initialize` (with the stored
// token when there is one), the OAuth metadata it points to (authorization server, endpoints, whether a client can register
// itself), and its name, version and tool list when it answers. Read-only: no tool is called.
// Usage: node V2/bench/mcp/competitors/probe.mjs [--tools] [name …]      (no name: every server in servers.json)
//          --tools   also print each tool's first description line and its argument names
import { SERVERS, initialize, listTools, discover } from "./common.mjs";
import { token } from "./login.mjs";

const args = process.argv.slice(2), FULL = args.includes("--tools"), names = args.filter((a) => !a.startsWith("--"));
for (const name of names.length ? names : Object.keys(SERVERS)) {
  const s = SERVERS[name]; if (!s) { console.log(`\n${name}: not in servers.json`); continue; }
  console.log(`\n=== ${name} · ${s.url || "(no remote URL)"}`);
  if (!s.url) { console.log(`  ${s.note || ""}`); continue; }
  const tk = await token(name).catch((e) => { console.log(`  ${e.message}`); return null; }), { init: r, tools } = await listTools(s.url, tk);
  const info = r.body?.result?.serverInfo;
  console.log(`  initialize ${tk ? "(with token)" : "(no token)"} → HTTP ${r.status}${r.status === 0 ? ` ${r.text}` : ""}${info ? ` · ${info.name} ${info.version || ""} · protocol ${r.body.result.protocolVersion}` : r.body?.error ? ` · ${JSON.stringify(r.body.error).slice(0, 160)}` : r.status && r.status !== 200 ? ` · ${r.text.replace(/\s+/g, " ").slice(0, 120)}` : ""}`);
  const ch = r.headers.get("www-authenticate"); if (ch) console.log(`  challenge: ${ch.slice(0, 220)}`);
  if (tools) {
    console.log(`  ${tools.length} tools: ${tools.map((x) => x.name).join(", ")}`);
    if (FULL) for (const t of tools) console.log(`    ${t.name}(${Object.keys(t.inputSchema?.properties || {}).join(", ")}) — ${(t.description || "").replace(/\s+/g, " ").slice(0, 200)}`);
  }
  if (r.status === 401 || r.status === 403 || !tk) {
    const d = await discover(s.url, ch || "");
    console.log(d.prm ? `  resource metadata: ${d.prmUrl}\n    authorization server: ${d.issuer}${d.prm.scopes_supported ? ` · scopes: ${d.prm.scopes_supported.join(" ")}` : ""}` : "  no protected-resource metadata found");
    console.log(d.as ? `  authorize: ${d.as.authorization_endpoint}\n  token: ${d.as.token_endpoint}\n  self-registration: ${d.as.registration_endpoint || "NOT offered"} · PKCE: ${(d.as.code_challenge_methods_supported || []).join(", ") || "not stated"}` : "  no authorization-server metadata found (API key, or not OAuth)");
  }
}
