import * as p from "@clack/prompts";
import { ensureDependency } from "../lib/ensure-dependency.js";
import { dockerAvailable, writeComposeFile, startStack } from "../lib/docker-stack.js";
import { ensureMarketplacesRegistered, claudeCliAvailable } from "../lib/claude-plugins.js";
import { updateSkillSourceCache, isSkillSourceCachePresent } from "../lib/skills.js";

export async function runMachineSetup() {
  p.intro("Agentic Ecosystem — machine setup");

  // 1. Shared Docker stack (sonarqube+postgres, semgrep-mcp, trivy, trivy-mcp)
  const dockerStep = await ensureDependency({
    name: "Docker",
    detect: () => dockerAvailable(),
    autoInstall: null, // Docker Desktop install isn't something to automate silently
    manualInstructions:
      "Install Docker Desktop, then re-check (or skip if you don't need the local SonarQube/semgrep/trivy MCP servers).",
  });

  if (dockerStep.status !== "skipped") {
    const projectsRoot = await p.text({
      message:
        "Projects root to mount into the shared scanning containers (semgrep/trivy will see everything under this folder)",
      initialValue: "F:\\git",
    });
    if (!p.isCancel(projectsRoot)) {
      const composePath = writeComposeFile(String(projectsRoot));
      const proceed = await p.confirm({
        message: `Start the shared mcp-tools Docker stack now (${composePath})?`,
        initialValue: true,
      });
      if (!p.isCancel(proceed) && proceed) {
        const result = startStack();
        if (result.ok) {
          p.log.success(`mcp-tools stack starting. Check status with: docker compose -f "${composePath}" ps`);
        } else {
          p.log.warn(
            `Docker stack failed to start (a port may already be in use — check the output above). Fix the conflict then run: docker compose -f "${composePath}" up -d`
          );
        }
      }
    }
  } else {
    p.log.warn("Skipped Docker-backed MCP tools setup (semgrep/trivy/sonarqube).");
  }

  // 2. Claude Code marketplaces - registration only. Plugin *installs* happen
  //    per-project in `aeco init` so they're active at repo scope.
  if (claudeCliAvailable()) {
    const proceed = await p.confirm({
      message: "Register the Superpowers and Product Superpowers marketplaces with Claude Code now?",
      initialValue: true,
    });
    if (!p.isCancel(proceed) && proceed) {
      ensureMarketplacesRegistered(process.cwd());
      p.log.success("Marketplaces registered.");
    }
  } else {
    p.log.warn("Claude Code CLI not found on PATH — skipping marketplace registration.");
  }

  // 3. Local skill source cache (used by `aeco init` to populate .agents/skills/)
  if (!isSkillSourceCachePresent()) {
    const proceed = await p.confirm({
      message:
        "Clone the superpowers and product-superpowers skill sources into ~/.agentic-ecosystem/sources/ now?",
      initialValue: true,
    });
    if (!p.isCancel(proceed) && proceed) {
      updateSkillSourceCache();
      p.log.success("Skill sources cached.");
    }
  } else {
    p.log.info("Skill source cache already present — nothing to do.");
  }

  p.outro("Machine setup complete. Run `aeco init` inside any project folder next.");
}
