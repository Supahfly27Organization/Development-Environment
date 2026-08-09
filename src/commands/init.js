import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import * as p from "@clack/prompts";

import { collectInitAnswers } from "../lib/prompts.js";
import { writeManaged } from "../lib/file-writer.js";
import { ensureDependency } from "../lib/ensure-dependency.js";
import { generateInstructionFiles } from "../lib/generate-instructions.js";
import { ensureGitignore } from "../lib/gitignore.js";
import { collectAndWriteSecrets } from "../lib/secrets.js";
import {
  isSkillSourceCachePresent,
  updateSkillSourceCache,
  copySkillsIntoProject,
} from "../lib/skills.js";
import {
  copyIssueTemplates,
  copyIssueWorkflowSkills,
  addGithubWorkflowHook,
} from "../lib/github-issue-workflow.js";
import {
  claudeCliAvailable,
  installProjectPlugins,
  projectPluginsInstalled,
} from "../lib/claude-plugins.js";
import { buildServerDefs, toClaudeMcpJson, toVscodeMcpJson } from "../lib/mcp-servers.js";
import { writeCodexConfig } from "../lib/codex-config.js";
import {
  detectCodebaseMemoryMcp,
  installCodebaseMemoryMcp,
  isWindows,
} from "../lib/codebase-memory-mcp.js";
import {
  detectCm,
  installCm,
  isCmInitialized,
  initCm,
  isCmServeRunning,
  startCmServe,
  addCmReflectHook,
  CM_SERVE_URL,
} from "../lib/cass-memory-system.js";
import {
  dockerAvailable,
  ensureToolsComposeFile,
  toolsStackFullyRunning,
  startToolsStack,
} from "../lib/docker-stack.js";

function gitInitialized(dir) {
  return fs.existsSync(path.join(dir, ".git"));
}

function track(summary, label, status) {
  if (status === "skipped") summary.manual.push(label);
  else summary.created.push(`${label} (${status})`);
}

async function writeClaudeSettings(targetFolder) {
  const settingsPath = path.join(targetFolder, ".claude", "settings.json");
  const existing = fs.existsSync(settingsPath)
    ? JSON.parse(fs.readFileSync(settingsPath, "utf8"))
    : {};

  const merged = {
    ...existing,
    extraKnownMarketplaces: {
      ...(existing.extraKnownMarketplaces ?? {}),
      "superpowers-dev": { source: { source: "github", repo: "obra/superpowers" } },
      "product-superpowers-marketplace": {
        source: { source: "github", repo: "guhcostan/product-superpowers" },
      },
    },
    enabledPlugins: {
      ...(existing.enabledPlugins ?? {}),
      "superpowers@superpowers-dev": true,
      "product-superpowers@product-superpowers-marketplace": true,
    },
  };

  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2) + "\n");
}

function printSummary(summary) {
  console.log("\n--- Summary ---");
  if (summary.created.length) {
    console.log("Created/updated:");
    for (const c of summary.created) console.log(`  - ${c}`);
  }
  if (summary.manual.length) {
    console.log("Needs manual follow-up:");
    for (const m of summary.manual) console.log(`  - ${m}`);
  }
}

