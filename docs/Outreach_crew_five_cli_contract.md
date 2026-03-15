# Outreach <> crew_five CLI Contract

> Version: v0.4 (2026-03-15)

## Goal

Use `crew_five` as the execution/runtime layer and shared GTM spine, while `Outreach`
acts as the AI agent / orchestrator that decides what to do next and invokes `crew_five`
via CLI against the same Supabase project.

## Recommended Topology

### Option 1 - Recommended

`Outreach -> crew_five CLI -> shared Supabase`

- `Outreach` never writes directly to GTM spine tables.
- `crew_five` remains the only mutation surface for segments, campaigns, drafts, and review transitions.
- Best fit for fast integration and lowest schema-coupling risk.

### Option 2

`Outreach -> lightweight adapter -> crew_five services/CLI -> shared Supabase`

- Add a thin wrapper in `Outreach` for retries, structured logging, and payload normalization.
- Good when the agent runtime needs queueing, tool tracing, or command sandboxing.

### Option 3

Hybrid read/write split.

- `Outreach` reads directly from Supabase for dashboards or agent context.
- `Outreach` performs all writes through `crew_five` CLI.
- Good when read latency matters, but write invariants must remain centralized.

## Shared Database Rules

- Both projects point to the same `SUPABASE_URL`.
- Trusted backend flows use the same `SUPABASE_SERVICE_ROLE_KEY`.
- `crew_five` owns GTM-spine mutations:
  - `segments`
  - `segment_members`
  - `campaigns`
  - `drafts`
  - `email_outbound`
  - `email_events`
  - optional ICP linkage (`icp_profiles`, `icp_hypotheses`)
- `Outreach` should treat CLI JSON output as the source of truth for command results.
- For automation, always pass `--error-format json` on commands that support it.

## JSON Error Contract

When `--error-format json` is enabled, failing commands should emit:

```json
{
  "ok": false,
  "error": {
    "code": "ERR_CODE_IF_AVAILABLE",
    "message": "Human-readable message",
    "details": {}
  }
}
```

`Outreach` should:

- parse stderr as JSON when exit code is non-zero;
- surface `error.code` to agent logic;
- store `error.message` as operator-visible context;
- treat missing `code` as retry/manual-review classification logic, not as parser failure.

## Command Surface For Outreach

### Segment Lifecycle

- `pnpm cli segment:list --error-format json`
- `pnpm cli segment:create --name "<name>" --locale en --filter '<json>'`
- `pnpm cli segment:snapshot --segment-id <segmentId> --error-format json`

### Campaign Lifecycle

- `pnpm cli campaign:list --error-format json`
- `pnpm cli campaign:list --icp-profile-id <icpProfileId> --error-format json`
- `pnpm cli campaign:create --name "<name>" --segment-id <segmentId> --snapshot-mode refresh --error-format json`
- `pnpm cli campaign:status --campaign-id <campaignId> --status review --error-format json`

### Enrichment

- `pnpm cli enrich:run --segment-id <segmentId> --provider <provider|provider,provider> --limit <N> --max-age-days 90 --dry-run --error-format json`
- `pnpm cli enrich:run --segment-id <segmentId> --provider <provider|provider,provider> --limit <N> --run-now --error-format json`

Providers:

- `mock`
- `exa`
- `parallel`
- `firecrawl`
- `anysite`

Provider combinations are passed as a comma-separated `--provider` value, for example:

```bash
pnpm cli enrich:run \
  --segment-id <segmentId> \
  --provider exa,firecrawl \
  --limit 10 \
  --dry-run \
  --error-format json
```

### Draft Lifecycle

- `pnpm cli draft:generate --campaign-id <campaignId> --error-format json`
- `pnpm cli draft:save --payload '<json>' --error-format json`
- `pnpm cli draft:load --campaign-id <campaignId> --error-format json`
- `pnpm cli draft:update-status --draft-id <draftId> --status approved --error-format json`
- `pnpm cli email:record-outbound --payload '<json>' --error-format json`
- `pnpm cli event:ingest --payload '<json>' --error-format json`

### Analytics

- `pnpm cli analytics:summary --group-by icp|segment|pattern --error-format json`
- `pnpm cli analytics:optimize --error-format json`

### ICP Helpers

