# Web UI Endpoint Map

> Version: v0.25 (2026-03-30)
>
> This document catalogues the HTTP endpoints exposed by the web adapter
> (`src/web/server.ts`) and shows how the React Web UI (`web/src`) uses them.
> It complements `docs/web_ui_requirements.md`, which remains the
> authoritative source for Web UI behaviour and navigation.

## Overview

- Base URL is `VITE_API_BASE` (defaults to `/api` in `web/src/apiClient.ts`).
- Canonical local ports:
  - daily work: adapter `8787`, Vite UI `5173`
  - isolated validation: adapter `8888`, Vite UI `5174`
- All endpoints live under this base and are implemented in
  `src/web/server.ts` via the `dispatch` function.
- The React app calls these endpoints exclusively through
  `web/src/apiClient.ts`.

---

## Endpoint catalog (by area)

### Campaigns and drafts

- `GET /api/campaigns`
  - Returns: list of campaigns (`id`, `name`, `status`, `segment_id`,
    `segment_version`, `project_id`, `offer_id`, `icp_hypothesis_id`).
  - Used by: `fetchCampaigns` in `web/src/apiClient.ts`.
- `POST /api/campaigns`
  - Body: `{ name, segmentId, segmentVersion, projectId?, offerId?, icpHypothesisId?, createdBy? }`.
  - Returns: created campaign row (includes `id`, `name`, `project_id`, `offer_id`, `icp_hypothesis_id`, `segment_id`, `segment_version`).
  - Used by: `createCampaign` in `web/src/apiClient.ts` (Pipeline Draft step inline creation).
- `GET /api/campaigns/:campaignId/next-wave-preview`
  - Returns:
    - `sourceCampaign`
    - `defaults`:
      - `targetSegmentId`
      - `targetSegmentVersion`
      - `offerId`
      - `icpHypothesisId`
      - `sendPolicy`
      - `senderPlanSummary`
    - `summary`
    - `blockedBreakdown`
    - `items[]`:
      - `contactId`
      - `companyId`
      - `source`
      - `eligible`
      - `blockedReason`
      - `recipientEmail`
      - `recipientEmailSource`
      - `exposure_summary`:
        - `total_exposures`
        - `last_icp_hypothesis_id`
        - `last_offer_id`
        - `last_offer_title`
        - `last_sent_at`
    - `items`
  - Used by: future next-wave preview flow.
- `POST /api/campaigns/next-wave`
  - Body: `{ sourceCampaignId, name, createdBy?, targetSegmentId?, targetSegmentVersion?, offerId?, icpHypothesisId?, snapshotMode?, senderPlan?, sendTimezone?, sendWindowStartHour?, sendWindowEndHour?, sendWeekdaysOnly? }`
  - Returns:
    - created `campaign`
    - reused defaults
    - `senderPlan`
    - `sendPolicy`
    - `summary`
    - `blockedBreakdown`
    - `items`
  - Used by: future next-wave create flow.
- `GET /api/campaigns/:campaignId/rotation-preview`
  - Returns:
    - `sourceCampaign`
      - `campaignId`
      - `campaignName`
      - `offerId`
      - `offerTitle`
      - `icpHypothesisId`
      - `icpHypothesisLabel`
      - `icpProfileId`
      - `icpProfileName`
    - `summary`
      - `sourceContactCount`
      - `candidateCount`
      - `eligibleCandidateContactCount`
      - `blockedCandidateContactCount`
    - `candidates[]`
      - `icpHypothesisId`
      - `hypothesisLabel`
      - `messagingAngle`
      - `offerId`
      - `offerTitle`
      - `projectName`
      - `eligibleContactCount`
      - `blockedContactCount`
      - `blockedBreakdown`
    - `contacts[]`
      - `contactId`
      - `companyId`
      - `companyName`
      - `fullName`
      - `position`
      - `recipientEmail`
      - `recipientEmailSource`
      - `sendable`
      - `exposureSummary`
      - `globalBlockedReasons[]`
      - `candidateEvaluations[]`
  - Used by: future controlled-rotation operator preview flow.
- `GET /api/projects`
  - Query params:
    - `status` (optional) – `active` | `inactive`
  - Returns: canonical project registry rows:
    - `id`, `key`, `name`, `description`, `status`
  - Used by: future launch / workspace project selectors.
- `POST /api/projects`
  - Body: `{ key, name, description?, status? }`
  - Returns: created project row.
- `PUT /api/projects/:projectId`
  - Body: `{ name?, description?, status? }`
  - Returns: updated project row.
- `GET /api/offers`
  - Query params:
    - `status` (optional) – `active` | `inactive`
  - Returns: minimal offer registry rows:
    - `id`, `project_id`, `title`, `project_name`, `description`, `status`
  - Used by: future launch / builder offer selectors.
- `POST /api/offers`
  - Body: `{ projectId?, title, projectName?, description?, status? }`
  - Returns: created offer row.
  - Used by: future operator / `Outreacher` offer-management flows.
- `PUT /api/offers/:offerId`
  - Body: `{ projectId?, title?, projectName?, description?, status? }`
  - Returns: updated offer row.
  - Used by: future operator / `Outreacher` offer-management flows.
