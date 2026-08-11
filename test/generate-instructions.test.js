import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { generateInstructionFiles } from "../src/lib/generate-instructions.js";

function makeScratchDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "aeco-test-"));
}

const answers = { projectName: "Widgets", description: "Makes widgets.", techStack: "Go, Postgres" };

test("CLAUDE.md is always written and contains the filled-in project info", async () => {
  const dir = makeScratchDir();
  await generateInstructionFiles(dir, answers, ["claude"]);
  const content = fs.readFileSync(path.join(dir, "CLAUDE.md"), "utf8");
  assert.match(content, /Widgets/);
  assert.match(content, /Makes widgets\./);
  assert.match(content, /Go, Postgres/);
});

test("AGENTS.md is a thin pointer to CLAUDE.md, not a duplicate copy", async () => {
  const dir = makeScratchDir();
  await generateInstructionFiles(dir, answers, ["codex"]);
  const content = fs.readFileSync(path.join(dir, "AGENTS.md"), "utf8");
  assert.match(content, /\[CLAUDE\.md\]\(\.\/CLAUDE\.md\)/);
  assert.doesNotMatch(content, /Working Rules/, "should not duplicate the full body");
});

test("copilot-instructions.md is a thin pointer to CLAUDE.md with a relative path from .github/", async () => {
  const dir = makeScratchDir();
  await generateInstructionFiles(dir, answers, ["copilot"]);
  const content = fs.readFileSync(path.join(dir, ".github", "copilot-instructions.md"), "utf8");
  assert.match(content, /\[CLAUDE\.md\]\(\.\.\/CLAUDE\.md\)/);
});

test("CLAUDE.md is written even when only codex/copilot are selected, since they point back to it", async () => {
  const dir = makeScratchDir();
  const results = await generateInstructionFiles(dir, answers, ["codex", "copilot"]);
  assert.ok(fs.existsSync(path.join(dir, "CLAUDE.md")));
  assert.equal(results.claude, "created");
});

test("CLAUDE.md references the four docs/claude reference docs, and all four are written", async () => {
  const dir = makeScratchDir();
  const results = await generateInstructionFiles(dir, answers, ["claude"]);
  const content = fs.readFileSync(path.join(dir, "CLAUDE.md"), "utf8");
  for (const file of [
    "DOMAIN_MODEL.md",
    "PATTERNS.md",
    "SCANNING_TOOLS.md",
    "KNOWLEDGE_TOOLS.md",
  ]) {
    assert.match(content, new RegExp(`docs/claude/${file}`));
    assert.ok(fs.existsSync(path.join(dir, "docs", "claude", file)), `${file} should be written`);
    assert.equal(results.claudeDocs[file], "created");
  }
});

test("docs/claude reference docs contain no leftover UpFront-specific content", async () => {
  const dir = makeScratchDir();
  await generateInstructionFiles(dir, answers, ["claude"]);
  for (const file of ["DOMAIN_MODEL.md", "PATTERNS.md", "SCANNING_TOOLS.md", "KNOWLEDGE_TOOLS.md"]) {
    const content = fs.readFileSync(path.join(dir, "docs", "claude", file), "utf8");
    assert.doesNotMatch(content, /UpFront/i);
  }
});

test("CLAUDE.md's Local DB Defaults section is present with no filled-in values", async () => {
  const dir = makeScratchDir();
  await generateInstructionFiles(dir, answers, ["claude"]);
  const content = fs.readFileSync(path.join(dir, "CLAUDE.md"), "utf8");
  assert.match(content, /## Local DB Defaults/);
  assert.doesNotMatch(content, /Host=localhost/);
});
