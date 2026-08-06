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

Walks through three steps interactively:

1. **Shared Docker stack** — writes `~/.agentic-ecosystem/docker-compose.yml` (rendered from
   `templates/docker-compose.mcp-tools.yml.template`) and starts it. The stack includes
   `sonarqube` + `postgres`, `semgrep-mcp`, `trivy`, and `trivy-mcp`. You supply a "projects root"
   folder that is bind-mounted into the containers so every project on the machine shares the same
   scanning infrastructure without re-creating it per repo.
2. **Claude Code marketplace registration** — registers the `superpowers-dev` and
   `product-superpowers-marketplace` marketplaces with the local Claude Code CLI (idempotent). Does
   **not** install the plugins yet — that happens per-project in `aeco init`.
3. **Skill source cache** — shallow-clones `obra/superpowers` and
   `guhcostan/product-superpowers` into `~/.agentic-ecosystem/sources/`. If the cache is already
   present the step is skipped. `aeco init` reads from this cache when populating `.agents/skills/`.

### 2. Project bootstrap (run per project, prompts before touching any existing file)

```
aeco init [target-folder]
```

Prompts for project name, description, tech stack, which tools to wire up (Claude Code / Codex /
GitHub Copilot), whether to write a `.env`, and whether to set up the GitHub issue workflow. Then
runs the following steps in order:

1. **git init** — initialises a git repository in the target folder if one doesn't already exist.
   Uses `ensureDependency` to confirm before running.

2. **Skills** (`src/lib/skills.js`) — copies `skills/<name>/` trees from both cached source repos
   into `<project>/.agents/skills/`. This path is auto-discovered natively by both Codex and GitHub
   Copilot without any format translation. Each file goes through `writeManaged` (text files) or a
   direct `fs.copyFileSync` (binary files), so the user is prompted before any differing file is
   overwritten.

3. **Instruction files** (`src/lib/generate-instructions.js`) — generates the following, always
   using `CLAUDE.md` as the single source of truth:
   - `CLAUDE.md` — full working rules and project context, rendered from
     `templates/instructions-body.template.md` with the project name / description / tech stack
     interpolated.
   - `docs/claude/` — four reference docs (`04_DOMAIN_MODEL.md`, `05_PATTERNS.md`,
     `06_SCANNING_TOOLS.md`, `07_KNOWLEDGE_TOOLS.md`) written alongside `CLAUDE.md` regardless of
     which tools are selected.
   - `AGENTS.md` (Codex only) — a thin pointer file that tells Codex to read `CLAUDE.md`.
   - `.github/copilot-instructions.md` (Copilot only) — equivalent pointer for GitHub Copilot.

4. **`.gitignore`** (`src/lib/gitignore.js`) — creates the file from
   `templates/gitignore.template` if absent; if one already exists only the lines that are missing
   are appended (existing order and content are never disturbed).

5. **Project-local Docker tools stack** (`src/lib/docker-stack.js`) — writes
   `tools-docker-compose.yml` into the project (rendered from
   `templates/tools-docker-compose.yml.template`) and starts it with `docker compose up -d` if
   Docker is available and the stack isn't already fully running. Uses the same `container_name`s
   as the shared stack from `aeco machine-setup`, so if that stack is already up this is a no-op.
   If Docker is unavailable the step is logged as a manual follow-up item.

6. **`codebase-memory-mcp`** (`src/lib/codebase-memory-mcp.js`) — detects the binary via
   `%LOCALAPPDATA%\Programs\codebase-memory-mcp\codebase-memory-mcp.exe` or `which`/`where`. On
   Windows it can download and install the latest release from
   `DeusData/codebase-memory-mcp` (with SHA-256 checksum verification) automatically after
   confirming with the user. On other platforms you are asked to install it manually.

