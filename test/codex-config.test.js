import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as TOML from "smol-toml";
import { writeCodexConfig } from "../src/lib/codex-config.js";
import { buildServerDefs } from "../src/lib/mcp-servers.js";

function makeScratchDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "aeco-test-"));
}

test("writeCodexConfig produces valid TOML with mcp_servers and sane defaults", () => {
  const dir = makeScratchDir();
  const servers = buildServerDefs({ codebaseMemoryMcpPath: null });
  const configPath = writeCodexConfig(dir, servers);

  const parsed = TOML.parse(fs.readFileSync(configPath, "utf8"));
  assert.equal(parsed.approval_policy, "on-request");
  assert.equal(parsed.sandbox_mode, "workspace-write");
  assert.ok(parsed.mcp_servers.sonarqube);
  assert.ok(parsed.mcp_servers.github);
});

test("writeCodexConfig merges into an existing config without clobbering unrelated keys", () => {
  const dir = makeScratchDir();
  fs.mkdirSync(path.join(dir, ".codex"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, ".codex", "config.toml"),
    TOML.stringify({ approval_policy: "never", some_other_key: "keep-me" })
  );

  const servers = buildServerDefs({ codebaseMemoryMcpPath: null });
  const configPath = writeCodexConfig(dir, servers);
  const parsed = TOML.parse(fs.readFileSync(configPath, "utf8"));

  assert.equal(parsed.approval_policy, "never", "existing approval_policy must be preserved");
  assert.equal(parsed.some_other_key, "keep-me", "unrelated existing keys must survive");
  assert.ok(parsed.mcp_servers.sonarqube, "mcp_servers should still be added");
});
