import * as p from "@clack/prompts";

/**
 * Shared detect -> confirm-install / manual-fallback-with-ack flow, used for
 * every dependency this tool needs (Docker, codebase-memory-mcp, git, npx
 * packages, Claude plugins, ...). Never installs anything without asking first.
 *
 * @param {object} opts
 * @param {string} opts.name - human label shown in prompts
 * @param {() => Promise<boolean>} opts.detect
 * @param {null | { confirmMessage?: string, install: () => Promise<void> }} opts.autoInstall
 *        Pass null when this tool can't install the dependency itself.
 * @param {string} [opts.manualInstructions]
 * @returns {Promise<{ status: "present" | "installed" | "skipped" }>}
 */
export async function ensureDependency({ name, detect, autoInstall, manualInstructions }) {
  if (await detect()) {
    return { status: "present" };
  }

  if (autoInstall) {
    const proceed = await p.confirm({
      message: autoInstall.confirmMessage ?? `${name} is missing. Install it now?`,
    });
    if (!p.isCancel(proceed) && proceed) {
      await autoInstall.install();
      if (await detect()) {
        return { status: "installed" };
      }
      p.log.warn(`${name}: install finished but it still isn't detected.`);
    }
  }

  // Manual fallback: give the user a chance to install it themselves and
  // acknowledge, or explicitly skip and move on.
  while (true) {
    p.log.warn(
      manualInstructions ?? `${name} could not be installed automatically. Please install it manually.`
    );
    const choice = await p.select({
      message: `${name}: what next?`,
      options: [
        { value: "recheck", label: "I've installed it — check again" },
        { value: "skip", label: "Skip — continue without it" },
      ],
    });
    if (p.isCancel(choice) || choice === "skip") {
      return { status: "skipped" };
    }
    if (await detect()) {
      return { status: "installed" };
    }
    p.log.error("Still not detected.");
  }
}
