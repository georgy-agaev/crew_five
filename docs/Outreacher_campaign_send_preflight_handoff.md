# Outreacher Campaign Send Preflight Handoff

> Version: v0.1 (2026-03-20)

## Goal

Define the minimal shared backbone needed so `Outreacher` slash workflows and the `crew_five` Web UI
can operate on the same campaign send readiness model.

This handoff intentionally avoids a full recipient email quality-scoring system for now.

## Problem Statement

Today we have:

- campaign launch logic in `Outreacher`
- campaign operations in `Campaigns` / `Builder V2`
- mailbox transport through `imap_mcp`

But we still lack one shared, explicit model for:

1. which mailbox sender set is planned for a campaign
2. whether a campaign is ready to move into send
3. what exactly blocks sending right now

This causes drift:

- `Outreacher` can know the sender choice conversationally
- `crew_five` Web UI may not see it unless it is persisted canonically
- operators cannot easily tell whether a campaign is blocked by sender setup, draft state, or recipient availability

## What We Are Not Doing Now

We are **not** introducing a full recipient email quality model.

For now, do **not** build:

- good / bad / risky recipient scoring
- confidence scores for recipient addresses
- separate deliverability heuristics for every contact

That is unnecessary complexity for the current phase.

## Recommended Shared Model

The shared model should have only three layers.

### 1. Planned sender set

Canonical source:

- `campaign_mailbox_assignments`

Use cases:

- `Outreacher` chooses sender identities
- Web UI shows the planned sender set
- send guard checks that at least one sender is assigned

Current canonical commands:

```bash
pnpm cli campaign:mailbox-assignment:get \
  --campaign-id <campaignId> \
  --error-format json
```

```bash
pnpm cli campaign:mailbox-assignment:put \
  --campaign-id <campaignId> \
  --payload '<json>' \
  --error-format json
```

### 2. Recipient sendability

For now, the only recipient-level state we need is:

- `recipient_email`
- `recipient_email_source`
- `recipient_email_kind`
- `sendable`

This already exists through `draft:load --include-recipient-context`.

That is enough for the current operator workflow.

### 3. Campaign send preflight

We need one campaign-scoped read model that answers:

- does the campaign have a planned sender set?
- how many approved drafts exist?
- how many sendable drafts exist?
- how many contacts are blocked?
- what are the current blockers?

This is the missing shared operator layer.

## Recommended Boundary

### `Outreacher` owns

- choosing mailbox accounts / sender identities
- deciding when to launch a send run
- deciding whether to override an already planned sender set
- send pacing, mailbox cooldowns, batching

### `crew_five` owns

- canonical persistence of campaign sender plan
- canonical campaign read models
- canonical preflight summary
- canonical blocking reasons before `sending`

## Minimal Blocking Reasons

Keep the blocking model simple.

Recommended blockers:

- `no_sender_assignment`
- `draft_not_approved`
- `missing_recipient_email`
- `campaign_paused`
- `no_sendable_drafts`

Optional later:

- `mailbox_not_ready`
- `mailbox_cooldown`

But these can come later.

## Implementation Status

This read model is now implemented in `crew_five` as:

```bash
pnpm cli campaign:send-preflight \
  --campaign-id <campaignId> \
  --error-format json
```

Web adapter endpoint:

`GET /api/campaigns/:campaignId/send-preflight`

## Recommended Next Implementation In `crew_five`

### Option 1 - Lightweight read model

Add a new read model and CLI surface, for example:

- `campaign:send-preflight`

Return:

- campaign id + status
- sender assignment summary
- draft counts
- sendable counts
- blockers

This is the implemented path.

### Option 2 - Expand `campaign:audit`

Reuse `campaign:audit` and append send-preflight fields.

Not recommended.

Reason:

- `campaign:audit` is already a broad coverage/anomaly surface
- send-readiness should stay operator-focused and simpler

### Option 3 - UI-only logic

Recompute send readiness separately in `Outreacher` and Web UI.

Not recommended.

Reason:

- logic will drift
- slash flows and Web UI will disagree

## Recommended Contract Shape

Suggested response:

```json
{
  "campaignId": "camp-123",
  "status": "ready",
  "senderPlan": {
    "assignmentCount": 2,
    "senderIdentityCount": 2,
    "mailboxAccountCount": 2
  },
  "drafts": {
    "approvedCount": 14,
    "sendableCount": 11,
    "blockedCount": 3
  },
  "blockers": [
    {
      "code": "missing_recipient_email",
      "count": 3
    }
  ],
  "readyToSend": true
}
```

Current shipped response is intentionally compact and operator-friendly:

```json
{
  "campaign": {
    "id": "camp-123",
    "name": "Q2 Push",
    "status": "ready",
    "segment_id": "seg-1",
    "segment_version": 1
  },
  "readyToSend": false,
  "blockers": [
    {
      "code": "suppressed_contact",
      "message": "Some approved drafts target suppressed or already-used contacts"
    }
  ],
  "summary": {
    "mailboxAssignmentCount": 1,
    "draftCount": 14,
    "approvedDraftCount": 9,
    "generatedDraftCount": 2,
    "rejectedDraftCount": 3,
    "sentDraftCount": 0,
    "sendableApprovedDraftCount": 7,
    "approvedMissingRecipientEmailCount": 2,
    "approvedSuppressedContactCount": 1
  },
  "senderPlan": {
    "assignmentCount": 1,
    "mailboxAccountCount": 1,
    "senderIdentityCount": 1,
    "domainCount": 1,
    "domains": ["voicexpert.ru"]
  }
}
```

Current canonical blocker codes:

- `no_sender_assignment`
- `draft_not_approved`
- `missing_recipient_email`
- `suppressed_contact`
- `no_sendable_drafts`
- `campaign_paused`

Meaning of `suppressed_contact`:

- unsubscribed
- complaint
- bounced
- repeated intro / already-used contact

## How Web UI Should Use It Later

Both `Campaigns` and `Builder V2` should use the same preflight read model.

That will let the UI show:

- planned sender set
- send readiness
- exact blockers

without needing to reconstruct this from scattered raw tables.

## How `Outreacher` Should Use It Later

Before starting send:

1. `campaign:mailbox-assignment:get`
2. if needed, `campaign:mailbox-assignment:put`
3. `campaign:send-preflight`
4. only then:
   - `campaign:status --status generating`
   - `campaign:status --status sending`

## Recommendation

The next project-level step should be:

1. keep sender planning canonical in `crew_five`
2. do **not** add recipient email quality scoring yet
3. add a dedicated `campaign:send-preflight` read model in `crew_five`
4. make both `Outreacher` and Web UI rely on that same surface

This is the smallest useful step that will unify operator behavior across slash workflows and UI.
