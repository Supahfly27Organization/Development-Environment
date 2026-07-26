import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.join(
  __dirname,
  "..",
  "..",
  "templates",
  "docker-compose.mcp-tools.yml.template"
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
  execFileSync("docker", ["compose", "-f", COMPOSE_PATH, "up", "-d"], {
    stdio: "inherit",
    shell: true,
  });
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
