# Contributing

This repository is a production-focused Codex plugin workspace. Treat every change as if it may ship to a public marketplace later.

## Standards

- Preserve safe defaults for git operations.
- Prefer deterministic CLI behavior over implicit shell shortcuts.
- Keep command docs explicit about preflight, verification, and failure handling.
- Do not add destructive defaults such as force-push, reset, or branch deletion.
- Keep plugin metadata accurate and publication-ready.

## Local Checks

Run the full local quality gate before opening a pull request:

```bash
npm run check
```

This runs:

- workspace validation for marketplace and plugin manifests
- MCP server configuration validation
- command document validation
- automated tests for the validator, MCP server surface, and remote-detection heuristics

## Repository Layout

- `.agents/plugins/marketplace.json`: local marketplace catalog
- `plugins/gitlab/.codex-plugin/plugin.json`: plugin manifest
- `plugins/gitlab/.mcp.json`: MCP server registration
- `plugins/gitlab/server/`: MCP server implementation
- `plugins/gitlab/skills/`: Codex skills
- `plugins/gitlab/commands/`: slash-command definitions
- `scripts/`: validation and maintenance scripts
- `tests/`: automated tests

## Adding a New Command

1. Create `plugins/gitlab/commands/<command-name>.md`.
2. Add YAML frontmatter with a `description`.
3. Include these sections in order:
   - `Preflight`
   - `Plan`
   - `Commands`
   - `Verification`
   - `Summary`
   - `Next Steps`
4. Document the safest default behavior first.
5. Update plugin docs if the command changes user-facing scope.
6. Run `npm run check`.

## Metadata Hygiene

Before release or marketplace submission:

- bump the plugin version in `plugins/gitlab/.codex-plugin/plugin.json`
- keep repository and homepage URLs current
- review privacy policy and terms links
- make sure prompt examples match the current feature set
- keep discovery metadata aligned with the actual supported GitLab workflows

## Pull Requests

Every pull request should describe:

- what user workflow changed
- what safety or compatibility risks were considered
- what validation or tests were run
