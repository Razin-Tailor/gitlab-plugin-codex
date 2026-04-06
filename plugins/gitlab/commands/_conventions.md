# Command Conventions

Every GitLab command in this plugin must be production-safe by default.

## Required Sections

Every non-underscore command document in this directory must include:

1. `Preflight`
2. `Plan`
3. `Commands`
4. `Verification`
5. `Summary`
6. `Next Steps`

## Required Frontmatter

Every command file must begin with YAML frontmatter and include a `description` field.

## Safety Defaults

- verify `glab` availability and authentication before GitLab-dependent actions
- prefer `git pull --ff-only` unless the user explicitly asks for a different strategy
- never force-push unless the user explicitly asks
- never overwrite existing directories during clone without confirmation
- surface protected branch and permission failures clearly

## Review Standard

When adding or changing a command, make sure it:

- states the exact command that will run
- explains destructive or high-risk branches before execution
- includes a verification step that proves the operation succeeded
- offers the next safe action when the workflow fails
