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

/** Copies skills/<name>/ from both cached source repos into <targetFolder>/.agents/skills/. */
export async function copySkillsIntoProject(targetFolder) {
  const destRoot = path.join(targetFolder, ".agents", "skills");
  fs.mkdirSync(destRoot, { recursive: true });

  const results = { copied: [], skipped: [], overwritten: [] };

  for (const source of SKILL_SOURCES) {
    const skillsDir = path.join(cacheDirFor(source.name), "skills");
    if (!fs.existsSync(skillsDir)) continue;

    for (const skillName of fs.readdirSync(skillsDir)) {
      const src = path.join(skillsDir, skillName);
      if (!fs.statSync(src).isDirectory()) continue;

      const dest = path.join(destRoot, skillName);
      if (fs.existsSync(dest)) {
        const choice = await p.select({
          message: `.agents/skills/${skillName} already exists. What do you want to do?`,
          options: [
            { value: "keep", label: "Keep existing (skip)" },
            { value: "overwrite", label: "Overwrite from source" },
          ],
        });
        if (p.isCancel(choice) || choice === "keep") {
          results.skipped.push(skillName);
          continue;
        }
        fs.rmSync(dest, { recursive: true, force: true });
        fs.cpSync(src, dest, { recursive: true });
        results.overwritten.push(skillName);
        continue;
      }

      fs.cpSync(src, dest, { recursive: true });
      results.copied.push(skillName);
    }
  }

  return results;
}
