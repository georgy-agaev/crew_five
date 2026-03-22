# Campaign Send Preflight: Web UI Task For Claude

**Status:** Done
**Created:** 2026-03-20
**Context:** `crew_five` adds a canonical `campaign:send-preflight` read model so `Outreacher` and Web UI
can use the same send-readiness surface before a campaign transitions to `sending`.

---

## Goal

Add a compact send-preflight block to the existing campaign operator surfaces so an operator can see:

- whether a campaign is ready to send
- what blocks sending right now
- what sender plan is currently assigned
- how many drafts are actually sendable

Do **not** redesign the page layout as part of this task.

---

## Backend Contract To Use

The UI should consume a new read-only endpoint:

`GET /api/campaigns/:campaignId/send-preflight`

Expected response shape:

```json
{
  "campaign": {
    "id": "uuid",
    "name": "Campaign Name",
    "status": "ready"
  },
  "readyToSend": false,
  "blockers": [
    {
      "code": "no_sender_assignment",
      "message": "Assign at least one sender before sending"
    }
  ],
  "summary": {
    "mailboxAssignmentCount": 0,
    "draftCount": 14,
    "approvedDraftCount": 8,
    "generatedDraftCount": 6,
    "rejectedDraftCount": 0,
    "sentDraftCount": 0,
    "sendableApprovedDraftCount": 5,
    "approvedMissingRecipientEmailCount": 3
  },
  "senderPlan": {
    "assignmentCount": 0,
    "domains": []
  }
}
```

Canonical blocker codes:

- `no_sender_assignment`
- `draft_not_approved`
- `missing_recipient_email`
- `suppressed_contact`
- `no_sendable_drafts`
- `campaign_paused`

Additional summary field now available:

- `approvedSuppressedContactCount`

---

## UI Scope

Add a **small operator card**, not a new workspace.

Recommended placements:

1. `Campaigns` operator desk
2. `Builder V2` campaign lifecycle surface

Each surface should show the same read model, with the same wording.

---

## Required UI States

### Ready

- green success badge / pill
- short message: `Ready to send`
- summary counters
- sender plan domains / sender count

### Blocked

- warning / error card
- list blocker messages
- compact counters
- sender plan section even when empty

### Loading

- lightweight skeleton or muted placeholder

### Empty / unsupported

- if no campaign selected: `Select a campaign to inspect send readiness`

---

## UX Rules

1. Show **blockers first**, counters second.
2. Do not invent email-quality scoring.
3. Do not duplicate campaign audit details here.
4. Do not mix preflight with actual send controls in the first pass.
5. Reuse existing workspace colors / typography / card styles.
6. Treat `suppressed_contact` as a separate class of problem, not as “missing email”.

---

## Suggested Component Shape

One reusable component:

- `CampaignSendPreflightCard`

Props:

- `campaignId`
- optional `compact`

Responsibilities:

- fetch preflight payload
- render readiness state
- render blockers
- render sender plan summary
- render counters

---

## Nice-To-Have But Not Required

- action link to mailbox assignment panel
- action link to drafts review
- inline refresh button

These should not block the first version.

---

## Acceptance Criteria

1. Operator can see if a campaign is ready to send without reading raw JSON.
2. Operator can see the exact blocker codes/messages when send is blocked.
3. Operator can see whether a sender plan exists.
4. The same backend read model is used in both `Campaigns` and `Builder V2`.
5. No new ad-hoc color palette or typography is introduced.
6. `approvedSuppressedContactCount` is visible when non-zero and not merged into the missing-email
   counter.
