# Task: Processed Company -> Campaign Wave Attach Backend

## Status

Completed.

## Goal

Remove the manual gap between:

- imported / processed companies
- and a chosen frozen campaign wave

by adding a canonical backend surface for attaching processed companies into an
existing campaign without mutating the original segment definition.

## Why this matters

The current operator loop is still missing one practical bridge:

- import companies
- process companies / employees
- choose a campaign wave
- attach those processed companies into that wave
- then generate drafts and continue execution

Today this bridge is not canonical. That keeps part of the real workflow manual
even though the surrounding launch / review / send flow is already in place.

## Constraints

- `crew_five` must remain the canonical execution spine.
- Campaigns are still treated as **frozen execution waves**.
- We must not silently mutate the campaign's source segment or rewrite the
  segment's filter definition in order to "attach" more companies.
- This should be an additive backend capability, not a broad schema rewrite.
- It must be auditable.

## Decision Options

### Option 1. Mutate the source segment / snapshot

Examples:

- edit segment filters
- rewrite `segment_members`
- bump segment version behind the campaign

Why not:

- breaks the "frozen campaign wave" model
- weak auditability
- risks surprising operators and `Outreach`
- couples campaign execution too tightly to mutable segment state

### Option 2. Store only attached companies, derive contacts live later

Examples:

- `campaign_company_attachments(campaign_id, company_id, ...)`
- resolve employees dynamically every time

Why not as the primary design:

- weak freeze semantics at contact level
- repeated runtime joins and ambiguity if employee set changes later
- harder to reason about "who exactly became part of the wave at attach time"

### Option 3. Recommended: campaign-scoped audience additions

Examples:

- keep the original segment snapshot unchanged
- add a campaign-scoped table for explicitly attached contacts / companies
- expose a shared helper that returns:
  - base audience from `segment_members`
  - plus campaign-specific attached additions

Why this is recommended:

- preserves frozen base wave semantics
- keeps attach additive and auditable
- gives draft generation and read models a single canonical audience surface
- avoids rewriting segment history

## Recommended Backend Shape

### 1. Schema

Add a new table for campaign-scoped audience additions.

Recommended name:

- `campaign_member_additions`

Recommended columns:

- `id uuid primary key default gen_random_uuid()`
- `campaign_id uuid not null references campaigns(id) on delete cascade`
- `company_id uuid not null references companies(id) on delete cascade`
- `contact_id uuid not null references employees(id) on delete cascade`
- `source text not null default 'manual_attach'`
- `attached_by text null`
- `attached_at timestamptz not null default now()`
- `metadata jsonb null`
- `snapshot jsonb null`

Recommended uniqueness:

- `unique (campaign_id, contact_id)`

Recommended indexes:

- `(campaign_id)`
- `(campaign_id, company_id)`
- `(campaign_id, contact_id)`

### 2. Snapshot semantics

`snapshot` should freeze the minimal company/contact context needed for later
read models and auditability, similar in spirit to `segment_members.snapshot`.

Recommended snapshot payload:

```json
{
  "contact": {
    "full_name": "...",
    "work_email": "...",
    "position": "..."
  },
  "company": {
    "id": "...",
    "company_name": "...",
    "website": "...",
    "employee_count": 42,
    "region": "...",
    "office_qualification": "Less",
    "company_research": {}
  }
}
```

### 3. Shared audience helper

Add a shared service, for example:

- `src/services/campaignAudience.ts`

Recommended responsibilities:

- `listBaseCampaignAudience(client, campaign)`
- `listAddedCampaignAudience(client, campaignId)`
- `listCampaignAudience(client, campaignId)`

`listCampaignAudience()` must:

- return base segment members for `(campaign.segment_id, campaign.segment_version)`
- union manual additions from `campaign_member_additions`
- dedupe by `contact_id`
- preserve whether a row came from:
  - `segment_snapshot`
  - `manual_attach`

This helper should become the canonical source for later campaign-level draft
generation and composition read models.

### 4. Attach mutation service

Add a dedicated service, for example:

- `src/services/campaignAttachCompanies.ts`

Recommended input:

```ts
{
  campaignId: string;
  companyIds: string[];
  attachedBy?: string;
  source?: 'manual_attach' | 'import_workspace';
}
```

Recommended behavior:

1. load campaign
2. validate campaign status is mutable for attach
3. validate requested company ids exist
4. fetch employees for those companies
5. compute base audience + existing additions
6. insert only new contact rows into `campaign_member_additions`
7. return detailed result breakdown