- `GET /api/campaigns/:campaignId/companies`
  - Returns:
    - `campaign`: operator-facing campaign detail (`id`, `name`, `status`,
      `segment_id`, `segment_version`, `created_at`, `updated_at`)
    - `companies`: the companies currently bound to the campaign audience
      (base `segment_members` plus any `campaign_member_additions`, minus any
      `campaign_member_exclusions`), including:
      - `company_id`
      - `company_name`
      - `website`
      - `employee_count`
      - `region`
      - `office_qualification`
      - `company_description`
      - `company_research`
      - `contact_count`
      - `enrichment`:
        - `status` – `fresh` | `stale` | `missing`
        - `last_updated_at`
        - `provider_hint`
  - Used by: `fetchCampaignCompanies` in `web/src/apiClient.ts`,
    powering the Campaign Ops operator surface.
- `GET /api/campaigns/:campaignId/detail`
  - Returns:
    - `campaign`: operator-facing campaign detail (`id`, `name`, `status`,
      `segment_id`, `segment_version`, `created_at`, `updated_at`)
    - `segment`, `icp_profile`, `icp_hypothesis`, `offer`, `project`:
      optional campaign context for generation/execution read-model consumers
      - `project`:
        - `id`
        - `key`
        - `name`
        - `description`
        - `status`
      - `offer`:
        - `id`
        - `project_id`
        - `title`
        - `project_name`
        - `description`
        - `status`
      - `icp_profile`:
        - `id`
        - `project_id`
        - `name`
        - `description`
        - `offering_domain`
        - `company_criteria`
        - `persona_criteria`
        - `phase_outputs`
        - `learnings`
      - `icp_hypothesis`:
        - `id`
        - `icp_id`
        - `name`
        - `offer_id`
        - `status`
        - `messaging_angle`
        - `search_config`
        - `targeting_defaults`
        - `pattern_defaults`
        - `notes`
    - `companies`: the same campaign company rows as `/companies`, but each row also includes
      `composition_summary` and `employees[]` with campaign-scoped employee detail:
      - `composition_summary`:
        - `total_contacts`
        - `segment_snapshot_contacts`
        - `manual_attach_contacts`
        - `sendable_contacts`
        - `eligible_for_new_intro_contacts`
        - `blocked_no_sendable_email_contacts`
        - `blocked_bounced_contacts`
        - `blocked_unsubscribed_contacts`
        - `blocked_already_used_contacts`
        - `contacts_with_drafts`
        - `contacts_with_sent_outbound`
      - `audience_source` – `segment_snapshot` | `manual_attach`
      - `attached_at`
      - `contact_id`, `full_name`, `position`
      - `work_email`, `generic_email`
      - `recipient_email`
      - `recipient_email_source` – `work` | `generic` | `missing`
      - `sendable`
      - `block_reasons` – `no_sendable_email` | `bounced` | `unsubscribed` | `already_used`
      - `eligible_for_new_intro`
      - `draft_counts`
      - `outbound_count`, `sent_count`
      - `replied`, `reply_count`
      - `exposure_summary`:
        - `total_exposures`
        - `last_icp_hypothesis_id`
        - `last_offer_id`
        - `last_offer_title`
        - `last_sent_at`
      - `execution_exposures[]`:
        - `campaign_id`
        - `icp_profile_id`
        - `icp_hypothesis_id`
        - `offer_id`
        - `offer_title`
        - `project_name`
        - `offering_domain`
        - `offering_hash`
        - `offering_summary`
        - `first_sent_at`
        - `last_sent_at`
        - `sent_count`
        - `replied`
        - `bounced`
        - `unsubscribed`
  - Used by: `fetchCampaignDetail` in `web/src/apiClient.ts`, powering the `Employees` column in
    the Campaigns operator desk so company selection does not depend on draft presence and both the
    UI and `Outreach` can read one shared campaign-wave composition / intro-eligibility model plus
    historical execution exposure memory anchored to outbound ledger rows.
- `POST /api/campaigns/:campaignId/companies/attach`
  - Body: `{ companyIds, attachedBy?, source? }`
  - Behaviour:
    - Attaches already-processed companies into an existing campaign wave without mutating the
      source segment definition.
    - Writes campaign-scoped contact rows into `campaign_member_additions`.
    - Returns an operator-readable summary with per-company status rows.
  - Used by: future `Import -> Process -> Attach` operator workflows.
- `GET /api/campaigns/:campaignId/audit`
  - Returns:
    - `campaign`: operator-facing campaign detail (`id`, `name`, `status`,
      `segment_id`, `segment_version`, `created_at`, `updated_at`)
    - `summary`: campaign coverage counters across snapshot contacts, drafts,
      outbounds, and events, including:
      - `company_count`, `snapshot_contact_count`
      - `contacts_with_any_draft`, `contacts_with_intro_draft`, `contacts_with_bump_draft`
      - `contacts_with_sent_outbound`, `contacts_with_events`
      - `draft_count` and draft status/sendability breakdowns
      - `outbound_count` and outbound status/missing-recipient breakdowns
      - `event_count` and reply/bounce/unsubscribe breakdowns
      - anomaly counters such as
        `snapshot_contacts_without_draft_count`,
        `drafts_missing_recipient_email_count`,
        `duplicate_draft_pair_count`,
        `draft_company_mismatch_count`,
        `sent_drafts_without_outbound_count`,
        `outbounds_without_draft_count`
    - `issues`: drill-down arrays for the corresponding anomaly buckets:
      - `snapshot_contacts_without_draft`
      - `drafts_missing_recipient_email`
      - `duplicate_drafts`
      - `draft_company_mismatches`
      - `sent_drafts_without_outbound`
      - `outbounds_without_draft`
      - `outbounds_missing_recipient_email`
  - Used by: operator audit workflows, external verification scripts, and the
    Campaigns page audit panel in `web/src/components/CampaignAuditPanel.tsx`.
