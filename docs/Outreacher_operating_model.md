# Outreacher Operating Model

> Version: v0.2 (2026-03-15)

## Goal

This document defines the recommended operating model for `Outreacher` when:

- `crew_five` is the GTM spine and execution/data CLI
- `imap_mcp` is the mailbox transport layer for outbound + inbound email
- Supabase is shared between `Outreacher` and `crew_five`

The target shape is:

`Outreacher -> crew_five CLI -> shared Supabase`

for data/state operations, and:

`Outreacher -> imap_mcp`

for mailbox operations.

## Core Principle

All campaign activity must continue to flow through the same spine:

`segment -> segment_members -> campaign -> drafts -> email_outbound -> email_events`

`Outreacher` is allowed to orchestrate decisions and transport actions, but it should not create
an alternative source of truth outside this spine.

## Recommended Workflow

The recommended operational workflow is:

`ICP -> Hypothesis -> Segment -> Enrich -> Campaign -> Drafts -> Send -> Events`

Enrichment is an explicit step before campaign creation / draft generation, not an optional afterthought.

Why:

- `company_research` materially changes prompt quality
- stale company/employee facts should be refreshed before copy generation
- `Outreacher` needs a preview step before consuming provider credits

## System Roles

### `Outreacher`

`Outreacher` is the orchestrator and control plane.

Responsibilities:

- choose what to send, when, and from which mailbox
- choose whether enrichment is needed before draft generation
- choose which enrichment provider or provider combination to run now
- load approved drafts from `crew_five`
- decide whether a draft is eligible for send
- send email through `imap_mcp`
- poll inboxes through `imap_mcp`
- classify replies and outcomes
- decide when to send follow-ups
- trigger analytics/reporting loops

### `crew_five`

`crew_five` is the GTM execution/data layer.

Responsibilities:

- persist segments, campaigns, drafts
- expose recipient-aware draft loading
- persist outbound send records in `email_outbound`
- persist normalized inbound/provider events in `email_events`
- preserve pattern metadata for later analytics
- provide analytics summaries over stored events

### `imap_mcp`

`imap_mcp` is the mailbox transport layer.

Responsibilities:

- send outbound email via SMTP-backed account configuration
- read inboxes and folders
- retrieve message bodies and message headers
- support reply/forward actions when needed

`imap_mcp` should not be treated as the system of record for GTM workflow state.

### Supabase

Supabase remains the shared persistence layer.

Responsibilities:

- canonical storage of drafts, sends, and events
- correlation between campaign, contact, draft, send, and reply
- input for analytics and follow-up scheduling

## Options Considered

### Decision 1 - Where should orchestration live?

Option A: all orchestration inside `Outreacher`

- Recommended.
- Best fit for your stated goal: `Outreacher` as AI agent, `crew_five` as CLI execution tool.

Option B: orchestration inside `crew_five`

- Simpler single-process flow.
- Not recommended now because it duplicates `imap_mcp` usage and pulls mailbox logic into `crew_five`.

Option C: separate orchestrator service between `Outreacher` and `crew_five`

- Better for scale later.
- Too much infrastructure overhead for the current phase.

### Decision 2 - Who should check inboxes?

Option A: `Outreacher` polls inboxes through `imap_mcp`

- Recommended.
- Keeps mailbox state close to the orchestrator that already knows sender account, send timing, and campaign intent.

Option B: `crew_five` polls inboxes directly

- Not recommended now.
- Would mix mailbox transport responsibilities into the GTM data layer.

Option C: dedicated inbox worker

- Good future shape once volume grows.
- Not needed yet.

### Decision 3 - Who should schedule follow-ups?

Option A: `Outreacher`

- Recommended.
- Follow-up logic depends on business rules, timing, inbox state, and campaign intent.

Option B: SQL-only scheduler in the database

- Can work for a simple rule engine.
- Harder to evolve when logic becomes context-aware.

Option C: separate follow-up worker

- A good future split if `Outreacher` becomes too busy.
- Not required now.

