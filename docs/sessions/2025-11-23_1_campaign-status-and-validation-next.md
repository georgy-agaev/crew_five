# Session Plan – 2025-11-23 12:03:48

## Overview
Focus on finalizing campaign status enforcement (explicit transition map) and polishing filter
validation UX. Keep scope tight: no legacy fallback, no new integrations.

## Plan
- Enforce a single campaign status transition map in code/CLI; add helper to expose it for reuse and use status type union to prevent typos.
- Ensure `campaign:update` rejects status changes (no status param) and only allows prompt_pack_id/schedule/throttle in allowed statuses.
- Polish `filters:validate` output with structured errors (code + hints) and add a terse format (`OK`/`ERR <code>`); keep JSON default.
- Add telemetry hook stub (emit success/fail for validation) for future observability; no schema changes.
- Update docs (README links from appendix) with status map/validation guidance; log changes in changelog/session.

## Files to Touch
- `src/services/campaigns.ts` – central transition map, guard helpers, error codes.
- `src/commands/campaignUpdate.ts`, `src/commands/campaignCreate.ts` – enforce guards/messages.
- `src/cli.ts` – validate command output polish; ensure exit codes consistent.
- `src/filters/index.ts` – structured validation errors (codes/hints).
- `tests/campaigns.test.ts`, `tests/campaignUpdateCommand.test.ts`, `tests/cli.test.ts`,
  `tests/segmentFilters.test.ts` – cover status transitions, guardrails, validation outputs.
- `README.md`, `docs/appendix_ai_contract.md`, `CHANGELOG.md` – document status map/validation UX.

## Functions
- `assertCampaignStatusTransition(current, next)` – validate status changes; throw with code/message
  and allowed targets.
- `campaignUpdateHandler(...)` – allow prompt_pack_id/schedule/throttle only; block disallowed
  statuses/fields with friendly errors.
- `validateFilters(def)` – return `{ok,error?}` with `ERR_FILTER_VALIDATION`, hints for prefixes/op.
- `registerValidateFiltersCommand(program)` – output JSON/text, set exit code on error.

## Tests
- `campaigns.status_transition_table_valid_and_invalid` – allowed transitions pass; illegal fail with
  clear code/message.
- `campaignUpdateHandler.rejects_invalid_status_or_fields` – blocks disallowed statuses/fields.
- `filters.validation_returns_codes_and_hints` – invalid field/op returns code + prefixes/op list.
- `cli.filters_validate_outputs_structured_json_and_text` – success/error output, exit codes set.

## Outcomes
- Added `CampaignStatus` union, exported transition map helper, and error code `ERR_STATUS_INVALID`
  for invalid transitions; table tests cover valid/invalid transitions.
- `filters:validate` now supports `json|text|terse` formats, emits code `ERR_FILTER_VALIDATION`,
  sets exit code on errors, and includes a telemetry stub hook.
- Filter validation returns codes with allowed prefixes/operators; CLI tests cover success/error
  output formats.
- Docs updated: README validation command formats; appendix links to README status/validation sections;
  changelog/session log updated.