- `pnpm cli icp:list --error-format json`
- `pnpm cli icp:hypothesis:list --error-format json`
- `pnpm cli icp:create --name "<name>" --offering-domain voicexpert.ru`
- `pnpm cli icp:coach:profile --name "<name>" --offering-domain voicexpert.ru --error-format json`

## Payload Contracts

### `draft:save`

Accepts either a single JSON object or an array.

Minimal single-object payload:

```json
{
  "campaignId": "camp-uuid",
  "contactId": "employee-uuid",
  "companyId": "company-uuid",
  "subject": "Subject line",
  "body": "Email body"
}
```

Expanded payload:

```json
{
  "campaignId": "camp-uuid",
  "contactId": "employee-uuid",
  "companyId": "company-uuid",
  "emailType": "intro",
  "language": "en",
  "patternMode": "standard",
  "variantLabel": "A",
  "subject": "Subject line",
  "body": "Email body",
  "status": "generated",
  "reviewer": null,
  "metadata": {
    "source": "outreach-agent",
    "provider": "anthropic",
    "model": "claude-3-7-sonnet",
    "offering_domain": "voicexpert.ru",
    "offering_hash": "sha256:8a2f...",
    "offering_summary": {
      "product_name": "VoiceExpert",
      "one_liner": "AI QA for calls",
      "key_benefits": ["QA automation", "manager visibility"]
    }
  }
}
```

Offering provenance policy for `draft:save`:

- `offering_domain` is the stable pointer back to the ICP / Marketing2025 offering file
- `offering_hash` is a hash of the canonical offering JSON computed by `Outreach`
- `offering_summary` is a compact normalized snapshot used for audit and analytics
- `Outreach` is responsible for computing `offering_hash` and assembling `offering_summary`
- `crew_five` persists these fields as-is inside `drafts.metadata`

### `draft:load`

```bash
pnpm cli draft:load --campaign-id <campaignId> --status approved --limit 20 --error-format json
```

Returns rows from `drafts`, newest first.

To prepare sends through `imap_mcp`, `Outreach` should request recipient context:

```bash
pnpm cli draft:load \
  --campaign-id <campaignId> \
  --status approved \
  --limit 20 \
  --include-recipient-context \
  --error-format json
```

Recipient resolution policy:

- use `employees.work_email` first
- fall back to `employees.generic_email`
- if both are empty, mark draft as not sendable

Additional response fields when `--include-recipient-context` is enabled:

```json
{
  "recipient_email": "info@example.com",
  "recipient_email_source": "generic",
  "recipient_email_kind": "generic",
  "sendable": true
}
```

### `draft:update-status`

```bash
pnpm cli draft:update-status \
  --draft-id <draftId> \
  --status approved \
  --reviewer outreach-agent \
  --metadata '{"review_source":"agent","review_reason":"passed"}' \
  --error-format json
```

Metadata is merged into existing `drafts.metadata`.

### `email:record-outbound`

Used by `Outreach` after a successful or failed send performed through `imap_mcp`.

```bash
pnpm cli email:record-outbound \
  --payload '{"draftId":"draft-uuid","provider":"imap_mcp","providerMessageId":"<message-id>","senderIdentity":"mailbox@example.com","status":"sent","metadata":{"mailbox_account_id":"mbox-1"}}' \
  --error-format json
```

Minimal payload:

```json
{
  "draftId": "draft-uuid",
  "provider": "imap_mcp",
  "providerMessageId": "<message-id>",
  "senderIdentity": "mailbox@example.com",
  "status": "sent"
}
```

Notes:

- successful records insert a row into `email_outbound` and update `drafts.status` to `sent`
- failed records insert a `failed` row into `email_outbound` and keep the draft retryable
- if `recipientEmail` is omitted, `crew_five` resolves it via `work_email -> generic_email`
- `email_outbound.metadata` inherits `drafts.metadata`, so offering provenance (`offering_domain`, `offering_hash`,
  `offering_summary`) automatically travels into the outbound ledger

### `enrich:run --dry-run`

`Outreach` should use `--dry-run` as the operator preview path before live enrichment.