## Recommended Architecture

### Final recommendation

Use `Outreacher` as the only orchestrator.

Operationally:

- `crew_five` owns GTM state
- `imap_mcp` owns mailbox transport
- `Outreacher` glues them together

### Why this is the right split

- It preserves the GTM spine in Supabase.
- It avoids duplicating mailbox logic in `crew_five`.
- It lets you change the transport later without breaking the data model.
- It keeps all agent-level decisions in one place.

## Outbound Process

### Step 1 - Load drafts ready for send

`Outreacher` should load approved drafts with recipient context:

```bash
pnpm cli draft:load \
  --campaign-id <campaignId> \
  --status approved \
  --include-recipient-context \
  --error-format json
```

The response should be treated as the send queue candidate set.

Important fields:

- `id`
- `campaign_id`
- `contact_id`
- `company_id`
- `email_type`
- `subject`
- `body`
- `recipient_email`
- `recipient_email_source`
- `recipient_email_kind`
- `sendable`

### Step 2 - Apply send guardrails

Before attempting send, `Outreacher` should reject rows that fail any of these checks:

- `sendable=false`
- draft already has a successful `email_outbound` row
- contact has bounced previously
- contact has unsubscribed previously
- contact already replied and should not receive a follow-up
- campaign is paused
- mailbox quota would be exceeded
- domain or mailbox cooldown is active

### Step 3 - Resolve recipient

Recipient resolution policy is:

1. use `employees.work_email` if present
2. otherwise use `employees.generic_email`
3. if both are empty, do not send

The source should always be logged:

- `recipient_email_source=work`
- `recipient_email_source=generic`
- `recipient_email_source=missing`

The kind should also be logged:

- `corporate`
- `personal`
- `generic`
- `missing`

This matters because some rows may have `work_email` filled with a personal mailbox.

### Step 4 - Choose sender mailbox

`Outreacher` should select the mailbox account, not `crew_five`.

Mailbox selection factors:

- daily cap remaining
- sends in the current rolling hour/minute
- mailbox warm-up stage
- domain affinity
- error/cooldown status
- campaign affinity if you want the same sender for a thread

Recommended mailbox metadata to keep in `Outreacher`:

- `mailbox_account_id`
- `from_email`
- `daily_cap`
- `per_minute_cap`
- `warmup_status`
- `cooldown_until`
- `last_sent_at`

### `imap_mcp` account configuration note

At the moment, `imap_add_account` is not the full source of truth for SMTP settings.

Operationally:

- account bootstrap may start through `imap_mcp`
- but SMTP host/port details may still require manual completion in `accounts.json`
- `Outreacher` should treat mailbox readiness as an explicit checked state, not as an assumption after account creation

### Step 5 - Send through `imap_mcp`

`Outreacher` uses `imap_send_email`.

Required send payload should include:

- mailbox/account identifier
- `to`
- `subject`
- plain text or HTML body
- reply-to if you want explicit routing

Recommended `Outreacher` internal send log fields:

- `draft_id`
- `campaign_id`
- `contact_id`
- `company_id`
- `mailbox_account_id`
- `to`
- `message_id`
- `sent_at`
- `attempt_number`

### Step 6 - Record outbound in `crew_five`

After send, `Outreacher` must immediately write the result back:

```bash
pnpm cli email:record-outbound --payload '<json>' --error-format json
```

Successful example:

```json
{
  "draftId": "draft-uuid",
  "provider": "imap_mcp",
  "providerMessageId": "<message-id@example.com>",
  "senderIdentity": "mailbox-01@example.com",
  "recipientEmail": "info@example.com",
  "recipientEmailSource": "generic",
  "recipientEmailKind": "generic",
  "status": "sent",
  "metadata": {
    "mailbox_account_id": "mailbox-01",
    "imap_account_id": "acc-123"
  }
}
```

Failed example:

