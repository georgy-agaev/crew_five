> Date: 2026-03-30
> Component: `Inbox V2` (crew_five Web UI) + `process-replies` (crew_five -> imap-mcp)

# Inbox V2: Linkage Filters And Noise Handling

## Goal
Make Inbox V2 usable when the same mailboxes are used by other outbound tools (external senders).

Operator should be able to:

- Focus on replies that belong to crew_five tracked campaigns.
- Still see "everything we ingested" from the mailbox.
- Hide replies that are not linked to our campaigns.

## What Inbox V2 Shows
Inbox V2 is **not** a raw mailbox viewer.

It shows **ingested mailbox events** (stored in `email_events`) for event types:

- `replied`
- `bounced`
- `unsubscribed`
- `complaint`

These events are ingested by `process-replies` using `imap-mcp`.

## Filters (Scope / Linkage)
Inbox V2 has 3 scope filters:

- `campaign-linked`
  - Only events whose `email_outbound.campaign_id` is NOT null.
  - This is "our stuff": events tied to a campaign context and outbound ledger.
- `all mail`
  - All ingested events (campaign-linked + unlinked).
- `unlinked`
  - Events tied to an outbound row that has `campaign_id = null`.
  - This bucket contains "noise" and also any reply we could not reliably link to a campaign.

### Why `unlinked` can exist if `email_events.outbound_id` is NOT NULL
Schema requires `email_events.outbound_id`.

For messages that are **not** linked to our campaign outbounds, crew_five creates a special
"inbox placeholder outbound" in `email_outbound`:

- `provider = imap_mcp`
- `campaign_id = null`
- `provider_message_id = inbox:<mailboxAccountId>:<uid>`
- metadata captures `mailbox_account_id`, `uid`, sender, subject

Then the event is ingested against that placeholder outbound.

## Key Behavior Change (Noise Fix)
When an inbound message has `In-Reply-To`:

- If `In-Reply-To` matches one of our `email_outbound.provider_message_id` values, we link the event to that outbound.
- If `In-Reply-To` does NOT match any of our tracked outbound message-ids, we DO NOT fall back to "guessing"
  linkage via sender email.

Instead, we create an inbox placeholder outbound and ingest the event as `unlinked`.

This prevents mis-linking replies produced by other tools that use the same mailbox accounts.

## Suggested Operator Flow
1. Start in `campaign-linked` + `unhandled` to focus on actionable replies for our campaigns.
2. If you want to audit noise volume: switch to `unlinked` and optionally increase limit to `200` or `500`.
3. Use `Poll now` only to request ingestion. Results appear after `process-replies` completes.

## Notes / Limitations
- We currently search **unread** emails (seen=false). Already-read messages will not be ingested unless made unread.
- Unlinked events are intentionally kept, because they help the operator understand mailbox activity and filter noise.
- If a reply lacks `In-Reply-To`, crew_five may still attempt to link it by sender email to recent outbounds.