Preview example:

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
  },
  "estimate": {
    "costModel": "none",
    "estimatedCredits": null,
    "estimatedUsd": null
  }
}
```

Rules:

- freshness is tracked with one shared timestamp per company/employee enrichment store
- data older than `90` days is refresh-eligible by default
- `--force-refresh` marks all rows eligible regardless of age
- `--limit` is interpreted as a company-level limit
- employee counts are informational and secondary
- provider combinations are treated as a union for the current run

## Recommended Outreach Flow

### Pattern A - Agent Generates Drafts Itself, crew_five Persists

1. `segment:list`
2. `campaign:list`
3. `draft:save` with agent-authored subject/body
4. `draft:load`
5. `draft:update-status`

### Pattern B - crew_five Generates, Outreach Reviews

1. `segment:snapshot`
2. `enrich:run --dry-run`
3. `enrich:run --run-now`
4. `campaign:create`
5. `draft:generate`
6. `draft:load`
7. agent review/ranking in `Outreach`
8. `draft:update-status`

### Pattern C - Mixed

1. `crew_five draft:generate` for baseline drafts
2. `Outreach` rewrites selected drafts
3. `Outreach` saves replacements via `draft:save`
4. `Outreach` transitions winners via `draft:update-status`

### Pattern D - Recommended IMAP MCP Send Loop

1. `draft:load --include-recipient-context`
2. `Outreach` filters rows where `sendable=true`
3. `Outreach` chooses a mailbox/account from its mailbox pool
4. `Outreach` sends via `imap_send_email`
5. `email:record-outbound` with `provider='imap_mcp'`
6. later, `event:ingest` for replies / bounces / unsubscribe events

### Snapshot Contract For Draft Context

`Outreach` should rely on `segment_members.snapshot.company` having at least:

```json
{
  "id": "company-uuid",
  "company_name": "Acme",
  "company_description": "Source description",
  "website": "acme.example",
  "employee_count": 120,
  "company_research": {}
}
```

Notes:

- `business_description` should not be used
- `company_research` is included so `Outreach` can build richer `company_confirmed_facts`

## Shared-Schema Preconditions

The shared Supabase project must contain:

- `icp_profiles.phase_outputs jsonb`
- `icp_profiles.learnings jsonb`
- `icp_profiles.offering_domain text`

Repository migration files:

- `supabase/migrations/20251212210000_add_icp_profile_phase_outputs.sql`
- `supabase/migrations/20260313110000_add_icp_profile_learnings.sql`
- `supabase/migrations/20260315093000_add_icp_profile_offering_domain.sql`

## Live Migration Status

As of 2026-03-15:

- required repository migrations exist;
- live shared Supabase has `icp_profiles.phase_outputs`, `icp_profiles.learnings`, and `icp_profiles.offering_domain`;
- `icp_profiles.offering_domain` is backfilled to `voicexpert.ru` for all 4 current ICP rows;
- local and remote migration state are aligned.

## Offering Provenance Contract

The recommended balanced model is:

- `icp_profiles.offering_domain` stores which offering family an ICP targets
- `drafts.metadata.offering_domain` stores the offering used when the draft was generated
- `drafts.metadata.offering_hash` stores the exact offering-file hash captured by `Outreach`
- `drafts.metadata.offering_summary` stores a compact snapshot of the offer content that influenced copy generation
- `email_outbound.metadata` inherits the same fields when a send is recorded

This gives:

- stable ICP -> offering routing
- reproducible attribution even if Marketing2025 offering JSON changes later
- analytics grouped by both `draft_pattern` and offering version/hash

`crew_five draft:generate` behavior:

- loads `icp_profiles.offering_domain` when an `--icp-profile-id` is provided
- writes `metadata.offering_domain` automatically
- if `snapshot.request.brief.context` already contains `offering_hash` and/or `offering_summary`, those are persisted
- if no explicit `offering_summary` is provided, `crew_five` falls back to a compact summary built from
  `request.brief.offer`

## Operational Notes

- `Outreach` should prefer idempotent orchestration: list/load before create/update when possible.
- For agent logs, store full command, exit code, stdout, stderr, and parsed JSON payload.
- For retries, classify commands:
  - Safe to retry: `segment:list`, `campaign:list`, `draft:load`, `icp:list`, `icp:hypothesis:list`
  - Retry with care: `segment:snapshot`, `draft:generate`
  - Do not blind-retry without dedupe logic: `segment:create`, `campaign:create`, `draft:save`, `draft:update-status`, `email:record-outbound`
