# Outreach <> crew_five CLI Contract

> Version: v0.14 (2026-04-01)

## Goal

Use `crew_five` as the execution/runtime layer and shared GTM spine, while `Outreach`
acts as the AI agent / orchestrator that decides what to do next and invokes `crew_five`
via CLI against the same Supabase project.

## Current Operational Split

### `crew_five` owns now

- campaign launch / attach / next-wave / rotation primitives
- mailbox assignment, send preflight, and business-day send policy
- direct send execution (`crew_five -> imap-mcp`)
- auto-send scheduling for intro + bump
- direct inbox polling / `Poll now`
- obvious reply ingestion into canonical `email_events`

### `Outreach` still owns

- company processing and enrichment orchestration around its own runtime
- draft generation / review runtime
- ambiguous reply interpretation
- follow-up content drafting after canonical events already exist in `crew_five`

### Explicit boundaries

- Do not reintroduce a parallel `send-campaign` runtime in `Outreach`.
- Do not reintroduce a parallel `process-replies` mailbox loop in `Outreach`.
- Do not rebuild recipient resolution or campaign composition rules from sparse local defaults when
  `crew_five` already exposes canonical read models.

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
- `campaign_member_additions`
- `campaign_member_exclusions`
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

- `pnpm cli project:list [--status active|inactive] --error-format json`
- `pnpm cli project:create --key "<key>" --name "<name>" [--description "<text>"] [--status active|inactive] --error-format json`
- `pnpm cli project:update --project-id <projectId> [--name "<name>"] [--description "<text>"] [--status active|inactive] --error-format json`
- `pnpm cli offer:list [--status active|inactive] --error-format json`
- `pnpm cli offer:create --title "<title>" [--project-id <projectId>] [--project-name "<name>"] [--description "<text>"] [--status active|inactive] --error-format json`
- `pnpm cli offer:update --offer-id <offerId> [--project-id <projectId>] [--title "<title>"] [--project-name "<name>"] [--description "<text>"] [--status active|inactive] --error-format json`
- `pnpm cli icp:hypothesis:list [--icp-profile-id <icpProfileId>] [--segment-id <segmentId>] [--error-format json]`
- `pnpm cli icp:hypothesis:create --icp-profile-id <icpProfileId> --label "<label>" [--offer-id <offerId>] [--targeting-defaults '<json>'] [--messaging-angle "<text>"] [--pattern-defaults '<json>'] [--notes "<text>"] [--error-format json]`
- `pnpm cli campaign:list --error-format json`
- `pnpm cli campaign:list --icp-profile-id <icpProfileId> --error-format json`
- `pnpm cli campaign:audit --campaign-id <campaignId> --error-format json`
- `pnpm cli campaign:attach-companies --campaign-id <campaignId> --company-ids '["<companyId>"]' --error-format json`
- `pnpm cli campaign:launch:preview --payload '<json>' --error-format json`
- `pnpm cli campaign:launch --payload '<json>' --error-format json`
- `pnpm cli campaign:next-wave:preview --campaign-id <campaignId> --error-format json`
- `pnpm cli campaign:next-wave:create --payload '<json>' --error-format json`
- `pnpm cli campaign:rotation:preview --campaign-id <campaignId> --error-format json`
- `pnpm cli campaign:auto-send:get --campaign-id <campaignId> --error-format json`
- `pnpm cli campaign:auto-send:put --campaign-id <campaignId> --payload '<json>' --error-format json`
- `pnpm cli campaign:send-preflight --campaign-id <campaignId> --error-format json`
- `pnpm cli campaign:followup-candidates --campaign-id <campaignId> --error-format json`
- `pnpm cli campaign:detail --campaign-id <campaignId> --error-format json`
- `pnpm cli campaign:mailbox-assignment:get --campaign-id <campaignId> --error-format json`
- `pnpm cli campaign:mailbox-assignment:put --campaign-id <campaignId> --payload '<json>' --error-format json`
- `pnpm cli campaign:create --name "<name>" --segment-id <segmentId> [--project-id <projectId>] [--offer-id <offerId>] [--icp-hypothesis-id <hypothesisId>] --snapshot-mode refresh --error-format json`
- `pnpm cli campaign:status --campaign-id <campaignId> --status review --error-format json`

