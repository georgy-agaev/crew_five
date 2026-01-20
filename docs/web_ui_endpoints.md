# Web UI Endpoint Map

> Version: v0.8 (2026-01-20)
>
> This document catalogues the HTTP endpoints exposed by the web adapter
> (`src/web/server.ts`) and shows how the React Web UI (`web/src`) uses them.
> It complements `docs/web_ui_requirements.md`, which remains the
> authoritative source for Web UI behaviour and navigation.

## Overview

- Base URL is `VITE_API_BASE` (defaults to `/api` in `web/src/apiClient.ts`).
- All endpoints live under this base and are implemented in
  `src/web/server.ts` via the `dispatch` function.
- The React app calls these endpoints exclusively through
  `web/src/apiClient.ts`.

---

## Endpoint catalog (by area)

### Campaigns and drafts

- `GET /api/campaigns`
  - Returns: list of campaigns (`id`, `name`, `status`, `segment_id`,
    `segment_version`).
  - Used by: `fetchCampaigns` in `web/src/apiClient.ts`.
- `POST /api/campaigns`
  - Body: `{ name, segmentId, segmentVersion, createdBy? }`.
  - Returns: created campaign row (includes `id`, `name`, `segment_id`, `segment_version`).
  - Used by: `createCampaign` in `web/src/apiClient.ts` (Pipeline Draft step inline creation).
- `GET /api/drafts`
  - Query params:
    - `campaignId` (optional) – filter drafts by campaign.
    - `status` (optional) – filter by draft status (e.g. `pending`).
  - Returns: draft rows (`id`, `status`, `contact`, `metadata`).
  - Used by: `fetchDrafts`.
- `POST /api/drafts/generate`
  - Body: JSON payload from `triggerDraftGenerate`, including:
    - `campaignId` (required),
    - `dryRun`, `limit`,
    - `dataQualityMode`, `interactionMode`,
    - ICP / coach prompt fields (`icpProfileId`, `icpHypothesisId`,
      `coachPromptStep`, `explicitCoachPromptId`),
    - provider/model hints.
  - Returns: `{ generated, dryRun, gracefulUsed? }` summary.
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
      - Pulls contacts from the selected internal campaign’s `segment_members` and maps them into
        Smartlead leads (requires `employees.work_email`).
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
  - Body: `{ name, description? }`.
  - Returns: created ICP profile.
  - Used by: `createIcpProfile`.
- `GET /api/icp/hypotheses`
  - Query params:
    - `icpProfileId` (optional),
    - `segmentId` (optional).
  - Returns: ICP hypotheses for the given filters.
  - Used by: `fetchIcpHypotheses`.
- `POST /api/icp/hypotheses`
  - Body: `{ icpProfileId, hypothesisLabel, segmentId?, searchConfig? }`.
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
- `GET /api/analytics/summary`
  - Query params:
    - `groupBy?` – `icp` | `segment` | `pattern`,
    - `since?` – ISO timestamp.
  - Returns: aggregated metrics per group (delivered, opened, replied,
    positive replies).
  - Used by: `fetchAnalyticsSummary`.
- `GET /api/analytics/optimize`
  - Query params: `since?`.
  - Returns: `{ suggestions, simSummary? }` for prompt/pattern tuning.
  - Used by: `fetchAnalyticsOptimize`.

### Inbox (stub)

- `GET /api/inbox/messages`
  - Query params: `status?`, `limit?` (currently ignored by the stub
    implementation).
  - Returns: `{ messages: [], total: 0 }` in the current stub; structure
    is compatible with `InboxMessage` in `web/src/apiClient.ts`.
  - Used by: `fetchInboxMessages`, primarily in
    `PipelineWorkspaceWithSidebar` for the Inbox view.

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
  - `POST /api/drafts/generate` – generate drafts for the selected
    campaign and prompt.
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
