# Changelog

All notable changes to this project will be documented in this file.

## [0.1.11] - 2025-11-23
### Added
- Hardened send scaffold with per-minute throttling, duplicate guard (mark drafts sending), retry-once stub, and summary logging (`sent/failed/skipped`).
- CLI send wiring retains stub provider and supports JSON logs; tests cover throttle/skip and retry logging.

## [0.1.12] - 2025-11-23
### Added
- Email send CLI now supports summary formats (json/text), dry-run, and JSON logging; send scaffold returns batch_id/timestamp summary.
- Tests cover throttle/skip and retry logging; docs updated with CLI options.

## [0.1.10] - 2025-11-23
### Added
- Email send scaffold (`email:send` CLI) with stubbed SMTP send/log/throttle and outbound recording.
- README documents the send scaffold command; tests cover stub send and throttle behavior.

## [0.1.9] - 2025-11-23
### Added
- Centralized status transitions in `src/status.ts` (typed union + helper); errors carry `ERR_STATUS_INVALID` with allowed transitions in details.
- Validation CLI formats refined (json/text/terse) with codes/hints and consistent exit codes; telemetry stub retained.
- Roadmap/session updated to reflect finalized status/validation UX.

## [0.1.8] - 2025-11-23
### Added
- Campaign status typed union plus exported transition map helper; invalid transitions now use `ERR_STATUS_INVALID`.
- `filters:validate` supports `json|text|terse` formats, returns codes/hints, sets exit codes, and includes a telemetry stub.
- README (validate command formats) and appendix link to status/validation sections; session log added.

## [0.1.7] - 2025-11-22
### Added
- Structured filter validation errors with `ERR_FILTER_VALIDATION` code, JSON/text output formats, and CLI wiring that exits non-zero on failure.
- Status transition helper exposed and documented; campaign updates continue to enforce allowed statuses/fields.
- Session docs/roadmap updated to reflect status enforcement/validation UX refinements.

## [0.1.6] - 2025-11-22
### Added
- Campaign status transition map (including pause/resume) with table tests; `campaign:update` still limited to prompt_pack_id/schedule/throttle and blocked outside draft/ready/review.
- `filters:validate` CLI command outputs structured JSON and exits non-zero on errors; filter validation now returns friendly messages with allowed prefixes/operators.
- README updated with status transition table and validate command; session logs/roadmap refreshed.

## [0.1.5] - 2025-11-22
### Added
- Snapshot hashing for reuse/refresh with hash mismatch rejection, filter validation errors improved, and `--force-version` wiring/guardrails in CLI/handlers.
- Campaign update guardrails block non-draft/ready/review statuses; filter DSL tests expanded (`not_in`, range/list), and docs updated (README, appendix).

## [0.1.4] - 2025-11-22
### Added
- Introduced validated segment filter DSL (`eq`, `in`, `not_in`, `gte`, `lte`) in `src/filters/` with guardrails for unknown fields and empty filters.
- Enforced snapshot guardrails (default max 5000 contacts, `--max-contacts`, `--allow-empty`) and tightened snapshot workflow defaults.
- Added `campaign:update` CLI/handler limited to `prompt_pack_id`, `schedule`, `throttle`; updated CLI wiring and docs.

## [0.1.3] - 2025-11-22
### Added
- Added tracked `prompts/template.md` and adjusted ignore rules so prompt drafts stay local while the template remains versioned.

## [0.1.2] - 2025-11-22
### Added
- Created `prompts/` folder for prompt drafts and ignored its contents (tracked placeholder only) to keep credentials and prompt iterations out of git.

## [0.1.1] - 2025-11-22
### Added
- Initialized git repository on `main` and added a repo-appropriate `.gitignore`.

## [0.1.0] - 2025-11-21
### Added
- Initial AI SDR GTM PRD (`docs/AI_SDR_GTM_PRD.md`) covering context, architecture spine, data-quality modes, interaction modes, analytics, release plan, and AI SDK integration.
- Appendix A with the non-negotiable `generate_email_draft` contract (`docs/appendix_ai_contract.md`).
- Pattern Breaker analytics requirements and monthly review strategy.
- CLI/UI parity requirement, interaction mode toggles, strict/graceful data-quality policies, and SMTP-first sending strategy.
- Supabase project linked (`supabase/config.toml`) with first migration `20251121211952_2025-11-21_create_spine_tables.sql` defining spine tables (`segments`, `segment_members`, `campaigns`, `drafts`, `email_outbound`, `email_events`, `fallback_templates`).
- Node/TypeScript CLI scaffold (`src/cli.ts`) with handlers for segment creation, campaign creation, and draft generation plus Vitest coverage for env loading, services, and commands.
- Segment snapshot pipeline added: filter parser, contact fetch, snapshot writer, `segment:snapshot` CLI command, and documentation/tests covering the new flow.
- Campaign creation now enforces snapshots via `ensureSegmentSnapshot` workflow, supports `--snapshot-mode`/`--bump-segment-version`, persists snapshot metadata in campaigns, and schema includes `segments.version` column.

### Changed
- Prioritized SMTP adapter over Smartlead; removed Leadmagic integration references from the PRD.
- Updated release plan milestones to include interaction-mode implementation and graceful-mode unlock post enrichment.

### Notes
- Changelog will be updated alongside future PRD or implementation changes.