Recommended allowed campaign statuses:

- `draft`
- `review`
- `ready`

Recommended blocked statuses:

- `generating`
- `sending`
- `paused`
- `complete`

### 5. Result shape

The attach response should be operator-readable.

Recommended top-level response:

```json
{
  "campaignId": "camp-1",
  "summary": {
    "requestedCompanyCount": 3,
    "attachedCompanyCount": 2,
    "alreadyPresentCompanyCount": 1,
    "blockedCompanyCount": 0,
    "invalidCompanyCount": 0,
    "insertedContactCount": 7,
    "alreadyPresentContactCount": 4
  },
  "items": [
    {
      "companyId": "co-1",
      "companyName": "Acme",
      "status": "attached",
      "insertedContactCount": 3,
      "alreadyPresentContactCount": 1,
      "reason": null
    }
  ]
}
```

Recommended item statuses:

- `attached`
- `already_present`
- `blocked`
- `invalid`

Recommended reasons:

- `campaign_status_locked`
- `company_not_found`
- `company_has_no_employees`
- `all_contacts_already_present`

## Required Integration Surfaces

The attach feature is not complete if it only writes rows. The following
surfaces must be updated to use the shared campaign audience helper.

### A. Draft generation / draft load path

Any flow that determines "which contacts belong to the campaign" must stop
reading only `segment_members` directly and instead read:

- base segment audience
- plus manual additions

Minimum required follow-up:

- draft generation for campaign-scoped flows

### B. Campaign company / employee read models

At least the following must reflect attached additions:

- `Campaigns` company list
- campaign detail / employee drill-down
- campaign composition counts

### C. Audit / composition surfaces

Campaign audit or composition read models should not silently ignore manually
attached contacts once the feature exists.

## API / CLI Surface

Recommended CLI:

- `campaign:attach-companies`

Recommended CLI usage:

```bash
pnpm cli campaign:attach-companies \
  --campaign-id <campaignId> \
  --company-ids '["co-1","co-2"]' \
  --attached-by operator \
  --source import_workspace \
  --error-format json
```

Recommended Web route:

- `POST /api/campaigns/:campaignId/companies/attach`

Recommended request body:

```json
{
  "companyIds": ["co-1", "co-2"],
  "attachedBy": "web-ui",
  "source": "import_workspace"
}
```

## What not to do

- Do not mutate `segments.filter_definition` as part of attach.
- Do not rewrite existing `segment_members` rows for the campaign.
- Do not make attach depend on prompt packs, send runtime, or mailbox selection.
- Do not overblock on sendability at attach time; composition/sendability can be
  exposed later in read models.
- Do not introduce a large generalized audience framework beyond what is needed
  for campaign-scoped additions.

## Test Plan

### Unit tests

- attach service inserts additions for new campaign/company/contact rows
- duplicate company attach is idempotent
- `all_contacts_already_present` resolves to `already_present`
- invalid company ids are reported cleanly
- locked campaign statuses reject mutation

### Audience helper tests

- unions base `segment_members` and `campaign_member_additions`
- dedupes by `contact_id`
- preserves source markers

### Integration / regression tests

- draft generation uses attached additions
- campaign company read model reflects added companies
- campaign detail employee list reflects added contacts
- CLI and Web route return the same summary semantics

## Recommended Implementation Order

1. migration for `campaign_member_additions`
2. shared audience helper
3. attach mutation service
4. CLI surface
5. Web adapter route
6. draft-generation parity update
7. campaign composition read-model parity update
8. frontend handoff
9. Outreach handoff if any CLI/runtime assumption changes

## Required docs after implementation

- `docs/Database_Description.md`
- `docs/Outreach_crew_five_cli_contract.md`
- `docs/web_ui_endpoints.md`
- session log in `docs/sessions/`
- `CHANGELOG.md`

## Follow-up handoffs

After backend is complete, prepare:

1. frontend brief for `Import -> Process -> Attach` flow
2. short `Outreach` note only if their runtime or CLI assumptions need to
   change

## Completion Notes

Implemented:

- `campaign_member_additions` migration
- shared `listCampaignAudience()` helper
- `campaign:attach-companies` CLI + `POST /api/campaigns/:campaignId/companies/attach`
- draft generation, campaign companies/detail, campaign audit, and Smartlead send updated to use
  the canonical campaign audience
- frontend brief and Outreach note prepared