Project identity is canonical shared context, but it does not replace the execution spine:

- `project` = business/workspace boundary
- `ICP` = targeting root
- `hypothesis` = execution preset
- `segment` = subset of ICP/hypothesis audience
- `campaign` = wave over that subset

### Data Hygiene And Import

- `pnpm cli employee:repair-names --dry-run --confidence high|low|all --error-format json`
- `pnpm cli employee:repair-names --confidence high|low|all --error-format json`
- `pnpm cli company:import --file <normalized-companies.json> --dry-run --error-format json`
- `pnpm cli company:import --file <normalized-companies.json> --error-format json`
- `pnpm cli company:save-processed --payload '<json>' --error-format json`

`employee:repair-names` defaults to `high` confidence in apply mode. Use `low` or `all`
only when an operator explicitly wants broader candidates.
Applied repairs are recorded in `employee_data_repairs` with original/repaired values, confidence,
and source.
`company:import` deduplicates by `tin`, then `registration_number`. When a duplicate match is found,
preview/apply items expose `match_field`; OGRN matches with differing TIN values emit a `TIN mismatch`
warning for operator review.

### `offer:list`

Use this to load the minimal canonical offer registry before choosing an `offerId` for launch or
raw campaign creation.

```bash
pnpm cli offer:list --status active --error-format json
```

Representative response:

```json
[
  {
    "id": "offer-1",
    "title": "Negotiation room audit",
    "project_name": "VoiceXpert",
    "description": "Audit offer",
    "status": "active"
  }
]
```

### `offer:create`

Use this to create a reusable offer row in `crew_five` instead of keeping offer identity only in
agent/runtime memory.

```bash
pnpm cli offer:create \
  --title "Negotiation room audit" \
  --project-name "VoiceXpert" \
  --description "Audit offer" \
  --status active \
  --error-format json
```

### `offer:update`

Use this to rename or deactivate an existing offer without breaking historical campaign links.

```bash
pnpm cli offer:update \
  --offer-id <offerId> \
  --description "Updated audit offer" \
  --status inactive \
  --error-format json
```

### `campaign:rotation:preview`

Use this to preview controlled offer / hypothesis rotation for an existing source wave before any
new wave is created.

```bash
pnpm cli campaign:rotation:preview \
  --campaign-id <campaignId> \
  --error-format json
```

Representative response shape:

```json
{
  "sourceCampaign": {
    "campaignId": "camp-1",
    "campaignName": "Wave 1",
    "offerId": "offer-1",
    "icpHypothesisId": "hyp-1",
    "icpProfileId": "icp-1"
  },
  "summary": {
    "sourceContactCount": 42,
    "candidateCount": 3,
    "eligibleCandidateContactCount": 27,
    "blockedCandidateContactCount": 99
  },
  "candidates": [],
  "contacts": []
}
```

Use it as a decision aid only. It does not create or mutate a campaign.

### `icp:hypothesis:create`

Use this to turn a hypothesis into an execution preset instead of leaving it only as a research
artifact.

```bash
pnpm cli icp:hypothesis:create \
  --icp-profile-id <icpProfileId> \
  --label "Audit-heavy mid-market finance" \
  --offer-id <offerId> \
  --targeting-defaults '{"regions":["EU"],"companySizes":["mid-market"]}' \
  --messaging-angle "Negotiation room refresh for audit-heavy teams" \
  --pattern-defaults '{"introPattern":"standard","tone":"direct"}' \
  --notes "Use for Q2 audit waves" \
  --error-format json
```

Representative fields now stored on `icp_hypotheses`:

- `offer_id`
- `targeting_defaults`
- `messaging_angle`
- `pattern_defaults`
- `notes`

### Campaign launch + create with hypothesis

`campaign:launch:preview`, `campaign:launch`, and raw `campaign:create` now accept
`icpHypothesisId` / `--icp-hypothesis-id`.

Operational rule:

- if a hypothesis has `offer_id` and launch/create omits `offerId`, `crew_five` resolves the
  campaign offer from the hypothesis
