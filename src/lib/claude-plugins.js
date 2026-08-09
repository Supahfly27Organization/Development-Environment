import { execFileSync } from "node:child_process";
import path from "node:path";

// Marketplace/plugin names confirmed from each repo's .claude-plugin/marketplace.json.
const PLUGINS = [
  { marketplaceRepo: "obra/superpowers", marketplaceName: "superpowers-dev", plugin: "superpowers" },
  {
    marketplaceRepo: "guhcostan/product-superpowers",
    marketplaceName: "product-superpowers-marketplace",
    plugin: "product-superpowers",
  },
];

export function claudeCliAvailable() {
  try {
    execFileSync("claude", ["--version"], { stdio: "ignore", shell: true });
    return true;
  } catch {
    return false;
  }
}

function marketplaceRegistered(marketplaceName, cwd) {
  try {
    const out = execFileSync("claude", ["plugin", "marketplace", "list"], {
      cwd,
      encoding: "utf8",
      shell: true,
    });
    return out.includes(marketplaceName);
  } catch {
    return false;
  }
}

function ensureMarketplace({ marketplaceRepo, marketplaceName }, cwd) {
  if (marketplaceRegistered(marketplaceName, cwd)) return;
  execFileSync("claude", ["plugin", "marketplace", "add", marketplaceRepo], {
    cwd,
    stdio: "inherit",
    shell: true,
  });
}

/** Registers both marketplaces (idempotent) - does NOT install plugins. Used by machine-setup. */
export function ensureMarketplacesRegistered(cwd) {
  for (const entry of PLUGINS) ensureMarketplace(entry, cwd);
}

/** Registers marketplaces if needed, then installs both plugins at project scope. Used by init. */
export function installProjectPlugins(cwd) {
  for (const entry of PLUGINS) {
    ensureMarketplace(entry, cwd);
    execFileSync(
      "claude",
      ["plugin", "install", `${entry.plugin}@${entry.marketplaceName}`, "--scope", "project"],
      { cwd, stdio: "inherit", shell: true }
    );
  }
}

function normalizePath(p) {
  return path.resolve(p).replace(/\\/g, "/").toLowerCase();
}

/**
 * True only if both plugins show as enabled at *project* scope for this exact
 * folder. `claude plugin list` is global across every project on the machine
 * (each entry carries its own `projectPath`), so a plain substring match on
 * the plugin id isn't enough - verified against real `--json` output:
 * `claude plugin list --enabled` doesn't exist (errors: "unknown option"),
 * the real flag is `--json`.
 */
export function projectPluginsInstalled(cwd) {
  let entries;
  try {
    const out = execFileSync("claude", ["plugin", "list", "--json"], {
      cwd,
      encoding: "utf8",
      shell: true,
    });
    entries = JSON.parse(out);
  } catch {
    return false;
  }

  const target = normalizePath(cwd);
  return PLUGINS.every((entry) => {
    const id = `${entry.plugin}@${entry.marketplaceName}`;
    return entries.some(
      (e) =>
        e.id === id &&
        e.enabled === true &&
        e.scope === "project" &&
        e.projectPath &&
        normalizePath(e.projectPath) === target
    );
  });
}

export { PLUGINS };
