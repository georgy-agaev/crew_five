# Session: Project Docs Refresh After v0.2.61 Release

> Date: 2026-04-01
> Status: Completed

## Context

The repository state moved materially since the March execution-layer migration:

- `crew_five` now owns live send execution, auto-send, inbox polling, and obvious reply ingestion
- `Outreach` remains the external generation/orchestration runtime over the same Supabase spine
- release `v0.2.61` was finalized on `main` with GitHub security automation restored to green

Several top-level docs still described older assumptions or did not state the current runtime split
clearly enough.

## Completed

- Updated [README.md](/Users/georgyagaev/crew_five/README.md):
  - added an explicit “Current Live State” section
  - documented direct `imap-mcp` runtime env vars and scheduler toggles
  - replaced outdated `SMTP First` wording with the current execution-runtime model
  - clarified current shared runtime split between `crew_five` and `Outreach`
  - documented the current security checks stack (`lint`, `ast-grep`, `gitleaks`, `audit`)
- Rewrote [README.md](/Users/georgyagaev/crew_five/README.md) into a much shorter project entry point:
  - removed historical/secondary material from the main landing document
  - focused it on current system boundary, current focus, live transport, current capabilities,
    next priorities, local runbook, and main CLI surface
  - kept deeper detail in specialized docs instead of the repo front page
- Updated
  [Outreach_crew_five_cli_contract.md](/Users/georgyagaev/crew_five/docs/Outreach_crew_five_cli_contract.md):
  - version bump to `v0.14`
  - added current operational split / boundaries
  - clarified `campaign:detail` as canonical generation context
  - clarified `next-wave` dedupe semantics
- Updated [roadmap.md](/Users/georgyagaev/crew_five/docs/sessions/roadmap.md):
  - version bump to `v1.3`
  - marked execution migration as completed infrastructure
  - moved setup-flow, inbox usability, and generation-context rollout into the active roadmap
- Updated [CHANGELOG.md](/Users/georgyagaev/crew_five/CHANGELOG.md) for the final `v0.2.61` shape.

## To Do

- Document the future canonical setup flow (`project -> offer -> hypothesis -> segment -> campaign`)
  once the corresponding operator/CLI flow is finalized.
- Refresh operator-facing docs for Inbox V2 once filtering/pagination behavior is finalized in the UI.
- Add a dedicated public-facing release/status page if external contributors need a simpler “what is
  live right now?” entry point than `README + roadmap + changelog`.
