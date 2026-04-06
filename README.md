# GitLab Codex Plugin

This workspace is a local Codex plugin catalog containing one plugin: `gitlab`.

Initial scope:

- clone GitLab repositories with `glab repo clone`
- pull updates with `git pull --ff-only`
- push branches with `git push`

Catalog layout:

- `.agents/plugins/marketplace.json`
- `plugins/gitlab/.codex-plugin/plugin.json`
- `plugins/gitlab/skills/gitlab/SKILL.md`
- `plugins/gitlab/commands/gitlab-clone.md`
- `plugins/gitlab/commands/gitlab-pull.md`
- `plugins/gitlab/commands/gitlab-push.md`

Implementation notes:

- GitLab auth and repo resolution go through `glab`.
- Git transport uses `git` where `glab` does not expose dedicated `pull` or `push` commands.
- Pull defaults to fast-forward only.
- Push never uses force flags unless the user explicitly asks.

Planned next steps:

- add project publish and remote creation flows
- add merge request and pipeline workflows
- add better helpers for self-managed GitLab hosts
