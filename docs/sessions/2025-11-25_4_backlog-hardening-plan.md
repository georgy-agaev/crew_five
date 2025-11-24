# Session Plan – 2025-11-25 00:38:28

## Overview
Address backlog items from recent sessions: wire graceful CLI flag, add outbound dedupe/logging guardrails, add reply pattern filters, validate judge inputs, and expose assume-now usage/telemetry hooks. Keep scope tight; no legacy fallback.

## Tasks
- To Do: Wire a single `--graceful` flag through draft generate/send with catalog guard; add dry-run preview counts for fallbacks.
- To Do: Add batch-level logging and dedupe guard for Smartlead send; summarize fetched vs. sent/failed/skipped once.
- To Do: Add top-N/date filters to reply pattern helper/CLI; keep defaults lightweight.
- To Do: Add input validation to judge (subject/body non-empty), with warnings in summary and optional fail-fast; keep limit default.
- To Do: Expose optional telemetry/log hook for assume-now usage with a single summary log and PII caution.
- To Do: Update docs/changelog/session log.

## Files to Touch
- `src/commands/draftGenerate.ts`, `src/cli.ts`, `src/services/drafts.ts` – graceful toggle wiring + guard.
- `src/commands/smartleadSend.ts` – dedupe guard, batch logging (fetched vs. sent/failed).
- `src/services/emailEvents.ts`, `tests/emailEvents.test.ts`, `tests/cli.test.ts` – pattern filters (top-N/date).
- `src/services/judge.ts`, `src/commands/judgeDrafts.ts`, `tests/judge.test.ts` – validate inputs, warn in summary.
- `README.md`, `docs/Smartlead_MCP_Command_Toolkit.md`, `CHANGELOG.md`, this session doc – doc updates.

## Functions
- `ensureGracefulToggle` (update) – enforce catalog and CLI flag.
- `smartleadSendCommand` (update) – dedupe guard, batch log summary, fetched vs. sent.
- `getReplyPatterns(options)` – optional `topN`/`since` filters.
- `judgeDraftsCommand` (update) – validate drafts, include warnings in summary.
- `onAssumeNow` hook (doc/code) – optional telemetry callback with PII caution.

## Tests
- `drafts.graceful_flag_blocks_without_catalog` – CLI/handler guard enforced.
- `smartleadSend.logs_batch_and_dedupes` – summaries include fetched/sent/failed; duplicates skipped.
- `emailEvents.patterns_support_filters` – topN/since filters applied.
- `judge.warns_on_empty_inputs` – summary includes warnings; validations enforced.