```json
{
  "draftId": "draft-uuid",
  "provider": "imap_mcp",
  "senderIdentity": "mailbox-01@example.com",
  "recipientEmail": "info@example.com",
  "recipientEmailSource": "generic",
  "recipientEmailKind": "generic",
  "status": "failed",
  "error": "SMTP 421 rate limit",
  "metadata": {
    "mailbox_account_id": "mailbox-01",
    "attempt": 1
  }
}
```

Expected effects:

- a row is inserted into `email_outbound`
- for successful sends, the draft becomes `sent`
- all metadata required for later reply correlation stays on the GTM spine

## Inbox and Reply Process

### Step 1 - Poll inboxes

`Outreacher` should run an `InboxWatcher` loop over all active mailbox accounts.

Recommended polling cadence:

- every 2 to 5 minutes for active campaigns
- every 10 to 15 minutes for low-volume or idle mailboxes

Folders to check:

- `INBOX`
- bounce/DSN folder if provider uses one
- spam/junk only if you explicitly want to inspect missed replies

### Step 2 - Fetch candidate inbound messages

Using `imap_mcp`, `Outreacher` should retrieve:

- latest messages
- unread messages
- or messages since last checkpoint

Store a checkpoint per mailbox:

- last poll timestamp
- last processed UID or message id

### Step 3 - Correlate inbound messages to outbound sends

Recommended match order:

1. `In-Reply-To` -> `email_outbound.provider_message_id`
2. `References` -> `email_outbound.provider_message_id`
3. thread heuristics using sender mailbox + recipient address + subject normalization
4. fallback contact-level heuristics only if explicit thread identifiers are missing

The goal is always to recover:

- `outbound_id`
- `draft_id`
- `contact_id`
- `campaign_id`

### Step 4 - Normalize the inbound event

Once correlated, `Outreacher` should emit a normalized event into `crew_five`:

```bash
pnpm cli event:ingest --payload '<json>' --error-format json
```

Reply example:

```json
{
  "provider": "imap_mcp",
  "provider_event_id": "reply:<message-id@example.com>",
  "event_type": "reply",
  "outbound_id": "email-outbound-uuid",
  "contact_id": "employee-uuid",
  "occurred_at": "2026-03-14T16:30:00Z",
  "payload": {
    "accountId": "acc-123",
    "folder": "INBOX",
    "messageId": "<reply-message-id@example.com>"
  }
}
```

Bounce example:

```json
{
  "provider": "imap_mcp",
  "provider_event_id": "bounce:<message-id@example.com>",
  "event_type": "bounced",
  "outbound_id": "email-outbound-uuid",
  "contact_id": "employee-uuid",
  "occurred_at": "2026-03-14T16:31:00Z",
  "payload": {
    "accountId": "acc-123",
    "folder": "INBOX",
    "dsn": "5.1.1"
  }
}
```

Unsubscribe example:

```json
{
  "provider": "imap_mcp",
  "provider_event_id": "unsubscribe:<message-id@example.com>",
  "event_type": "unsubscribed",
  "outbound_id": "email-outbound-uuid",
  "contact_id": "employee-uuid",
  "occurred_at": "2026-03-14T16:32:00Z",
  "payload": {
    "accountId": "acc-123",
    "folder": "INBOX"
  }
}
```

## Enrichment Process

### Step 1 - Preview enrichment before live execution

Use:

```bash
pnpm cli enrich:run \
  --segment-id <segmentId> \
  --provider exa,firecrawl \
  --limit 10 \
  --max-age-days 90 \
  --dry-run \
  --error-format json
```

Interpretation:

- `--limit` is a company-level limit
- employee counts are secondary/informational
- data older than `90` days is refresh-eligible by default
- `--force-refresh` overrides freshness and allows manual refresh
- provider combinations are treated as a union for the current run

### Step 2 - Decide whether to run live

`Outreacher` should inspect preview output:

- `companiesFresh`
- `companiesStale`
- `companiesMissing`
- `companiesEligibleForRefresh`
- `plannedCompanyCount`
- provider list

Then decide:

