import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { writeManaged } from "./file-writer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.join(
  __dirname,
  "..",
  "..",
  "templates",
  "docker-compose.mcp-tools.yml.template"
);
const TOOLS_TEMPLATE_PATH = path.join(
  __dirname,
  "..",
  "..",
  "templates",
  "tools-docker-compose.yml.template"
);

export const STACK_DIR = path.join(os.homedir(), ".agentic-ecosystem");
export const COMPOSE_PATH = path.join(STACK_DIR, "docker-compose.yml");

export function dockerAvailable() {
  try {
    execFileSync("docker", ["info"], { stdio: "ignore", shell: true });
    return true;
  } catch {
    return false;
  }
}

/** Writes/updates the shared docker-compose.yml for the mcp-tools stack. */
export function writeComposeFile(projectsRoot) {
  fs.mkdirSync(STACK_DIR, { recursive: true });
  const template = fs.readFileSync(TEMPLATE_PATH, "utf8");
  const rendered = template.replaceAll("{{PROJECTS_ROOT}}", toComposePath(projectsRoot));
  fs.writeFileSync(COMPOSE_PATH, rendered);
  return COMPOSE_PATH;
}

function toComposePath(p) {
  // Forward slashes work reliably for Docker Desktop bind mounts on Windows too.
  return p.replace(/\\/g, "/");
}

export function startStack() {
  try {
    execFileSync("docker", ["compose", "-f", COMPOSE_PATH, "up", "-d"], {
      stdio: "inherit",
      shell: true,
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}

export function stackStatus() {
  try {
    return execFileSync("docker", ["compose", "-f", COMPOSE_PATH, "ps"], {
      encoding: "utf8",
      shell: true,
    });
  } catch {
    return null;
  }
}

/** Writes/updates the project-local tools-docker-compose.yml (sonarqube/semgrep/trivy). */
export async function ensureToolsComposeFile(targetFolder) {
  const template = fs.readFileSync(TOOLS_TEMPLATE_PATH, "utf8");
  const rendered = template.replaceAll("{{PROJECT_DIR}}", toComposePath(targetFolder));
  const targetPath = path.join(targetFolder, "tools-docker-compose.yml");
  const status = await writeManaged(targetPath, rendered);
  return { path: targetPath, status };
}

/** All services declared in the compose file, per `docker compose config`. */
export function toolsStackDeclaredServices(composePath) {
  try {
    const output = execFileSync("docker", ["compose", "-f", composePath, "config", "--services"], {
      encoding: "utf8",
      shell: true,
    });
    return output.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

/** Services from the compose file that are currently running (matched by compose project name, not file path). */
export function toolsStackRunningServices(composePath) {
  try {
    const output = execFileSync(
      "docker",
      ["compose", "-f", composePath, "ps", "--services", "--filter", "status=running"],
      { encoding: "utf8", shell: true }
    );
    return output.trim().split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

/** True only if every declared service is already running. */
export function toolsStackFullyRunning(composePath) {
  const declared = toolsStackDeclaredServices(composePath);
  if (declared.length === 0) return false;
  const running = new Set(toolsStackRunningServices(composePath));
  return declared.every((service) => running.has(service));
}

export function startToolsStack(composePath) {
  try {
    execFileSync("docker", ["compose", "-f", composePath, "up", "-d"], {
      stdio: "inherit",
      shell: true,
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}