- if both are provided and they disagree, backend rejects the request with
  `CAMPAIGN_HYPOTHESIS_OFFER_MISMATCH`

### `campaign:attach-companies`

Use this when processed companies already exist in `companies` / `employees` and `Outreach` wants to
add them into an existing frozen campaign wave without mutating the source segment definition.

```bash
pnpm cli campaign:attach-companies \
  --campaign-id <campaignId> \
  --company-ids '["co-1","co-2"]' \
  --attached-by outreacher \
  --source import_workspace \
  --error-format json
```

Contract notes:

- attach is additive and campaign-scoped
- base `segment_members` stay unchanged
- inserted contact rows are stored in `campaign_member_additions`
- the effective campaign audience becomes:
  - base segment snapshot rows
  - plus manual attach rows
- draft generation, campaign detail/company reads, campaign audit, and Smartlead send now read that
  unified audience

Representative response:

```json
{
  "campaignId": "camp-1",
  "summary": {
    "requestedCompanyCount": 2,
    "attachedCompanyCount": 1,
    "alreadyPresentCompanyCount": 1,
    "blockedCompanyCount": 0,
    "invalidCompanyCount": 0,
    "insertedContactCount": 3,
    "alreadyPresentContactCount": 2
  },
  "items": [
    {
      "companyId": "co-1",
      "companyName": "Acme",
      "status": "attached",
      "insertedContactCount": 3,
      "alreadyPresentContactCount": 0,
      "reason": null
    }
  ]
}
```

### `company:import`

Use this when `Outreach` has already parsed a source file into normalized JSON rows and wants
`crew_five` to preview or apply a canonical import into `companies` + `employees`.

Preview:

```bash
pnpm cli company:import \
  --file <normalized-companies.json> \
  --dry-run \
  --error-format json
```

Apply:

```bash
pnpm cli company:import \
  --file <normalized-companies.json> \
  --error-format json
```

Important dedup semantics:

- first match by `tin`
- if no `tin` match, match by `registration_number`
- if the match is by `registration_number` and the incoming TIN differs from the DB TIN,
  the item remains `update` and emits a `TIN mismatch` warning

Representative preview/apply item:

```json
{
  "company_name": "ООО \"Ясон Агро\"",
  "tin": "2635800395",
  "action": "update",
  "match_field": "registration_number",
  "office_qualification": "Less",
  "warnings": ["TIN mismatch: file=2635800395, db=6325079752"]
}
```

### `campaign:send-preflight`

Use this when `Outreach` or the Web UI wants one canonical answer to "can this campaign move into
send right now?" without reconstructing readiness from mailbox assignments, drafts, and employees.

```bash
pnpm cli campaign:send-preflight \
  --campaign-id <campaignId> \
  --error-format json
```

Response shape:

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

Canonical blocker codes now include:

- `no_sender_assignment`
- `draft_not_approved`
- `missing_recipient_email`
- `suppressed_contact`
- `no_sendable_drafts`
- `campaign_paused`

`suppressed_contact` means at least one approved draft currently targets a contact that should not
be sent:

- unsubscribed
- complaint
- bounced
- or repeated intro / already-used contact

### `campaign:auto-send:get`

Use this when `Outreach` or the Web UI needs the canonical auto-send flags that control intro and
bump scheduler eligibility for a campaign.

```bash
pnpm cli campaign:auto-send:get \
  --campaign-id <campaignId> \
  --error-format json
```

Response shape:

```json
{
  "campaignId": "camp-123",
  "campaignName": "Q2 Push",
  "campaignStatus": "review",
  "autoSendIntro": true,
  "autoSendBump": false,
  "bumpMinDaysSinceIntro": 3,
  "updatedAt": "2026-03-21T10:00:00Z"
}
```

### `campaign:auto-send:put`

Use this when `Outreach` or the Web UI wants to explicitly opt a campaign into intro and/or bump
auto-send.

```bash
pnpm cli campaign:auto-send:put \
  --campaign-id <campaignId> \
  --payload '{"autoSendIntro":true,"autoSendBump":true,"bumpMinDaysSinceIntro":3}' \
  --error-format json
```