export async function runInit({ targetFolder: cliTarget }) {
  p.intro("Agentic Ecosystem — project bootstrap");

  const answers = await collectInitAnswers(cliTarget ?? process.cwd());
  const targetFolder = path.resolve(answers.targetFolder);
  fs.mkdirSync(targetFolder, { recursive: true });

  const summary = { created: [], manual: [] };

  // 1. git init
  const gitStep = await ensureDependency({
    name: "git repository",
    detect: () => gitInitialized(targetFolder),
    autoInstall: {
      confirmMessage: `No git repository found in ${targetFolder}. Run "git init" now?`,
      install: async () =>
        execFileSync("git", ["init"], { cwd: targetFolder, stdio: "inherit", shell: true }),
    },
    manualInstructions: "Initialize git yourself, then re-run this step.",
  });
  track(summary, "git init", gitStep.status);

  // 2. skills (covers Codex + Copilot via .agents/skills; Claude gets the real plugins below)
  if (!isSkillSourceCachePresent()) {
    await ensureDependency({
      name: "superpowers/product-superpowers skill sources",
      detect: () => isSkillSourceCachePresent(),
      autoInstall: {
        confirmMessage:
          "Skill sources aren't cached locally yet. Clone them now (obra/superpowers, guhcostan/product-superpowers)?",
        install: async () => updateSkillSourceCache(),
      },
      manualInstructions:
        "Run `aeco machine-setup` first, or clone https://github.com/obra/superpowers and https://github.com/guhcostan/product-superpowers manually into ~/.agentic-ecosystem/sources/<name>.",
    });
  }
  if (isSkillSourceCachePresent()) {
    const skillResults = await copySkillsIntoProject(targetFolder);
    summary.created.push(
      `.agents/skills/ (${skillResults.copied.length} copied, ${skillResults.skipped.length} kept, ` +
        `${skillResults.overwritten.length} overwritten, ${skillResults.appended.length} appended)`
    );
  } else {
    summary.manual.push("Skipped .agents/skills/ population (no skill source cache available).");
  }

  // 3. instruction files
  const fileResults = await generateInstructionFiles(targetFolder, answers, answers.tools);
  for (const [tool, status] of Object.entries(fileResults)) {
    if (tool === "claudeDocs") continue;
    track(summary, `${tool} instructions file`, status);
  }
  if (fileResults.claudeDocs) {
    const docCount = Object.keys(fileResults.claudeDocs).length;
    summary.created.push(`docs/claude/ (${docCount} reference docs)`);
  }

  // 4. .gitignore
  const gitignoreResult = ensureGitignore(targetFolder);
  track(summary, ".gitignore", gitignoreResult.status);

  // 5. Project-local Docker tools stack (sonarqube/semgrep/trivy) - set up before wiring MCP config below
  if (dockerAvailable()) {
    const toolsCompose = await ensureToolsComposeFile(targetFolder);
    track(summary, "tools-docker-compose.yml", toolsCompose.status);

    if (toolsStackFullyRunning(toolsCompose.path)) {
      summary.created.push("mcp-tools Docker stack already running");
    } else {
      startToolsStack(toolsCompose.path);
      summary.created.push("mcp-tools Docker stack started (sonarqube/semgrep/trivy)");
    }
  } else {
    summary.manual.push(
      "Docker isn't available — tools-docker-compose.yml was not started. Install Docker, then run `docker compose -f tools-docker-compose.yml up -d` yourself."
    );
  }

  // 6. codebase-memory-mcp
  let codebaseMemoryMcpPath = detectCodebaseMemoryMcp();
  if (!codebaseMemoryMcpPath) {
    const cbmStep = await ensureDependency({
      name: "codebase-memory-mcp",
      detect: () => Boolean(detectCodebaseMemoryMcp()),
      autoInstall: isWindows()
        ? {
            confirmMessage: "codebase-memory-mcp isn't installed. Download and install the latest release now?",
            install: async () => installCodebaseMemoryMcp(),
          }
        : null,
      manualInstructions:
        "Install codebase-memory-mcp yourself from https://github.com/DeusData/codebase-memory-mcp/releases, then continue.",
    });
    codebaseMemoryMcpPath = detectCodebaseMemoryMcp();
    track(summary, "codebase-memory-mcp", cbmStep.status);
  }

  // 6b. CASS Memory System (cm) - procedural memory CLI
  let cmPath = detectCm();
  if (!cmPath) {
    const cmStep = await ensureDependency({
      name: "CASS Memory System (cm)",
      detect: () => Boolean(detectCm()),
      autoInstall: {
        confirmMessage: isWindows()
          ? "CASS Memory System (cm) isn't installed. Install it now via Scoop?"
          : "CASS Memory System (cm) isn't installed. Install it now via the official install script?",
        install: async () => installCm(),
      },
      manualInstructions:
        "Install manually: Windows via Scoop (`scoop bucket add dicklesworthstone " +
        "https://github.com/Dicklesworthstone/scoop-bucket` then `scoop install dicklesworthstone/cm`), " +
        "or macOS/Linux via `curl -fsSL " +
        "https://raw.githubusercontent.com/Dicklesworthstone/cass_memory_system/main/install.sh | " +
        "bash -s -- --easy-mode --verify`.",
    });
    cmPath = detectCm();
    track(summary, "CASS Memory System (cm)", cmStep.status);
  }

  let cmServeUrl = null;
  if (cmPath) {
    if (!isCmInitialized()) {
      const cmInitStep = await ensureDependency({
        name: "cm init",
        detect: () => isCmInitialized(),
        autoInstall: {
          confirmMessage: "Run `cm init` to set up CASS Memory System configuration now?",
          install: async () => initCm(cmPath),
        },
        manualInstructions: "Run `cm init` yourself once you're ready.",
      });
      track(summary, "cm init", cmInitStep.status);
    }

    if (await isCmServeRunning()) {
      cmServeUrl = CM_SERVE_URL;
      summary.created.push("cm serve already running");
    } else {
      const cmServeStep = await ensureDependency({
        name: "cm serve (MCP HTTP server)",
        detect: () => isCmServeRunning(),
        autoInstall: {
          confirmMessage: `Start \`cm serve\` in the background now (listens on ${CM_SERVE_URL})?`,
          install: async () => startCmServe(cmPath),
        },
        manualInstructions: `Run \`cm serve\` yourself so the MCP server is reachable at ${CM_SERVE_URL}.`,
      });
      if (cmServeStep.status !== "skipped") cmServeUrl = CM_SERVE_URL;
      track(summary, "cm serve", cmServeStep.status);
    }
  }

  // 7. MCP servers + per-tool config
  const servers = buildServerDefs({ codebaseMemoryMcpPath, projectPath: targetFolder, cmServeUrl });

  if (answers.tools.includes("claude")) {
    const mcpStatus = await writeManaged(path.join(targetFolder, ".mcp.json"), toClaudeMcpJson(servers));
    track(summary, "Claude .mcp.json", mcpStatus);
    await writeClaudeSettings(targetFolder);
    summary.created.push(".claude/settings.json (marketplaces + enabledPlugins)");

    if (cmPath) {
      const cmHookStatus = addCmReflectHook(targetFolder);
      track(summary, ".claude/hooks.json (cm reflect post-session hook)", cmHookStatus);
    }

    if (claudeCliAvailable()) {
      const pluginStep = await ensureDependency({
        name: "Superpowers + Product Superpowers Claude Code plugins",
        detect: () => projectPluginsInstalled(targetFolder),
        autoInstall: {
          confirmMessage:
            "Install the Superpowers and Product Superpowers plugins for this repo (--scope project)?",
          install: async () => installProjectPlugins(targetFolder),
        },
        manualInstructions:
          "Run `claude plugin install superpowers@superpowers-dev --scope project` and `claude plugin install product-superpowers@product-superpowers-marketplace --scope project` yourself inside this repo.",
      });
      track(summary, "Claude Code plugins", pluginStep.status);
    } else {
      summary.manual.push("Claude Code CLI not found on PATH — install plugins manually once it's set up.");
    }

    if (answers.wantsGithubIssueWorkflow) {
      const templateResults = await copyIssueTemplates(targetFolder);
      const templateCount = Object.keys(templateResults).length;
      summary.created.push(`.github/ISSUE_TEMPLATE/ (${templateCount} issue forms: epic, user_story, bug)`);

      const skillResults = await copyIssueWorkflowSkills(targetFolder);
      const skillCount = Object.keys(skillResults).length;
      summary.created.push(
        `.claude/skills/github-issue-{sync,start,commit}/ (${skillCount} skills)`
      );

      const hookStatus = addGithubWorkflowHook(targetFolder);
      track(summary, ".claude/settings.json GitHub issue workflow SessionStart hook", hookStatus);
    }
  }

  if (answers.tools.includes("codex")) {
    const configPath = writeCodexConfig(targetFolder, servers);
    summary.created.push(path.relative(targetFolder, configPath));
  }

  if (answers.tools.includes("copilot")) {
    const vscodeStatus = await writeManaged(
      path.join(targetFolder, ".vscode", "mcp.json"),
      toVscodeMcpJson(servers)
    );
    track(summary, ".vscode/mcp.json", vscodeStatus);
  }

  // 8. secrets
  const secretsResult = await collectAndWriteSecrets(targetFolder, answers);
  if (secretsResult.written) summary.created.push(".env");

  printSummary(summary);
  p.outro("Done.");
}
