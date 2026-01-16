# 2025-12-02 – Priority Hardening & Parity Plan

> Timestamp (UTC): 2025-12-02T00:00:00Z  
> Goal: clear the remaining high-priority guardrails (snapshot/version, event FKs/idempotency,
> CLI error surfaces, Smartlead error-path tests), reconcile prompt-selection UI docs, and
> run the quick analytics FK sanity check.

## To Do (order of attack)
- Snapshot/version guardrails & event FKs/idempotency
  - Ensure draft/enrich commands enforce campaign.segment_version vs snapshot, with force-version
    path explicit. Harden email event FK population and stable idempotency hash.
  - Files: `src/commands/draftGenerate.ts`, `src/commands/enrich.ts`, `src/services/segmentSnapshotWorkflow.ts`,
    `src/services/emailEvents.ts`, `tests/draftCommand.test.ts`, `tests/enrichment.test.ts`,
    `tests/emailEvents.test.ts`.

- CLI error hardening follow-through
  - Friendly validation for `event:ingest` (provider/event_type) and Smartlead env checks; broaden
    CLI/tests for dry-run/limit/error surfaces; align README/Smartlead doc/CHANGELOG.
  - Files: `src/cli.ts`, `src/cli-event-ingest.ts`, `src/services/emailEvents.ts`, `src/commands/smartlead*.ts`,
    `tests/cli.test.ts`, `tests/emailEvents.test.ts`, `README.md`, `docs/Smartlead_MCP_Command_Toolkit.md`,
    `CHANGELOG.md`, this session doc.

- Smartlead direct API error-path coverage/stance on send
  - Add tests for 4xx/5xx error handling and clarify interim `smartlead:send` behaviour
    (document as experimental or thin wrapper).
  - Files: `tests/smartleadMcp.test.ts`, `src/commands/smartleadSend.ts`, `README.md`,
    `docs/Setup_smartlead_mcp.md`.

- Prompt selection/UI doc reconciliation
  - Reconcile To Do vs Completed in `2025-12-01_4_prompt-selection-ui-plan.md` and
    `2025-12-01_5_web-ui-model-prompt-wiring-plan.md`; if work is done, mark Completed and list
    any deltas; if not, capture gaps (registry page, campaign selector, prompt preview/tests).
  - Files: `docs/sessions/2025-12-01_4_prompt-selection-ui-plan.md`,
    `docs/sessions/2025-12-01_5_web-ui-model-prompt-wiring-plan.md`, related web files/tests only
    if gaps remain.

- Analytics FK/view sanity check
  - Run/record quick helper check that `email_event` FKs surface in analytics view; reuse
    `email_event_fks_are_present_for_recent_inserts` pattern; log outcome.
  - Files: `tests/emailEvents.test.ts` (or helper), `tests/analytics.test.ts`, this session doc.

## Completed
- Email event idempotency hardened: stable key when `occurred_at` is missing, dedupe now checks `idempotency_key` when `provider_event_id` is absent; tests updated (`tests/emailEvents.test.ts`).
- CLI error surfaces tightened: `event:ingest` now emits `INVALID_JSON` on bad payloads, Smartlead config errors emit `SMARTLEAD_CONFIG_MISSING` with JSON output support on `smartlead:campaigns:list`; tests updated (`tests/cli.test.ts`).
- Smartlead send error handling covered: failed sends increment failure counts without inserts; Smartlead docs/README call out config errors, experimental send stance, and `--error-format json` support (`tests/smartleadSend.test.ts`, `docs/Setup_smartlead_mcp.md`, `README.md`).
- Prompt-selection session docs reconciled: `2025-12-01_4_prompt-selection-ui-plan.md` and
  `2025-12-01_5_web-ui-model-prompt-wiring-plan.md` now reflect completed work with no remaining To Dos.
- Analytics FK sanity check noted: added a helper-style test to confirm `analytics_events_flat` rows
  surface FK columns for joins (`tests/analytics.test.ts`).

## Out of Scope
- New SIM behaviour beyond Option 2 stub.
- New schema changes or prompt/LLM provider expansions not required for the above guardrails.