- `GET /api/campaigns/:campaignId/outbounds`
  - Returns:
    - `campaign`: operator-facing campaign detail (`id`, `name`, `status`,
      `segment_id`, `segment_version`, `created_at`, `updated_at`)
    - `outbounds`: campaign-scoped send ledger rows including:
      - `id`, `status`, `provider`, `provider_message_id`
      - `sender_identity`, `sent_at`, `created_at`, `error`
      - `pattern_mode`
      - `draft_id`, `draft_email_type`, `draft_status`, `subject`
      - `contact_id`, `contact_name`, `contact_position`
      - `company_id`, `company_name`, `company_website`
      - `recipient_email`, `recipient_email_source`, `recipient_email_kind`
      - `metadata`
  - Used by: `fetchCampaignOutbounds` in `web/src/apiClient.ts`,
    powering the outbound ledger section in Campaigns.
- `GET /api/campaigns/:campaignId/events`
  - Returns:
    - `campaign`: operator-facing campaign detail (`id`, `name`, `status`,
      `segment_id`, `segment_version`, `created_at`, `updated_at`)
    - `events`: campaign-scoped event ledger rows including:
      - `id`, `outbound_id`, `event_type`, `outcome_classification`
      - `provider_event_id`, `occurred_at`, `created_at`
      - `pattern_id`, `coach_prompt_id`, `payload`
      - `draft_id`, `draft_email_type`, `draft_status`, `subject`
      - `provider`, `provider_message_id`, `sender_identity`, `sent_at`
      - `recipient_email`, `recipient_email_source`, `recipient_email_kind`
      - `contact_id`, `contact_name`, `contact_position`
      - `company_id`, `company_name`, `company_website`
  - Used by: `fetchCampaignEvents` in `web/src/apiClient.ts`,
    powering the campaign event ledger in Campaigns.
- `GET /api/drafts`
  - Query params:
    - `campaignId` (optional) – filter drafts by campaign.
    - `status` (optional) – filter by draft status.
    - `includeRecipientContext` (optional, `true|false`) – when `true`,
      enriches each draft row with contact/company/recipient context for operator review.
  - Returns: draft rows including:
    - `id`, `status`, `email_type`, `subject`, `body`
    - `pattern_mode`, `variant_label`, `reviewer`
    - `contact_id`, `contact_name`, `contact_position`
    - `company_id`, `company_name`
    - `recipient_email`, `recipient_email_source`, `recipient_email_kind`, `sendable`
    - when `email_type=bump` and `includeRecipientContext=true`, backend-computed bump review/send
      visibility:
      `bump_lifecycle_state` (`generated_pending_review` | `approved_waiting_next_day` |
      `approved_sendable`), `bump_can_send_now`, `bump_send_block_reasons`, `bump_approved_at`
    - `metadata`
  - Used by: `fetchDrafts`, including the Campaigns review surface.
- `POST /api/drafts/:draftId/status`
  - Body: `{ status, reviewer?, metadata? }`.
  - Behaviour:
    - Updates a draft review status via the existing draft store.
    - Merges `metadata` into existing draft metadata instead of replacing it.
    - On `approved` / `rejected`, backend also stamps canonical review metadata so review/send
      gates do not depend on browser timestamps:
      `reviewed_at`, `reviewed_by`, and for approvals `approved_at`.
    - `Campaigns` uses this path to persist reject-review metadata such as
      `review_reason_code`, `review_reason_codes`, `review_reason_text`,
      `reviewed_at`, and `reviewed_by`.
  - Returns: updated draft row.
  - Used by: `reviewDraftStatus` in `web/src/apiClient.ts`, powering operator review in Campaigns.
- `POST /api/drafts/:draftId/content`
  - Body: `{ subject, body }`.
  - Behaviour:
    - Updates the `subject` and `body` of a draft via the draft store.
    - Returns a sparse updated draft row; UI consumers should preserve already-loaded
      contact/company/recipient context when merging the response into local state.
  - Returns: updated draft row.
  - Used by: `updateDraftContent` in `web/src/apiClient.ts`, powering inline draft edits in Campaigns.
- `POST /api/drafts/generate`
  - Body: JSON payload from `triggerDraftGenerate`, including:
    - `campaignId` (required),
    - `dryRun`, `limit`,
    - `dataQualityMode`, `interactionMode`,
    - ICP / coach prompt fields (`icpProfileId`, `icpHypothesisId`,
      `coachPromptStep`, `explicitCoachPromptId`),
    - provider/model hints.
  - Behaviour:
    - In live mode this endpoint delegates draft generation to the Outreach-owned runtime via
      `OUTREACH_GENERATE_DRAFTS_CMD`.
    - `crew_five` acts as the web adapter/bridge only; it does not run local intro generation for
      this endpoint anymore.
  - Returns: `{ generated, dryRun, gracefulUsed?, failed?, skipped?, error? }` summary.
  - Used by: `triggerDraftGenerate`.

### Segments and enrichment

- `GET /api/settings/enrichment`
  - Returns: global enrichment settings `{ version, defaultProviders, primaryCompanyProvider, primaryEmployeeProvider }`.
  - Used by: `fetchEnrichmentSettings`.
- `POST /api/settings/enrichment`
  - Body: `{ defaultProviders, primaryCompanyProvider, primaryEmployeeProvider }`.
  - Behaviour:
    - Persists global defaults and the per-entity primary providers (company vs lead).
    - Filters out providers that are not "ready" (missing API key) server-side.
    - Rejects saving if any enabled provider fails a live credential probe.
  - Used by: `saveEnrichmentSettings`.
