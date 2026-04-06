---
description: Clone a GitLab repository with glab, including optional target directory and passthrough git clone flags.
---

# GitLab Clone

Clone a GitLab repository through `glab repo clone`.

## Preflight

Run these checks before cloning:

1. Confirm `glab` is available:
   ```bash
   command -v glab
   glab --version
   ```
2. Confirm authentication is ready:
   ```bash
   glab auth status
   ```
3. Resolve the repository target from `$ARGUMENTS`.
   If no repository was provided, ask for one in `group/project`, URL, or project ID form.
4. Resolve the destination directory if one was supplied.
   If it already exists and is non-empty, stop and ask before proceeding.
5. If the user is targeting a self-managed host, respect `GITLAB_HOST` or the existing `glab` host configuration.

## Plan

State the exact `glab repo clone` command before running it.

- Default form: `glab repo clone <repo>`
- With explicit directory: `glab repo clone <repo> <dir>`
- With raw git clone flags: `glab repo clone <repo> [dir] -- <gitflags>`

This command is a local write because it creates a new checkout, but it should not modify an existing repository unless the destination path was explicitly chosen and confirmed.

## Commands

Run the clone using the form that matches the request:

```bash
glab repo clone <repo>
```

```bash
glab repo clone <repo> <dir>
```

```bash
glab repo clone <repo> [dir] -- --branch <branch> --depth 1
```

Capture the full command output so the local directory and remote setup can be reported accurately.

## Verification

After the clone succeeds, verify the new checkout:

```bash
git -C <dir> remote -v
git -C <dir> branch --show-current
git -C <dir> status -sb
```

If `glab` added an `upstream` remote for a fork, mention it explicitly.

## Summary

Present a concise result block:

```text
## Result
- Action: cloned GitLab repository
- Status: success | partial | failed
- Details: repository, local directory, current branch, remotes
```

## Next Steps

- If the clone succeeded, suggest opening the checkout and using `/gitlab-pull` to sync later.
- If the user cloned the wrong target, recommend removing the new directory manually rather than deleting it automatically.
- If authentication failed, direct the user to sign in with `glab auth login`.
