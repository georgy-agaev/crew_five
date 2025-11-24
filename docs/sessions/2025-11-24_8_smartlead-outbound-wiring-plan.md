# Session Plan – 2025-11-24 15:50:19

## Overview
Wire outbound sending via Smartlead MCP while reusing our spine. Add a guarded send command with
dry-run/idempotency and summary logging. No legacy fallback.

## Tasks
- Completed: Add Smartlead send wrapper (`sendViaSmartlead`) using MCP.
- Completed: Wire CLI command (e.g., `smartlead:send`) with `--dry-run`, batch size, and summary output.
- Completed: Record outbound attempts/ids in `email_outbound` with idempotency keys.
- Completed: Update docs/changelog and session log.

## Files to Touch
- `src/integrations/smartleadMcp.ts` – add send method; reuse auth/error handling.
- `src/commands/smartleadSend.ts`, `src/cli.ts` – CLI wiring and options.
- `tests/smartleadSend.test.ts`, `tests/cli.test.ts` – send summary/dry-run/idempotency.
- `README.md`, `CHANGELOG.md`, this session doc.

## Functions
- `sendViaSmartlead(client, drafts, options)` – send drafts via MCP, supports dry-run, returns summary.
- `recordSmartleadOutbound(...)` – persist provider ids and idempotency keys to `email_outbound`.
- `smartleadSendCommand(args)` – CLI entry to load drafts, call send, print summary.

## Tests
- `smartleadSend.sends_and_logs_summary` – successful sends return counts/ids.
- `smartleadSend.respects_dry_run` – no send when dry-run, summary only.
- `smartleadSend.idempotency_recorded` – provider ids and keys stored; duplicates skipped.

## Outcomes
- Smartlead send command added with dry-run/batch-size and summary JSON output.
- MCP send wrapper invoked; email_outbound records include idempotency keys; tests passing.
- Changelog updated (0.1.24); docs to follow in next doc sweep.

## Review Notes
- Consider adding batch-level logging/metrics for skip/fail to spot reputation risks early.
- Add idempotency on select (e.g., filter out drafts already sent) or explicit duplicate guard if MCP returns an idempotency key.
- Dry-run only skips; consider summarizing drafts count vs. fetched to avoid confusion when fewer than batch size are available.
