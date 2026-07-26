import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeManaged } from "./file-writer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BODY_TEMPLATE_PATH = path.join(__dirname, "..", "..", "templates", "instructions-body.template.md");

function renderBody({ projectName, description, techStack }) {
  const template = fs.readFileSync(BODY_TEMPLATE_PATH, "utf8");
  return template
    .replaceAll("{{PROJECT_NAME}}", projectName || "This project")
    .replaceAll("{{PROJECT_DESCRIPTION}}", description || "_(describe what this project does)_")
    .replaceAll("{{TECH_STACK}}", techStack || "_(list primary languages/frameworks)_");
}

/**
 * CLAUDE.md holds the actual working rules/project content (single source of
 * truth). AGENTS.md and .github/copilot-instructions.md are thin pointer
 * files back to it, so there's nothing to keep in sync across three copies.
 */
export async function generateInstructionFiles(targetFolder, answers, tools) {
  const body = renderBody(answers);
  const results = {};

  // CLAUDE.md is the canonical source, written whenever any tool is selected
  // (Codex/Copilot's own files point back to it).
  const claudeContent = `# CLAUDE.md\n\n${body}\n`;
  results.claude = await writeManaged(path.join(targetFolder, "CLAUDE.md"), claudeContent);

  if (tools.includes("codex")) {
    const content = `# AGENTS.md\n\nThis project's working rules and context live in [CLAUDE.md](./CLAUDE.md) — read that file for the full instructions.\n\n<!-- Codex-specific notes go here. Skills live in .agents/skills/. -->\n`;
    results.codex = await writeManaged(path.join(targetFolder, "AGENTS.md"), content);
  }

  if (tools.includes("copilot")) {
    const content = `# Copilot instructions\n\nThis project's working rules and context live in [CLAUDE.md](../CLAUDE.md) — read that file for the full instructions.\n\n<!-- Copilot-specific notes go here. Agent Skills live in .agents/skills/. -->\n`;
    results.copilot = await writeManaged(
      path.join(targetFolder, ".github", "copilot-instructions.md"),
      content
    );
  }

  return results;
}
