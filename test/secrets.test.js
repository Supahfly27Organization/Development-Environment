import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { collectAndWriteSecrets } from "../src/lib/secrets.js";

function makeScratchDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "aeco-test-"));
}

test("collectAndWriteSecrets writes a prefilled value without prompting", async () => {
  const dir = makeScratchDir();
  fs.writeFileSync(path.join(dir, ".env"), "GITHUB_TOKEN=abc\n");

  const result = await collectAndWriteSecrets(
    dir,
    { wantsSecrets: true },
    { SONAR_TOKEN: "squ_generated" }
  );

  assert.equal(result.written, true);
  const env = fs.readFileSync(path.join(dir, ".env"), "utf8");
  assert.match(env, /GITHUB_TOKEN=abc/);
  assert.match(env, /SONAR_TOKEN=squ_generated/);
});

test("collectAndWriteSecrets doesn't overwrite an existing key with a prefilled value", async () => {
  const dir = makeScratchDir();
  fs.writeFileSync(path.join(dir, ".env"), "GITHUB_TOKEN=abc\nSONAR_TOKEN=already-set\n");

  const result = await collectAndWriteSecrets(
    dir,
    { wantsSecrets: true },
    { SONAR_TOKEN: "squ_generated" }
  );

  assert.equal(result.written, false);
  const env = fs.readFileSync(path.join(dir, ".env"), "utf8");
  assert.match(env, /SONAR_TOKEN=already-set/);
});

test("collectAndWriteSecrets is a no-op when wantsSecrets is false, even with prefilled values", async () => {
  const dir = makeScratchDir();
  const result = await collectAndWriteSecrets(dir, { wantsSecrets: false }, { SONAR_TOKEN: "squ_generated" });
  assert.equal(result.written, false);
  assert.equal(fs.existsSync(path.join(dir, ".env")), false);
});
