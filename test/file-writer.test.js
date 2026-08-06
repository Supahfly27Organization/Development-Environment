import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { writeManaged } from "../src/lib/file-writer.js";

function makeScratchDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "aeco-test-"));
}

/** Returns a stub deps object whose `select` always resolves to `value`. */
function stubSelect(value) {
  return { select: async () => value };
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

test("writeManaged appends generated content when user chooses append (existing ends with newline)", async () => {
  const dir = makeScratchDir();
  const target = path.join(dir, "file.md");
  fs.writeFileSync(target, "# Existing\n");
  const status = await writeManaged(target, "## Generated\n", stubSelect("append"));
  assert.equal(status, "appended");
  assert.equal(fs.readFileSync(target, "utf8"), "# Existing\n## Generated\n");
});

test("writeManaged appends with a newline separator when existing file does not end with newline", async () => {
  const dir = makeScratchDir();
  const target = path.join(dir, "file.md");
  fs.writeFileSync(target, "# Existing");
  const status = await writeManaged(target, "## Generated\n", stubSelect("append"));
  assert.equal(status, "appended");
  assert.equal(fs.readFileSync(target, "utf8"), "# Existing\n## Generated\n");
});

test("writeManaged overwrites file when user chooses overwrite", async () => {
  const dir = makeScratchDir();
  const target = path.join(dir, "file.md");
  fs.writeFileSync(target, "# Old content\n");
  const status = await writeManaged(target, "# New content\n", stubSelect("overwrite"));
  assert.equal(status, "overwritten");
  assert.equal(fs.readFileSync(target, "utf8"), "# New content\n");
});

test("writeManaged leaves file untouched when user chooses keep", async () => {
  const dir = makeScratchDir();
  const target = path.join(dir, "file.md");
  fs.writeFileSync(target, "# Old content\n");
  const status = await writeManaged(target, "# New content\n", stubSelect("keep"));
  assert.equal(status, "kept");
  assert.equal(fs.readFileSync(target, "utf8"), "# Old content\n");
});
