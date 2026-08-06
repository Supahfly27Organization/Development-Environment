import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { writeManaged } from "./file-writer.js";

const SOURCES_DIR = path.join(os.homedir(), ".agentic-ecosystem", "sources");

// These both ship a skills/<name>/SKILL.md tree that Codex and GitHub Copilot
// discover natively from .agents/skills/ - no format translation needed.
const SKILL_SOURCES = [
  { name: "superpowers", repo: "https://github.com/obra/superpowers.git" },
  { name: "product-superpowers", repo: "https://github.com/guhcostan/product-superpowers.git" },
];

export function cacheDirFor(sourceName) {
  return path.join(SOURCES_DIR, sourceName);
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

/** Recursively lists all file paths under `dir`, relative to `dir`. */
function listFilesRecursive(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      for (const sub of listFilesRecursive(path.join(dir, entry.name))) {
        files.push(path.join(entry.name, sub));
      }
    } else {
      files.push(entry.name);
    }
  }
  return files;
}

const TEXT_EXTENSIONS = new Set([
  ".md", ".txt", ".yaml", ".yml", ".json", ".toml", ".sh", ".ps1", ".js", ".ts",
]);

/** Returns true if the file should be treated as text and handled by writeManaged. */
function isTextFile(filePath) {
  return TEXT_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

/**
 * Copies skills/<name>/ from both cached source repos into <targetFolder>/.agents/skills/.
 * Text files inside each skill folder are handled by writeManaged, giving the user the full
 * Keep / Overwrite / Append / Show diff prompt when a conflict exists.
 * Binary files (images, compiled assets, etc.) are copied directly with fs.copyFileSync.
 *
 * @param {string} targetFolder
 * @param {{ select?: Function, sourcesDir?: string }} [deps] - Optional injectable dependencies for testing.
 */
export async function copySkillsIntoProject(targetFolder, deps = {}) {
  const sourcesDir = deps.sourcesDir ?? SOURCES_DIR;
  const destRoot = path.join(targetFolder, ".agents", "skills");
  fs.mkdirSync(destRoot, { recursive: true });

  const results = { copied: [], skipped: [], overwritten: [], appended: [] };

  for (const source of SKILL_SOURCES) {
    const skillsDir = path.join(sourcesDir, source.name, "skills");
    if (!fs.existsSync(skillsDir)) continue;

    for (const skillName of fs.readdirSync(skillsDir)) {
      const srcSkillDir = path.join(skillsDir, skillName);
      if (!fs.statSync(srcSkillDir).isDirectory()) continue;

      const destSkillDir = path.join(destRoot, skillName);

      for (const relFile of listFilesRecursive(srcSkillDir)) {
        const srcFile = path.join(srcSkillDir, relFile);
        const destFile = path.join(destSkillDir, relFile);

        if (isTextFile(relFile)) {
          const content = fs.readFileSync(srcFile, "utf8");
          const status = await writeManaged(destFile, content, deps);

          if (status === "created") results.copied.push(path.join(skillName, relFile));
          else if (status === "appended") results.appended.push(path.join(skillName, relFile));
          else if (status === "overwritten") results.overwritten.push(path.join(skillName, relFile));
          else results.skipped.push(path.join(skillName, relFile)); // "kept" | "unchanged"
        } else {
          // Binary file: copy directly, overwriting if present.
          fs.mkdirSync(path.dirname(destFile), { recursive: true });
          const isNew = !fs.existsSync(destFile);
          fs.copyFileSync(srcFile, destFile);
          if (isNew) results.copied.push(path.join(skillName, relFile));
          else results.overwritten.push(path.join(skillName, relFile));
        }
      }
    }
  }

  return results;
}
