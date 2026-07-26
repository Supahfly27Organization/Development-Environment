import { execFileSync } from "node:child_process";

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

/** True only if both plugins already show as enabled for this project. */
export function projectPluginsInstalled(cwd) {
  try {
    const out = execFileSync("claude", ["plugin", "list", "--enabled"], {
      cwd,
      encoding: "utf8",
      shell: true,
    });
    return PLUGINS.every((entry) => out.includes(`${entry.plugin}@${entry.marketplaceName}`));
  } catch {
    return false;
  }
}

export { PLUGINS };
