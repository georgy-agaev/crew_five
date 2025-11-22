# Changelog

All notable changes to this project will be documented in this file.

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
