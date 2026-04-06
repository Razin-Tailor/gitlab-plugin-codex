# GitLab Plugin

CLI-first Codex plugin for GitLab workflows, designed to be hardened for future marketplace publication.

## Supported Commands

- `/gitlab-clone`
- `/gitlab-pull`
- `/gitlab-push`

## Operational Model

- validate `glab` availability and login before GitLab-aware operations
- use `glab repo clone` for cloning
- use `git pull --ff-only` by default for pulls
- use `git push` or `git push -u origin <branch>` for pushes
- refuse force-push workflows unless the user explicitly requests them

## Safety Defaults

- no overwrite of existing clone directories without confirmation
- no implicit merge pulls
- no implicit rebase pulls
- no implicit remote creation during push
- explicit reporting for auth, permission, upstream, and protected branch failures

## Validation

This plugin is guarded by repository-level validation that checks:

- manifest integrity
- asset paths
- skill frontmatter
- command frontmatter and required sections

Run:

```bash
npm run check
```

## Current Gaps

- merge request workflows are not included yet
- pipeline workflows are not included yet
- publishing a local non-GitLab repo to a new GitLab remote is not automated yet
- self-managed host support currently depends on existing `glab` host configuration or `GITLAB_HOST`
