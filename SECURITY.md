# Security Policy

## Supported Scope

This repository currently supports the `gitlab` Codex plugin and its validation tooling.

## Reporting

If you find a security issue in the plugin, do not open a public issue with exploit details.

Report it privately to:

- `r42intailor@gmail.com`

Include:

- affected workflow or file
- reproduction steps
- impact assessment
- any mitigation you already tested

## Response Expectations

- Initial acknowledgement target: 3 business days
- Triage target: 7 business days
- Fix timeline depends on severity and scope

## Hardening Principles

- destructive git operations require explicit user intent
- auth-sensitive operations should verify CLI login state first
- validation should block malformed marketplace or plugin metadata from shipping
