# Task: crew_five Execution-Layer Migration

**Date:** 2026-03-23
**Status:** Completed
**Owner:** backend / Codex

## Context

`Outreach` currently still owns two runtime-heavy skills:

- `send-campaign`
- `process-replies`

This creates three classes of problems:

1. token cost
2. bridge/runtime fragility
3. split observability across two systems

At the same time, `crew_five` already owns most of the canonical execution state:

- campaign status
- send policy
- mailbox assignment
- send preflight
- auto-send scheduler
- inbox poll scheduler
- `email_outbound`
- `email_events`
- suppression state
- campaign analytics

That means the current architecture is misaligned:

- `crew_five` already looks like the execution system
- `Outreach` is still carrying part of the routine runtime loop

## Problem

We are spending LLM/runtime budget on flows that are mostly deterministic operations:

- loading drafts
- sending approved emails
- polling inboxes
- recording sends/replies/bounces
- updating suppression

These are poor candidates for repeated Claude runtime calls.

`Outreach` should remain the intelligence layer where judgment is genuinely needed:

- draft generation
- reply drafting
- ambiguous reply interpretation
- GTM reasoning / hypothesis work

## Options

### Option 1 — Keep execution in Outreach

Leave `send-campaign` and `process-replies` where they are.

Pros:

- no migration work
- no temporary contract churn

Cons:

- highest token cost
- highest bridge fragility
- split execution observability
- routine runtime still depends on Claude availability

### Option 2 — Move execution layer to crew_five, keep judgment in Outreach

Move deterministic send/reply runtime into `crew_five`, but keep generation and ambiguous
interpretation in `Outreach`.

Pros:

- best cost / risk trade-off
- cleaner architecture
- keeps `Outreach` focused on writing / judgment
- aligns execution state and execution code inside one system

Cons:

- requires interface refactor
- reply processing becomes partially split by confidence level

### Option 3 — Move everything into crew_five

Pull send, replies, and all LLM decisioning into `crew_five`.

Pros:

- fully centralized
- smallest long-term surface area

Cons:

- too large for one safe session
- higher migration risk
- weakens the current `Outreach` role prematurely

## Recommended Path

Take **Option 2**.

### What stays in Outreach

- `generate-drafts`
- `generate-bumps`
- review / regenerate draft logic
- ambiguous human reply interpretation
- reply drafting
- GTM reasoning
- ICP / hypothesis iteration

### What moves to crew_five

- `send-campaign`
- approved-draft loading and send loop
- send result recording
- inbox polling
- obvious reply classification
  - bounce
  - unsubscribe
  - out-of-office
  - simple auto-reply
- suppression updates
- reply / send operational metrics

## Migration Order

### Phase 1 — Send execution migration

Move `send-campaign` into `crew_five`.

Why first:

- it is the most deterministic flow
- `crew_five` already owns preflight, scheduler, mailbox assignment, and outbounds
- highest payoff with the lowest ambiguity

### Phase 2 — Reply ingestion migration

Move inbox polling and obvious reply classification into `crew_five`.

Keep ambiguous replies routed to `Outreach`.

### Phase 3 — Optional deeper consolidation

After phases 1 and 2 are stable, decide whether any remaining execution bridge in `Outreach`
should be retired.

## Phase 1 Scope — send-campaign

### New canonical responsibility

`crew_five` becomes the source of truth for:

- loading sendable approved drafts
- mailbox round-robin
- provider send execution
- recording `email_outbound`
- updating draft status to `sent`
- handling retryable vs terminal send errors

### Required surfaces

- keep current preflight contract
- add internal send runner that does not depend on Claude
- preserve current scheduler behavior
- preserve mailbox assignment semantics

### Expected result

- auto-send no longer depends on `Outreach` / Claude runtime
- manual send path can also converge on the same deterministic execution layer

## Completed This Session

### Phase 1 foundation implemented

The first backend foundation for Phase 1 now exists in code.

Completed:

- added a canonical deterministic send runner in
  [campaignSendExecution.ts](/Users/georgyagaev/crew_five/src/services/campaignSendExecution.ts)
- added focused coverage in
  [campaignSendExecution.test.ts](/Users/georgyagaev/crew_five/tests/campaignSendExecution.test.ts)
- added intro / bump / mixed execution support
- added mailbox round-robin sender assignment inside the runner
- added canonical outbound recording through the existing `email_outbound` path
- added failed-send handling that records failed outbound attempts and restores draft status
- updated
  [campaignAutoSend.ts](/Users/georgyagaev/crew_five/src/services/campaignAutoSend.ts)
  so the scheduler can prefer an internal `executeSendCampaign(...)` callback instead of only the
  external bridge trigger
- added a direct `imap-mcp` live transport adapter in
  [imapMcpSendTransport.ts](/Users/georgyagaev/crew_five/src/web/liveDeps/imapMcpSendTransport.ts)
  with focused coverage in
  [imapMcpSendTransport.test.ts](/Users/georgyagaev/crew_five/src/web/liveDeps/imapMcpSendTransport.test.ts)
- hardened the `imap-mcp` integration by introducing a shared transport manager in
  [imapMcpTransportManager.ts](/Users/georgyagaev/crew_five/src/web/liveDeps/imapMcpTransportManager.ts)
  so send + inbox polling share a single MCP stdio process and can restart cleanly on
  unrecoverable `ImapFlow` reconnect states (`Failed to reconnect: Can not re-use ImapFlow instance`).
  This prevents the “two imap-mcp processes fighting over the same accounts” failure mode that showed up
  as periodic `ECONNRESET` / `Connection not available` bursts in live logs.
- updated
  [liveDeps.ts](/Users/georgyagaev/crew_five/src/web/liveDeps.ts)
  so auto-send now prefers direct `imap-mcp` execution when configured, and only falls back to the
  legacy `Outreach` bridge otherwise
