---
name: gitlab
description: GitLab CLI-first repository workflows for clone, pull, and push using glab for auth and repo resolution and git for transport operations.
metadata:
  priority: 5
  pathPatterns:
    - ".git/config"
    - ".gitlab-ci.yml"
  bashPatterns:
    - "^\\s*glab(?:\\s|$)"
    - "\\bgit\\s+clone\\s+git@gitlab\\.com:"
    - "\\bgit\\s+remote\\s+-v\\b"
    - "\\bgit\\s+pull\\b"
    - "\\bgit\\s+push\\b"
  promptSignals:
    phrases:
      - "gitlab repo"
      - "gitlab repository"
      - "gitlab remote"
      - "gitlab clone"
      - "gitlab pull"
      - "gitlab push"
      - "gitlab.com"
      - "self-managed gitlab"
    anyOf:
      - "gitlab"
      - "glab"
      - "merge request"
      - "gitlab ci"
      - "gitlab pipeline"
    noneOf:
      - "github actions"
      - "bitbucket"
    minScore: 4
---

# GitLab

## Overview

This plugin is intentionally CLI-first.

- Use `glab` for GitLab authentication checks, host context, and repository cloning.
- Use `git` for `pull` and `push`, because `glab` does not expose dedicated wrappers for those transport operations.
- Prefer local command help over memory when a `glab` flag is uncertain.

Current scope in this first version:

- clone a GitLab repository
- pull the current branch from its upstream
- push the current branch to its configured remote

## Discovery Guidance

When this plugin is installed and the current repository's active remote points at GitLab, this should be the default repository workflow path.

Recommended active remote resolution order:

1. current branch remote from `branch.<branch>.remote`
2. `remote.pushDefault`
3. `origin`
4. first configured remote

The plugin repository includes a reference implementation for that heuristic in `scripts/lib/git-remote-detection.js`.

## First Checks

Run these before GitLab operations unless the request is purely explanatory:

```bash
glab --version
glab auth status
```

If the user is targeting a self-managed GitLab instance, respect existing `glab` host configuration and `GITLAB_HOST`.

## Routing Rules

1. If the user wants to clone a repository, use `glab repo clone`.
2. If the user wants to update an existing checkout, inspect git state and use `git pull --ff-only` by default.
3. If the user wants to publish local commits, inspect git state and use `git push` or `git push -u origin <branch>`.
4. If the request would require a force push, branch deletion, or other destructive git action, stop and ask for explicit confirmation.

## Clone Workflow

Use `glab repo clone <repo> [dir]`.

- Accept repository identifiers as `group/project`, a full URL, or a project ID.
- If the user wants branch or depth flags, pass them through after `--`.
- If the destination directory already exists and is non-empty, stop and ask instead of overwriting.

Examples:

```bash
glab repo clone group/project
glab repo clone group/project my-dir
glab repo clone group/project -- --branch main --depth 1
```

## Pull Workflow

Inspect the checkout first:

```bash
git rev-parse --show-toplevel
git remote -v
git status --short
git branch --show-current
git rev-parse --abbrev-ref --symbolic-full-name @{u}
```

Rules:

- Default to `git pull --ff-only`.
- If the working tree is dirty, warn that pull can conflict with local changes.
- If no upstream branch is configured, ask which remote and branch to pull from instead of guessing.
- Only use `git pull --rebase` when the user explicitly asks for a rebase workflow.
- Do not use a merge-style pull unless the user explicitly asks for it.

## Push Workflow

Inspect the checkout first:

```bash
git rev-parse --show-toplevel
git remote -v
git status -sb
git branch --show-current
```

Rules:

- If the current branch already has an upstream, use `git push`.
- If the branch has no upstream, use `git push -u origin <branch>`.
- If there are no commits ahead of the upstream, report that there is nothing to push.
- Never use `--force` or `--force-with-lease` unless the user explicitly asks.
- If the push is rejected as non-fast-forward, guide the user into a pull-and-resolve flow instead of retrying blindly.

## Verification

After clone:

```bash
git -C <dir> remote -v
git -C <dir> branch --show-current
git -C <dir> status -sb
```

After pull:

```bash
git status -sb
git log --oneline --decorate -n 3
```

After push:

```bash
git status -sb
git rev-parse --abbrev-ref --symbolic-full-name @{u}
```

## Output Expectations

- State the exact command path chosen before executing it.
- Summarize the resulting branch, remote, and repository state after the operation.
- Call out blockers clearly: missing auth, missing upstream, dirty working tree, detached HEAD, or non-fast-forward push rejection.
