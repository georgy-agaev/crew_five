# Session Plan – 2025-11-26 2 – CLI Error Parity & JSON Mode

## Overview
Extend the CLI hardening work by unifying error handling across all commands, adding an optional JSON error-output mode for automation, and documenting common failure scenarios. The goal is to make `campaign:status` and `filters:validate` follow the same conventions as the newer error wrapper, expose a machine-friendly error format, and give operators a concise troubleshooting guide without introducing any legacy fallback behaviour.

## Tasks
- Completed: Refactor `campaign:status` to use the shared `wrapCliAction`/`formatCliError` helpers so status-transition and Supabase errors surface as consistent, non-stack-trace messages with stable exit codes, including JSON error output when requested.
- Completed: Introduce a per-command `--error-format text|json` option for `campaign:status`, `event:ingest`, and `smartlead:events:pull`, and extend `wrapCliAction` so Smartlead commands and event ingest respect it when emitting errors.
- Completed: Align `filters:validate` with the shared error-handling approach by ensuring `validateFilters` returns structured error objects with `code/message/details` compatible with the shared formatter, while preserving existing CLI output formats and exit-code semantics.
- Completed: Add tests to cover the new error-format behaviour for `campaign:status`, `event:ingest`, and `smartlead:events:pull`, keeping `ast-grep` and existing guardrails green.
- Completed: Update `README.md`, `CHANGELOG.md`, and this session doc to describe the unified error experience, JSON error options, and where to use them in automation.

## Options
- Option 1 – Minimal parity pass: Only wrap `campaign:status` and `filters:validate` with `wrapCliAction`, keeping their current text-only outputs and exit-code logic intact. Lowest risk but does not add JSON error output or global configuration.
- Option 2 – Central error-format flag: Add a single `--error-format json|text` (or env-driven equivalent) that `wrapCliAction` reads, emitting either plain-text messages or structured JSON error objects across commands, including Smartlead and event ingest. Provides consistent automation support with modest refactor.
- Option 3 – Error contracts + docs: Build on Option 2 by documenting error codes (e.g., `ERR_FILTER_VALIDATION`, status/Smartlead codes) and adding a README troubleshooting section describing typical CLI failures and how to interpret JSON vs text errors. Slightly more scope but yields clearer contracts for operators and tests.

Preferred path: follow Option 2 as the core implementation (central error-format flag + shared wrapper), then apply Option 3’s documentation and contract clarifications in the same session where feasible.

## Files to Touch
- `src/cli.ts` – Refactor `campaign:status` and `filters:validate` actions to use `wrapCliAction`, introduce an `--error-format json|text` option (or equivalent) at the top-level and propagate it into `wrapCliAction`/`formatCliError` calls, and ensure Smartlead and event ingest commands respect the new error-format behaviour.
- `src/status.ts` – (Read-only for context) verify existing status error codes/messages so `formatCliError` can surface concise status-related errors without extra wrapper logic.
- `tests/cli.test.ts` – Add tests for `campaign:status` and `filters:validate` under both text and JSON error-format modes; extend Smartlead and event ingest tests to assert JSON error outputs and exit codes.
- `README.md` – Document the new `--error-format` option, describe how JSON errors look, and add a troubleshooting subsection for common CLI issues (missing env vars, invalid filters/segment IDs/status transitions, Smartlead configuration problems).
- `CHANGELOG.md` – Add a new version entry summarizing unified error handling, `--error-format` support, and troubleshooting docs.
- `docs/sessions/2025-11-26_2_cli-error-parity-and-json-mode-plan.md` – Track plan, decisions, and status as tasks complete.

## Functions
- `createProgram(deps: CliDependencies)` (update) – Continue to define all CLI subcommands but wire `campaign:status`, `filters:validate`, and any remaining actions through `wrapCliAction`, and surface a shared `--error-format` option or configuration that influences error output across commands.
- `wrapCliAction(action)` (update) – Extend the helper to accept contextual options (e.g., error format) so it can decide whether to emit plain-text messages or structured JSON error payloads while still setting `process.exitCode` appropriately.
- `formatCliError(error)` (update) – Enhance the formatter so when JSON mode is enabled it returns an object with `code`, `message`, and optional `details`, while in text mode it preserves the current concise string output.
- `campaignStatusHandler(client, options)` (read-only) – Source for status-transition errors; wrapper will ensure these errors are presented consistently at the CLI without changing handler logic.
- `validateFilters(definition)` (read-only) – Continues to produce structured filter validation results; `filters:validate` will rely on shared error handling for JSON/text formatting and exit codes, without changing the validation contract itself.

## Tests
- `cli.campaign_status_uses_shared_error_wrapper_text` – campaign:status errors printed via wrapper, readable text output.
- `cli.campaign_status_uses_shared_error_wrapper_json` – same error surfaced as JSON with code/message fields.
- `cli.filters_validate_uses_shared_error_wrapper_json` – filter validation errors emitted as JSON according to error-format setting.
- `cli.smartlead_errors_support_json_format` – Smartlead env/validation errors return JSON when error-format=json is enabled.
- `cli.event_ingest_bad_payload_json_format` – invalid JSON payload produces structured JSON error object instead of plain text.
- `cli.global_error_format_defaults_to_text` – when not specified, error format remains text for backwards compatibility.

## Status
- Completed: Error-parity refactor implemented for `campaign:status`, `event:ingest`, and `smartlead:events:pull` with `--error-format` support and tests; `filters:validate` shares the same structured error contract via `validateFilters`, and README/CHANGELOG have been updated to document JSON error options for CLI automation.
