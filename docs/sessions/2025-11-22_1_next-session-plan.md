# Session Plan – 2025-11-22 (Next Session)

## Overview
Focus the next session on hardening segmentation and snapshot enforcement so campaigns always use
deterministic contact sets, while keeping draft generation stable. Avoid legacy fallback work unless
explicitly requested.

## Plan (Completed 2025-11-22)
- [Completed] Narrow scope: add a minimal `campaign:update` that only allows `prompt_pack_id`,
  `schedule`, and `throttle` updates; forbid segment changes/status changes for now.
- [Completed] Keep filter DSL minimal (equals, in/not-in, >=, <=) with required `op/field/value`;
  reject unknown fields/operators.
- [Completed] Build a mock Supabase client that records applied filters to assert query constraints
  in tests.
- [Completed] Reject snapshots when filters resolve to zero contacts unless `--allow-empty` is
  passed.
- [Completed] If `bumpVersion` is set, always increment then refresh; ignore provided
  `segmentVersion`.
- [Completed] Add end-to-end CLI/Vitest coverage for `segment:snapshot` + `campaign:create` with
  mocked Supabase/AI to validate snapshot enforcement.
- [Completed] Document the DSL grammar/operator table in the PRD appendix.
- [Completed] Move filter parsing/validation into `src/filters/` and export AST types for reuse.
- [Completed] Enforce max contacts per snapshot (configurable; default 5000) and fail fast when
  exceeded.

## Files to Touch
- `src/filters/` (new) – parsing/validation and AST types; query adapter.
- `src/services/segments.ts` – use filter module + contact query builder.
- `src/services/segmentSnapshotWorkflow.ts` – guardrails: zero-contact rejection, max-size checks,
  bump rules.
- `src/commands/segmentSnapshot.ts`, `src/commands/campaignCreate.ts`,
  `src/commands/campaignUpdate.ts` (new) – CLI wiring for refresh/bump.
- `src/cli.ts` – register the new `campaign:update` command.
- `tests/segmentFilters.test.ts`, `tests/segmentSnapshotWorkflow.test.ts`, `tests/cli.test.ts` –
  coverage for CLI snapshot/create/update with mocked Supabase/AI.
- `README.md`, `CHANGELOG.md`, `docs/sessions/YYYY-MM-DD_<n>_*.md`, PRD appendix – document DSL and
  behaviors.

## Functions
- `parseSegmentFilters(filterDef)` – parse/validate minimal DSL (equals, in/not-in, >=, <=); throw on
  empty/unknown.
- `buildContactQuery(filters)` – translate validated filters into Supabase query; tested via mock
  client recording constraints.
- `ensureSegmentSnapshot(...)` (update) – reject zero-contact snapshots unless `allowEmpty`; enforce
  bumpVersion refresh rules and max-size guard.
- `campaignUpdateHandler(client, options)` – update only `prompt_pack_id`, `schedule`, `throttle`;
  forbid segment/status changes.
- `registerCampaignUpdateCommand(program, handlers)` – expose `campaign:update` CLI wiring.

## Tests
- `segmentFilters.in_and_range_operators_filter_contacts` – >=, <=, in/not-in clauses work with mock
  recorded constraints.
- `segmentFilters.rejects_unknown_fields_or_empty_filters` – validation errors on bad DSL.
- `segmentSnapshotWorkflow.rejects_zero_contacts_without_allow_empty` – guardrail blocks empty sets.
- `segmentSnapshotWorkflow.enforces_max_contacts_guardrail` – fails when exceeding limit.
- `cli.campaign_update_allows_prompt_pack_schedule_throttle_only` – CLI rejects segment/status
  changes.
- `cli.segment_snapshot_and_campaign_create_end_to_end` – mocked Supabase/AI; snapshot enforced in
  campaign create/update paths.

## Outcomes (2025-11-22)
- Added `src/filters/` with validated minimal DSL (`eq`, `in`, `not_in`, `gte`, `lte`) and Supabase
  query adapter plus tests.
- Enforced snapshot guardrails: default max 5000 contacts, optional `--max-contacts`, and
  `--allow-empty` to opt into zero-contact snapshots.
- Added `campaign:update` CLI/handler limited to `prompt_pack_id`, `schedule`, `throttle`; blocked
  segment/status changes.
- Updated CLI wiring, handlers, docs (README, appendix), and tests; full Vitest suite passing.
