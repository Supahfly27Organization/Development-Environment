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
  assert.ok(servers.serena);
});

test("buildServerDefs includes codebase-memory-mcp when a path is given", () => {
  const servers = buildServerDefs({ codebaseMemoryMcpPath: "C:\\fake\\cbm.exe" });
  assert.equal(servers["codebase-memory-mcp"].command, "C:\\fake\\cbm.exe");
});

test("buildServerDefs wires serena's --project flag to the given projectPath", () => {
  const servers = buildServerDefs({ codebaseMemoryMcpPath: null, projectPath: "F:\\fake\\project" });
  assert.equal(servers.serena.command, "uvx");
  assert.ok(servers.serena.args.includes("git+https://github.com/oraios/serena"));
  const idx = servers.serena.args.indexOf("--project");
  assert.equal(servers.serena.args[idx + 1], "F:\\fake\\project");
});

test("buildServerDefs defaults serena's --project flag to cwd when projectPath is omitted", () => {
  const servers = buildServerDefs({ codebaseMemoryMcpPath: null });
  const idx = servers.serena.args.indexOf("--project");
  assert.equal(servers.serena.args[idx + 1], process.cwd());
});

test("buildServerDefs omits cass-memory when no cmServeUrl is given", () => {
  const servers = buildServerDefs({ codebaseMemoryMcpPath: null });
  assert.equal(servers["cass-memory"], undefined);
});

test("buildServerDefs includes cass-memory as a url-type server when cmServeUrl is given", () => {
  const servers = buildServerDefs({ codebaseMemoryMcpPath: null, cmServeUrl: "http://127.0.0.1:8765/" });
  assert.deepEqual(servers["cass-memory"], { type: "url", url: "http://127.0.0.1:8765/" });
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

test("url-type servers (cass-memory) pass through unchanged for Claude, Codex, and VS Code", () => {
  const servers = buildServerDefs({ codebaseMemoryMcpPath: null, cmServeUrl: "http://127.0.0.1:8765/" });

  const claude = JSON.parse(toClaudeMcpJson(servers));
  assert.deepEqual(claude.mcpServers["cass-memory"], { type: "url", url: "http://127.0.0.1:8765/" });

  const codex = toCodexMcpServersTable(servers);
  assert.deepEqual(codex["cass-memory"], { type: "url", url: "http://127.0.0.1:8765/" });

  const vscode = JSON.parse(toVscodeMcpJson(servers));
  assert.deepEqual(vscode.servers["cass-memory"], { type: "url", url: "http://127.0.0.1:8765/" });
});