Validation rules:

- `autoSendIntro` must be a boolean when provided
- `autoSendBump` must be a boolean when provided
- `bumpMinDaysSinceIntro` must be an integer `>= 1`
- at least one field must be provided

The response shape matches `campaign:auto-send:get`.

### `campaign:send-policy:get`

Use this when `Outreach` or the Web UI needs the canonical campaign-local send calendar policy that
the scheduler enforces before intro/bump auto-send.

```bash
pnpm cli campaign:send-policy:get \
  --campaign-id <campaignId> \
  --error-format json
```

Response shape:

```json
{
  "campaignId": "camp-123",
  "campaignName": "Q2 Push",
  "campaignStatus": "review",
  "sendTimezone": "Europe/Moscow",
  "sendWindowStartHour": 9,
  "sendWindowEndHour": 17,
  "sendWeekdaysOnly": true,
  "updatedAt": "2026-03-21T12:00:00Z"
}
```

### `campaign:send-policy:put`

Use this when `Outreach` or the Web UI wants to explicitly change the campaign-local calendar policy.

```bash
pnpm cli campaign:send-policy:put \
  --campaign-id <campaignId> \
  --payload '{"sendTimezone":"Europe/Berlin","sendWindowStartHour":8,"sendWindowEndHour":16,"sendWeekdaysOnly":true}' \
  --error-format json
```

Validation rules:

- `sendTimezone` must be a valid IANA timezone when provided
- `sendWindowStartHour` must be an integer `0..23`
- `sendWindowEndHour` must be an integer `1..24`
- `sendWindowEndHour` must be greater than `sendWindowStartHour`
- `sendWeekdaysOnly` must be a boolean when provided
- at least one field must be provided

The response shape matches `campaign:send-policy:get`.

### `campaign:launch:preview`

Use this when `Outreach` or a future launch wizard wants one canonical preview before mutating
campaign state.

```bash
pnpm cli campaign:launch:preview \
  --payload '{"name":"Q2 Negotiation Rooms","segmentId":"seg-uuid","segmentVersion":1,"offerId":"offer-1","snapshotMode":"reuse","senderPlan":{"assignments":[{"mailboxAccountId":"mbox-1","senderIdentity":"sales@voicexpert.ru","provider":"imap_mcp"}]}}' \
  --error-format json
```

Current behaviour:

- if a segment snapshot already exists for the requested version, the preview is built from real
  `segment_members`, `companies`, and `employees`
- if snapshot mode is `reuse` and the snapshot is missing, the preview stays read-only and returns
  an estimate from `filterPreview` counts instead of mutating anything
- sender planning is summarized from the proposed `senderPlan.assignments`
- send policy defaults are resolved server-side and returned canonically in `sendPolicy`

Representative response:

```json
{
  "ok": true,
  "campaign": {
    "name": "Q2 Negotiation Rooms",
    "status": "draft"
  },
  "segment": {
    "id": "seg-uuid",
    "version": 1,
    "snapshotStatus": "existing"
  },
  "summary": {
    "companyCount": 62,
    "contactCount": 78,
    "sendableContactCount": 44,
    "freshCompanyCount": 46,
    "staleCompanyCount": 15,
    "missingCompanyCount": 1,
    "senderAssignmentCount": 1
  },
  "senderPlan": {
    "assignmentCount": 1,
    "mailboxAccountCount": 1,
    "senderIdentityCount": 1,
    "domainCount": 1,
    "domains": ["voicexpert.ru"]
  },
  "sendPolicy": {
    "sendTimezone": "Europe/Moscow",
    "sendWindowStartHour": 9,
    "sendWindowEndHour": 17,
    "sendWeekdaysOnly": true
  },
  "warnings": [
    {
      "code": "company_enrichment_incomplete",
      "message": "Some companies in this campaign snapshot still need enrichment or refresh."
    }
  ]
}
```

Current warning codes:

- `snapshot_missing_refresh_required`
- `missing_sender_plan`
- `company_enrichment_incomplete`

### `campaign:launch`

