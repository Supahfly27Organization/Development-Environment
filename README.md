# agentic-ecosystem

A standalone CLI that bootstraps a project for **Claude Code**, **Codex**, and **GitHub Copilot**
simultaneously: instruction files, permission/MCP config, and the Superpowers /
Product Superpowers skills, all wired up the same way every time.

## Install

```
npm install
npm link      # exposes the `aeco` command globally
```

## Usage

### 1. Machine setup (run once per machine, safe to re-run)

```
aeco machine-setup
```

- Starts a shared Docker stack (`sonarqube` + `postgres`, `semgrep-mcp`, `trivy`, `trivy-mcp`) under
  `~/.agentic-ecosystem/`, mounting one "projects root" folder so every project on the machine can
  use the same scanning containers without re-creating them per repo.
- Registers the `superpowers` and `product-superpowers` Claude Code marketplaces (does **not**
  install the plugins — that happens per-project so they're active at the repo level).
- Clones both skill source repos into `~/.agentic-ecosystem/sources/` for fast project bootstraps.

### 2. Project bootstrap (run per project, prompts before touching any existing file)

```
aeco init [target-folder]
```

For the target folder (defaults to the current directory), this:

- `git init`s if there's no repo yet.
- Copies `skills/` from both source repos into `.agents/skills/` — auto-discovered by both Codex
  and GitHub Copilot natively (same `SKILL.md` format Claude Code uses).
- Generates `CLAUDE.md` as the single source of truth for working rules and project context.
  `AGENTS.md` and `.github/copilot-instructions.md` are thin pointer files back to it, so there's
  nothing to keep in sync across three copies.
- Writes `.gitignore` (merging in only missing lines if one already exists).
- Writes `tools-docker-compose.yml` into the project (sonarqube + postgres, semgrep-mcp, trivy,
  trivy-mcp), then starts that stack if it isn't already running, before wiring up any MCP config
  below. Uses the same `container_name`s and compose project name as the shared stack from
  `aeco machine-setup`, so if that's already up this is a no-op rather than a conflicting second
  copy.
- Detects (and can install) `codebase-memory-mcp`; wires up `.mcp.json` / `.codex/config.toml` /
  `.vscode/mcp.json` with the same MCP server set: `codebase-memory-mcp`, `sonarqube`, `semgrep`,
  `trivy`, `github`.
- Detects (and can install) the [CASS Memory System](https://github.com/Dicklesworthstone/cass_memory_system)
  `cm` CLI (Scoop on Windows, the official install script on macOS/Linux), runs `cm init` if it
  hasn't been set up yet, and starts `cm serve` in the background so it can be wired into the MCP
  config above as `cass-memory` (a `type: "url"` server pointing at `http://127.0.0.1:8765/`). For
  Claude, also adds a `cm reflect` post-session entry to `.claude/hooks.json` for automated
  procedural-memory learning.
- Installs the Superpowers + Product Superpowers plugins for Claude Code at **project scope**
  (`--scope project`), so they're active for this repo specifically.
- Prompts for secrets (`GITHUB_TOKEN`, `SONAR_TOKEN`) and writes `.env` (already covered by
  `.gitignore`).
- Prints a summary of what was created, skipped, or needs manual follow-up.

Every generated file uses the same rule: if it doesn't exist, create it; if it exists and is
identical, do nothing; if it exists and differs, ask before touching it.

## Testing

```
npm test
```

Runs the automated suite (Node's built-in test runner, no extra dependency) covering the MCP
server renderers, `.gitignore` merge logic, `writeManaged`'s create/unchanged paths, and the
CLAUDE.md-canonical instruction file generation. The Claude Code plugin-detection logic
(`projectPluginsInstalled`) shells out to the real `claude` CLI and is verified manually rather
than in the automated suite, since it's an integration point with an external tool.

## Notes

- **Requires a native console.** `aeco machine-setup` and `aeco init` are interactive and need a
  real TTY. Git Bash / MinTTY on Windows doesn't expose one for raw-mode input, so both commands
  detect that and print a message telling you to use PowerShell, Windows Terminal, or cmd.exe
  instead of crashing.
- `codebase-memory-mcp` auto-install is Windows-only (downloads the latest release from
  `DeusData/codebase-memory-mcp`). On other platforms you'll be asked to install it manually.
- The Docker-backed MCP servers (`semgrep`, `trivy`, `sonarqube`) are machine-level infrastructure
  set up once via `aeco machine-setup`, not per-project.
- Claude Code plugin state (`claude plugin list`) is global across every project on the machine —
  each entry is tagged with its own `projectPath`, so this tool checks that field rather than just
  the plugin name when deciding whether a project already has both plugins installed.
