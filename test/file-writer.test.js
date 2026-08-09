import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { writeManaged } from "../src/lib/file-writer.js";

function makeScratchDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "aeco-test-"));
}

test("writeManaged creates a file that doesn't exist yet", async () => {
  const dir = makeScratchDir();
  const target = path.join(dir, "nested", "file.txt");
  const status = await writeManaged(target, "hello\n");
  assert.equal(status, "created");
  assert.equal(fs.readFileSync(target, "utf8"), "hello\n");
});

test("writeManaged is a silent no-op when content is byte-identical", async () => {
  const dir = makeScratchDir();
  const target = path.join(dir, "file.txt");
  await writeManaged(target, "hello\n");
  const status = await writeManaged(target, "hello\n");
  assert.equal(status, "unchanged");
});

// Note: the "existing file differs" branch prompts interactively via
// @clack/prompts and isn't covered here - it needs a real TTY/mocked prompt.
