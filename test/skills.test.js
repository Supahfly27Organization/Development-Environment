import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { copySkillsIntoProject } from "../src/lib/skills.js";

function makeScratchDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "aeco-skills-test-"));
}

/**
 * Creates a fake skill source cache at `sourcesDir`:
 *   sourcesDir/superpowers/skills/<skillName>/<files...>
 * product-superpowers/skills/ is created empty so the source is present.
 */
function makeSourceCache(sourcesDir, skillName, files) {
  for (const [relPath, content] of Object.entries(files)) {
    const full = path.join(sourcesDir, "superpowers", "skills", skillName, relPath);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }
  fs.mkdirSync(path.join(sourcesDir, "product-superpowers", "skills"), { recursive: true });
}

function stubSelect(value) {
  return { select: async () => value };
}

function deps(sourcesDir, selectValue) {
  return { sourcesDir, ...stubSelect(selectValue) };
}

// ── tests ─────────────────────────────────────────────────────────────────────

test("copySkillsIntoProject copies new skill files with status 'copied'", async () => {
  const sourcesDir = makeScratchDir();
  const target = makeScratchDir();
  makeSourceCache(sourcesDir, "my-skill", { "SKILL.md": "# My Skill\n" });

  const results = await copySkillsIntoProject(target, deps(sourcesDir, "keep"));

  assert.ok(results.copied.some((f) => f.includes("SKILL.md")), "SKILL.md should be copied");
  assert.equal(results.skipped.length, 0);
  assert.equal(results.overwritten.length, 0);
  assert.equal(results.appended.length, 0);

  const dest = path.join(target, ".agents", "skills", "my-skill", "SKILL.md");
  assert.equal(fs.readFileSync(dest, "utf8"), "# My Skill\n");
});

test("copySkillsIntoProject keeps existing file when user chooses keep", async () => {
  const sourcesDir = makeScratchDir();
  const target = makeScratchDir();
  makeSourceCache(sourcesDir, "my-skill", { "SKILL.md": "# New version\n" });

  const destFile = path.join(target, ".agents", "skills", "my-skill", "SKILL.md");
  fs.mkdirSync(path.dirname(destFile), { recursive: true });
  fs.writeFileSync(destFile, "# My custom version\n");

  const results = await copySkillsIntoProject(target, deps(sourcesDir, "keep"));

  assert.ok(results.skipped.some((f) => f.includes("SKILL.md")));
  assert.equal(fs.readFileSync(destFile, "utf8"), "# My custom version\n");
});

test("copySkillsIntoProject overwrites existing file when user chooses overwrite", async () => {
  const sourcesDir = makeScratchDir();
  const target = makeScratchDir();
  makeSourceCache(sourcesDir, "my-skill", { "SKILL.md": "# New version\n" });

  const destFile = path.join(target, ".agents", "skills", "my-skill", "SKILL.md");
  fs.mkdirSync(path.dirname(destFile), { recursive: true });
  fs.writeFileSync(destFile, "# My custom version\n");

  const results = await copySkillsIntoProject(target, deps(sourcesDir, "overwrite"));

  assert.ok(results.overwritten.some((f) => f.includes("SKILL.md")));
  assert.equal(fs.readFileSync(destFile, "utf8"), "# New version\n");
});

test("copySkillsIntoProject appends to existing file when user chooses append", async () => {
  const sourcesDir = makeScratchDir();
  const target = makeScratchDir();
  makeSourceCache(sourcesDir, "my-skill", { "SKILL.md": "## Generated section\n" });

  const destFile = path.join(target, ".agents", "skills", "my-skill", "SKILL.md");
  fs.mkdirSync(path.dirname(destFile), { recursive: true });
  fs.writeFileSync(destFile, "# My custom version\n");

  const results = await copySkillsIntoProject(target, deps(sourcesDir, "append"));

  assert.ok(results.appended.some((f) => f.includes("SKILL.md")));
  assert.equal(
    fs.readFileSync(destFile, "utf8"),
    "# My custom version\n## Generated section\n"
  );
});

test("copySkillsIntoProject handles unchanged file silently without prompting", async () => {
  const sourcesDir = makeScratchDir();
  const target = makeScratchDir();
  makeSourceCache(sourcesDir, "my-skill", { "SKILL.md": "# Identical\n" });

  const destFile = path.join(target, ".agents", "skills", "my-skill", "SKILL.md");
  fs.mkdirSync(path.dirname(destFile), { recursive: true });
  fs.writeFileSync(destFile, "# Identical\n");

  let promptCalled = false;
  const d = { sourcesDir, select: async () => { promptCalled = true; return "keep"; } };
  const results = await copySkillsIntoProject(target, d);

  assert.equal(promptCalled, false, "prompt must not be shown for identical files");
  assert.ok(results.skipped.some((f) => f.includes("SKILL.md")));
});
