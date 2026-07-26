import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ensureToolsComposeFile } from "../src/lib/docker-stack.js";

// Note: dockerAvailable/toolsStackFullyRunning/startToolsStack shell out to the
// real `docker` CLI and aren't covered here - same convention as claude-plugins.js.

function makeScratchDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "aeco-test-"));
}

test("ensureToolsComposeFile writes tools-docker-compose.yml with the project path substituted", async () => {
  const dir = makeScratchDir();
  const result = await ensureToolsComposeFile(dir);

  assert.equal(result.status, "created");
  assert.equal(result.path, path.join(dir, "tools-docker-compose.yml"));

  const content = fs.readFileSync(result.path, "utf8");
  assert.ok(!content.includes("{{PROJECT_DIR}}"), "placeholder should be substituted");
  assert.ok(content.includes(dir.replace(/\\/g, "/")), "should bind-mount the target folder");
  assert.ok(content.includes("container_name: sonarqube"));
});

test("ensureToolsComposeFile is a no-op when the file already matches", async () => {
  const dir = makeScratchDir();
  await ensureToolsComposeFile(dir);
  const result = await ensureToolsComposeFile(dir);
  assert.equal(result.status, "unchanged");
});