7. **MCP server configuration** (`src/lib/mcp-servers.js`) — builds a unified server definition
   set (`codebase-memory-mcp`, `sonarqube`, `semgrep`, `trivy`, `github`, `serena`) and then
   renders it into the config format(s) appropriate for the selected tools:
   - `.mcp.json` — Claude Code project MCP config (`mcpServers` object).
   - `.codex/config.toml` (`src/lib/codex-config.js`) — merged TOML with
     `approval_policy = "on-request"`, `sandbox_mode = "workspace-write"`, and an
     `[mcp_servers]` table. Existing keys are preserved; only missing servers are added.
   - `.vscode/mcp.json` — VS Code / Copilot Chat format (`servers` object, with `${GITHUB_TOKEN}`
     rewritten as `${env:GITHUB_TOKEN}` to match VS Code's substitution syntax).

   For Claude Code, `aeco init` also writes `.claude/settings.json` with the two marketplaces
   pre-registered and both plugins listed under `enabledPlugins`, then installs
   `superpowers@superpowers-dev` and `product-superpowers@product-superpowers-marketplace` at
   `--scope project` via the Claude CLI (confirmed before running).

8. **GitHub issue workflow** (optional, Claude Code only) (`src/lib/github-issue-workflow.js`) —
   if selected at the prompt:
   - Copies three GitHub issue form templates (`epic.yml`, `user_story.yml`, `bug.yml`) into
     `.github/ISSUE_TEMPLATE/`.
   - Copies three Claude Code skills (`github-issue-sync`, `github-issue-start`,
     `github-issue-commit`) into `.claude/skills/`.
   - Adds a `SessionStart` hook to `.claude/settings.json` that reminds Claude to use those skills
     at the right points in the issue lifecycle (idempotent: won't add a duplicate entry).

9. **Secrets** (`src/lib/secrets.js`) — prompts for `GITHUB_TOKEN` and `SONAR_TOKEN` (skipping
   any keys already present in an existing `.env`) and writes them to `.env`. This file is already
   covered by `.gitignore`. The step is skipped entirely if you declined the secrets prompt.

Every generated file follows the same conflict rule via `writeManaged` (`src/lib/file-writer.js`):
- **New file** → created silently.
- **Identical file** → skipped silently, no prompt shown.
- **Differing file** → interactive prompt: keep / overwrite / append / show diff (recursive until
  a non-diff choice is made).

At the end, a summary lists every file that was created or updated, and any items that need manual
follow-up.

## File-writer conflict resolution (`src/lib/file-writer.js`)

`writeManaged(filePath, content, deps?)` is the single write primitive used throughout the
codebase. It guarantees no silent overwrites:

| Situation | Behaviour | Return value |
|-----------|-----------|--------------|
| File doesn't exist | Write and return | `"created"` |
| File exists, content identical | Do nothing | `"unchanged"` |
| File exists, content differs | Prompt user | `"kept"` / `"overwritten"` / `"appended"` |

The `deps` parameter allows injecting a stub `select` function for testing without hitting a real
TTY.

## Dependency resolution (`src/lib/ensure-dependency.js`)

All optional dependencies (Docker, git, `codebase-memory-mcp`, Claude plugins, …) flow through
`ensureDependency({ name, detect, autoInstall, manualInstructions })`:

1. Run `detect()` — if already present, return `{ status: "present" }`.
2. If `autoInstall` is provided, confirm with the user and run `install()`.
3. If still not detected, loop: show `manualInstructions`, let the user recheck or skip.

## Skills (`src/lib/skills.js`)

Two source repos are aggregated:

| Name | Repository |
|------|-----------|
| `superpowers` | `https://github.com/obra/superpowers.git` |
| `product-superpowers` | `https://github.com/guhcostan/product-superpowers.git` |

`updateSkillSourceCache()` does a shallow clone or `git pull --ff-only` for each into
`~/.agentic-ecosystem/sources/<name>/`. `copySkillsIntoProject(targetFolder)` then mirrors every
`skills/<name>/` subdirectory from both caches into `<project>/.agents/skills/<name>/`, resolving
conflicts via `writeManaged` for text files and copying binary files directly.

## MCP servers (`src/lib/mcp-servers.js`)

`buildServerDefs({ codebaseMemoryMcpPath, projectPath })` returns a normalised server map:

| Server | Transport |
|--------|-----------|
| `codebase-memory-mcp` | Local binary (Windows) |
| `sonarqube` | `npx -y sonarqube-api-mcp` |
| `semgrep` | `docker exec -i semgrep-mcp semgrep mcp` |
| `trivy` | `docker exec -i trivy-mcp trivy mcp` |
| `github` | `docker run ghcr.io/github/github-mcp-server` |
| `serena` | `uvx --from git+https://github.com/oraios/serena serena start-mcp-server` |

The same map is then serialised into `.mcp.json`, `.codex/config.toml`, and `.vscode/mcp.json`
by their respective renderers.

## Testing

```
npm test
```

Runs the automated suite using Node's built-in test runner (no extra test dependency). Coverage
includes:

- `mcp-servers.js` — JSON/TOML/VSCode renderers and env-variable rewriting.
- `gitignore.js` — create-from-scratch and append-missing-lines paths.
- `file-writer.js` — create / unchanged / overwrite / append / keep flows.
- `generate-instructions.js` — CLAUDE.md canonical rendering and pointer-file generation.
- `docker-stack.js` — compose file rendering and service detection helpers.
- `codebase-memory-mcp.js` — archive-name selection and binary detection.
- `codex-config.js` — TOML merge logic.
- `skills.js` — copy, keep, overwrite, append, and unchanged-file flows.
- `github-issue-workflow.js` — issue template and skill copying, SessionStart hook idempotency.

The Claude Code plugin-detection logic (`projectPluginsInstalled`) shells out to the real `claude`
CLI and is verified manually rather than in the automated suite, since it is an integration point
with an external tool.

## Notes

- **Requires a native console.** Both commands are interactive and need a real TTY. Git Bash /
  MinTTY on Windows doesn't expose one for raw-mode input; both commands detect this and print a
  message directing you to use PowerShell, Windows Terminal, or cmd.exe instead of crashing.
- `codebase-memory-mcp` auto-install is Windows-only. On other platforms you will be asked to
  install it manually from `https://github.com/DeusData/codebase-memory-mcp/releases`.
- The Docker-backed MCP servers (`semgrep`, `trivy`, `sonarqube`) are machine-level infrastructure
  set up once via `aeco machine-setup`, not per-project.
- Claude Code plugin state (`claude plugin list --json`) is global across every project on the
  machine. Each entry carries its own `projectPath`, so `projectPluginsInstalled` matches on both
  the plugin id **and** the normalised absolute project path to avoid false positives from other
  repos on the same machine.
