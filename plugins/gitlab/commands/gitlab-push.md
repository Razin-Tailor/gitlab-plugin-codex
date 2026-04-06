---
description: Push the current branch to GitLab, using the existing upstream when present and setting one when needed.
---

# GitLab Push

Publish local commits from the current checkout to GitLab.

## Preflight

Run these checks before pushing:

1. Confirm the current directory is inside a git repository:
   ```bash
   git rev-parse --show-toplevel
   ```
2. Inspect remotes and confirm the checkout is tied to GitLab:
   ```bash
   git remote -v
   git remote get-url origin
   ```
   If there is no `origin`, stop and explain that this first version does not create a GitLab remote automatically.
3. Confirm authentication is ready:
   ```bash
   glab auth status
   ```
4. Inspect branch and status:
   ```bash
   git status -sb
   git branch --show-current
   ```
   If the checkout is in detached HEAD, stop and ask which branch should be pushed.
5. Resolve upstream if present:
   ```bash
   git rev-parse --abbrev-ref --symbolic-full-name @{u}
   ```
   If no upstream exists, be ready to use `git push -u origin <branch>`.
6. Never use force flags unless the user explicitly asks for them.

## Plan

Choose the least surprising push form:

- If an upstream exists: `git push`
- If no upstream exists: `git push -u origin <branch>`

State the exact command before running it.

## Commands

Use one of these forms based on the repository state:

```bash
git push
```

```bash
git push -u origin <branch>
```

Capture the full output so branch tracking and remote update details can be summarized.

## Verification

After pushing, verify the checkout state:

```bash
git status -sb
git rev-parse --abbrev-ref --symbolic-full-name @{u}
```

If the push is rejected, report whether it was caused by a non-fast-forward update, permissions, or a protected branch rule.

## Summary

Present a concise result block:

```text
## Result
- Action: pushed current branch
- Status: success | partial | failed
- Details: branch, upstream, remote, ahead or behind state
```

## Next Steps

- If the push succeeded, suggest continuing with merge request support once that workflow is added.
- If the push failed with non-fast-forward, suggest `/gitlab-pull` before retrying.
- If the push failed because the branch is protected, explain that this plugin will not force-push around protection rules.
