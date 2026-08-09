import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import * as p from "@clack/prompts";

const SOURCES_DIR = path.join(os.homedir(), ".agentic-ecosystem", "sources");

// These both ship a skills/<name>/SKILL.md tree that Codex and GitHub Copilot
// discover natively from .agents/skills/ - no format translation needed.
const SKILL_SOURCES = [
  { name: "superpowers", repo: "https://github.com/obra/superpowers.git" },
  { name: "product-superpowers", repo: "https://github.com/guhcostan/product-superpowers.git" },
];

export function cacheDirFor(sourceName, sourcesDir = SOURCES_DIR) {
  return path.join(sourcesDir, sourceName);
}

export function isSkillSourceCachePresent() {
  return SKILL_SOURCES.every((s) => fs.existsSync(path.join(cacheDirFor(s.name), "skills")));
}

/** Shallow-clones (or fast-forward pulls) both skill source repos into the local cache. */
export function updateSkillSourceCache() {
  fs.mkdirSync(SOURCES_DIR, { recursive: true });
  for (const source of SKILL_SOURCES) {
    const dir = cacheDirFor(source.name);
    if (fs.existsSync(path.join(dir, ".git"))) {
      execFileSync("git", ["-C", dir, "pull", "--ff-only"], { stdio: "inherit", shell: true });
    } else {
      execFileSync("git", ["clone", "--depth", "1", source.repo, dir], { stdio: "inherit", shell: true });
    }
  }
}

/** Recursively lists files under `dir`, as POSIX-style paths relative to `dir`. */
function listFilesRecursive(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFilesRecursive(full).map((f) => path.posix.join(entry.name, f)));
    } else if (entry.isFile()) {
      out.push(entry.name);
    }
  }
  return out;
}

/**
 * Copies skills/<name>/ from both cached source repos into <targetFolder>/.agents/skills/,
 * file by file. Byte-identical existing files are left alone without prompting; files that
 * differ prompt for keep/overwrite/append. Returns relative "skillName/path/to/file" labels
 * in each bucket.
 *
 * @param {string} targetFolder
 * @param {object} [deps]
 * @param {string} [deps.sourcesDir] - override for the skill source cache root (for tests).
 * @param {(opts: object) => Promise<string>} [deps.select] - override for @clack/prompts' select (for tests).
 */
export async function copySkillsIntoProject(targetFolder, deps = {}) {
  const sourcesDir = deps.sourcesDir ?? SOURCES_DIR;
  const select = deps.select ?? p.select;

  const destRoot = path.join(targetFolder, ".agents", "skills");
  fs.mkdirSync(destRoot, { recursive: true });

  const results = { copied: [], skipped: [], overwritten: [], appended: [] };

  for (const source of SKILL_SOURCES) {
    const skillsDir = path.join(cacheDirFor(source.name, sourcesDir), "skills");
    if (!fs.existsSync(skillsDir)) continue;

    for (const skillName of fs.readdirSync(skillsDir)) {
      const skillSrcDir = path.join(skillsDir, skillName);
      if (!fs.statSync(skillSrcDir).isDirectory()) continue;

      for (const relFile of listFilesRecursive(skillSrcDir)) {
        const srcFile = path.join(skillSrcDir, relFile);
        const destFile = path.join(destRoot, skillName, relFile);
        const label = path.posix.join(skillName, relFile);
        const content = fs.readFileSync(srcFile, "utf8");

        if (!fs.existsSync(destFile)) {
          fs.mkdirSync(path.dirname(destFile), { recursive: true });
          fs.writeFileSync(destFile, content);
          results.copied.push(label);
          continue;
        }

        const existing = fs.readFileSync(destFile, "utf8");
        if (existing === content) {
          results.skipped.push(label);
          continue;
        }

        const choice = await select({
          message: `.agents/skills/${label} already exists and differs from the generated version. What do you want to do?`,
          options: [
            { value: "keep", label: "Keep existing (skip)" },
            { value: "overwrite", label: "Overwrite from source" },
            { value: "append", label: "Append generated content to the existing file" },
          ],
        });

        if (p.isCancel(choice) || choice === "keep") {
          results.skipped.push(label);
          continue;
        }

        if (choice === "append") {
          fs.writeFileSync(destFile, existing + content);
          results.appended.push(label);
          continue;
        }

        fs.writeFileSync(destFile, content);
        results.overwritten.push(label);
      }
    }
  }

  return results;
}
