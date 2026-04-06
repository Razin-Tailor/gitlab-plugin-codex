---
description: Pull the current branch from GitLab with safe defaults, using fast-forward-only unless the user explicitly asks for another strategy.
---

# GitLab Pull

Update the current checkout from its configured upstream.

## Preflight

Run these checks before pulling:

1. Confirm the current directory is inside a git repository:
   ```bash
   git rev-parse --show-toplevel
   ```
2. Inspect remotes and confirm the checkout is tied to GitLab:
   ```bash
   git remote -v
   git remote get-url origin
   ```
   If there is no `origin` or the remote is not the GitLab repo the user intended, stop and explain the mismatch.
3. Confirm authentication is ready:
   ```bash
   glab auth status
   ```
4. Inspect working tree safety:
   ```bash
   git status --short
   git branch --show-current
   git rev-parse --abbrev-ref --symbolic-full-name @{u}
   ```
   If the working tree is dirty, warn that pull may conflict with local changes.
   If no upstream is configured, ask which remote and branch should be pulled.

## Plan

Default to a predictable pull:

- Preferred: `git pull --ff-only`
- Only use `git pull --rebase` if the user explicitly asks for rebase
- Do not use a merge-style `git pull` unless the user explicitly asks for it

State the chosen command before running it.

## Commands

Use one of these forms based on the user request:

```bash
git pull --ff-only
```

```bash
git pull --rebase
```

Capture the full output so updated branch state can be summarized cleanly.

## Verification

After pulling, verify the checkout state:

```bash
git status -sb
git log --oneline --decorate -n 3
```

If the pull fails, surface the exact failure mode: local changes would be overwritten, non-fast-forward update, merge conflict, or missing upstream.

## Summary

Present a concise result block:

```text
## Result
- Action: pulled current branch
- Status: success | partial | failed
- Details: branch, upstream, new HEAD, working tree state
```

## Next Steps

- If the pull succeeded, suggest `/gitlab-push` after the user makes new local commits.
- If the pull failed because the tree is dirty, suggest stashing or committing before retrying.
- If the pull failed because no upstream is configured, ask the user which branch should track which remote ref.