Use this when `Outreach` or a future Web wizard is ready to perform the canonical launch mutation.

```bash
pnpm cli campaign:launch \
  --payload '{"name":"Q2 Negotiation Rooms","segmentId":"seg-uuid","segmentVersion":1,"offerId":"offer-1","snapshotMode":"reuse","createdBy":"outreacher","senderPlan":{"source":"outreacher","assignments":[{"mailboxAccountId":"mbox-1","senderIdentity":"sales@voicexpert.ru","provider":"imap_mcp"}]}}' \
  --error-format json
```

Current behaviour:

- ensures the segment snapshot using the same `reuse|refresh` semantics as low-level campaign
  creation
- creates the campaign row in `draft`
- if `senderPlan.assignments` is present and non-empty, persists the initial mailbox assignment
  immediately
- persists resolved send policy on the campaign row
- returns one merged launch result for campaign, segment snapshot, sender plan, and send policy

Representative response:

```json
{
  "campaign": {
    "id": "camp-uuid",
    "name": "Q2 Negotiation Rooms",
    "status": "draft",
    "segment_id": "seg-uuid",
    "segment_version": 1
  },
  "segment": {
    "id": "seg-uuid",
    "version": 1,
    "snapshot": {
      "version": 1,
      "count": 78
    }
  },
  "senderPlan": {
    "assignments": [
      {
        "id": "assign-1",
        "mailboxAccountId": "mbox-1",
        "senderIdentity": "sales@voicexpert.ru",
        "provider": "imap_mcp"
      }
    ],
    "summary": {
      "assignmentCount": 1,
      "mailboxAccountCount": 1,
      "senderIdentityCount": 1,
      "domainCount": 1,
      "domains": ["voicexpert.ru"]
    }
  },
  "sendPolicy": {
    "sendTimezone": "Europe/Moscow",
    "sendWindowStartHour": 9,
    "sendWindowEndHour": 17,
    "sendWeekdaysOnly": true
  }
}
```

Canonical blocker codes:

- `no_sender_assignment`
- `draft_not_approved`
- `missing_recipient_email`
- `no_sendable_drafts`
- `campaign_paused`

### `campaign:next-wave:preview`

```bash
pnpm cli campaign:next-wave:preview \
  --campaign-id camp-source \
  --error-format json
```

Returns canonical next-wave preview:

- source campaign identity
- reused defaults:
  - `offerId`
  - `icpHypothesisId`
  - send policy
  - sender-plan summary
- summary:
  - `candidateContactCount`
  - `eligibleContactCount`
  - `blockedContactCount`
- `blockedBreakdown`
- `items[]` with candidate-level explainability:
  - `contactId`
  - `eligible`
  - `blockedReason`
  - `recipientEmail`
  - `exposure_summary`:
    - `total_exposures`
    - `last_icp_hypothesis_id`
    - `last_offer_id`
    - `last_offer_title`
    - `last_sent_at`

Canonical blocked reasons:

- `suppressed_contact`
- `already_contacted_recently`
- `no_sendable_email`
- `already_in_target_wave`
- `already_used_in_source_wave`

Important semantic note:

- `already_used_in_source_wave` now means the company/contact is already present in the source
  campaign audience itself, not only that an outbound was previously sent. This prevents “Wave 2
  duplicates Wave 1” when the source wave is still early in execution.

### `campaign:next-wave:create`

```bash
pnpm cli campaign:next-wave:create \
  --payload '{"sourceCampaignId":"camp-source","name":"Wave 2","createdBy":"outreacher"}' \
  --error-format json
```

Creates a fresh campaign wave and returns:

- created campaign row
- source campaign identity
- reused defaults
- canonical sender plan
- canonical send policy
- candidate/eligible/blocked summary
- blocked breakdown

Important semantics:

- source wave is not mutated
- blocked contacts from the target segment are written into `campaign_member_exclusions`
- eligible copied manual contacts are written into `campaign_member_additions`

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

- `pnpm cli analytics:summary --group-by icp|segment|pattern|rejection_reason|offering|offer|hypothesis|recipient_type|sender_identity --error-format json`
- `pnpm cli analytics:funnel --campaign-id <campaignId> --error-format json`
- `pnpm cli analytics:optimize --error-format json`