- `GET /api/segments`
  - Returns: list of segments, including derived counts:
    - `company_count`, `employee_count`, `total_count` computed from each segment’s `filter_definition` via
      the same allowlisted filter engine used by `POST /api/filters/preview`.
  - Used by: `fetchSegments`.
- `POST /api/segments/snapshot`
  - Body: `{ segmentId, finalize?, allowEmpty?, maxContacts? }`.
  - Returns: snapshot metadata, including `version` and `count`.
  - Used by: `snapshotSegment`.
- `POST /api/enrich/segment`
  - Body: `{ segmentId, adapter?, limit?, dryRun?, runNow? }`.
  - Behaviour:
    - Enqueues enrichment job for a segment.
    - If `runNow` and a run-once helper is configured, returns
      `{ status: 'completed', jobId, summary }`, otherwise
      `{ status: 'queued', jobId }`.
  - Used by: `enqueueSegmentEnrichment`.
- `POST /api/enrich/segment/multi`
  - Body: `{ segmentId, providers, limit?, dryRun?, runNow? }`.
  - Behaviour:
    - Runs the same enrichment flow across multiple providers (sequentially), returning a
      per-provider result list.
  - Used by: `enqueueSegmentEnrichmentMulti`.
- `GET /api/enrich/status`
  - Query params: `segmentId` (required).
  - Returns: enrichment job status `{ status, jobId, ... }`.
  - Used by: `fetchEnrichmentStatus`.

### Smartlead send and campaigns

- `POST /api/smartlead/send`
  - Body: `{ campaignId, smartleadCampaignId, dryRun?, batchSize?, step?, variantLabel? }`.
  - Behaviour:
    - Prepares a Smartlead campaign using the direct Smartlead API (no MCP server):
      - Pulls contacts from the selected internal campaign audience (base `segment_members` plus
        `campaign_member_additions`) and maps them into Smartlead leads (requires
        `employees.work_email`).
      - Syncs a single email sequence step using the first generated draft (subject/body).
      - Stores `smartlead_campaign_id` and `smartlead_last_prepared_at` under `campaigns.metadata`.
    - In `dryRun=true`, returns counts only and does not call Smartlead.
    - Returns: `{ leadsPrepared, leadsPushed, sequencesPrepared, sequencesSynced, skippedContactsNoEmail, ... }`.
  - Used by: `triggerSmartleadSend`, `triggerSmartleadPreview` (Send step preview), and `SendPage`.
- `GET /api/smartlead/campaigns`
  - Returns: Smartlead campaign rows `{ id, name, status }`.
  - Used by: `fetchSmartleadCampaigns`.
- `POST /api/smartlead/campaigns`
  - Body: `{ name, dryRun? }`.
  - Behaviour:
    - In dry-run mode, returns a fake campaign object.
    - When `dryRun=false`, calls Smartlead client and returns created
      campaign or an error.
  - Used by: `createSmartleadCampaign`.

### Companies and contacts

- `GET /api/companies`
  - Query params:
    - `segment` (optional) – segment label.
    - `limit` (optional) – max rows to return.
  - Returns: normalized company rows (segment, office quantification,
    registration date, outreach status).
  - Used by: `fetchCompanies`.
- `GET /api/contacts`
  - Query params:
    - `companyIds` (optional, comma-separated ids),
    - `limit` (optional).
  - Returns: contact rows (company id, name, title, email, persona).
  - Used by: `fetchContacts`.

### ICP profiles, hypotheses, coach, and discovery

- `GET /api/icp/profiles`
  - Returns: ICP profiles.
  - Used by: `fetchIcpProfiles`.
- `POST /api/icp/profiles`
  - Body: `{ name, projectId?, description? }`.
  - Returns: created ICP profile.
  - Used by: `createIcpProfile`.
- `GET /api/icp/hypotheses`
  - Query params:
    - `icpProfileId` (optional),
    - `segmentId` (optional).
  - Returns: ICP hypotheses for the given filters, now including operational preset fields:
    - `offer_id`
    - `targeting_defaults`
    - `messaging_angle`
    - `pattern_defaults`
    - `notes`
  - Used by: `fetchIcpHypotheses`.
- `POST /api/icp/hypotheses`
  - Body: `{ icpProfileId, hypothesisLabel, offerId?, segmentId?, searchConfig?, targetingDefaults?, messagingAngle?, patternDefaults?, notes? }`.
  - Returns: created hypothesis.
  - Used by: `createIcpHypothesis`.
- `POST /api/coach/icp`
  - Body: ICP profile creation brief `{ name, description?, promptId? }`.
  - Returns: `{ jobId?, profile: { id, name?, description? } }`.
  - Used by: `generateIcpProfileViaCoach`.
- `POST /api/coach/hypothesis`
  - Body: `{ icpProfileId, hypothesisLabel?, searchConfig?, promptId? }`.
  - Returns: `{ jobId?, hypothesis: { id, icp_id?, hypothesis_label? } }`.
  - Used by: `generateHypothesisViaCoach`.
- `POST /api/icp/discovery`
  - Body: `{ icpProfileId, icpHypothesisId?, limit? }`.
  - Returns: `{ jobId?, runId, provider, status }` (Exa-powered discovery).
  - Used by: `triggerIcpDiscovery`.