- skip enrichment
- run enrichment now
- change provider combination
- change limit
- force refresh

### Step 3 - Run enrichment live

Use:

```bash
pnpm cli enrich:run \
  --segment-id <segmentId> \
  --provider exa,firecrawl \
  --limit 10 \
  --run-now \
  --error-format json
```

Live enrichment should happen before `campaign:create` / `draft:generate` whenever the preview shows stale or missing
data that is material for prompt quality.

### Step 5 - Classify replies

`Outreacher` should run reply classification after correlation.

Recommended current outcome classes:

- `meeting`
- `soft_interest`
- `decline`
- `angry`
- `neutral`

Recommended rule:

- `event_type='reply'`
- `outcome_classification` derived by `Outreacher`
- text/body stored in `payload`

This keeps `crew_five` as the event ledger while `Outreacher` stays the interpretation layer.

## Follow-up Process

### Who decides when to send the second email?

`Outreacher`.

Follow-up timing depends on:

- when the first email was actually sent
- whether any reply happened
- whether any bounce/unsubscribe happened
- whether the campaign should still continue

That logic belongs in the orchestrator, not in the mailbox layer and not in static SQL alone.

### Follow-up scheduler inputs

Use:

- `email_outbound.sent_at`
- `email_outbound.status`
- `drafts.email_type`
- `email_events.event_type`
- `email_events.outcome_classification`

Do not schedule the bump based on `draft.created_at`.

Always use the actual send time from `email_outbound.sent_at`.

### Recommended intro -> bump rule

For a given contact:

1. there is a successful `intro` send record
2. no `reply`, `bounced`, `unsubscribed`, or `complaint` event exists after that send
3. elapsed time since `intro.sent_at` >= configured SLA
4. an approved `bump` draft exists
5. the contact is not suppressed

Then `Outreacher` can enqueue/send the `bump`.

### Suggested SLA options

Option A: fixed delay

- e.g. 3 business days after intro
- simplest and recommended to start

Option B: mailbox/domain-aware delay

- e.g. slower cadence for colder mailboxes
- useful later

Option C: campaign-level adaptive delay

- e.g. aggressive campaigns use 2 days, conservative campaigns use 5 days
- good once you have enough data

Recommended now: Option A.

### Suggested bump workflow

1. find eligible contacts
2. find approved `bump` draft for each contact
3. run send guardrails again
4. send via `imap_mcp`
5. write `email:record-outbound`

## Pattern Tracking and Analytics

### Is pattern information already stored?

Yes.

Current pattern provenance exists in:

- `drafts.pattern_mode`
- `drafts.metadata.coach_prompt_id`
- `drafts.metadata.draft_pattern`

`draft_pattern` is currently the main stable pattern identifier.

It is built from:

- `coach_prompt_id`
- `pattern_mode`
- variant label

Example:

`cold_intro_v5.2:direct:A`

### Where pattern context flows later

When inbound events are ingested with `outbound_id`, `crew_five` can enrich events with:

- `pattern_id`
- `coach_prompt_id`
- campaign/segment context
- ICP context

This is already implemented in the event enrichment path.

### What should be treated as the source of truth?

Recommended order:

1. `drafts.metadata.draft_pattern`
2. `drafts.metadata.coach_prompt_id`
3. `drafts.pattern_mode`

`email_outbound.metadata` should carry a copy of these values forward for traceability, but the draft remains the
primary origin of pattern identity.

### Who should analyze performance?

Recommended current split:

- `Outreacher` is responsible for ingesting clean reply/outcome data
- `crew_five` is responsible for storing and aggregating it
- `Outreacher` can then consume analytics summaries and decide what to do next

### What should be measured per pattern?

At minimum:

- sent count
- reply count
- positive reply count
- meeting count
- decline count
- angry count
- bounce count
- unsubscribe count

Recommended derived metrics:

- reply rate
- positive reply rate
- meeting rate
- angry rate
- bounce rate
- unsubscribe rate

### Recommended current analytics loop

