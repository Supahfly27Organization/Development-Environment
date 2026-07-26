#!/usr/bin/env node
import { runMachineSetup } from "../src/commands/machine-setup.js";
import { runInit } from "../src/commands/init.js";

const [, , subcommand, ...rest] = process.argv;

async function main() {
  switch (subcommand) {
    case "machine-setup":
      await runMachineSetup();
      break;
    case "init":
      await runInit({ targetFolder: rest[0] });
      break;
    default:
      console.log(`Usage:
  aeco machine-setup          Set up shared machine-level infra (Docker MCP tools stack, Claude Code marketplaces, cached skill sources)
  aeco init [target-folder]   Bootstrap a single project for Claude Code, Codex, and GitHub Copilot (defaults to the current directory)
`);
      process.exit(subcommand ? 1 : 0);
  }
}

main().catch((err) => {
  console.error("\naeco failed:", err.message ?? err);
  process.exit(1);
});