### ICP Helpers

- `pnpm cli icp:list --error-format json`
- `pnpm cli icp:hypothesis:list --error-format json`
- `pnpm cli icp:create --name "<name>" [--project-id <projectId>] --offering-domain voicexpert.ru`
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

### `company:save-processed`

Use this when `Outreach` has already scraped/analyzed a company and wants `crew_five`
to perform the canonical write into `companies` + `employees`.

```bash
pnpm cli company:save-processed \
  --payload '{"company":{"tin":"7707083893","company_name":"ООО Пример","company_description":"Описание бизнеса","company_research":{"provider":"firecrawl","facts":["Подтвержденный факт"]},"website":"example.ru","office_qualification":"More","processing_status":"completed"},"employees":[{"full_name":"Инна Федина","position":"Директор"},{"full_name":"Иван Иванов","position":"Руководитель ИТ","work_email":"ivan@example.ru"}]}' \
  --error-format json
```

Behavior:

- upserts the company by canonical duplicate keys (`tin`, then `registration_number`);
- validates the payload before writing;
- normalizes obvious high-confidence swapped employee `first_name` / `last_name` values before persistence;
- upserts employees as one atomic company bundle;
- resolves employee duplicates by `company_id + full_name` inside the saved company;
- returns warnings when low-confidence employee name-repair candidates are left unchanged.
- writes name-repair audit rows when high-confidence employee normalization is applied during save.

Error behavior (when `--error-format json` is used):

- On validation failure, exits non-zero and returns `error.code = "INVALID_PAYLOAD"`.
- `error.details.warnings`: human-readable reasons.
- `error.details.missing_fields`: required fields that were missing/empty.
- `error.details.invalid_fields`: fields that were present but invalid (e.g. invalid emails).

Success response shape:

```json
{
  "company_id": "company-uuid",
  "employee_ids": ["employee-1", "employee-2"],
  "warnings": [],
  "company_action": "update",
  "employee_created_count": 1,
  "employee_updated_count": 1
}
```

### `campaign:followup-candidates`

Use this read model before a bump send run so `Outreach` does not have to recompute intro/reply
eligibility from raw spine tables.

```bash
pnpm cli campaign:followup-candidates \
  --campaign-id <campaignId> \
  --error-format json
```

Success response shape:

```json
[
  {
    "contact_id": "employee-uuid",
    "company_id": "company-uuid",
    "intro_sent": true,
    "intro_sent_at": "2026-03-10T10:00:00Z",
    "intro_sender_identity": "sales@example.com",
    "reply_received": false,
    "bounce": false,
    "unsubscribed": false,
    "bump_draft_exists": true,
    "bump_sent": false,
    "eligible": true,
    "days_since_intro": 6,
    "auto_reply": null
  }
]
```

Behavior:

- uses the latest sent intro outbound per contact as the intro anchor;
- blocks candidates that already have a reply, bounce, unsubscribe, complaint, or sent bump;
- returns `days_since_intro` so `Outreach` can apply mailbox/timing policy on top of canonical
  eligibility data.

### `campaign:detail`

Use this read model when `Outreach` or the operator UI needs one canonical campaign-scoped picture
instead of stitching together `campaign -> companies -> employees -> drafts -> outbounds -> events`
on its own.

This is the preferred source for generation context. `Outreach` should not rebuild campaign
context from local defaults when `campaign:detail` is available.

```bash
pnpm cli campaign:detail \
  --campaign-id <campaignId> \
  --error-format json
```

Success response shape:

