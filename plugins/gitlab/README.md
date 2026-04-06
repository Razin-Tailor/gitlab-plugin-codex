# GitLab Plugin

CLI-first Codex plugin for GitLab workflows.

Current command surface:

- `/gitlab-clone`
- `/gitlab-pull`
- `/gitlab-push`

Current behavior:

- validates `glab` availability and login before GitLab operations
- uses `glab repo clone` for cloning
- uses `git pull --ff-only` by default for pulls
- uses `git push` or `git push -u origin <branch>` for pushes
- never force-pushes unless the user explicitly asks

Current limitations:

- merge requests and pipeline workflows are not included yet
- pushing a repository with no GitLab remote is not automated yet
- self-managed instances rely on existing `glab` host configuration or `GITLAB_HOST`
