# Mailbox → Campaign Assignment: Design Decision

**Status:** Completed on 2026-03-18
**Created:** 2026-03-18
**Context:** Mailboxes page (read-only) is live. Operator needs a way to assign a mailbox to a campaign before sending.

---

## Problem

Currently mailbox ↔ campaign association is implicit — it only appears after emails are sent via imap-mcp (derived from `email_outbound.sender_identity` + `metadata.mailbox_account_id`).

There is no way to:
- Pre-assign a mailbox to a campaign before sending
- Validate that a campaign has a configured sender before transitioning to `sending`
- Prevent accidental multi-mailbox campaigns

---

## Current State

### What exists
- `email_outbound` stores `sender_identity`, `metadata.mailbox_account_id`, `campaign_id`
- `campaigns` table has unused `sender_profile_id uuid` column
- `GET /api/mailboxes` returns ledger-derived mailbox inventory
- `GET /api/campaigns/:id/mailbox-summary` returns consistency check
- Mailboxes UI shows read-only inventory + consistency verdicts

### What does NOT exist
- No `mailbox_accounts` or `sender_profiles` table
- No endpoint to assign/unassign a mailbox to a campaign
- No validation gate at `ready → generating` or `generating → sending` that checks mailbox config

---

## Options

### Option A: Direct assignment table

```sql
create table campaign_mailbox_assignments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  mailbox_account_id text not null,
  sender_identity text not null,
  assigned_at timestamptz not null default now(),
  unique (campaign_id, mailbox_account_id)
);
```

**Endpoints:**
- `POST /api/campaigns/:id/mailbox` — assign
- `DELETE /api/campaigns/:id/mailbox/:mailboxAccountId` — unassign
- `GET /api/campaigns/:id/mailbox` — current assignment

**Pros:** Simple, explicit, queryable
**Cons:** New table to maintain, no connection to actual imap-mcp accounts (we don't have a mailbox registry)

### Option B: Use existing `sender_profile_id` on campaigns

```sql
create table sender_profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mailbox_account_id text not null,
  sender_identity text not null,
  provider text not null default 'imap_mcp',
  created_at timestamptz not null default now()
);
```

Then `campaigns.sender_profile_id` references `sender_profiles(id)`.

**Endpoints:**
- `GET /api/sender-profiles` — list
- `POST /api/sender-profiles` — create
- `PATCH /api/campaigns/:id` — set `sender_profile_id`

**Pros:** Uses existing column, reusable across campaigns, maps to "who sends"
**Cons:** More complex, introduces a new entity to manage

### Option C: Config at send time

No persistent assignment. When campaign transitions to `sending`, operator selects mailbox from active inventory in the UI. Selection is passed as a parameter to the send workflow.

**Pros:** No new tables, no stale config
**Cons:** No pre-validation, operator must remember to choose every time, harder to audit

---

## UI Integration Points

Regardless of option chosen, UI changes needed:

1. **Builder V2** — "Assign mailbox" control in campaign lifecycle column (between status transitions and followup guardrail)
2. **Mailboxes page** — Optional: "Assign to campaign" action from mailbox row
3. **Status transition guard** — If mailbox is required for `sending`, block the transition with a message if none assigned

---

## Validation Gate (recommended regardless of option)

Add a check when transitioning to `sending`:
- If campaign has no assigned mailbox / sender profile → block with error: "Assign a mailbox before sending"
- Show which mailbox will be used in the confirmation dialog

---

## Questions to Resolve

1. Do we need a persistent mailbox registry (sender_profiles), or is the ledger-derived inventory sufficient?
2. Should one campaign support multiple mailboxes (rotation), or strictly one?
3. Should the assignment be required before `generating` (for draft headers) or only before `sending`?
4. How does this interact with Smartlead campaigns? (Smartlead has its own sender management)

---

## Chosen Direction

**Option A** for MVP, with one important refinement:

- persist a **planned sender set** per campaign, not just a single mailbox row
- each assignment row represents one sender identity that `Outreacher` selected for the campaign
- Web/UI should distinguish:
  - **planned** sender set = explicit pre-send assignment
  - **observed** mailboxes = ledger-derived history from `email_outbound`

This matches the real workflow where `Outreacher` may preselect several sender emails across one or more domains before any message has actually been sent.

## What shipped

### Storage

Added `public.campaign_mailbox_assignments`:

- `id`
- `campaign_id`
- `mailbox_account_id`
- `sender_identity`
- `provider`
- `source`
- `metadata`
- `assigned_at`

Constraint:
- `unique (campaign_id, sender_identity)`

### API

- `GET /api/campaigns/:id/mailbox-assignment`
- `PUT /api/campaigns/:id/mailbox-assignment`

`PUT` uses **whole-set replace** semantics so `Outreacher` can push the exact planned sender set for a campaign in one call.

### Sending guard

Transitioning a campaign to `sending` is now blocked unless the campaign has at least one planned sender assignment.

Error contract:

```json
{
  "error": "Assign at least one mailbox sender identity before sending",
  "code": "MAILBOX_ASSIGNMENT_REQUIRED"
}
```

HTTP status:
- `409`

## Notes for Outreacher

- If `Outreacher` selects 8 sender emails across 2 domains for a campaign, it should push that sender set into `campaign_mailbox_assignments` before any real send happens.
- `Mailboxes` UI can then show the plan immediately, instead of waiting for `email_outbound` to appear after real delivery.
- `email_outbound` remains the source of truth for **observed** mailboxes, not for **planned** sender selection.
