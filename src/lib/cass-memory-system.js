import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync, spawn } from "node:child_process";
import { isWindows } from "./codebase-memory-mcp.js";

// https://github.com/Dicklesworthstone/cass_memory_system - `cm` CLI providing
// procedural memory (episodic/working/procedural layers) for coding agents.
const REPO = "Dicklesworthstone/cass_memory_system";
const SCOOP_BUCKET_URL = "https://github.com/Dicklesworthstone/scoop-bucket";
const INSTALL_SCRIPT_URL = `https://raw.githubusercontent.com/${REPO}/main/install.sh`;
const CONFIG_DIR = path.join(os.homedir(), ".cass-memory");

export const CM_SERVE_URL = "http://127.0.0.1:8765/";
export const CM_REFLECT_COMMAND = "cm reflect --days 1";

/** Returns the resolved `cm` binary path/name if found on PATH, else null. */
export function detectCm() {
  try {
    const cmd = isWindows() ? "where" : "which";
    const out = execFileSync(cmd, ["cm"], { encoding: "utf8", shell: true }).trim();
    return out.split(/\r?\n/)[0] || null;
  } catch {
    return null;
  }
}

function scoopAvailable() {
  try {
    execFileSync("where", ["scoop"], { encoding: "utf8", shell: true });
    return true;
  } catch {
    return false;
  }
}

/** Installs the `cm` CLI: Scoop on Windows, the official install script elsewhere. */
export async function installCm() {
  if (isWindows()) {
    if (!scoopAvailable()) {
      throw new Error(
        `Scoop isn't installed, so cm can't be auto-installed. Install Scoop from https://scoop.sh first, ` +
          `or install cm manually - see https://github.com/${REPO}#installation`
      );
    }
    execFileSync("scoop", ["bucket", "add", "dicklesworthstone", SCOOP_BUCKET_URL], {
      stdio: "inherit",
      shell: true,
    });
    execFileSync("scoop", ["install", "dicklesworthstone/cm"], { stdio: "inherit", shell: true });
    return;
  }

  execFileSync("bash", ["-c", `curl -fsSL "${INSTALL_SCRIPT_URL}" | bash -s -- --easy-mode --verify`], {
    stdio: "inherit",
  });
}

/** Whether `cm init` has already run (its global config directory exists). */
export function isCmInitialized() {
  return fs.existsSync(CONFIG_DIR);
}

/** Runs `cm init` interactively so the user can answer its setup prompts. */
export function initCm(cmPath) {
  execFileSync(cmPath ?? "cm", ["init"], { stdio: "inherit", shell: isWindows() });
}

/** Checks whether `cm serve`'s MCP HTTP server is already reachable. */
export async function isCmServeRunning() {
  try {
    await fetch(CM_SERVE_URL, { signal: AbortSignal.timeout(1000) });
    return true;
  } catch {
    return false;
  }
}

/**
 * Starts `cm serve` as a detached background process and waits for it to
 * become reachable. The process is left running after this call/aeco exits.
 */
export async function startCmServe(cmPath) {
  const child = spawn(cmPath ?? "cm", ["serve"], {
    detached: true,
    stdio: "ignore",
    shell: isWindows(),
  });
  child.unref();

  for (let i = 0; i < 10; i++) {
    if (await isCmServeRunning()) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`cm serve did not become reachable at ${CM_SERVE_URL} within 5s`);
}

/**
 * Adds a post-session `cm reflect` entry to <targetFolder>/.claude/hooks.json so
 * procedural-memory learning runs automatically. Idempotent and preserves any
 * existing hooks already in the file.
 */
export function addCmReflectHook(targetFolder) {
  const hooksPath = path.join(targetFolder, ".claude", "hooks.json");
  const hooks = fs.existsSync(hooksPath) ? JSON.parse(fs.readFileSync(hooksPath, "utf8")) : {};

  hooks["post-session"] = hooks["post-session"] ?? [];
  if (hooks["post-session"].includes(CM_REFLECT_COMMAND)) {
    return "unchanged";
  }

  hooks["post-session"].push(CM_REFLECT_COMMAND);
  fs.mkdirSync(path.dirname(hooksPath), { recursive: true });
  fs.writeFileSync(hooksPath, JSON.stringify(hooks, null, 2) + "\n");
  return "added";
}
