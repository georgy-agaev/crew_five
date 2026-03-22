# Outreach Agent Runner Examples

> Version: v0.3 (2026-03-15)

This document gives ready-to-adapt command-runner templates for an external `Outreach`
agent that uses `crew_five` as its CLI execution layer against the same Supabase project.

## Options

### Option 1 - TypeScript runner

Use [examples/outreach-crew-five-runner.ts](/Users/georgyagaev/crew_five/examples/outreach-crew-five-runner.ts).

Best fit when:
- `Outreach` is Node/TypeScript
- you want strong alignment with the `crew_five` codebase
- you want a reusable class with command-specific helper methods

### Option 2 - Python runner

Use [examples/outreach_crew_five_runner.py](/Users/georgyagaev/crew_five/examples/outreach_crew_five_runner.py).

Best fit when:
- the agent runtime is Python
- orchestration is LLM-heavy and already Python-first
- you want the simplest subprocess-based wrapper

### Option 3 - Hybrid

Use the TypeScript runner for production services and the Python runner for notebooks,
evaluation scripts, or fast agent experiments.

## Common Rules

- Always pass `--error-format json` for automation.
- Treat stdout as success payload and stderr as error payload.
- On non-zero exit, first attempt to parse stderr as:

```json
{
  "ok": false,
  "error": {
    "code": "ERR_CODE",
    "message": "Error message",
    "details": {}
  }
}
```

- Store command, args, exit code, stdout, and stderr in agent logs.
- Do not blindly retry mutating commands without dedupe logic.

## Minimal Draft Review Loop

1. `segment:list`
2. `campaign:list`
3. create campaign if needed
4. `draft:save` or `draft:generate`
5. `draft:load`
6. agent review
7. `draft:update-status`

## Recommended Enrichment Loop

1. `segment:list`
2. optional `campaign:list --icp-profile-id`
3. `enrich:run --dry-run`
4. inspect preview counts
5. `enrich:run --run-now`
6. only then create campaign / generate drafts

## Recommended IMAP Send Loop

1. `draft:load --include-recipient-context`
2. filter rows where `sendable=true`
3. choose mailbox/account in `Outreacher`
4. call `imap_send_email`
5. `email:record-outbound`
6. later ingest reply/bounce/unsubscribe via `event:ingest`

## Example `draft:load --include-recipient-context` Row

```json
{
  "id": "draft-uuid",
  "campaign_id": "camp-uuid",
  "contact_id": "employee-uuid",
  "company_id": "company-uuid",
  "status": "approved",
  "recipient_email": "info@example.com",
  "recipient_email_source": "generic",
  "recipient_email_kind": "generic",
  "sendable": true,
  "contact": {
    "id": "employee-uuid",
    "full_name": "Alice Doe",
    "position": "Director",
    "work_email": "",
    "generic_email": "info@example.com",
    "company_name": "Example Co"
  },
  "company": {
    "id": "company-uuid",
    "company_name": "Example Co",
    "website": "example.com"
  }
}
```

## Example `enrich:run --dry-run` Preview

```json
{
  "status": "preview",
  "mode": "async",
  "dryRun": true,
  "segmentId": "seg-uuid",
  "segmentVersion": 3,
  "providers": ["exa", "firecrawl"],
  "refreshPolicy": {
    "maxAgeDays": 90,
    "forceRefresh": false
  },
  "counts": {
    "companiesTotal": 42,
    "companiesFresh": 18,
    "companiesStale": 9,
    "companiesMissing": 15,
    "companiesEligibleForRefresh": 24,
    "contactsTotal": 55,
    "contactsFresh": 11,
    "contactsStale": 8,
    "contactsMissing": 36,
    "contactsEligibleForRefresh": 44,
    "plannedCompanyCount": 10,
    "plannedContactCount": 17
  }
}
```

## Example Enrichment Calls

Preview:

```bash
pnpm cli enrich:run \
  --segment-id <segmentId> \
  --provider exa,firecrawl \
  --limit 10 \
  --max-age-days 90 \
  --dry-run \
  --error-format json
```

Live run:

```bash
pnpm cli enrich:run \
  --segment-id <segmentId> \
  --provider exa,firecrawl \
  --limit 10 \
  --run-now \
  --error-format json
```

## Example `email:record-outbound` Payload

Successful send:

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

Failed send:

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

## Example `event:ingest` Payload

Reply:

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

Bounce:

```json
{
  "provider": "imap_mcp",
  "provider_event_id": "bounce:<message-id@example.com>",
  "event_type": "bounce",
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

## Example Draft Save Payload

```json
{
  "campaignId": "camp-uuid",
  "contactId": "employee-uuid",
  "companyId": "company-uuid",
  "emailType": "intro",
  "language": "en",
  "patternMode": "standard",
  "subject": "Subject line",
  "body": "Email body",
  "metadata": {
    "source": "outreach-agent",
    "provider": "anthropic",
    "model": "claude-3-7-sonnet"
  }
}
```

## Suggested Next Step In Outreach

Wrap one generic `run_crew_five(command, args)` function first, then expose only the
few high-level agent methods you actually need:

- `list_segments()`
- `list_campaigns()`
- `list_campaigns_by_icp()`
- `enrich_segment()`
- `create_campaign()`
- `save_draft()`
- `load_drafts()`
- `load_drafts_for_send()`
- `update_draft_status()`
- `record_outbound()`

That keeps the agent contract small while still allowing direct fallback to raw CLI calls.
