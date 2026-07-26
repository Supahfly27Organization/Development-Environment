import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildServerDefs,
  toClaudeMcpJson,
  toCodexMcpServersTable,
  toVscodeMcpJson,
} from "../src/lib/mcp-servers.js";

test("buildServerDefs omits codebase-memory-mcp when no path is given", () => {
  const servers = buildServerDefs({ codebaseMemoryMcpPath: null });
  assert.equal(servers["codebase-memory-mcp"], undefined);
  assert.ok(servers.sonarqube);
  assert.ok(servers.semgrep);
  assert.ok(servers.trivy);
  assert.ok(servers.github);
});

test("buildServerDefs includes codebase-memory-mcp when a path is given", () => {
  const servers = buildServerDefs({ codebaseMemoryMcpPath: "C:\\fake\\cbm.exe" });
  assert.equal(servers["codebase-memory-mcp"].command, "C:\\fake\\cbm.exe");
});

test("toClaudeMcpJson produces valid, parseable JSON with an mcpServers key", () => {
  const servers = buildServerDefs({ codebaseMemoryMcpPath: null });
  const json = toClaudeMcpJson(servers);
  const parsed = JSON.parse(json);
  assert.ok(parsed.mcpServers.sonarqube);
  assert.deepEqual(parsed.mcpServers.sonarqube.args, ["-y", "sonarqube-api-mcp"]);
});

test("toCodexMcpServersTable shapes the same servers for a TOML mcp_servers table", () => {
  const servers = buildServerDefs({ codebaseMemoryMcpPath: null });
  const table = toCodexMcpServersTable(servers);
  assert.equal(table.github.command, "docker");
  assert.ok(table.github.args.includes("ghcr.io/github/github-mcp-server"));
});

test("toVscodeMcpJson rewrites ${VAR} env refs to VS Code's ${env:VAR} syntax", () => {
  const servers = buildServerDefs({ codebaseMemoryMcpPath: null });
  const json = toVscodeMcpJson(servers);
  const parsed = JSON.parse(json);
  assert.equal(parsed.servers.github.env.GITHUB_PERSONAL_ACCESS_TOKEN, "${env:GITHUB_TOKEN}");
  assert.equal(parsed.servers.sonarqube.env.SONAR_TOKEN, "${env:SONAR_TOKEN}");
});