- `GET /api/icp/discovery/candidates`
  - Query params:
    - `runId` (required),
    - `icpProfileId?`, `icpHypothesisId?`.
  - Returns: discovery candidate DTOs
    (`id`, `name`, `domain`, `url`, `country`, `size`, `confidence`).
  - Used by: `fetchIcpDiscoveryCandidates`.
- `POST /api/icp/discovery/promote`
  - Body: `{ runId, candidateIds, segmentId }`.
  - Returns: `{ promotedCount }` after moving candidates into companies
    and segment members.
  - Used by: `promoteIcpDiscoveryCandidates`.

### Analytics, events, and patterns

- `GET /api/events`
  - Query params: `since?`, `limit?`.
  - Returns: email events (`id`, `event_type`, `occurred_at`).
  - Used by: `fetchEvents`.
- `GET /api/reply-patterns`
  - Query params: `since?`, `topN?`.
  - Returns: reply patterns (`reply_label`, `count`).
  - Used by: `fetchReplyPatterns`.
- `GET /api/dashboard/overview`
  - Returns one canonical dashboard payload for the new `Home` surface:
    - `campaigns.total`
    - `campaigns.active`
    - `campaigns.byStatus`
    - `pending.draftsOnReview`
    - `pending.inboxReplies` (currently unhandled canonical reply events)
    - `pending.staleEnrichment`
    - `pending.missingEnrichment`
    - `recentActivity[]` from campaigns, drafts, and reply events
  - Used by: future `Home / Dashboard` UI to avoid stitching multiple endpoints client-side.
- `GET /api/analytics/summary`
  - Query params:
    - `groupBy?` – `icp` | `segment` | `pattern` | `rejection_reason` | `offering` | `offer`,
    - `since?` – ISO timestamp.
  - Returns: aggregated metrics per group (delivered, opened, replied,
    positive replies).
  - Notes:
    - `offering` groups by legacy draft metadata `offering_domain`
    - `offer` groups by canonical `campaign.offer_id` plus offer registry labels
  - Used by: `fetchAnalyticsSummary`.
- `GET /api/analytics/rejection-reasons`
  - Query params: `since?` – ISO timestamp.
  - Returns grouped draft-review rejection analytics derived from `drafts.metadata`:
    - `total_rejected`
    - `by_reason`
    - `by_pattern`
    - `by_pattern_and_reason`
    - `by_campaign`
    - `by_email_type`
    - `by_icp_profile`
    - `by_icp_hypothesis`
  - Used by: rejection analytics / review learnings UI surfaces.
- `GET /api/analytics/optimize`
  - Query params: `since?`.
  - Returns: `{ suggestions, simSummary? }` for prompt/pattern tuning.
  - Used by: `fetchAnalyticsOptimize`.

### Import / Post-Import Processing

- `POST /api/company-import/preview`
  - Body: `{ records }` where `records` is an array of canonical import rows.
  - Returns:
    - `mode`
    - `summary`
    - `items`
  - Used by: `ImportWorkspacePage` preview flow.
- `POST /api/company-import/apply`
  - Body: `{ records }` where `records` is an array of canonical import rows.
  - Returns:
    - `mode`
    - `summary`
    - `items`
    - `applied[]` with actual persisted company ids per submitted row:
      - `index`
      - `company_id`
      - `action`
  - Used by: `ImportWorkspacePage` apply flow and follow-up processing handoff.
- `POST /api/company-import/process`
  - Starts async post-import company processing through Outreacher.
  - Body:
```json
{
  "companyIds": ["uuid-1", "uuid-2"],
  "mode": "full",
  "source": "xlsx-import"
}
```
  - Response:
    - `jobId`
    - `status`
    - `mode`
    - `totalCompanies`
    - `batchSize`
    - `source`
  - Runtime:
    - validates company ids exist
    - chunks work by recommended batch size (`10`)
    - uses local command bridge `OUTREACH_PROCESS_COMPANY_CMD`
    - rejects hard max batches `>20`
  - Used by: future `Import -> Apply + process with Outreacher` UI.
- `GET /api/company-import/process/:jobId`
  - Returns async processing job status:
    - `jobId`
    - `status`
    - `mode`
    - `totalCompanies`
    - `batchSize`
    - `processedCompanies`
    - `completedCompanies`
    - `failedCompanies`
    - `skippedCompanies`
    - `results[]`
    - `errors[]`
  - Used by: future import processing progress UI.

### Mailboxes / Sender Planning

- `POST /api/campaigns/launch-preview`
  - Returns the canonical launch preview for a proposed campaign payload.
  - Request body:
```json
{
  "name": "Q2 Negotiation Rooms",
  "segmentId": "seg-uuid",
  "segmentVersion": 1,
  "projectId": "project-1",
  "offerId": "offer-1",
  "snapshotMode": "reuse",
  "sendTimezone": "Europe/Moscow",
  "sendWindowStartHour": 9,
  "sendWindowEndHour": 17,
  "sendWeekdaysOnly": true,
  "senderPlan": {
    "assignments": [
      {
        "mailboxAccountId": "mbox-1",
        "senderIdentity": "sales@voicexpert.ru",
        "provider": "imap_mcp"
      }
    ]
  }
}
```
  - Response includes:
    - `campaign`
    - `segment.snapshotStatus`
    - `summary.companyCount`
    - `summary.contactCount`
    - `summary.sendableContactCount`
    - `summary.freshCompanyCount`
    - `summary.staleCompanyCount`
    - `summary.missingCompanyCount`
    - `summary.senderAssignmentCount`
    - `senderPlan.domains`
    - `sendPolicy`
    - `warnings[]`
  - Used by: future `Builder V2` / `Campaigns` launch wizard surfaces.
