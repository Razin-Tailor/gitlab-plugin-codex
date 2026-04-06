# GitLab Install Suggestion Heuristic

This document defines the recommended host-app behavior for suggesting the GitLab plugin when it is not installed.

## Goal

If the active repository context points at GitLab, Codex should prefer the GitLab plugin:

- If the plugin is installed, route GitLab repository tasks into it.
- If the plugin is not installed, show the install suggestion card.

## Decision Rule

Use the active remote, not just any configured remote.

Recommended order:

1. Resolve the current branch:
   ```bash
   git branch --show-current
   ```
2. Resolve the branch-specific remote if it exists:
   ```bash
   git config --get branch.<branch>.remote
   ```
3. Fallback to the repository push default:
   ```bash
   git config --get remote.pushDefault
   ```
4. Fallback to `origin` if present.
5. If `origin` is absent, use the first configured remote.

After the active remote name is selected, read its URL:

```bash
git remote get-url <remote>
git remote get-url --push <remote>
```

## GitLab Classification

Treat the active remote as GitLab when either of these is true:

- host is `gitlab.com`
- host matches a configured self-managed GitLab host
- host name contains `gitlab`

Examples that should classify as GitLab:

- `git@gitlab.com:group/project.git`
- `https://gitlab.com/group/project.git`
- `ssh://git@gitlab.example.com/group/project.git`
- `https://code.company.internal/group/project.git` with that host in the configured self-managed host list

## Non-Goals

Do not trigger the install suggestion just because:

- the repository has a `.gitlab-ci.yml` file
- one non-active remote points at GitLab
- the user mentions CI in the abstract

The default should follow the active repository remote, not weak signals.

## Repository Reference Implementation

This repository includes a reference implementation in:

- `scripts/lib/git-remote-detection.js`

And tests in:

- `tests/git-remote-detection.test.js`
