import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  copyIssueTemplates,
  copyIssueWorkflowSkills,
  addGithubWorkflowHook,
  escapeForPowerShellSingleQuote,
} from "../src/lib/github-issue-workflow.js";

function makeScratchDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "aeco-test-"));
}

test("copyIssueTemplates writes epic/user_story/bug forms under .github/ISSUE_TEMPLATE/", async () => {
  const dir = makeScratchDir();
  const results = await copyIssueTemplates(dir);
  assert.deepEqual(results, { "epic.yml": "created", "user_story.yml": "created", "bug.yml": "created" });
  const epic = fs.readFileSync(path.join(dir, ".github", "ISSUE_TEMPLATE", "epic.yml"), "utf8");
  assert.match(epic, /name: Epic/);
});

test("copyIssueWorkflowSkills writes the three SKILL.md files under .claude/skills/", async () => {
  const dir = makeScratchDir();
  const results = await copyIssueWorkflowSkills(dir);
  assert.deepEqual(results, {
    "github-issue-sync": "created",
    "github-issue-start": "created",
    "github-issue-commit": "created",
  });
  const sync = fs.readFileSync(path.join(dir, ".claude", "skills", "github-issue-sync", "SKILL.md"), "utf8");
  assert.match(sync, /name: github-issue-sync/);
  assert.match(sync, /ask the user whether to create one now/);
});

test("addGithubWorkflowHook adds a SessionStart hook to a fresh settings.json", async () => {
  const dir = makeScratchDir();
  const status = addGithubWorkflowHook(dir);
  assert.equal(status, "added");
  const settings = JSON.parse(fs.readFileSync(path.join(dir, ".claude", "settings.json"), "utf8"));
  assert.equal(settings.hooks.SessionStart.length, 1);
  assert.match(settings.hooks.SessionStart[0].hooks[0].command, /github-issue-sync/);
});

test("escapeForPowerShellSingleQuote doubles embedded single quotes", () => {
  assert.equal(escapeForPowerShellSingleQuote("doesn't"), "doesn''t");
  assert.equal(escapeForPowerShellSingleQuote("no quotes here"), "no quotes here");
  assert.equal(escapeForPowerShellSingleQuote("it's, isn't, won't"), "it''s, isn''t, won''t");
});

test("addGithubWorkflowHook is idempotent and preserves existing settings", async () => {
  const dir = makeScratchDir();
  fs.mkdirSync(path.join(dir, ".claude"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, ".claude", "settings.json"),
    JSON.stringify({ enabledPlugins: { foo: true } }, null, 2)
  );

  addGithubWorkflowHook(dir);
  const status = addGithubWorkflowHook(dir);
  assert.equal(status, "unchanged");

  const settings = JSON.parse(fs.readFileSync(path.join(dir, ".claude", "settings.json"), "utf8"));
  assert.equal(settings.enabledPlugins.foo, true);
  assert.equal(settings.hooks.SessionStart.length, 1);
});