- `POST /api/campaigns/launch`
  - Performs the canonical launch mutation.
  - Request body matches `launch-preview`, plus optional `createdBy`.
  - Response includes:
    - `campaign`
    - `segment.snapshot`
    - `senderPlan.assignments`
    - `senderPlan.summary`
    - `sendPolicy`
  - Used by: future `Builder V2` / `Campaigns` launch wizard surfaces and `Outreacher /launch-campaign`.
- `GET /api/mailboxes`
  - Returns ledger-derived **observed** mailbox inventory from `email_outbound`.
- `GET /api/campaigns/:id/auto-send`
  - Returns canonical campaign auto-send flags:
    - `campaignId`
    - `campaignName`
    - `campaignStatus`
    - `autoSendIntro`
    - `autoSendBump`
    - `bumpMinDaysSinceIntro`
    - `updatedAt`
  - Used by: future Campaigns / Builder V2 auto-send controls.
- `PUT /api/campaigns/:id/auto-send`
  - Body:
    - `autoSendIntro?`
    - `autoSendBump?`
    - `bumpMinDaysSinceIntro?`
  - Validation:
    - body must be an object
    - at least one field must be provided
    - `bumpMinDaysSinceIntro` must be an integer `>= 1`
  - Returns: the updated canonical auto-send settings view.
  - Used by: future Campaigns / Builder V2 auto-send controls.
- `GET /api/campaigns/:id/send-policy`
  - Returns canonical campaign-local send calendar policy:
    - `campaignId`
    - `campaignName`
    - `campaignStatus`
    - `sendTimezone`
    - `sendWindowStartHour`
    - `sendWindowEndHour`
    - `sendWeekdaysOnly`
    - `updatedAt`
  - Used by: future Campaigns / Builder V2 send-calendar controls.
- `PUT /api/campaigns/:id/send-policy`
  - Body:
    - `sendTimezone?`
    - `sendWindowStartHour?`
    - `sendWindowEndHour?`
    - `sendWeekdaysOnly?`
  - Validation:
    - body must be an object
    - at least one field must be provided
    - `sendTimezone` must be a valid IANA timezone
    - `sendWindowStartHour` must be an integer `0..23`
    - `sendWindowEndHour` must be an integer `1..24`
    - `sendWindowEndHour` must be greater than `sendWindowStartHour`
    - `sendWeekdaysOnly` must be a boolean when provided
  - Returns: the updated canonical send policy view.
  - Used by: future Campaigns / Builder V2 send-calendar controls.
- `GET /api/campaigns/:id/mailbox-summary`
  - Returns observed mailbox consistency for a campaign.
- `GET /api/campaigns/:id/mailbox-assignment`
  - Returns **planned** sender identities for a campaign from `campaign_mailbox_assignments`.
  - Response includes assignment rows plus summary counts:
    - `assignmentCount`
    - `mailboxAccountCount`
    - `senderIdentityCount`
    - `domainCount`
    - `domains`
- `PUT /api/campaigns/:id/mailbox-assignment`
  - Replaces the full planned sender set for a campaign.
  - Request body:
```json
{
  "source": "outreacher",
  "assignments": [
    {
      "mailboxAccountId": "mbox-1",
      "senderIdentity": "sales@voicexpert.ru",
      "provider": "imap_mcp",
      "metadata": null
    }
  ]
}
```
  - Used by: mailbox planning / pre-send sender assignment flows.
- `GET /api/campaigns/:id/send-preflight`
  - Returns the canonical send-readiness view for a campaign.
  - Response includes:
    - `readyToSend`
    - `blockers[]`
      - possible blocker codes include:
        - `no_sender_assignment`
        - `draft_not_approved`
        - `missing_recipient_email`
        - `suppressed_contact`
        - `no_sendable_drafts`
        - `campaign_paused`
    - `summary.mailboxAssignmentCount`
    - `summary.draftCount`
    - `summary.approvedDraftCount`
    - `summary.generatedDraftCount`
    - `summary.rejectedDraftCount`
    - `summary.sentDraftCount`
    - `summary.sendableApprovedDraftCount`
    - `summary.approvedMissingRecipientEmailCount`
    - `summary.approvedSuppressedContactCount`
    - `senderPlan.assignmentCount`
    - `senderPlan.domains`
  - Behaviour:
    - uses canonical recipient resolution from `employees.work_email` / `generic_email`
    - blocks approved drafts that target bounced / unsubscribed / complaint contacts
    - blocks repeated intro sends for already-used contacts
  - Used by: `CampaignSendPreflightCard` in `Campaigns` / operator surfaces.
- `POST /api/campaigns/:id/send`
  - Body:
    - `reason?`
      - `auto_send_intro`
      - `auto_send_bump`
      - `auto_send_mixed`
    - `batchLimit?`
  - Defaults:
    - `reason = auto_send_mixed`
  - Returns:
    - direct `crew_five` execution result when direct transport is configured:
      - `accepted`
      - `source`
      - `requestedAt`
      - `campaignId`
      - `reason`
      - `provider`
      - `selectedCount`
      - `sentCount`
      - `failedCount`
      - `skippedCount`
      - `results[]`
    - or the legacy `Outreach` bridge payload when only the old send bridge is configured
  - Used by: `triggerCampaignSendExecution` in `web/src/apiClient.ts`, powering the manual
    `Send now` action in `CampaignSendPreflightCard`.

