# GitLab Codex Plugin

Production-focused Codex plugin workspace for GitLab workflows built around `glab`.

## Current Scope

The first supported workflows are intentionally narrow and safe:

- clone GitLab repositories with `glab repo clone`
- pull updates with `git pull --ff-only`
- push branches with `git push`

These workflows are now exposed through a local MCP server inside the plugin, not only through command docs.

## Design Principles

- Use `glab` for GitLab-aware auth and repository resolution.
- Use `git` for transport operations that `glab` does not wrap directly.
- Default to the safest behavior that still matches normal developer expectations.
- Validate plugin metadata and command definitions automatically.
- Keep the repository ready for eventual marketplace review and publication.

## Quality Gates

Run the full local check before pushing:

```bash
npm run check
```

That validates:

- `.agents/plugins/marketplace.json`
- plugin manifests under `plugins/*/.codex-plugin/plugin.json`
- local MCP server configuration under `plugins/*/.mcp.json`
- skill frontmatter
- command frontmatter and required sections
- repository-level publication files such as `README.md`, `LICENSE`, and `SECURITY.md`

CI runs the same checks on pushes and pull requests.

## Repository Layout

- `.agents/plugins/marketplace.json`: local plugin catalog
- `plugins/gitlab/`: GitLab plugin bundle
- `plugins/gitlab/.codex-plugin/plugin.json`: plugin metadata
- `plugins/gitlab/.mcp.json`: local MCP server registration
- `plugins/gitlab/server/`: executable MCP server
- `plugins/gitlab/skills/gitlab/SKILL.md`: umbrella GitLab workflow skill
- `plugins/gitlab/commands/`: command documents
- `scripts/`: validation tooling
- `tests/`: automated tests

## MCP Tooling

List the plugin tools locally:

```bash
npm run mcp:list-tools
```

Invoke a tool directly through the plugin surface:

```bash
node scripts/invoke-mcp-tool.js gitlab_clone '{"repository":"group/project","directory":"/tmp/project"}'
```

## Development Workflow

1. Update plugin docs, skills, or commands.
2. Run `npm run check`.
3. Review the command behavior for safe defaults.
4. Push only after validation is clean.

## Planned Feature Expansion

- project publish and remote creation flows
- merge request workflows
- pipeline status and log workflows
- self-managed GitLab host guidance