1. `Outreacher` keeps inbox ingest current
2. `Outreacher` classifies replies into outcome classes
3. `crew_five` stores events with pattern context
4. a scheduled analytics task groups results by `draft_pattern`
5. `Outreacher` uses that to:
   - boost winning patterns
   - slow/stop weak ones
   - decide whether a prompt revision is needed

## Recommended `Outreacher` Internal Modules

### 1. `DraftDispatchPlanner`

Responsibilities:

- load approved drafts
- apply recipient resolution and eligibility checks
- produce a send plan

### 2. `MailboxAllocator`

Responsibilities:

- choose sender mailbox
- enforce mailbox caps and cooldowns
- keep thread affinity if desired

### 3. `SendDispatcher`

Responsibilities:

- call `imap_send_email`
- capture `messageId`
- write `email:record-outbound`
- handle send retries safely

### 4. `InboxWatcher`

Responsibilities:

- poll inboxes
- fetch new inbound messages
- persist mailbox checkpoints

### 5. `ReplyCorrelator`

Responsibilities:

- link inbound messages to `email_outbound`
- recover `outbound_id` and `draft_id`
- produce normalized event payloads

### 6. `ReplyClassifier`

Responsibilities:

- classify reply meaning
- emit `outcome_classification`

### 7. `FollowUpScheduler`

Responsibilities:

- detect overdue intros without response
- check if a `bump` is available and eligible
- create/send follow-up tasks

### 8. `PatternAnalyticsWorker`

Responsibilities:

- aggregate performance by `draft_pattern`
- detect high-performing patterns
- detect risky patterns (`angry`, bounce, unsubscribe spikes)

## Recommended Operational Cadence

### Fast loops

- Send dispatcher: continuous or every 1 to 5 minutes
- Inbox watcher: every 2 to 5 minutes

### Medium loops

- Follow-up scheduler: every 1 hour
- Bounce/unsubscribe reconciliation: every 15 to 30 minutes

### Slow loops

- Pattern analytics summary: daily
- Mailbox health / deliverability summary: daily
- Prompt/pattern review: weekly

## Failure Handling

### Send failure

If a send fails:

- write `email:record-outbound` with `status=failed`
- keep the draft retryable
- cool down the mailbox if failure looks mailbox-specific
- do not silently drop the send

### Correlation failure

If inbound mail cannot be matched to an outbound:

- store it in `Outreacher` quarantine/review queue
- retry correlation later
- do not invent a match just to close the loop

### Classification uncertainty

If reply meaning is unclear:

- ingest event as `reply`
- set `outcome_classification='neutral'`
- optionally flag for manual review

## Current `crew_five` Commands Relevant To Outreacher

### Load send-ready drafts

```bash
pnpm cli draft:load \
  --campaign-id <campaignId> \
  --status approved \
  --include-recipient-context \
  --error-format json
```

### Persist a send result

```bash
pnpm cli email:record-outbound --payload '<json>' --error-format json
```

### Persist a reply / bounce / unsubscribe event

```bash
pnpm cli event:ingest --payload '<json>' --error-format json
```

### Existing draft review helpers

```bash
pnpm cli draft:update-status --draft-id <draftId> --status approved --error-format json
```

## What should be built next

### Recommended next step

Implement the `Outreacher` runtime in this order:

1. `DraftDispatchPlanner`
2. `MailboxAllocator`
3. `SendDispatcher`
4. `InboxWatcher`
5. `ReplyCorrelator`
6. `FollowUpScheduler`
7. `ReplyClassifier`
8. `PatternAnalyticsWorker`

### Why this order

- It gets outbound running first.
- It captures reply data before analytics.
- It delays heavier intelligence until the GTM spine is already populated with real send/reply history.

## Summary

The recommended model is:

- `Outreacher` decides
- `imap_mcp` transports
- `crew_five` records
- Supabase remains the single spine

That split gives you:

- a clean orchestration boundary
- transport flexibility
- reliable follow-up timing based on real sends
- usable pattern analytics based on real replies