### Inbox

- `GET /api/inbox/messages`
  - Query params: `status?`, `limit?` (currently ignored by the legacy stub
    implementation).
  - Returns: `{ messages: [], total: 0 }`.
  - Used by: legacy inbox surfaces only.
- `GET /api/inbox/replies`
  - Query params:
    - `campaignId?`
    - `replyLabel?`
    - `handled?` (`true` or `false`)
    - `linkage?` (`linked` | `unlinked` | `all`)
      - `linked`: only events linked to a campaign (the underlying outbound has `campaign_id != null`)
      - `unlinked`: only events not linked to any campaign (the underlying outbound has `campaign_id is null`, e.g. inbox placeholders)
      - `all`: default server behaviour (no linkage filtering)
    - `limit?`
  - Returns canonical reply events joined with outbound/draft/contact/company
    context.
  - Each reply includes:
    - `handled`
    - `handled_at`
    - `handled_by`
  - Used by: `Inbox V2`.
- `POST /api/inbox/poll`
  - Triggers inbox polling to ingest obvious replies into canonical `email_events`.
  - Prefers direct `imap-mcp` polling when configured via:
    - `IMAP_MCP_SERVER_ROOT`
    - `IMAP_MCP_HOME`
    - optional `IMAP_MCP_SERVER_COMMAND`
    - optional `IMAP_MCP_SERVER_ENTRY`
  - Falls back to the legacy Outreach-owned polling trigger when direct transport is not configured:
    - external HTTP trigger via `OUTREACH_PROCESS_REPLIES_URL`
    - fallback base URL via `OUTREACH_API_BASE` -> `/process-replies`
    - local command bridge via `OUTREACH_PROCESS_REPLIES_CMD`
  - Returns `202` on accepted trigger, `501` when polling is not configured.
  - Reliability:
    - Direct `imap-mcp` transport applies per-mailbox backoff after repeated transient connection
      failures (e.g. `ECONNRESET`, MCP timeouts). During backoff, polling returns `accepted=true`
      but may increment `skipped` (instead of `failed`) for the affected mailbox accounts.
  - Used by: `Inbox V2`.
- `POST /api/inbox/replies/:id/handled`
  - Marks a canonical inbox reply event as handled.
  - Request body may include `handledBy`.
  - Returns `{ id, handled, handled_at, handled_by }`.
- `POST /api/inbox/replies/:id/unhandled`
  - Clears handled state for a canonical inbox reply event.
  - Returns `{ id, handled, handled_at, handled_by }`.

### Prompt registry

- `GET /api/prompt-registry`
  - Query params: `step?` – optional filter
    (`icp_profile`, `icp_hypothesis`, `draft`).
  - Returns: prompt registry rows with `is_active` flag injected.
  - Used by: `fetchPromptRegistry`.
- `POST /api/prompt-registry`
  - Body: prompt entry payload
    (`id`, `step`, `version?`, `description?`, `rollout_status?`,
    `prompt_text?`).
  - Returns: created prompt entry.
  - Used by: `createPromptRegistryEntry`.
- `GET /api/prompt-registry/active`
  - Query params: `step` (required).
  - Returns: `{ step, coach_prompt_id }`, with `coach_prompt_id` nullable.
  - Used by: `fetchActivePrompt`.
- `POST /api/prompt-registry/active`
  - Body: `{ step, coach_prompt_id }`.
  - Side effect: demotes all prompts for the step to `pilot`, then sets
    the given prompt to `active`.
  - Returns: `{ ok: true }`.
  - Used by: `setActivePrompt`.

### SIM

- `POST /api/sim`
  - Body: `{ segmentId?, draftIds?, mode? }`.
  - Behaviour:
    - Requires either `segmentId` or non-empty `draftIds`.
    - Returns a SIM job stub (status + job id) in current stubbed
      implementation.
  - Used by: `createSimJob`.

### Meta, services, and LLM models

- `GET /api/meta`
  - Returns: `{ mode, apiBase, smartleadReady, supabaseReady }`.
  - Used by: `fetchMeta` to drive the top-level status bar in
    `web/src/App.tsx` and provide adapter context for workspace pages.
- `GET /api/services`
  - Returns: `{ services: ServiceConfig[] }` where each service has
    `{ name, category, status, hasApiKey, config?, lastChecked?, errorMessage? }`.
  - Used by: `fetchServices` to power the services/adapter panel in
    `PipelineWorkspaceWithSidebar`.
- `GET /api/llm/models`
  - Query params: `provider` – `openai` | `anthropic` (required).
  - Returns: `LlmModelInfo[]` (id, provider, ownership, context window),
    or a 400/501 error for unsupported or unconfigured providers.
  - Used by: `fetchLlmModels` in `SettingsPage` and
    `PipelineWorkspaceWithSidebar` to populate model dropdowns.

---

## Screens → endpoint usage

This section maps each Web UI screen to the endpoints it calls via
`web/src/apiClient.ts`.

### ICP & Coach tab – `IcpDiscoveryPage`

Component: `web/src/pages/IcpDiscoveryPage.tsx`

- Segment / campaign context:
  - `GET /api/segments` – load available segments.
  - `GET /api/campaigns` – load campaigns for discovery context.
- ICP core:
  - `GET /api/icp/profiles` – list ICP profiles.
  - `POST /api/icp/profiles` – create ICP profile.
  - `GET /api/icp/hypotheses` – list hypotheses (per profile).
  - `POST /api/icp/hypotheses` – create hypothesis.