```json
{
  "campaign": {
    "id": "campaign-uuid",
    "name": "Q1 Push"
  },
  "segment": {
    "id": "segment-uuid",
    "name": "SMB Moscow"
  },
  "icp_profile": {
    "id": "icp-uuid",
    "name": "VoiceXpert ICP",
    "offering_domain": "voicexpert.ru"
  },
  "icp_hypothesis": {
    "id": "hyp-uuid",
    "name": "Negotiation room refresh",
    "status": "active"
  },
  "offer": {
    "id": "offer-1",
    "title": "Negotiation room audit",
    "project_name": "VoiceXpert",
    "status": "active"
  },
  "companies": [
    {
      "company_id": "company-uuid",
      "company_name": "ООО Пример",
      "contact_count": 1,
      "composition_summary": {
        "total_contacts": 1,
        "sendable_contacts": 1,
        "eligible_for_new_intro_contacts": 0,
        "blocked_no_sendable_email_contacts": 0,
        "blocked_bounced_contacts": 0,
        "blocked_unsubscribed_contacts": 0,
        "blocked_already_used_contacts": 1,
        "contacts_with_drafts": 1,
        "contacts_with_sent_outbound": 1
      },
      "employees": [
        {
          "contact_id": "employee-uuid",
          "work_email": "inna@example.ru",
          "generic_email": "info@example.ru",
          "recipient_email": "inna@example.ru",
          "recipient_email_source": "work",
          "sendable": true,
          "block_reasons": ["already_used"],
          "eligible_for_new_intro": false,
          "full_name": "Инна Федина",
          "draft_counts": {
            "total": 2,
            "intro": 1,
            "bump": 1
          },
          "outbound_count": 1,
          "replied": true,
          "exposure_summary": {
            "total_exposures": 1,
            "last_icp_hypothesis_id": "hyp-uuid",
            "last_offer_id": "offer-1",
            "last_offer_title": "Negotiation room audit",
            "last_sent_at": "2026-03-12T10:00:00Z"
          },
          "execution_exposures": [
            {
              "campaign_id": "campaign-uuid",
              "icp_profile_id": "icp-uuid",
              "icp_hypothesis_id": "hyp-uuid",
              "offer_id": "offer-1",
              "offer_title": "Negotiation room audit",
              "project_name": "VoiceXpert",
              "offering_domain": "voicexpert.ru",
              "offering_hash": "hash-1",
              "offering_summary": "Negotiation room refresh for audit-heavy teams",
              "first_sent_at": "2026-03-12T10:00:00Z",
              "last_sent_at": "2026-03-12T10:00:00Z",
              "sent_count": 1,
              "replied": true,
              "bounced": false,
              "unsubscribed": false
            }
          ]
        }
      ]
    }
  ]
}
```

Operationally important fields for generation/runtime alignment:

- `project`
- `offer`
- `icp_profile.description`
- `icp_profile.company_criteria`
- `icp_profile.persona_criteria`
- `icp_hypothesis`
- `companies[].employees[].recipient_email`
- `companies[].employees[].audience_source`
- `companies[].employees[].exposure_summary`

For actual delivery execution, pair `campaign:detail` with:

- `draft:load --campaign-id <campaignId> --include-recipient-context --error-format json`

That command returns the resolved send target (`recipient_email`, `recipient_email_source`,
`sendable`) so `Outreach` does not need to infer a recipient from raw employee fields.

Behavior:

- reuses the canonical campaign company grouping already used by the Web adapter;
- enriches that company view with segment + ICP context and campaign-scoped employee drill-down;
- exposes one shared campaign-wave composition model for both `Outreach` and the UI:
  - resolved `recipient_email` / `recipient_email_source`
  - `sendable`
  - intro block reasons:
    - `no_sendable_email`
    - `bounced`
    - `unsubscribed`
    - `already_used`
  - `eligible_for_new_intro`
  - company-level `composition_summary`
  - employee-level historical `exposure_summary`
  - employee-level `execution_exposures[]` derived from canonical outbound ledger rows
- this is the canonical read model to answer:
  - which contacts are present in the wave
  - which contacts are still eligible for a new intro
  - why specific contacts are blocked
  - which ICP / hypothesis / offer context a contact has already received
  - how far each company is from being fully draft/send covered

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
  --status rejected \
  --reviewer outreach-agent \
  --metadata '{"review_surface":"campaigns","review_reason_code":"marketing_tone","review_reason_codes":["marketing_tone","too_generic"],"review_reason_text":"Reads like a promo email","reviewed_at":"2026-03-16T18:00:00Z","reviewed_by":"outreacher"}' \
  --error-format json
