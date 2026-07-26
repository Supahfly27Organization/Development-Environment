import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ensureGitignore } from "../src/lib/gitignore.js";

function makeScratchDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "aeco-test-"));
}

test("ensureGitignore creates the file when absent", () => {
  const dir = makeScratchDir();
  const result = ensureGitignore(dir);
  assert.equal(result.status, "created");
  assert.ok(fs.existsSync(path.join(dir, ".gitignore")));
});

test("ensureGitignore is a no-op when the file already matches the template", () => {
  const dir = makeScratchDir();
  ensureGitignore(dir);
  const result = ensureGitignore(dir);
  assert.equal(result.status, "unchanged");
});

test("ensureGitignore appends only missing lines, preserving what's already there", () => {
  const dir = makeScratchDir();
  ensureGitignore(dir);
  const gitignorePath = path.join(dir, ".gitignore");

  const original = fs.readFileSync(gitignorePath, "utf8");
  const withoutEnvLine = original.replace("\n.env\n", "\n");
  fs.writeFileSync(gitignorePath, withoutEnvLine + "\nmy-custom-local-line/\n");

  const result = ensureGitignore(dir);
  assert.equal(result.status, "appended");

  const final = fs.readFileSync(gitignorePath, "utf8").split("\n");
  assert.ok(final.includes(".env"), ".env should have been re-appended");
  assert.ok(final.includes("my-custom-local-line/"), "pre-existing custom line must survive");
});
