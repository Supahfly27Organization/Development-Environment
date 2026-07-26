import fs from "node:fs";
import path from "node:path";
import * as TOML from "smol-toml";
import { toCodexMcpServersTable } from "./mcp-servers.js";

/** Writes/merges the project-local .codex/config.toml with the shared MCP server set. */
export function writeCodexConfig(targetFolder, servers) {
  const dir = path.join(targetFolder, ".codex");
  fs.mkdirSync(dir, { recursive: true });
  const configPath = path.join(dir, "config.toml");

  let existing = {};
  if (fs.existsSync(configPath)) {
    try {
      existing = TOML.parse(fs.readFileSync(configPath, "utf8"));
    } catch {
      existing = {};
    }
  }

  const merged = {
    approval_policy: "on-request",
    sandbox_mode: "workspace-write",
    ...existing,
    mcp_servers: { ...(existing.mcp_servers ?? {}), ...toCodexMcpServersTable(servers) },
  };

  fs.writeFileSync(configPath, TOML.stringify(merged));
  return configPath;
}
