# Session Plan – 2025-11-26 00:00:00

## Overview
Harden the CLI command surface for the AI SDR GTM system: eliminate unhandled promise rejections and noisy stack traces, add dry-run/limit flags where expected, align CLI behaviour with docs, and keep Smartlead and event ingestion safe and idempotent. Scope is CLI and supporting services only; no legacy fallback paths unless explicitly required later.

## Tasks
- Completed: Baseline CLI walkthrough for all commands (segment, campaign, draft generation, filters, email send, events, Smartlead, enrichment) and inventory of current runtime issues in “real” CLI mode.
- Completed: Introduce shared CLI error-handling helper (`wrapCliAction` + `formatCliError`) and wire `draft:generate` through it so handler errors are caught and surfaced without unhandled promise rejections.
- Completed: Apply the shared CLI error-handling pattern to `segment:snapshot`, `event:ingest`, and Smartlead commands so they surface clean messages and stable exit codes instead of unhandled rejections or raw stack traces; tests cover JSON errors, missing Smartlead env, and invalid since/limit.
- Completed: Add `--dry-run` support to `campaign:create`, wire it through `campaignCreateHandler`, and ensure tests cover both handler-level behaviour (no campaign insert, snapshot summary returned) and CLI wiring.
- Completed: Add `--limit` support to `draft:generate` at the CLI level, threading it through `draftGenerateHandler` into `generateDrafts` to cap work per invocation in line with README usage; handler and CLI wiring are covered by tests.
- To Do: Make `event:ingest` payload validation and Smartlead MCP env checks emit friendly, structured errors (no stack traces) while preserving strict requirements for `provider`, `event_type`, and Smartlead MCP configuration.
- To Do: Add/extend tests around CLI wiring, dry-run/limit semantics, and error surfaces (including Smartlead env gating) and keep `ast-grep` guardrails green after changes.
- To Do: Update `README.md`, `docs/Smartlead_MCP_Command_Toolkit.md` (if needed), `CHANGELOG.md`, and this session doc once CLI behaviour and flags are finalized.

## Options
- Option 1 – Minimal patch on hot spots: Wrap only the currently failing commands (`draft:generate`, `segment:snapshot`, `event:ingest`, Smartlead commands) with per-command `try/catch` handling and add the missing `--dry-run` / `--limit` flags directly in `src/cli.ts`. Fastest to ship but risks duplication and future drift in error handling.
- Option 2 – Centralised CLI error and config guardrails: Introduce a small helper layer in `src/cli.ts` (e.g., `wrapCliAction` + `formatCliError`) used by all commands to standardise error reporting, exit codes, and Smartlead env gating. Slightly more refactor up front but yields consistent UX and simpler future extensions.
- Option 3 – CLI + docs/test parity sweep: Build on Option 2 by also aligning README and Smartlead docs with the actual flag set (e.g., `draft:generate --limit`, `campaign:create --dry-run`), expanding CLI-focused tests in `tests/cli.test.ts` and related suites, and codifying error expectations (messages, codes) so regressions are caught automatically.

Preferred path: start with Option 2 for a clean, centralised error-handling surface, then apply Option 3’s doc/test parity changes in the same session while keeping mutations limited to CLI/service layers.

## Files to Touch
- `src/cli.ts` – Define shared CLI error-handling helper(s), wire `draft:generate` and `segment:snapshot` (and other commands) through it, add `--dry-run` for `campaign:create`, and surface `--limit` for `draft:generate` consistent with `generateDrafts` options and README.
- `src/commands/campaignCreate.ts` – Extend `CampaignCreateOptions` with `dryRun?: boolean` and, when dry-run is enabled, perform snapshot computation/validation but skip `createCampaign` writes; return a structured summary instead.
- `src/commands/draftGenerate.ts` – Accept a `limit` option from the CLI, pass it through to `generateDrafts`, and ensure the handler surface remains a thin, testable adapter without legacy fallback complexity.
- `src/services/drafts.ts` – Confirm `generateDrafts` respects the new `limit` parameter end-to-end, maintain strict error throwing on Supabase failures, and rely on CLI-level error formatting rather than embedding CLI concerns here.
- `src/cli-event-ingest.ts`, `src/services/emailEvents.ts` – Keep `mapProviderEvent` strict but ensure CLI-facing `eventIngestHandler` converts common validation errors into user-friendly messages via the new error-handling path while preserving dry-run idempotency.
- `src/commands/smartleadCampaignsList.ts`, `src/commands/smartleadEventsPull.ts`, `src/commands/smartleadSend.ts` – Ensure Smartlead commands participate in the shared CLI error-handling and respect existing dry-run semantics and retry/assume-now guardrails.
- `tests/cli.test.ts` – Add CLI-level tests for `campaign:create --dry-run`, `draft:generate --limit/--dry-run`, event ingest validation, Smartlead env gating, and error formatting (no unhandled rejections, stable exit behaviour).
- `tests/campaignCommand.test.ts`, `tests/draftCommand.test.ts`, `tests/emailEvents.test.ts`, `tests/smartleadMcp.test.ts` – Extend or add tests for new handler options and Smartlead/email event behaviours without touching DB schema.
- `README.md`, `docs/Smartlead_MCP_Command_Toolkit.md`, `CHANGELOG.md`, `docs/sessions/2025-11-26_1_cli-hardening-and-error-handling-plan.md` – Align CLI examples and narrative with the updated flags and error semantics; record changes in the changelog.

