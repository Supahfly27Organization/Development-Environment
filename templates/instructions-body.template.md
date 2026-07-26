## Working Rules
- Keep responses concise — no lengthy explanations unless asked
- When implementing, write code directly — skip preamble
- Do not re-read files already in context
- Only invoke Superpowers / Product Superpowers skills when explicitly named (slash command or direct request). Do not speculatively invoke skills based on topical relevance.
- When dispatching subagents, always pass an explicit model param — never omit it and rely on inheritance. Default to a mid-tier model for implementation/integration work; use a cheap/fast model only for purely mechanical tasks (renames, boilerplate, simple lookups); reserve the most capable model for final/architecture review passes, not general implementation.

## Working Rules (manual tasks only — not part of a multi-step planned pipeline)
- Read ONLY files directly needed for the current task
- Never explore the codebase broadly before starting
- Prefer querying codebase-memory-mcp over generic file search for navigation, once this repo is indexed

## What is {{PROJECT_NAME}}?

{{PROJECT_DESCRIPTION}}

Tech: {{TECH_STACK}}

## Task → Read These First

<!-- Fill this in as the codebase grows: map common tasks to the files/docs that should be
     read first. This is the highest-leverage section in this file — it's what turns a
     generic agent into one that knows this codebase's shape. -->

| Task | Read These |
|------|-----------|
| _(add rows here)_ | |

## Security & Quality Scanning

<!-- If this project uses SonarQube / Semgrep / Trivy (this repo's .mcp.json wires up all
     three as MCP servers by default), document decision rules and scan order in a docs file
     and link it here, e.g. docs/claude/06_SCANNING_TOOLS.md. -->

## Repo Rules

<!-- Project-specific do/don't rules, e.g. "never read X unless the task is about X",
     "preserve existing namespaces when refactoring", "frontend commands run from Y, not
     the repo root". -->

1. _(add rules here)_

## Deeper Context (read as needed)

<!-- Link to docs/ files as they're added. -->