- added a canonical manual send route:
  - `POST /api/campaigns/:campaignId/send`
- added a manual send action in the operator `Send preflight` card so the same execution runner can
  be used outside the scheduler
- validated direct delivery live against the real transport and mailbox state

### Direct adapter configuration

Current direct send path is enabled by:

- `IMAP_MCP_SERVER_ROOT`
- `IMAP_MCP_HOME`
- optional `IMAP_MCP_SERVER_COMMAND` (defaults to `node`)
- optional `IMAP_MCP_SERVER_ENTRY` (defaults to `dist/index.js`, useful for `tsx src/index.ts`
  launcher overrides)

This keeps the transport adapter thin while avoiding hard-coded personal paths in core code.

### Live smoke validated

Direct send was validated end-to-end against the existing mailbox transport.

Confirmed:

- `crew_five` can send directly through `imap-mcp` without routing through `Outreach`
- a manual transport smoke sent two emails successfully from
  `pavel@voicexpertout.ru`
- recipients:
  - `gagaev@emag.ru`
  - `georgy.agaev@gmail.com`
- both messages were delivered

### Phase 2 completed

Reply-side migration is now also implemented in `crew_five`.

Completed:

- added a direct `imap-mcp` inbox adapter in
  [imapMcpInboxTransport.ts](/Users/georgyagaev/crew_five/src/web/liveDeps/imapMcpInboxTransport.ts)
- added an internal reply-ingestion service in
  [processReplies.ts](/Users/georgyagaev/crew_five/src/services/processReplies.ts)
- added rule-based obvious reply classification in
  [replyClassifier.ts](/Users/georgyagaev/crew_five/src/services/replyClassifier.ts)
- wired
  [liveDeps.ts](/Users/georgyagaev/crew_five/src/web/liveDeps.ts)
  so inbox polling now prefers direct `crew_five` ingestion and only falls back to the legacy
  `Outreach` bridge when the direct path is not configured
- kept canonical event recording via existing
  [emailEvents.ts](/Users/georgyagaev/crew_five/src/services/emailEvents.ts)
  and existing inbox read models / handled-unhandled surfaces

Behavior of the new internal path:

- polls unread messages from `imap-mcp`
- matches replies to `email_outbound` via `In-Reply-To -> provider_message_id`, with fallback to
  recipient email matching
- ingests obvious `bounce`, `unsubscribe`, `vacation`, `decline`, `interest`, and generic
  `needs_review` replies into canonical `email_events`
- marks successfully processed or skipped messages as read so the scheduler does not loop forever on
  the same inbox rows

Legacy `Outreach` remains only as a fallback transport / optional later judgment layer.

Known environment note:

- on the current machine, the built `imap-mcp-server/dist/index.js` launcher is not reliable
- the direct adapter therefore also supports an explicit `IMAP_MCP_SERVER_ENTRY`
- recommended local override:
  - `IMAP_MCP_SERVER_COMMAND=/Users/georgyagaev/mcp/servers/imap-mcp-server/node_modules/.bin/tsx`
  - `IMAP_MCP_SERVER_ENTRY=src/index.ts`

### What is not done yet

- deeper ambiguous-reply escalation / reply drafting still remains on the `Outreach` side
- live environments must still opt into the direct `imap-mcp` transport path through adapter env
  config
- a later cleanup decision is still needed on whether to retire the legacy `Outreach`
  process-replies fallback completely

### Current interpretation

The recommended Option 2 migration is now operationally complete:

- `crew_five` owns send execution
- `crew_five` owns inbox polling and obvious reply ingestion
- `Outreach` remains the intelligence layer for generation / ambiguous judgment

## Phase 2 Scope — process-replies

### New canonical responsibility

`crew_five` becomes the source of truth for:

- inbox polling
- ingestion of raw reply events
- obvious classification
- suppression updates
- canonical event recording

### Outreach handoff remains for

- ambiguous replies
- reply strategy
- reply draft generation

## Technical Notes

### Why this matches the current spine

The execution hierarchy still remains:

- project
- ICP
- hypothesis
- segment subset
- campaign wave

`crew_five` already owns this operational state. Moving execution loops into `crew_five` reduces
cross-system drift.

### Solution-first rule

Do not build unnecessary new orchestration layers before checking the current provider integrations.

For send execution:

- first reuse existing mailbox/provider integrations already present in `crew_five`
- only add new provider abstractions where current ones are insufficient

For replies:

- first reuse existing inbox polling/event recording paths already present in `crew_five`
- only escalate ambiguous cases to LLM

## Acceptance Criteria

### Phase 1

1. `send-campaign` no longer requires `Outreach` runtime.
2. Auto-send scheduler can trigger sends without Claude.
3. Approved drafts are sent through a deterministic `crew_five` loop.
4. Send outcomes are recorded canonically in `email_outbound` and related draft state.
5. Existing preflight and mailbox assignment rules remain intact.

### Phase 2

1. Inbox polling no longer requires `Outreach` for routine ingestion.
2. Obvious bounce/unsubscribe/OOO/simple auto-replies are classified without LLM.
3. Suppression updates happen inside `crew_five`.
4. Ambiguous replies can still be escalated to `Outreach`.

## Out of Scope

- moving draft generation into `crew_five`
- removing `Outreach` completely
- redesigning ICP / hypothesis authoring
- introducing a new workflow engine

## Recommended Next Session Start

1. Migrate direct inbox polling transport reuse / hardening further only if needed.
2. Decide whether to build direct `imap-mcp` inbox adapter lifecycle reuse similar to send-layer
   hardening.
3. Focus roadmap effort on richer execution context or Playwright refresh, not on reopening the
   already working send/reply migration.
