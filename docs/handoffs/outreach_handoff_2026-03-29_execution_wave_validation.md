# Handoff: Execution Layer + Wave/Rotation Validation

**Date:** 2026-03-29  
**Status:** Draft (hold for sending)  
**Owners:** `crew_five` -> `Outreach`

## Scope

This handoff covers two things:

1. Execution-layer stability for live mode (send + inbox poll via `imap-mcp`).
2. How to validate `attach` / `wave` (next-wave) / `rotation` generation flows without wasting tokens.

## Current State (crew_five)

- `send-campaign` execution: owned by `crew_five` (direct `imap-mcp` transport when configured).
- `process-replies` ingestion: owned by `crew_five` (direct `imap-mcp` inbox transport when configured).
- Web adapter schedulers:
  - inbox poll scheduler: enabled by `INBOX_POLL_ENABLED=true`
  - auto-send scheduler: enabled by `AUTO_SEND_ENABLED=true`

### Transport hardening (important)

Root cause of the “mailbox flakiness” seen in logs:

- send and inbox were previously starting separate `imap-mcp` stdio processes
- those processes could hold competing IMAP connections to the same accounts
- on disconnects, imap-mcp can enter an unrecoverable `ImapFlow` state
  (`Failed to reconnect: Can not re-use ImapFlow instance`)

Fix:

- `crew_five` now uses a shared `imapMcpTransportManager` so send + inbox share **one**
  MCP stdio process and have a single reconnect/restart policy.
- the manager restarts the MCP process when it sees unrecoverable reconnect errors and retries once
  on transient connection failures (timeouts, `ECONNRESET`, `Connection not available`).

## Wave / Rotation Reality Check (BKC pilot family)

### Observed issue: “Wave 2” is not a fresh wave

Campaigns:

- Base wave: `dad76931-0ef5-4144-a84a-eaa4ae759334` (`ВКС-Less-30plus-2026-03`)
- Existing Wave 2: `f51361b3-83d2-47b2-92dc-92b679cc792f` (`ВКС-Less-30plus-2026-03 — Wave 2`)

Audience overlap:

- `baseCompanies=349`
- `wave2Companies=242`
- `wave2InBase=242`
- `wave2Unique=0`

Conclusion:

- this Wave 2 dataset is an invalid “fresh wave” for intro generation
- generating intros on it will waste tokens and send credits

What Wave 2 should be instead (choose one):

1. **Rotation**: same companies, different offer/hypothesis (new framing).
2. **Follow-up**: bump/follow-up sequence driven by reply/non-reply state.
3. **Fresh wave**: different companies (not in base wave) which requires a segment that contains
   more companies than the base wave used.

### Canonical next-wave campaign (ready for validation)

To unblock validation without reusing the invalid Wave 2 dataset, a canonical next-wave campaign
was created via `campaign:next-wave:create`:

- `0e0aa8d8-f650-4a9f-9232-d1f61752b448` (`ВКС-Less-30plus-2026-03 - Next Wave (canon)`)

### Canonical attach-validation campaign (ready for manual_attach)

A dedicated attach-validation campaign was created via `campaign:launch`:

- `25eea785-7400-4e93-bd55-ed66484d8e4f` (`ВКС-Less-30plus-2026-03 - Attach Validation (canon)`)

Next step for attach validation is to attach a small set of companies to this campaign (source:
`manual_attach`) and then confirm Outreach generation includes them.

## Canonical validation protocol

Use: [outreach_generation_validation_protocol.md](/Users/georgyagaev/crew_five/docs/tasks/outreach_generation_validation_protocol.md)

Key rule:

- do **not** validate next-wave using the existing Wave 2 campaign above
- create a fresh next-wave using the canonical `crew_five` next-wave flow

## CLI commands (Outreach operator)

These calls should be enough to machine-check readiness before generation:

```bash
# Base detail (canonical context)
pnpm cli campaign:detail --campaign-id dad76931-0ef5-4144-a84a-eaa4ae759334 --error-format json

# Next-wave preview (canonical exclusions + eligible count)
pnpm cli campaign:next-wave:preview --campaign-id dad76931-0ef5-4144-a84a-eaa4ae759334 --error-format json

# Rotation preview (if Wave 2 is intended as rotation)
pnpm cli campaign:rotation:preview --campaign-id dad76931-0ef5-4144-a84a-eaa4ae759334 --error-format json
```

If any required canonical fields are missing (project/offer/hypothesis/criteria/recipient context),
generation should stop and report missing fields instead of locally re-inferring.
