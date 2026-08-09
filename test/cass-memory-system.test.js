import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { addCmReflectHook, CM_REFLECT_COMMAND } from "../src/lib/cass-memory-system.js";

// Note: detectCm/installCm/initCm/isCmServeRunning/startCmServe shell out to the
// real `cm`/`scoop`/`bash` tools or the network and aren't covered here - same
// convention as claude-plugins.js and docker-stack.js.

function makeScratchDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "aeco-test-"));
}

test("addCmReflectHook adds a post-session entry to a fresh hooks.json", () => {
  const dir = makeScratchDir();
  const status = addCmReflectHook(dir);
  assert.equal(status, "added");
  const hooks = JSON.parse(fs.readFileSync(path.join(dir, ".claude", "hooks.json"), "utf8"));
  assert.deepEqual(hooks["post-session"], [CM_REFLECT_COMMAND]);
});

test("addCmReflectHook is idempotent and preserves existing hooks", () => {
  const dir = makeScratchDir();
  fs.mkdirSync(path.join(dir, ".claude"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, ".claude", "hooks.json"),
    JSON.stringify({ "post-session": ["some-other-command"] }, null, 2)
  );

  addCmReflectHook(dir);
  const status = addCmReflectHook(dir);
  assert.equal(status, "unchanged");

  const hooks = JSON.parse(fs.readFileSync(path.join(dir, ".claude", "hooks.json"), "utf8"));
  assert.deepEqual(hooks["post-session"], ["some-other-command", CM_REFLECT_COMMAND]);
});
