import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeManaged } from "./file-writer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_ROOT = path.join(__dirname, "..", "..", "templates");
const ISSUE_TEMPLATES_DIR = path.join(TEMPLATES_ROOT, "github-issue-templates");
const CLAUDE_SKILLS_DIR = path.join(TEMPLATES_ROOT, "claude-skills");

const ISSUE_TEMPLATE_FILES = ["epic.yml", "user_story.yml", "bug.yml"];
const SKILL_NAMES = ["github-issue-sync", "github-issue-start", "github-issue-commit"];

const HOOK_CONTEXT =
  "GitHub issue workflow: after product-superpowers stories are approved, use the github-issue-sync skill " +
  "to create GitHub issues (epics + linked stories) from the approved stories doc. Use github-issue-start " +
  "right before beginning implementation on a tracked issue, and github-issue-commit when closing out that work.";

/** Escapes a string for safe embedding inside a PowerShell single-quoted literal. */
export function escapeForPowerShellSingleQuote(value) {
  return value.replace(/'/g, "''");
}

const HOOK_COMMAND =
  `Write-Output '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"` +
  `${escapeForPowerShellSingleQuote(HOOK_CONTEXT)}"}}'`;

/** Copies the Epic/User Story/Bug issue-form templates into <targetFolder>/.github/ISSUE_TEMPLATE/. */
export async function copyIssueTemplates(targetFolder) {
  const destDir = path.join(targetFolder, ".github", "ISSUE_TEMPLATE");
  const results = {};
  for (const file of ISSUE_TEMPLATE_FILES) {
    const content = fs.readFileSync(path.join(ISSUE_TEMPLATES_DIR, file), "utf8");
    results[file] = await writeManaged(path.join(destDir, file), content);
  }
  return results;
}

/** Copies the github-issue-{sync,start,commit} skills into <targetFolder>/.claude/skills/. */
export async function copyIssueWorkflowSkills(targetFolder) {
  const results = {};
  for (const name of SKILL_NAMES) {
    const content = fs.readFileSync(path.join(CLAUDE_SKILLS_DIR, name, "SKILL.md"), "utf8");
    results[name] = await writeManaged(
      path.join(targetFolder, ".claude", "skills", name, "SKILL.md"),
      content
    );
  }
  return results;
}

/**
 * Adds a SessionStart hook to <targetFolder>/.claude/settings.json that reminds Claude to use
 * the github-issue-{sync,start,commit} skills at the right points. Idempotent: won't add a
 * duplicate entry if one with the same command already exists.
 */
export function addGithubWorkflowHook(targetFolder) {
  const settingsPath = path.join(targetFolder, ".claude", "settings.json");
  const settings = fs.existsSync(settingsPath)
    ? JSON.parse(fs.readFileSync(settingsPath, "utf8"))
    : {};

  settings.hooks = settings.hooks ?? {};
  settings.hooks.SessionStart = settings.hooks.SessionStart ?? [];

  const alreadyPresent = settings.hooks.SessionStart.some((group) =>
    (group.hooks ?? []).some((hook) => hook.command === HOOK_COMMAND)
  );

  if (!alreadyPresent) {
    settings.hooks.SessionStart.push({
      hooks: [{ type: "command", command: HOOK_COMMAND, shell: "powershell" }],
    });
  }

  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n");
  return alreadyPresent ? "unchanged" : "added";
}
