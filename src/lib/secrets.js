import fs from "node:fs";
import path from "node:path";
import * as p from "@clack/prompts";

const WANTED_SECRETS = [
  { key: "GITHUB_TOKEN", message: "GitHub personal access token (used by the github MCP server)" },
  { key: "SONAR_TOKEN", message: "SonarQube token (used by the sonarqube MCP server)" },
];

/**
 * Prompts for any missing secrets and writes/updates `.env` at the project root.
 * @param {Record<string, string>} [prefilled] - values already obtained automatically
 *        (e.g. an auto-generated SONAR_TOKEN); written without prompting.
 */
export async function collectAndWriteSecrets(targetFolder, { wantsSecrets }, prefilled = {}) {
  if (!wantsSecrets) {
    return { written: false };
  }

  const envPath = path.join(targetFolder, ".env");
  const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
  const existingKeys = new Set(
    existing
      .split("\n")
      .map((l) => l.match(/^([A-Z0-9_]+)=/)?.[1])
      .filter(Boolean)
  );

  const lines = existing ? [existing.replace(/\n+$/, "")] : [];
  let added = 0;

  for (const { key, message } of WANTED_SECRETS) {
    if (existingKeys.has(key)) continue;
    if (prefilled[key]) {
      lines.push(`${key}=${prefilled[key]}`);
      added++;
      continue;
    }
    const value = await p.text({ message: `${message} (leave blank to fill in later)` });
    if (p.isCancel(value)) {
      p.cancel("Cancelled.");
      process.exit(1);
    }
    lines.push(`${key}=${value || ""}`);
    added++;
  }

  if (added > 0) {
    fs.writeFileSync(envPath, lines.join("\n") + "\n");
  }

  return { written: added > 0, path: envPath, addedCount: added };
}