```

Metadata is merged into existing `drafts.metadata`.

Recommended rejection taxonomy:

- `too_generic`
- `marketing_tone`
- `bad_subject`
- `wrong_narrative`
- `gender_mismatch`
- `explicit_title`
- `unnatural_russian`
- `fabricated_context`
- `weak_personalization`
- `bad_cta`
- `wrong_persona`
- `tone_mismatch`
- `factual_issue`
- `duplicate`
- `other`

Recommended review metadata contract:

```json
{
  "review_surface": "campaigns",
  "review_reason_code": "marketing_tone",
  "review_reason_codes": ["marketing_tone", "too_generic"],
  "review_reason_text": "Reads like a promo email",
  "reviewed_at": "2026-03-16T18:00:00Z",
  "reviewed_by": "outreacher"
}
```

Rules:

- `review_reason_code` is required for `status=rejected`
- `review_reason_text` is required when `review_reason_code=other`
- `review_reason_codes` is optional multi-label context
- `reviewed_at` and `reviewed_by` should be written on every review action

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
3. `Outreach` chooses a mailbox/account or sender set from its mailbox pool
4. `Outreach` writes the planned sender set into `crew_five` before send
5. `Outreach` sends via `imap_send_email`
6. `email:record-outbound` with `provider='imap_mcp'`
7. later, `event:ingest` for replies / bounces / unsubscribe events

### Optional Adapter API - Campaign Mailbox Planning

Preferred `Outreach` path: use the CLI mailbox-assignment commands so sender planning stays inside
the same mutation surface as the rest of the GTM spine.

Read current plan:

```bash
pnpm cli campaign:mailbox-assignment:get \
  --campaign-id <campaignId> \
  --error-format json
```

Replace full sender set:

```bash
pnpm cli campaign:mailbox-assignment:put \
  --campaign-id <campaignId> \
  --payload '{"source":"outreacher","assignments":[{"mailboxAccountId":"mbox-1","senderIdentity":"sales@voicexpert.ru","provider":"imap_mcp"}]}' \
  --error-format json
```

CLI payload semantics:

- whole-set replace
- one row per planned sender identity
- this is **planned** sender state, not observed delivery history
- `campaign:status --status sending` is blocked until at least one assignment exists

Web adapter parity remains available when `Outreach` needs Web/UI and spine to know the sender plan
before any real outbound exists.

Read current plan:

```http
GET /api/campaigns/:campaignId/mailbox-assignment
```

Replace full sender set:

```http
PUT /api/campaigns/:campaignId/mailbox-assignment
Content-Type: application/json
```

Body:

```json
{
  "source": "outreacher",
  "assignments": [
    {
      "mailboxAccountId": "mbox-1",
      "senderIdentity": "sales@voicexpert.ru",
      "provider": "imap_mcp"
    },
    {
      "mailboxAccountId": "mbox-2",
      "senderIdentity": "team@skomplekt.com",
      "provider": "imap_mcp"
    }
  ]
}
```

Semantics:

- whole-set replace
- one row per planned sender identity
- this is **planned** sender state, not observed delivery history
- `GET /api/mailboxes` remains the observed ledger from `email_outbound`

Sending guard:

- transition to `sending` is blocked until the campaign has at least one planned mailbox assignment
- failure contract:

```json
{
  "error": "Assign at least one mailbox sender identity before sending",
  "code": "MAILBOX_ASSIGNMENT_REQUIRED"
}
```

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

`Outreach` and `crew_five` should also rely on `segment_members.snapshot.contact` carrying canonical
recipient context resolved at snapshot time:

```json
{
  "full_name": "Jane Doe",
  "work_email": "",
  "generic_email": "info@acme.example",
  "position": "CEO",
  "recipient_email": "info@acme.example",
  "recipient_email_source": "generic",
  "recipient_email_kind": "generic",
  "sendable": true
}
```

Recipient rules:

- use repo-standard naming: `recipient_email`, not `effective_email`
- resolve with the shared policy `work_email -> generic_email`
- persist the resolved recipient inside the snapshot so downstream tools do not have to re-infer it
  from partial contact payloads

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