## Functions
- `createProgram(deps: CliDependencies)` (update) – Continue wiring all CLI subcommands but delegate command actions through a shared wrapper (`wrapCliAction`) so all errors are formatted consistently and exit codes are predictable, including Smartlead env prechecks.
- `runCli(argv = process.argv)` (update) – Remain the entrypoint for `pnpm cli`, potentially wrapping `program.parseAsync` in a final catch-all to guard against any uncaught errors that slip past per-command handling and emit a single structured error message.
- `campaignCreateHandler(client, options)` (update) – Accept a `dryRun` flag from the CLI; in dry-run mode, exercise `ensureSegmentSnapshot` and validate inputs but skip `createCampaign` inserts, returning a summary with the chosen segment version and snapshot counts.
- `draftGenerateHandler(client, aiClient, options)` (update) – Accept and forward a `limit` parameter (and existing graceful/fail-fast toggles) into `generateDrafts`, keeping the handler itself a thin adapter while relying on CLI error handling to catch Supabase/AI failures.
- `generateDrafts(client, aiClient, options)` (update) – Enforce `limit` defaults and behaviour (max members processed per call), maintain strict throwing on Supabase errors, and ensure the summary object remains the primary success path consumed by CLI and tests.
- `eventIngestHandler(client, payloadJson, options)` (update) – Parse incoming JSON, call `ingestEmailEvent`, and rely on shared CLI wrappers so payload validation errors like missing `provider`/`event_type` surface as clean, user-facing error messages without stack traces.
- `mapProviderEvent(payload)` / `ingestEmailEvent(client, payload, options)` (update) – Keep strict validation and idempotent inserts, but clearly document expected payload shape in tests/docs and avoid embedding CLI-specific behaviour inside the service layer.
- `smartleadCampaignsListCommand(client, options)` (update) – Continue to call `client.listCampaigns` and print JSON/text summaries; when invoked from CLI, errors should propagate through the shared handler for consistent messaging and exit codes.
- `smartleadEventsPullCommand(client, supabaseClient, options)` (update) – Preserve validation for `since`/`limit`/`retryAfterCapMs` and ingestion semantics, but ensure any thrown errors (including from `ingestEmailEvent`) follow the new CLI error formatting.
- `smartleadSendCommand(mcp, supabase, options)` (update) – Maintain existing batch send/dedupe logic; rely on shared CLI error handling so Supabase or MCP failures translate into predictable CLI failures rather than unhandled exceptions.
- `wrapCliAction(action)` (new, `src/cli.ts`) – Higher-order helper that runs async command actions, catches errors, formats them (optionally for JSON/text), and sets `process.exitCode` without emitting Node unhandled rejection warnings.
- `formatCliError(error)` (new, `src/cli.ts` or helper) – Convert any thrown error (Error, Supabase error object) into a concise CLI message (and optionally JSON payload) that hides stack traces but preserves useful codes/messages for operators.

## Tests
- `cli.campaign_create_supports_dry_run` – dry-run path computes snapshot, skips campaign insert writes.
- `cli.draft_generate_accepts_limit_and_dry_run` – CLI passes limit into handler and avoids inserts on dry-run.
- `cli.draft_generate_handles_supabase_error_cleanly` – Supabase error produces user message and non-zero exit, no unhandled rejection.
- `cli.segment_snapshot_reports_validation_errors` – invalid/mismatched snapshot options print clear error and exit non-zero.
- `cli.event_ingest_requires_provider_and_event_type` – missing provider/event_type yields friendly validation error, no stack trace.
- `cli.smartlead_commands_require_env_vars` – missing SMARTLEAD_MCP_* env cause clear config error and stable exit code.
- `drafts.generateDrafts_respects_limit_and_dry_run` – limit caps members processed; dry-run skips inserts but updates summary.
- `campaigns.create_respects_dry_run` – campaignCreateHandler dry-run uses snapshot workflow but never writes campaign row.
- `emailEvents.mapProviderEvent_validates_payload_shape` – asserts mapProviderEvent throws on missing fields and normalizes reply labels.
- `smartleadMcp.commands_surface_errors_consistently` – Smartlead list/pull/send propagate MCP errors through shared CLI formatter.

## Status
- Completed: CLI surface scanned end-to-end; core failure modes and option mismatches identified (missing `--dry-run` on `campaign:create`, unhandled rejections on `draft:generate`/`segment:snapshot`, strict event payload and Smartlead env requirements). Initial centralised CLI error handling is in place for `draft:generate` with tests.
- To Do: Extend centralised CLI error handling to remaining commands, add `campaign:create --dry-run` and `draft:generate --limit`, harden event/Smartlead behaviour, expand tests, and align docs/changelog with the updated CLI contract.
