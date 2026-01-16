# Session Plan – 2025-11-26 3 – CLI Error-Format Parity & Troubleshooting

## Overview
Extend the new JSON error mode across the remaining CLI commands and document a concise troubleshooting guide for common CLI failures. The goal is to provide consistent `--error-format` behaviour for all mutating/remote commands and to give operators clear examples of how to interpret text vs JSON errors, without introducing any legacy fallback logic.

## Tasks
- Completed: Add `--error-format text|json` support to additional CLI commands that can fail on validation or remote calls (`draft:generate`, `campaign:create`, `smartlead:send`), wiring them through the existing `wrapCliAction` helper.
- Completed: Ensure all newly covered commands using `wrapCliAction` have tests that cover both default text errors and explicit `--error-format json` behaviour, including exit codes and error payload shape.
- Completed: Add `--error-format` usage notes to `README.md` for supported commands and extend existing documentation to highlight JSON mode for automation.
- Completed: Update `CHANGELOG.md` and this session doc to note expanded `--error-format json` support and to summarize the new CLI error-format parity.

## Files to Touch
- `src/cli.ts` – Add `--error-format <format>` options to `draft:generate`, `campaign:create`, and `smartlead:send` (and optionally `email:send` if helpful), wrapping their actions with `wrapCliAction` where not already applied, and ensuring options are plumbed into the wrapper via the first argument.
- `tests/cli.test.ts` – Add tests that exercise `--error-format json` for the newly covered commands (draft generation, campaign creation, Smartlead send, and optional email send), asserting that errors are emitted as `{ ok:false, error:{ code,message,details } }` and that exit codes are set.
- `README.md` – Add or extend documentation for `--error-format` usage on supported commands and introduce a short “CLI Troubleshooting” section with concrete examples of errors and how to interpret text vs JSON outputs.
- `CHANGELOG.md` – Append a note under the next version entry indicating that `--error-format json` support has been expanded to additional commands and that troubleshooting docs were added.
- `docs/sessions/2025-11-26_3_cli-error-format-parity-and-troubleshooting-plan.md` – Track tasks, functions, test coverage, and status for this session.

## Functions
- `createProgram(deps: CliDependencies)` (update) – Continue registering all CLI commands but ensure that `draft:generate`, `campaign:create`, `smartlead:send`, and optionally `email:send` expose an `--error-format` option and route their actions through `wrapCliAction` so text/JSON error behaviour is consistent.
- `wrapCliAction(action)` (reuse) – Already inspects the first argument’s `errorFormat` and emits either plain messages or JSON error payloads; this session relies on reusing it for additional commands rather than introducing new wrappers.
- `formatCliError(error)` (reuse) – Continues to normalize errors into `{ code,message,details }`; no functional change expected, but tests will assert its output is used for the new commands when `--error-format json` is supplied.
- `campaignCreateHandler(client, options)` (read-only) – Keep existing dry-run behaviour; rely on `wrapCliAction` to surface any errors (e.g., bad snapshot options) in text or JSON form at the CLI level.
- `draftGenerateHandler(client, aiClient, options)` (read-only) – Continue forwarding options to `generateDrafts`; CLI wiring will now determine whether any thrown errors appear as text or JSON.
- `smartleadSendCommand(mcp, supabase, options)` (read-only) – Maintain current batch send/dedupe semantics; `wrapCliAction` will be responsible for formatting MCP/Supabase errors.

## Tests
- `cli.draft_generate_error_format_json` – draft:generate failure uses JSON error payload when requested.
- `cli.campaign_create_error_format_json` – campaign:create validation/snapshot errors emit JSON error object.
- `cli.smartlead_send_error_format_json` – Smartlead send errors (e.g., missing MCP env) output JSON errors.
- `cli.email_send_error_format_json` (optional) – email send scaffold errors respect JSON error format.
- `cli.error_format_defaults_to_text_for_new_commands` – without `--error-format`, errors remain text for added commands.

## Status
- Completed: JSON error-mode coverage extended to `draft:generate`, `campaign:create`, and `smartlead:send`, tests added for these commands, and README/CHANGELOG reflect the new `--error-format` options and behaviour; email send remains text-only by design for now.
