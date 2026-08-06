import { execFileSync } from "node:child_process";

// Single source of truth for the MCP server set, mirrored from UpFront's
// actual .mcp.json. Each renderer below shapes the same data for a
// different tool's config format.

/** Returns true if `uvx` is available on PATH (required to run serena). */
export function uvxAvailable() {
  try {
    execFileSync("uvx", ["--version"], { stdio: "ignore", shell: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {object} opts
 * @param {string|null} opts.codebaseMemoryMcpPath - absolute path to the local
 *        codebase-memory-mcp binary, or null if it isn't installed/skipped.
 * @param {string} [opts.sonarHostUrl]
 * @param {string} [opts.projectPath] - absolute path to the target project, passed to
 *        serena's `--project` flag. Defaults to the current working directory.
 * @param {boolean} [opts.includeSerena] - include the serena MCP server entry. Defaults to false
 *        so callers must explicitly opt in after confirming uvx is available.
 */
export function buildServerDefs({ codebaseMemoryMcpPath, sonarHostUrl, projectPath, includeSerena = false }) {
  const servers = {};

  if (codebaseMemoryMcpPath) {
    servers["codebase-memory-mcp"] = { command: codebaseMemoryMcpPath, args: [], env: {} };
  }

  servers["sonarqube"] = {
    command: "npx",
    args: ["-y", "sonarqube-api-mcp"],
    env: { SONAR_HOST_URL: sonarHostUrl ?? "http://localhost:9000", SONAR_TOKEN: "${SONAR_TOKEN}" },
  };

  servers["semgrep"] = {
    command: "docker",
    args: ["exec", "-i", "semgrep-mcp", "semgrep", "mcp"],
    env: {},
  };

  servers["trivy"] = {
    command: "docker",
    args: ["exec", "-i", "trivy-mcp", "trivy", "mcp"],
    env: {},
  };

  servers["github"] = {
    command: "docker",
    args: ["run", "-i", "--rm", "-e", "GITHUB_PERSONAL_ACCESS_TOKEN", "ghcr.io/github/github-mcp-server"],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: "${GITHUB_TOKEN}" },
  };

  if (includeSerena) {
    servers["serena"] = {
      command: "uvx",
      args: [
        "--from",
        "git+https://github.com/oraios/serena",
        "serena",
        "start-mcp-server",
        "--context",
        "ide-assistant",
        "--project",
        projectPath ?? process.cwd(),
      ],
      env: {},
    };
  }

  return servers;
}

function stripEmpty(def) {
  const out = { command: def.command };
  if (def.args?.length) out.args = def.args;
  if (Object.keys(def.env ?? {}).length) out.env = def.env;
  return out;
}

/** Claude Code project `.mcp.json` shape. */
export function toClaudeMcpJson(servers) {
  const mcpServers = {};
  for (const [name, def] of Object.entries(servers)) {
    mcpServers[name] = stripEmpty(def);
  }
  return JSON.stringify({ mcpServers }, null, 2) + "\n";
}

/** Codex `[mcp_servers.<id>]` table, to be merged into config.toml by the caller. */
export function toCodexMcpServersTable(servers) {
  const mcp_servers = {};
  for (const [name, def] of Object.entries(servers)) {
    mcp_servers[name] = stripEmpty(def);
  }
  return mcp_servers;
}

/** VS Code / Copilot Chat `.vscode/mcp.json` shape (`${env:VAR}` substitution syntax). */
export function toVscodeMcpJson(servers) {
  const out = {};
  for (const [name, def] of Object.entries(servers)) {
    const shaped = stripEmpty(def);
    if (shaped.env) {
      const env = {};
      for (const [k, v] of Object.entries(shaped.env)) {
        env[k] = String(v).replace(/^\$\{(\w+)\}$/, "${env:$1}");
      }
      shaped.env = env;
    }
    out[name] = shaped;
  }
  return JSON.stringify({ servers: out }, null, 2) + "\n";
}
