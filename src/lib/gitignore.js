import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.join(__dirname, "..", "..", "templates", "gitignore.template");

/**
 * Writes .gitignore if absent. If one already exists, appends only the lines
 * that are missing (never replaces or reorders what's already there).
 */
export function ensureGitignore(targetFolder) {
  const templateContent = fs.readFileSync(TEMPLATE_PATH, "utf8");
  const targetPath = path.join(targetFolder, ".gitignore");

  if (!fs.existsSync(targetPath)) {
    fs.writeFileSync(targetPath, templateContent);
    return { status: "created" };
  }

  const existing = fs.readFileSync(targetPath, "utf8");
  const existingLines = new Set(
    existing.split("\n").map((l) => l.trim()).filter(Boolean)
  );
  const missingLines = templateContent
    .split("\n")
    .filter((line) => line.trim() && !existingLines.has(line.trim()));

  if (missingLines.length === 0) {
    return { status: "unchanged" };
  }

  const appended =
    existing.replace(/\n+$/, "") +
    "\n\n# --- appended by aeco (agentic-ecosystem) ---\n" +
    missingLines.join("\n") +
    "\n";
  fs.writeFileSync(targetPath, appended);
  return { status: "appended", count: missingLines.length };
}