- Coach flows:
  - `POST /api/coach/icp` – generate ICP profile via coach.
  - `POST /api/coach/hypothesis` – generate hypothesis via coach.
- Discovery and promotion:
  - `POST /api/icp/discovery` – start Exa discovery run.
  - `GET /api/icp/discovery/candidates` – load candidates for a run.
  - `POST /api/icp/discovery/promote` – promote approved candidates into
    `companies` / `segment_members`.

### Segments & Enrichment tab – `WorkflowZeroPage`

Component: `web/src/pages/WorkflowZeroPage.tsx`

- Segments and snapshots:
  - `GET /api/segments` – list segments and versions.
  - `POST /api/segments/snapshot` – create/finalize segment snapshot v1.
  - `GET /api/enrich/status` – show last enrichment status for the
    selected segment.
- Enrichment:
  - `POST /api/enrich/segment` – enqueue (and optionally run) segment
    enrichment.
- Companies and contacts:
  - `GET /api/companies` – fetch companies (filtered by segment label).
  - `GET /api/contacts` – fetch contacts for selected company ids.
- Campaign + draft generation:
  - `GET /api/campaigns` – list campaigns tied to segments.
  - `POST /api/drafts/generate` – trigger Outreach draft generation for the selected campaign via
    the web adapter bridge.
- Smartlead integration:
  - `GET /api/smartlead/campaigns` – available Smartlead campaigns.
  - `POST /api/smartlead/campaigns` – create Smartlead campaign (with
    optional dry-run).
  - `POST /api/smartlead/send` – preview Smartlead send (mock send).
- Prompt registry:
  - `GET /api/prompt-registry` – load draft prompts for the `draft` step
    (used in draft generation).

### Analytics tab – `EventsPage`

Component: `web/src/pages/EventsPage.tsx`

- Event and pattern feeds:
  - `GET /api/events` – list recent email events.
  - `GET /api/reply-patterns` – list reply patterns since a given time.
- Analytics:
  - `GET /api/analytics/summary` – AN.v2 summary grouped by ICP, Segment,
    or Pattern.
  - `GET /api/analytics/optimize` – optimization suggestions and SIM
    summary.
- Prompt registry:
  - `GET /api/prompt-registry` – list all prompt entries (for context in
    analytics).

### Prompt Registry tab – `PromptRegistryPage`

Component: `web/src/pages/PromptRegistryPage.tsx`

- Registry browse:
  - `GET /api/prompt-registry` – list entries for the selected step.
- Registry mutations:
  - `POST /api/prompt-registry` – create new prompt entry.
  - `POST /api/prompt-registry/active` – set active prompt for a step.
- Active prompt lookup:
  - `GET /api/prompt-registry/active` – used indirectly via
    `setActivePrompt` tests and flows.

### SIM tab – `SimPage`

Component: `web/src/pages/SimPage.tsx`

- SIM job stub:
  - `POST /api/sim` – create a SIM job stub for a given segment and mode
    (`full_sim` / `offer_roast`).

### Settings tab – `SettingsPage`

Component: `web/src/pages/SettingsPage.tsx`

- LLM models:
  - `GET /api/llm/models` – loaded via `fetchLlmModels` for `openai` and
    `anthropic` to populate per-task model selection, falling back to the
    static catalog when unavailable.

### Shared shell – `App`

Component: `web/src/App.tsx`

- Adapter meta:
  - `GET /api/meta` – loaded via `fetchMeta` to display API base, mode,
    Supabase readiness, and Smartlead readiness.

### Pipeline workspace – `PipelineWorkspaceWithSidebar`

Component: `web/src/pages/PipelineWorkspaceWithSidebar.tsx`

- Services and adapters:
  - `GET /api/services` – loaded via `fetchServices` to show health of
    Supabase, LLMs, Smartlead, and enrichment providers.
  - `GET /api/llm/models` – loaded via `fetchLlmModels` for OpenAI and
    Anthropic to enrich model selection for different tasks.
- Inbox:
  - `GET /api/inbox/messages` – loaded via `fetchInboxMessages` with
    `status` filters (`unread`, `starred`, `all`) to back the Inbox
    sidebar view (currently stubbed on the server).
- ICP, segments, campaigns, prompts, and analytics:
  - Reuses the same endpoints documented in the `ICP & Coach`,
    `Segments & Enrichment`, `Prompt Registry`, and `Analytics` sections
    (e.g. `/api/icp/*`, `/api/segments*`, `/api/enrich/*`,
    `/api/prompt-registry*`, `/api/analytics/*`, `/api/smartlead/*`,
    `/api/drafts/*`), orchestrated within a single multi-pane workspace.

### Utility / legacy pages

These components are currently not mounted directly in the main tab bar
but are kept for focused workflows and tests.

- `CampaignsPage` (`web/src/pages/CampaignsPage.tsx`)
  - `GET /api/campaigns` – load campaigns.
  - `POST /api/drafts/generate` – generate drafts per campaign.
  - `POST /api/smartlead/send` – trigger Smartlead send (mock) for
    campaign-level flows.
- `DraftsPage` (`web/src/pages/DraftsPage.tsx`)
  - `GET /api/campaigns` – load campaigns.
  - `GET /api/drafts` – load drafts for selected campaign.
  - `POST /api/drafts/generate` – regenerate drafts for a campaign.
- `SendPage` (`web/src/pages/SendPage.tsx`)
  - `POST /api/smartlead/send` – run Smartlead send (mock) for approved
    drafts, with dry-run and batch size controls.
