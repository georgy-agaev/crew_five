# Session Log – 2025-11-22 (Hash Guardrails and Campaign Updates)

## Overview
Deliver hash-aware snapshot guardrails, version/concurrency safety, and tighter campaign update
rules without touching legacy fallback paths. Keep changes minimal and focused on current needs.

## Plan
- Completed: Enforce hash/change detection on snapshots (reuse vs refresh) using filter hashing.
- Completed: Add `--force-version` handling with optimistic version checks; fail on stale versions
  unless forced.
- Completed: Block `campaign:update` when status is beyond draft/ready/review; keep allowed fields
  limited to prompt_pack_id/schedule/throttle.
- Completed: Improve filter validation errors and docs (allowed fields/operators, examples).
- Completed: Add tests for `not_in`, mixed numeric/list filters, hash mismatch reuse, non-draft
  update rejection, and CLI force-version wiring.

## Files to Touch
- `src/filters/index.ts` – hash helpers, validation messaging.
- `src/services/segmentSnapshotWorkflow.ts` – hash enforcement, force-version logic.
- `src/services/campaigns.ts`, `src/commands/campaignUpdate.ts` – status guardrail.
- `src/cli.ts` – `--force-version` wiring.
- `README.md`, `docs/appendix_ai_contract.md` – doc updates.
- `tests/*` – new coverage per plan.

## Outcomes
- Snapshot workflow now hashes filters, stores the hash in `segment_members.snapshot`, rejects reuse
  on hash mismatch, and supports `--force-version` with optimistic checks; default max 5000 guardrail
  remains.
- CLI adds `--force-version` to snapshot and campaign creation; segment/campaign handlers pass
  through guardrail flags; filter validation errors list allowed prefixes/operators.
- `campaign:update` now blocks updates when status is outside draft/ready/review; tests cover
  allowed JSON parsing and rejection.
- Tests expanded: hash mismatch reuse, force-version flows, `not_in` + range operators, status
  guardrails, CLI force-version wiring; full suite passing.
- Docs updated (README, appendix) with operator list, allowed fields, guardrails, hash note, and
  force-version usage.
