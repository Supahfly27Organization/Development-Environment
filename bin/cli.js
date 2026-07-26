#!/usr/bin/env node
import { runMachineSetup } from "../src/commands/machine-setup.js";
import { runInit } from "../src/commands/init.js";

const [, , subcommand, ...rest] = process.argv;

const INTERACTIVE_COMMANDS = new Set(["machine-setup", "init"]);

function requireRealTty() {
  if (process.stdin.isTTY && process.stdout.isTTY) return;
  console.error(
    `aeco ${subcommand} needs an interactive terminal (it asks questions as it goes).\n` +
      "This shell isn't providing one - this is a known limitation of Git Bash / MinTTY on Windows,\n" +
      "which doesn't expose a real console handle for raw-mode input.\n\n" +
      "Run this command from a native console instead: PowerShell.exe, Windows Terminal, or cmd.exe\n" +
      "(not Git Bash - its prompt usually looks like `user@host MINGW64 ~`)."
  );
  process.exit(1);
}

async function main() {
  if (INTERACTIVE_COMMANDS.has(subcommand)) {
    requireRealTty();
  }

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
