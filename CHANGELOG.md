# Changelog

All notable changes to this project will be documented in this file.

## [0.2.47] - 2026-03-22
### Added
- Added explicit repository licensing under Apache License 2.0:
  - root [LICENSE](/Users/georgyagaev/crew_five/LICENSE)
  - `license: "Apache-2.0"` in [package.json](/Users/georgyagaev/crew_five/package.json)
    and [web/package.json](/Users/georgyagaev/crew_five/web/package.json)
  - licensing section in [README.md](/Users/georgyagaev/crew_five/README.md)
### Fixed
- Made `scan:ast-grep` self-contained via `pnpm dlx @ast-grep/cli` so GitHub Actions security checks no longer depend on a globally installed `ast-grep` binary.

## [0.2.46] - 2026-03-22
### Fixed
- Rotation preview no longer falls back to a generic `Server error` for invalid source campaigns.
- Added a canonical domain guard requiring a real sent source wave for rotation preview:
  - status in `sending | paused | complete`
  - at least one existing execution exposure, sent outbound, or sent draft
- Rotation domain errors now return `400` from the web adapter instead of `500`.
- Web API client preserves known rotation guard messages instead of collapsing them into the generic
  `Invalid request` validation text.
### Docs
- Added session log
  [2026-03-22_17_rotation_preview_invalid_source_guard.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-22_17_rotation_preview_invalid_source_guard.md).

## [0.2.45] - 2026-03-22
### Added
- Multi-project foundations Web UI:
  - Project picker + inline create in launch drawer (key + name)
  - `projectId` passed through launch flow
  - Project shown in Campaigns context (name + key)
  - API client: `fetchProjects()`, `createProject()`, `ProjectRecord` type
  - `project_id` added to `Campaign` type, `project` to `CampaignDetailView`

## [0.2.44] - 2026-03-22
### Fixed
- Fixed live `next-wave-preview` / `rotation-preview` regressions after multi-project foundations.
- `campaign detail` and `campaign next-wave` preview paths now load campaign audience via
  `listCampaignAudience(..., { includeSnapshot: false })` to avoid snapshot-heavy
  `UND_ERR_HEADERS_OVERFLOW` failures in preview/read-model endpoints.
- Fixed `Campaigns` live operator-desk regressions by making `listCampaignCompanies()` use
  snapshot-light audience loading and by removing the live dependency on `employees.company_name`
  from `campaignAudit`, with batched employee lookups for large campaigns.
- Hardened Builder V2 `Next wave` / `Rotation` preview paths for large campaigns by removing
  unnecessary snapshot loading from target-segment evaluation and batching broad employee /
  outbound / exposure lookups.
- Clarified that `campaigns.project_id` is backed by the existing migration
  [20260322012000_add_projects_and_project_links.sql](/Users/georgyagaev/crew_five/supabase/migrations/20260322012000_add_projects_and_project_links.sql)
  and requires `supabase db push`, rather than a new schema patch.
### Docs
- Updated bug task
  [backend_fix_next_wave_and_rotation_preview.md](/Users/georgyagaev/crew_five/docs/tasks/backend_fix_next_wave_and_rotation_preview.md)
  and added session log
  [2026-03-22_10_next_wave_rotation_preview_fix.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-22_10_next_wave_rotation_preview_fix.md).
- Added live Campaigns follow-up log
  [2026-03-22_11_campaigns_companies_audit_live_fix.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-22_11_campaigns_companies_audit_live_fix.md).
- Added Builder V2 hardening log
  [2026-03-22_12_next_wave_rotation_large_campaign_hardening.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-22_12_next_wave_rotation_large_campaign_hardening.md).
### Docs
- Added consolidated finish-line handoffs for frontend, Outreach, and shared E2E validation:
  [claude_stage_closeout_handoff.md](/Users/georgyagaev/crew_five/docs/tasks/claude_stage_closeout_handoff.md),
  [Outreacher_stage_closeout_handoff.md](/Users/georgyagaev/crew_five/docs/Outreacher_stage_closeout_handoff.md),
  [stage_e2e_closeout_checklist.md](/Users/georgyagaev/crew_five/docs/tasks/stage_e2e_closeout_checklist.md),
  and session note
  [2026-03-22_13_stage_closeout_handoffs.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-22_13_stage_closeout_handoffs.md).
- Added legacy pipeline deletion assessment
  [legacy_pipeline_web_ui_deletion_assessment.md](/Users/georgyagaev/crew_five/docs/tasks/legacy_pipeline_web_ui_deletion_assessment.md)
  and session note
  [2026-03-22_14_legacy_pipeline_deletion_assessment.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-22_14_legacy_pipeline_deletion_assessment.md).
### Changed
- Switched the main Web UI entry from implicit legacy `pipeline` to `home`, while keeping
  `?view=pipeline` available as an explicit secondary route.
- Added a secondary Legacy Pipeline link on the Home surface and updated routing/frontend tests.
- Added session note
  [2026-03-22_15_home_as_primary_entry.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-22_15_home_as_primary_entry.md).

## [0.2.43] - 2026-03-22
### Added
- Multi-project foundations backend:
  - canonical `projects` registry service in
    [projects.ts](/Users/georgyagaev/crew_five/src/services/projects.ts)
  - migration
    [20260322012000_add_projects_and_project_links.sql](/Users/georgyagaev/crew_five/supabase/migrations/20260322012000_add_projects_and_project_links.sql)
  - CLI commands `project:list`, `project:create`, `project:update`
  - web routes `GET/POST /api/projects` and `PUT /api/projects/:projectId`
- Project-aware public surfaces:
  - `icp:create` / web ICP create accept `projectId`
  - offers accept `projectId`
  - raw `campaign:create` accepts `projectId`
  - live campaign list now includes `project_id`
- Project consistency guards across ICP / hypothesis / offer / campaign launch:
  - `ICP_HYPOTHESIS_OFFER_PROJECT_MISMATCH`
  - `CAMPAIGN_PROJECT_MISMATCH`
### Docs
- Added backend task
  [multi_project_foundations_backend.md](/Users/georgyagaev/crew_five/docs/tasks/multi_project_foundations_backend.md),
  frontend task
  [multi_project_foundations_web_ui.md](/Users/georgyagaev/crew_five/docs/tasks/multi_project_foundations_web_ui.md),
  Outreach handoff
  [Outreacher_multi_project_foundations_handoff.md](/Users/georgyagaev/crew_five/docs/Outreacher_multi_project_foundations_handoff.md),
  and session log
  [2026-03-22_9_multi_project_foundations_backend.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-22_9_multi_project_foundations_backend.md).
- Updated
  [docs/web_ui_endpoints.md](/Users/georgyagaev/crew_five/docs/web_ui_endpoints.md),
  [docs/Outreach_crew_five_cli_contract.md](/Users/georgyagaev/crew_five/docs/Outreach_crew_five_cli_contract.md),
  [docs/Database_Description.md](/Users/georgyagaev/crew_five/docs/Database_Description.md),
  and [docs/sessions/roadmap.md](/Users/georgyagaev/crew_five/docs/sessions/roadmap.md).

## [0.2.42] - 2026-03-22
### Added
- Rotation preview Web UI: `CampaignRotationPreviewDrawer` with source campaign context,
  candidate rows (offer + hypothesis + messaging angle, kept separate), eligible/blocked counts,
  blocked breakdown per candidate with canonical reason labels.
- "Rotation" button in Campaigns and Builder V2 headers.
- API client: `fetchRotationPreview()`, `RotationPreviewResult`, `RotationPreviewCandidate`.
- 6 tests: closed, preview, candidate display, blocked breakdown, error, Russian.

## [0.2.41] - 2026-03-22
### Added
- Controlled rotation groundwork backend:
  - [campaignRotation.ts](/Users/georgyagaev/crew_five/src/services/campaignRotation.ts)
  - CLI command `campaign:rotation:preview`
  - Web route `GET /api/campaigns/:campaignId/rotation-preview`
- Rotation preview now evaluates candidate hypotheses under the same ICP profile and exposes:
  - source campaign / offer / hypothesis / ICP context
  - candidate eligible vs blocked counts
  - global stop reasons
  - candidate-specific `already_received_candidate_offer`
### Docs
- Marked
  [controlled_rotation_backend.md](/Users/georgyagaev/crew_five/docs/tasks/controlled_rotation_backend.md)
  as completed.
- Added frontend task
  [campaign_rotation_web_ui.md](/Users/georgyagaev/crew_five/docs/tasks/campaign_rotation_web_ui.md),
  Outreach handoff
  [Outreacher_controlled_rotation_handoff.md](/Users/georgyagaev/crew_five/docs/Outreacher_controlled_rotation_handoff.md),
  and session log
  [2026-03-22_8_controlled_rotation_backend.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-22_8_controlled_rotation_backend.md).
- Updated
  [docs/web_ui_endpoints.md](/Users/georgyagaev/crew_five/docs/web_ui_endpoints.md),
  [docs/Outreach_crew_five_cli_contract.md](/Users/georgyagaev/crew_five/docs/Outreach_crew_five_cli_contract.md),
  and [docs/sessions/roadmap.md](/Users/georgyagaev/crew_five/docs/sessions/roadmap.md).

## [0.2.39] - 2026-03-22
### Added
- Offer-aware analytics backend:
  - `analytics:summary --group-by hypothesis`
  - `analytics:summary --group-by recipient_type`
  - `analytics:summary --group-by sender_identity`
- Shared analytics execution-context loading across `email_events`, `email_outbound`, `campaigns`,
  `offers`, and `icp_hypotheses`.
### Docs
- Added backend task
  [offer_aware_analytics_backend.md](/Users/georgyagaev/crew_five/docs/tasks/offer_aware_analytics_backend.md),
  frontend task
  [offer_aware_analytics_web_ui.md](/Users/georgyagaev/crew_five/docs/tasks/offer_aware_analytics_web_ui.md),
  Outreach handoff
  [Outreacher_offer_aware_analytics_handoff.md](/Users/georgyagaev/crew_five/docs/Outreacher_offer_aware_analytics_handoff.md),
  and session log
  [2026-03-22_5_offer_aware_analytics_backend.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-22_5_offer_aware_analytics_backend.md).
- Updated [docs/Outreach_crew_five_cli_contract.md](/Users/georgyagaev/crew_five/docs/Outreach_crew_five_cli_contract.md)
  and [docs/sessions/roadmap.md](/Users/georgyagaev/crew_five/docs/sessions/roadmap.md).
### Docs
- Added consolidated Claude brief
  [claude_execution_exposure_and_offer_analytics_ui.md](/Users/georgyagaev/crew_five/docs/tasks/claude_execution_exposure_and_offer_analytics_ui.md)
  and session note
  [2026-03-22_6_claude_execution_exposure_and_analytics_brief.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-22_6_claude_execution_exposure_and_analytics_brief.md).
- Added next backend task
  [controlled_rotation_backend.md](/Users/georgyagaev/crew_five/docs/tasks/controlled_rotation_backend.md)
  and session note
  [2026-03-22_7_controlled_rotation_backend_brief.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-22_7_controlled_rotation_backend_brief.md).

## [0.2.40] - 2026-03-22
### Added
- Execution exposure visibility in employee drill-down:
  - `exposure_summary`: total touches, last offer, last touch date
  - `execution_exposures[]`: expandable details with offer/project, sent count,
    replied/bounced/unsubscribed badges per campaign
- Next-wave preview: shows "N/M with prior exposure" indicator
- Analytics groupBy: added `hypothesis`, `recipient_type`, `sender_identity` to
  EventsPage, LegacyAnalyticsPage, PipelineWorkspace selectors and label formatters

## [0.2.38] - 2026-03-22
### Added
- Ledger-derived execution exposure backend:
  - [executionExposure.ts](/Users/georgyagaev/crew_five/src/services/executionExposure.ts)
  - `campaign:detail` now returns `employees[].exposure_summary` and `employees[].execution_exposures[]`
  - `campaign:next-wave:preview` now returns `items[].exposure_summary`
### Docs
- Marked
  [offer_history_exposure_backend.md](/Users/georgyagaev/crew_five/docs/tasks/offer_history_exposure_backend.md)
  as completed.
- Added Claude follow-up task
  [campaign_execution_exposure_web_ui.md](/Users/georgyagaev/crew_five/docs/tasks/campaign_execution_exposure_web_ui.md),
  Outreach handoff
  [Outreacher_execution_exposure_handoff.md](/Users/georgyagaev/crew_five/docs/Outreacher_execution_exposure_handoff.md),
  and session log
  [2026-03-22_4_execution_exposure_backend.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-22_4_execution_exposure_backend.md).

## [0.2.37] - 2026-03-22
### Changed
- Removed `interactionMode` and `dataQualityMode` from operator-facing launch / next-wave public
  contracts while keeping backend campaign defaults intact.
### Docs
- Updated handoff/task docs and public endpoint/CLI contract docs to reflect factual runtime:
  `interactionMode` and `dataQualityMode` are not currently used by `Outreach` and should no longer
  be treated as operator-facing launch / next-wave choices.

## [0.2.36] - 2026-03-22
### Added
- Campaign next-wave Web UI: `CampaignNextWaveDrawer` with preview, blocked breakdown,
  name input, create, and success state.
- "Wave" / "Next wave" buttons in Campaigns and Builder V2 headers.
- API client: `fetchNextWavePreview()`, `createNextWave()`, full types.
- Created campaign auto-added to campaign list on success.
- 6 tests: closed, preview, blocked breakdown, create success, error, Russian.

## [0.2.35] - 2026-03-21
### Added
- Canonical next-wave backend:
  - [campaignNextWave.ts](/Users/georgyagaev/crew_five/src/services/campaignNextWave.ts)
  - CLI commands `campaign:next-wave:preview` and `campaign:next-wave:create`
  - Web routes `GET /api/campaigns/:campaignId/next-wave-preview` and `POST /api/campaigns/next-wave`
- Exclusion-aware campaign audience with migration
  [20260322000500_add_campaign_member_exclusions.sql](/Users/georgyagaev/crew_five/supabase/migrations/20260322000500_add_campaign_member_exclusions.sql).
### Changed
- Campaign audience now resolves as:
  - base `segment_members`
  - plus `campaign_member_additions`
  - minus `campaign_member_exclusions`
- Next-wave creation now:
  - reuses source offer/hypothesis/send-policy/mailbox defaults
  - materializes blocked target contacts into `campaign_member_exclusions`
  - copies eligible source manual additions into `campaign_member_additions`
### Docs
- Added frontend task
  [campaign_next_wave_web_ui.md](/Users/georgyagaev/crew_five/docs/tasks/campaign_next_wave_web_ui.md),
  Outreach handoff
  [Outreacher_next_wave_handoff.md](/Users/georgyagaev/crew_five/docs/Outreacher_next_wave_handoff.md),
  and session log
  [2026-03-21_28_next_wave_backend.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-21_28_next_wave_backend.md).
- Updated [README.md](/Users/georgyagaev/crew_five/README.md),
  [docs/Database_Description.md](/Users/georgyagaev/crew_five/docs/Database_Description.md),
  [docs/Outreach_crew_five_cli_contract.md](/Users/georgyagaev/crew_five/docs/Outreach_crew_five_cli_contract.md),
  [docs/web_ui_endpoints.md](/Users/georgyagaev/crew_five/docs/web_ui_endpoints.md),
  and [docs/sessions/roadmap.md](/Users/georgyagaev/crew_five/docs/sessions/roadmap.md).

## [0.2.34] - 2026-03-21
### Added
- Hypothesis picker in campaign launch drawer:
  - Dropdown with all hypotheses, offer-linked ones listed first when offer selected.
  - `icpHypothesisId` passed through preview and launch requests.
  - Hypothesis shown in preview and success states (label + messaging_angle).
- Campaign context: hypothesis shown in Campaigns operator desk (name + messaging_angle).

## [0.2.33] - 2026-03-21
### Added
- Operational hypothesis backend:
  - migration [20260321234500_add_operational_hypothesis_fields.sql](/Users/georgyagaev/crew_five/supabase/migrations/20260321234500_add_operational_hypothesis_fields.sql)
  - campaign linkage via `campaigns.icp_hypothesis_id`
  - canonical resolver [campaignHypothesis.ts](/Users/georgyagaev/crew_five/src/services/campaignHypothesis.ts)
- `icp:hypothesis:create` now persists reusable execution fields:
  - `offer_id`
  - `targeting_defaults`
  - `messaging_angle`
  - `pattern_defaults`
  - `notes`
- `campaign:create`, `campaign:launch:preview`, and `campaign:launch` now accept
  `icpHypothesisId`.
### Changed
- `campaign:detail` now returns campaign-linked operational hypothesis context instead of relying
  only on segment-linked research context.
- `crew_five` now resolves missing `offerId` from a selected hypothesis and rejects conflicting
  combinations with `CAMPAIGN_HYPOTHESIS_OFFER_MISMATCH`.
### Docs
- Added backend task
  [campaign_hypothesis_operational_backend.md](/Users/georgyagaev/crew_five/docs/tasks/campaign_hypothesis_operational_backend.md),
  frontend brief
  [campaign_hypothesis_operational_web_ui.md](/Users/georgyagaev/crew_five/docs/tasks/campaign_hypothesis_operational_web_ui.md),
  Outreach handoff
  [Outreacher_hypothesis_operational_handoff.md](/Users/georgyagaev/crew_five/docs/Outreacher_hypothesis_operational_handoff.md),
  and session log
  [2026-03-21_26_operational_hypothesis_backend.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-21_26_operational_hypothesis_backend.md).
- Updated [README.md](/Users/georgyagaev/crew_five/README.md),
  [docs/Database_Description.md](/Users/georgyagaev/crew_five/docs/Database_Description.md),
  [docs/Outreach_crew_five_cli_contract.md](/Users/georgyagaev/crew_five/docs/Outreach_crew_five_cli_contract.md),
  [docs/web_ui_endpoints.md](/Users/georgyagaev/crew_five/docs/web_ui_endpoints.md),
  and [docs/sessions/roadmap.md](/Users/georgyagaev/crew_five/docs/sessions/roadmap.md).
### Docs
- Corrected
  [docs/tasks/missing_migration_campaign_icp_hypothesis_id.md](/Users/georgyagaev/crew_five/docs/tasks/missing_migration_campaign_icp_hypothesis_id.md)
  to reflect the real issue: the migration already exists and must be applied with `supabase db push`.
- Added next backend task
  [next_wave_backend_support.md](/Users/georgyagaev/crew_five/docs/tasks/next_wave_backend_support.md)
  and session note
  [2026-03-21_27_next_wave_backend_brief.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-21_27_next_wave_backend_brief.md).

## [0.2.32] - 2026-03-21
### Added
- Campaign offer visibility in Campaigns and Builder V2 context blocks:
  shows linked offer title + project_name when `campaign.offer_id` exists.
- Analytics `groupBy=offer` option added to EventsPage, LegacyAnalyticsPage,
  and PipelineWorkspace. Renders `offer_title` with `project_name` fallback.
- `offer` kept separate from legacy `offering` (offering_domain) in all analytics surfaces.

## [0.2.31] - 2026-03-21
### Added
- Offer selection in campaign launch drawer:
  - Offer picker dropdown with active offers from `GET /api/offers`.
  - Inline "New offer" create flow (title, project name, description) via `POST /api/offers`.
  - Auto-select newly created offer and refresh list.
  - `offerId` passed through preview and launch requests.
  - Selected offer shown in preview and success states (title + project_name).
- API client: `fetchOffers()`, `createOffer()`, `OfferRecord` type.
- `offerId` added to `CampaignLaunchPreviewInput` and `CampaignLaunchInput`.
### Docs
- Refreshed [docs/sessions/roadmap.md](/Users/georgyagaev/crew_five/docs/sessions/roadmap.md) to
  mark completed current-stage priorities explicitly and identify operational `Hypothesis` as the
  next backend priority.
- Added roadmap status note
  [2026-03-21_25_roadmap_status_refresh.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-21_25_roadmap_status_refresh.md).

## [0.2.30] - 2026-03-21
### Added
- Minimal offer registry backend:
  - [offers.ts](/Users/georgyagaev/crew_five/src/services/offers.ts)
  - migration [20260321223000_add_offers_and_campaign_offer_id.sql](/Users/georgyagaev/crew_five/supabase/migrations/20260321223000_add_offers_and_campaign_offer_id.sql)
  - CLI commands `offer:list`, `offer:create`, `offer:update`
  - Web routes `GET /api/offers`, `POST /api/offers`, `PUT /api/offers/:offerId`
- Added `campaigns.offer_id` support across raw campaign creation and canonical launch flows.
- Added Outreach handoff
  [Outreacher_offer_registry_handoff.md](/Users/georgyagaev/crew_five/docs/Outreacher_offer_registry_handoff.md)
  and session log
  [2026-03-21_21_minimal_offer_registry_backend.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-21_21_minimal_offer_registry_backend.md).
- Added Claude UI task
  [campaign_offer_registry_web_ui.md](/Users/georgyagaev/crew_five/docs/tasks/campaign_offer_registry_web_ui.md)
  and handoff session note
  [2026-03-21_22_offer_registry_handoffs.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-21_22_offer_registry_handoffs.md).
- Added campaign-detail offer context and analytics summary group `offer`, backed by canonical
  `campaigns.offer_id` instead of legacy draft metadata only.
- Added follow-up handoffs:
  - Claude UI task
    [campaign_offer_visibility_and_analytics_web_ui.md](/Users/georgyagaev/crew_five/docs/tasks/campaign_offer_visibility_and_analytics_web_ui.md)
  - Outreach handoff
    [Outreacher_offer_followup_handoff.md](/Users/georgyagaev/crew_five/docs/Outreacher_offer_followup_handoff.md)
  - session note
    [2026-03-21_24_offer_followup_handoffs.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-21_24_offer_followup_handoffs.md)
### Docs
- Updated [README.md](/Users/georgyagaev/crew_five/README.md),
  [docs/Database_Description.md](/Users/georgyagaev/crew_five/docs/Database_Description.md),
  [docs/Outreach_crew_five_cli_contract.md](/Users/georgyagaev/crew_five/docs/Outreach_crew_five_cli_contract.md),
  and [docs/web_ui_endpoints.md](/Users/georgyagaev/crew_five/docs/web_ui_endpoints.md)
  for the new offer registry and `offerId` launch/create contract.
- Added session log
  [2026-03-21_23_offer_context_read_models_and_analytics.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-21_23_offer_context_read_models_and_analytics.md).

## [0.2.29] - 2026-03-21
### Added
- Campaign wave composition visibility in `Campaigns`:
  - Per-company composition chips showing eligible/total intro count, sent, and used contacts.
  - Employee details drawer shows `block_reasons` with operator-friendly labels
    (no_sendable_email, bounced, unsubscribed, already_used) and `eligible_for_new_intro` status.
- Send preflight card update:
  - `approvedSuppressedContactCount` shown as separate "Suppressed" chip (red) when > 0.
  - `suppressed_contact` blocker code rendered separately from missing email.

## [0.2.28] - 2026-03-21
### Added
- Added canonical suppression helper
  [contactSuppression.ts](/Users/georgyagaev/crew_five/src/services/contactSuppression.ts) so
  bounce / unsubscribe / complaint state is derived once and reused across read models.
- Added Claude frontend brief
  [campaign_wave_composition_visibility_web_ui.md](/Users/georgyagaev/crew_five/docs/tasks/campaign_wave_composition_visibility_web_ui.md)
  for company composition summaries and per-contact block-reason visibility in `Campaigns`.
### Changed
- Hardened [campaignSendPreflight.ts](/Users/georgyagaev/crew_five/src/services/campaignSendPreflight.ts)
  with blocker `suppressed_contact` and `summary.approvedSuppressedContactCount`.
- Approved drafts are no longer considered sendable when they target unsubscribed, complaint,
  bounced, or repeated-intro / already-used contacts.
- Switched campaign follow-up candidates and campaign detail composition logic to the same
  suppression helper instead of repeating ad hoc event checks.
- Event ingestion now materializes `reply_bounce=true` on bounced contacts and
  `reply_unsubscribe=true` on unsubscribe / complaint contacts in `employees`.
### Docs
- Updated send-preflight contracts in
  [docs/web_ui_endpoints.md](/Users/georgyagaev/crew_five/docs/web_ui_endpoints.md),
  [docs/Outreach_crew_five_cli_contract.md](/Users/georgyagaev/crew_five/docs/Outreach_crew_five_cli_contract.md),
  and
  [docs/Outreacher_campaign_send_preflight_handoff.md](/Users/georgyagaev/crew_five/docs/Outreacher_campaign_send_preflight_handoff.md).
- Updated Claude task
  [campaign_send_preflight_web_ui.md](/Users/georgyagaev/crew_five/docs/tasks/campaign_send_preflight_web_ui.md)
  for the new `suppressed_contact` blocker and `approvedSuppressedContactCount`.
- Added session log
  [2026-03-21_18_suppression_deliverability_hardening_backend.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-21_18_suppression_deliverability_hardening_backend.md).

## [0.2.27] - 2026-03-21
### Added
- Extended canonical `campaign detail` with campaign-wave composition / intro-eligibility visibility:
  per-contact `recipient_email`, `recipient_email_source`, `sendable`, `block_reasons`, and
  `eligible_for_new_intro`.
- Added company-level `composition_summary` counters to the same read model so UI and `Outreach`
  can see sendable/blocked/used coverage per company without stitching multiple calls together.
- Added regression coverage in
  [tests/campaignDetailReadModel.test.ts](/Users/georgyagaev/crew_five/tests/campaignDetailReadModel.test.ts)
  for no-email, bounced, unsubscribed, and already-used contacts.
### Docs
- Updated [docs/web_ui_endpoints.md](/Users/georgyagaev/crew_five/docs/web_ui_endpoints.md),
  [docs/Outreach_crew_five_cli_contract.md](/Users/georgyagaev/crew_five/docs/Outreach_crew_five_cli_contract.md),
  and added session log
  [2026-03-21_17_campaign_detail_composition_visibility_backend.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-21_17_campaign_detail_composition_visibility_backend.md).

## [0.2.26] - 2026-03-21
### Added
- Employee drill-down drawer (`CampaignEmployeeDetailsDrawer`): full name, position, company,
  emails, sendability, coverage, activity counters, draft summary.
- "Details" / "Подробнее" button on employee context card in Campaigns Messages column.
- Actionable empty states: "No drafts yet" vs "N drafts exist but current filters hide them"
  with specific guidance text.
- 6 tests: closed, details display, draft summary, no drafts, not sendable, Russian.
### Fixed
- Campaign audit `HeadersOverflowError` — `listCampaignAudience` now supports `includeSnapshot: false`;
  audit resolves company names from `companies` table instead of loading full snapshots.

## [0.2.25] - 2026-03-21
### Fixed
- Fixed `Campaigns` operator desk mismatch where companies from the campaign audience could appear
  without employees because the `Employees` column was derived only from draft rows.
- Added canonical Web route `GET /api/campaigns/:campaignId/detail` and API client
  `fetchCampaignDetail()` so the operator desk now reads campaign-scoped employees from the backend
  detail read model.
- Batched `campaign detail` employee lookups in chunks of 100 ids so large live campaigns no
  longer fail with `UND_ERR_HEADERS_OVERFLOW` on the Supabase-backed `employees.in(...)` query.
- Added canonical fallback for campaign company `website`, `region`, and `employee_count` from
  `companies` when snapshot rows only contain sparse company data.
- Extended the same sparse-snapshot fallback to `office_qualification` and
  `company_description` so the Campaigns company context card no longer drops these fields when
  only canonical company data has them.
- Added a compact employee context card at the top of the `Campaigns` message column showing the
  selected employee, recipient email, work/generic email, sendability, draft coverage, and
  sent/reply counters.
### Docs
- Added frontend brief
  [campaign_employee_drilldown_web_ui.md](/Users/georgyagaev/crew_five/docs/tasks/campaign_employee_drilldown_web_ui.md)
  for Claude to finish employee drill-down and actionable no-draft states in `Campaigns`.

## [0.2.24] - 2026-03-21
### Added
- Campaign wave attach Web UI: `CampaignAttachCompaniesDrawer` with directory company picker,
  select all/deselect, search, attach summary with per-company status breakdown.
- API client function `attachCompaniesToCampaign()` with full types.
- "+ Attach" button in Campaigns operator desk companies column header.
- Auto-refreshes campaign companies and audit after successful attach.
- 6 tests: closed state, company list, selection toggle, attach result, error, Russian locale.

## [0.2.23] - 2026-03-21
### Added
- Canonical campaign-wave attach backend for processed companies:
  - [campaignAudience.ts](/Users/georgyagaev/crew_five/src/services/campaignAudience.ts)
  - [campaignAttachCompanies.ts](/Users/georgyagaev/crew_five/src/services/campaignAttachCompanies.ts)
  - migration [20260321150000_add_campaign_member_additions.sql](/Users/georgyagaev/crew_five/supabase/migrations/20260321150000_add_campaign_member_additions.sql)
- CLI surface `campaign:attach-companies` and Web route
  `POST /api/campaigns/:campaignId/companies/attach`.
- Frontend brief
  [campaign_wave_attach_web_ui.md](/Users/georgyagaev/crew_five/docs/tasks/campaign_wave_attach_web_ui.md)
  and Outreach handoff
  [Outreacher_campaign_wave_attach_handoff.md](/Users/georgyagaev/crew_five/docs/Outreacher_campaign_wave_attach_handoff.md).
- Session log
  [2026-03-21_12_campaign_wave_attach_backend.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-21_12_campaign_wave_attach_backend.md).
### Changed
- Updated campaign-scoped draft generation, campaign company/detail reads, campaign audit, and
  Smartlead send preparation to read the unified campaign audience (`segment_members` plus
  `campaign_member_additions`) instead of only the base snapshot.
- Updated [README.md](/Users/georgyagaev/crew_five/README.md),
  [docs/Database_Description.md](/Users/georgyagaev/crew_five/docs/Database_Description.md),
  [docs/Outreach_crew_five_cli_contract.md](/Users/georgyagaev/crew_five/docs/Outreach_crew_five_cli_contract.md),
  [docs/web_ui_endpoints.md](/Users/georgyagaev/crew_five/docs/web_ui_endpoints.md), and marked
  [campaign_wave_attach_backend.md](/Users/georgyagaev/crew_five/docs/tasks/campaign_wave_attach_backend.md)
  as completed.

## [0.2.22] - 2026-03-21
### Added
- Added detailed backend task
  [campaign_wave_attach_backend.md](/Users/georgyagaev/crew_five/docs/tasks/campaign_wave_attach_backend.md)
  for the next current-stage priority: attaching processed companies into frozen
  campaign waves canonically.
- Added session note
  [2026-03-21_11_campaign_wave_attach_backend_brief.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-21_11_campaign_wave_attach_backend_brief.md)
  documenting the chosen backend shape: campaign-scoped audience additions plus
  a shared campaign audience helper.

## [0.2.21] - 2026-03-21
### Fixed
- Restored campaign launch compatibility for legacy stored segment filters that still use bare
  `employee_count` instead of canonical `companies.employee_count`.
- Updated [src/filters/index.ts](/Users/georgyagaev/crew_five/src/filters/index.ts) so the shared
  legacy alias layer now normalizes `employee_count -> companies.employee_count` before snapshot and
  launch execution.
- Added parser regression coverage in
  [src/filters/index.test.ts](/Users/georgyagaev/crew_five/src/filters/index.test.ts) and snapshot
  workflow regression coverage in
  [tests/segmentSnapshotWorkflowLegacyFilters.test.ts](/Users/georgyagaev/crew_five/tests/segmentSnapshotWorkflowLegacyFilters.test.ts).
- Closed task
  [campaign_launch_invalid_segment_filter_employee_count.md](/Users/georgyagaev/crew_five/docs/tasks/campaign_launch_invalid_segment_filter_employee_count.md)
  and recorded the fix in
  [2026-03-21_10_campaign_launch_legacy_employee_count_fix.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-21_10_campaign_launch_legacy_employee_count_fix.md).

## [0.2.20] - 2026-03-21
### Added
- Campaign send policy Web UI: `CampaignSendPolicyCard` with timezone, send window (start/end hour),
  and weekdays-only toggle with browser-side validation.
- Send policy fields in launch form, preview card, and success state.
- API client functions `fetchCampaignSendPolicy()` and `updateCampaignSendPolicy()`.
- Updated launch types (`CampaignLaunchPreviewInput/Result`, `CampaignLaunchInput/Result`) to include
  `sendPolicy` / send policy override fields.
- 8 tests for send policy card: placeholder, display, edit, validation (end > start, empty tz), save, error, Russian.
- Integrated into Builder V2 and Campaigns operator desk.

## [0.2.19] - 2026-03-21
### Added
- Canonical campaign send policy backend with explicit `campaigns` fields for timezone, local send
  window, and weekdays-only gating.
- [campaignSendPolicy.ts](/Users/georgyagaev/crew_five/src/services/campaignSendPolicy.ts) for
  validated read/update of campaign-local send policy.
- [campaignSendCalendar.ts](/Users/georgyagaev/crew_five/src/services/campaignSendCalendar.ts) to
  evaluate campaign-local local-time calendar gating.
- CLI surfaces in [cli.ts](/Users/georgyagaev/crew_five/src/cli.ts):
  - `campaign:send-policy:get`
  - `campaign:send-policy:put`
- Web adapter routes in
  [campaignRoutes.ts](/Users/georgyagaev/crew_five/src/web/routes/campaignRoutes.ts):
  - `GET /api/campaigns/:id/send-policy`
  - `PUT /api/campaigns/:id/send-policy`
- Frontend handoff [campaign_send_policy_web_ui.md](/Users/georgyagaev/crew_five/docs/tasks/campaign_send_policy_web_ui.md)
  and Outreach handoff [Outreacher_campaign_send_policy_handoff.md](/Users/georgyagaev/crew_five/docs/Outreacher_campaign_send_policy_handoff.md).
- Session log [2026-03-21_5_campaign_send_policy_backend.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-21_5_campaign_send_policy_backend.md).
- Session log [2026-03-21_6_campaign_send_policy_web_ui_brief.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-21_6_campaign_send_policy_web_ui_brief.md)
  documenting the detailed frontend handoff for Claude.
- Session log [2026-03-21_7_outreacher_campaign_send_policy_handoff.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-21_7_outreacher_campaign_send_policy_handoff.md)
  documenting the practical handoff for `Outreach`.
- Session log [2026-03-21_8_send_policy_handoff_alignment.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-21_8_send_policy_handoff_alignment.md)
  aligning the frontend and Outreach decision rule for campaigns with no send-policy hint.
- Session log [2026-03-21_9_campaign_launch_send_policy_smoke.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-21_9_campaign_launch_send_policy_smoke.md)
  documenting live Web UI verification of explicit send policy persistence and the discovered
  launch bug for a segment with legacy invalid filters.
- Bug task [campaign_launch_invalid_segment_filter_employee_count.md](/Users/georgyagaev/crew_five/docs/tasks/campaign_launch_invalid_segment_filter_employee_count.md)
  for launch failures caused by legacy `employee_count` filter references in stored segments.
### Changed
- Updated [campaignAutoSend.ts](/Users/georgyagaev/crew_five/src/services/campaignAutoSend.ts) so
  auto-send sweeps now skip deterministically outside the campaign-local send window or on
  non-workdays before running intro preflight or bump follow-up queries.
- Updated launch preview and launch contracts to accept and return canonical `sendPolicy`.
- Updated [README.md](/Users/georgyagaev/crew_five/README.md),
  [docs/Outreach_crew_five_cli_contract.md](/Users/georgyagaev/crew_five/docs/Outreach_crew_five_cli_contract.md),
  [docs/web_ui_endpoints.md](/Users/georgyagaev/crew_five/docs/web_ui_endpoints.md),
  [docs/Database_Description.md](/Users/georgyagaev/crew_five/docs/Database_Description.md),
  [docs/tasks/campaign_send_policy_backend.md](/Users/georgyagaev/crew_five/docs/tasks/campaign_send_policy_backend.md),
  and [docs/Outreacher_auto_send_scheduler_handoff.md](/Users/georgyagaev/crew_five/docs/Outreacher_auto_send_scheduler_handoff.md)
  for the new send policy model.

## [0.2.18] - 2026-03-21
### Added
- Campaign auto-send Web UI: `CampaignAutoSendCard` component with inline toggles for
  intro/bump auto-send and bump delay input with validation.
- Integrated auto-send card into Builder V2 and Campaigns operator desk.
- API client functions `fetchCampaignAutoSendSettings()` and `updateCampaignAutoSendSettings()`.
- 7 tests covering auto-send card: settings display, toggle, save, validation, error, Russian locale.

## [0.2.17] - 2026-03-21
### Added
- Added [docs/private/2026-03-21_master_roadmap_index.md](/Users/georgyagaev/crew_five/docs/private/2026-03-21_master_roadmap_index.md),
  a master navigation document linking the private strategy, backend roadmap, capability matrix,
  and current/next-stage action plans.
- Added [docs/private/2026-03-21_backend_task_auto_send_scheduler.md](/Users/georgyagaev/crew_five/docs/private/2026-03-21_backend_task_auto_send_scheduler.md),
  a full backend implementation brief for automatic scheduled intro + bump sending, including
  architecture guidance, guardrails, testing scope, and required frontend/Outreach handoffs.
- Added [docs/private/2026-03-21_current_stage_action_plan.md](/Users/georgyagaev/crew_five/docs/private/2026-03-21_current_stage_action_plan.md),
  a backend-first execution plan for the current product stage with session-by-session sequencing,
  frontend follow-up blocks, and a practical delivery order focused on removing operator routine.
- Added [docs/private/2026-03-21_next_stage_action_plan.md](/Users/georgyagaev/crew_five/docs/private/2026-03-21_next_stage_action_plan.md),
  a follow-on execution plan for the next stage covering `Offer`, `Hypothesis`, next-wave support,
  offer-aware analytics, controlled rotation, and multi-project foundations.
- Added [docs/private/2026-03-21_outreach_capability_matrix.md](/Users/georgyagaev/crew_five/docs/private/2026-03-21_outreach_capability_matrix.md),
  documenting the current `Outreach` skill/runtime inventory so roadmap planning can avoid duplicating
  existing runtime capabilities in `crew_five`.
### Changed
- Updated [docs/private/2026-03-20_backend_roadmap_v1.md](/Users/georgyagaev/crew_five/docs/private/2026-03-20_backend_roadmap_v1.md)
  to align backend priorities with the `Outreach` capability inventory and the revised
  semi-automated outbound operating model.
- Updated [docs/private/2026-03-21_current_stage_action_plan.md](/Users/georgyagaev/crew_five/docs/private/2026-03-21_current_stage_action_plan.md)
  to prioritize automatic scheduled intro + bump sending as the urgent first block in the current
  stage because live campaigns already exist and the main pain is manual send supervision.
- Rewrote [docs/sessions/roadmap.md](/Users/georgyagaev/crew_five/docs/sessions/roadmap.md) as the
  current public roadmap/navigation document, replacing the outdated phase-oriented plan with the
  agreed semi-automated outbound assistant model, current-stage urgent priorities, and next-stage
  direction.

## [0.2.16] - 2026-03-20
### Added
- Campaign launch Web UI: `CampaignLaunchDrawer`, `CampaignLaunchForm`, `CampaignLaunchPreviewCard`
  components implementing the full launch-preview -> launch flow.
- Integrated launch drawer into Builder V2 and Campaigns operator desk with "Launch campaign" button.
- API client functions `campaignLaunchPreview()` and `campaignLaunch()` with full TypeScript types.
- 6 tests covering launch drawer states: form, preview, success, error, Russian locale.

## [0.2.15] - 2026-03-20
### Added
- Added [docs/sessions/2026-03-21_1_auto_send_scheduler_execution_plan.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-21_1_auto_send_scheduler_execution_plan.md),
  a detailed backend execution plan for `v1` automatic intro+bump sending, including schema choice,
  sweep service shape, trigger bridge, scheduler structure, and test order.
- Added [docs/tasks/campaign_launch_web_ui.md](/Users/georgyagaev/crew_five/docs/tasks/campaign_launch_web_ui.md),
  a dedicated frontend brief for Claude covering the canonical launch flow on top of
  `POST /api/campaigns/launch-preview` and `POST /api/campaigns/launch`.
- Added [docs/sessions/2026-03-20_8_campaign_launch_web_ui_brief.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-20_8_campaign_launch_web_ui_brief.md),
  recording the frontend handoff preparation for the new launch backend.
- Added [campaignLaunch.ts](/Users/georgyagaev/crew_five/src/services/campaignLaunch.ts), the
  canonical launch mutation that ensures the snapshot, creates the campaign, and optionally persists
  the initial sender plan in one shared backend step.
- Added `campaign:launch` to [src/cli.ts](/Users/georgyagaev/crew_five/src/cli.ts), so
  `Outreacher` no longer has to stitch together raw `campaign:create` and mailbox assignment writes
  as its primary launch path.
- Added `POST /api/campaigns/launch` to
  [src/web/routes/campaignRoutes.ts](/Users/georgyagaev/crew_five/src/web/routes/campaignRoutes.ts),
  completing the backend API pair for launch preview + launch.
- Added [docs/sessions/2026-03-20_7_campaign_launch_backend.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-20_7_campaign_launch_backend.md),
  documenting the completed backend launch implementation.
- Added [campaignLaunchPreview.ts](/Users/georgyagaev/crew_five/src/services/campaignLaunchPreview.ts),
  a canonical read-only launch preview that summarizes existing snapshot coverage, enrichment
  freshness, recipient sendability, and proposed sender-plan domains before any campaign mutation.
- Added `campaign:launch:preview` to [src/cli.ts](/Users/georgyagaev/crew_five/src/cli.ts), so
  `Outreacher` and future launch wizards can call one shared preview contract instead of rebuilding
  launch checks client-side.
- Added `POST /api/campaigns/launch-preview` to
  [src/web/routes/campaignRoutes.ts](/Users/georgyagaev/crew_five/src/web/routes/campaignRoutes.ts),
  exposing the same canonical preview surface to `Builder V2` and `Campaigns`.
- Added [docs/sessions/2026-03-20_6_campaign_launch_preview_backend.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-20_6_campaign_launch_preview_backend.md),
  documenting the completed backend Phase 1 for canonical campaign launch.
- Added [campaignSendPreflight.ts](/Users/georgyagaev/crew_five/src/services/campaignSendPreflight.ts),
  a canonical send-readiness read model that combines campaign status, planned sender set, approved draft
  counts, and recipient sendability into one operator-facing response.
- Added `campaign:send-preflight` to [src/cli.ts](/Users/georgyagaev/crew_five/src/cli.ts), giving
  `Outreacher` and operators one shared CLI surface to check send blockers before moving a campaign into
  `sending`.
- Added `GET /api/campaigns/:id/send-preflight` to the Web adapter in
  [campaignRoutes.ts](/Users/georgyagaev/crew_five/src/web/routes/campaignRoutes.ts), so future `Campaigns`
  and `Builder V2` UI surfaces can consume the same read model as `Outreacher`.
- Added [docs/tasks/campaign_send_preflight_web_ui.md](/Users/georgyagaev/crew_five/docs/tasks/campaign_send_preflight_web_ui.md),
  a focused Web UI brief for Claude covering the compact send-preflight operator card.
- Added [docs/sessions/2026-03-20_3_campaign_send_preflight_implementation.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-20_3_campaign_send_preflight_implementation.md),
  documenting the implementation, blocker model, and verification steps.
- Added [docs/sessions/2026-03-20_4_campaign_send_preflight_live_smoke.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-20_4_campaign_send_preflight_live_smoke.md),
  documenting autonomous live verification of `campaign:send-preflight` across existing campaigns and
  a temporary sequential smoke campaign.
- Added [docs/tasks/cleanup_campaign_send_preflight_smoke_data.md](/Users/georgyagaev/crew_five/docs/tasks/cleanup_campaign_send_preflight_smoke_data.md),
  capturing the destructive cleanup follow-up for temporary smoke campaigns and drafts.
- Added [docs/sessions/2026-03-20_5_campaign_launch_execution_plan.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-20_5_campaign_launch_execution_plan.md),
  laying out the recommended next backend milestone for canonical campaign launch:
  `campaign:launch:preview` + `campaign:launch`.
### Changed
- Updated [README.md](/Users/georgyagaev/crew_five/README.md),
  [docs/Outreach_crew_five_cli_contract.md](/Users/georgyagaev/crew_five/docs/Outreach_crew_five_cli_contract.md),
  [docs/web_ui_endpoints.md](/Users/georgyagaev/crew_five/docs/web_ui_endpoints.md),
  [docs/Outreacher_campaign_launch_handoff.md](/Users/georgyagaev/crew_five/docs/Outreacher_campaign_launch_handoff.md),
  and [docs/sessions/2026-03-20_5_campaign_launch_execution_plan.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-20_5_campaign_launch_execution_plan.md)
  to reflect that the full backend launch contract (`campaign:launch:preview` + `campaign:launch`)
  is now implemented.
- Updated [README.md](/Users/georgyagaev/crew_five/README.md),
  [docs/Outreach_crew_five_cli_contract.md](/Users/georgyagaev/crew_five/docs/Outreach_crew_five_cli_contract.md),
  [docs/web_ui_endpoints.md](/Users/georgyagaev/crew_five/docs/web_ui_endpoints.md),
  [docs/Outreacher_campaign_launch_handoff.md](/Users/georgyagaev/crew_five/docs/Outreacher_campaign_launch_handoff.md),
  and [docs/sessions/2026-03-20_5_campaign_launch_execution_plan.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-20_5_campaign_launch_execution_plan.md)
  to reflect that Phase 1 (`campaign:launch:preview`) is now implemented while `campaign:launch`
  remains the next backend step.
- Updated [docs/Outreach_crew_five_cli_contract.md](/Users/georgyagaev/crew_five/docs/Outreach_crew_five_cli_contract.md),
  [docs/web_ui_endpoints.md](/Users/georgyagaev/crew_five/docs/web_ui_endpoints.md), [README.md](/Users/georgyagaev/crew_five/README.md),
  and [docs/Outreacher_campaign_send_preflight_handoff.md](/Users/georgyagaev/crew_five/docs/Outreacher_campaign_send_preflight_handoff.md)
  to reflect that `campaign:send-preflight` is now implemented, not just planned.
- Completed the cleanup recorded in
  [docs/tasks/cleanup_campaign_send_preflight_smoke_data.md](/Users/georgyagaev/crew_five/docs/tasks/cleanup_campaign_send_preflight_smoke_data.md),
  removing the two temporary smoke-test campaigns and their related draft and mailbox-assignment rows
  after live verification of `campaign:send-preflight`.

## [0.2.14] - 2026-03-17
### Added
- Added [Outreacher_campaign_status_and_enrichment_handoff.md](/Users/georgyagaev/crew_five/docs/Outreacher_campaign_status_and_enrichment_handoff.md),
  a dedicated handoff for the `Outreacher` team covering campaign status semantics, generation ownership,
  and the recommended enrichment flow around campaign preparation.
- Added [docs/sessions/2026-03-17_1_outreacher_campaign_status_and_enrichment_handoff.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-17_1_outreacher_campaign_status_and_enrichment_handoff.md),
  recording the handoff scope and recommendations.
- Added [docs/sessions/2026-03-17_2_company_import_ogrn_dedup_visibility.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-17_2_company_import_ogrn_dedup_visibility.md),
  documenting the operator-facing OGRN dedup visibility improvement for `company:import`.
- Added [Outreacher_company_import_dedup_handoff.md](/Users/georgyagaev/crew_five/docs/Outreacher_company_import_dedup_handoff.md),
  a dedicated handoff for the `Outreacher` team explaining `company:import` dedup order,
  `match_field`, and `TIN mismatch` warning semantics.
- Added [docs/sessions/2026-03-17_3_outreacher_company_import_dedup_handoff.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-17_3_outreacher_company_import_dedup_handoff.md),
  recording the contract expansion and handoff scope for import dedup visibility.
- Added [docs/sessions/2026-03-17_4_company_import_ogrn_apply_fix.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-17_4_company_import_ogrn_apply_fix.md),
  documenting the real `company:import` apply failure on OGRN dedup and the completed fix.
- Added [docs/sessions/2026-03-19_1_campaign_mailbox_assignment_cli_parity.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-19_1_campaign_mailbox_assignment_cli_parity.md),
  documenting the completed CLI parity for planned campaign mailbox assignments.
- Added [Outreacher_campaign_launch_handoff.md](/Users/georgyagaev/crew_five/docs/Outreacher_campaign_launch_handoff.md),
  a dedicated handoff for the `/launch-campaign` workflow so `Outreacher` can create campaigns
  through `crew_five` while also persisting the planned sender set canonically.
- Added [docs/sessions/2026-03-20_1_outreacher_campaign_launch_handoff.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-20_1_outreacher_campaign_launch_handoff.md),
  recording the review of the current `Outreacher` launch workflow and the recommended next step.
- Added [Outreacher_campaign_send_preflight_handoff.md](/Users/georgyagaev/crew_five/docs/Outreacher_campaign_send_preflight_handoff.md),
  defining the minimal shared send-readiness backbone for `Outreacher` and `crew_five` Web UI
  without adding recipient email quality scoring yet.
- Added [docs/sessions/2026-03-20_2_campaign_send_preflight_handoff.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-20_2_campaign_send_preflight_handoff.md),
  recording the agreed send-preflight handoff and the recommended next implementation step.
### Changed
- Corrected [Outreacher_campaign_status_and_enrichment_handoff.md](/Users/georgyagaev/crew_five/docs/Outreacher_campaign_status_and_enrichment_handoff.md)
  so the send flow now matches the real transition map in `crew_five`:
  `ready -> generating -> sending`, not `ready -> sending`.
- Updated [docs/tasks/company_import_ogrn_dedup.md](/Users/georgyagaev/crew_five/docs/tasks/company_import_ogrn_dedup.md),
  [docs/Outreach_crew_five_cli_contract.md](/Users/georgyagaev/crew_five/docs/Outreach_crew_five_cli_contract.md),
  and [README.md](/Users/georgyagaev/crew_five/README.md) to reflect that OGRN dedup already worked,
  and the delivered change is visibility: `match_field` plus `TIN mismatch` warnings.
- Fixed [companyStore.ts](/Users/georgyagaev/crew_five/src/services/companyStore.ts) so
  `company:import` no longer leaks a failed `tin` filter into the fallback
  `registration_number` lookup when using the real mutable Supabase query builder.
- Updated [Outreacher_company_import_dedup_handoff.md](/Users/georgyagaev/crew_five/docs/Outreacher_company_import_dedup_handoff.md)
  with the live regression note so `Outreacher` can treat the original OGRN apply failure as fixed
  and expect `action: update` / `match_field: registration_number` on the previously failing payload.
- Added `campaign:mailbox-assignment:get` and `campaign:mailbox-assignment:put` to
  [src/cli.ts](/Users/georgyagaev/crew_five/src/cli.ts), so `Outreacher` can persist the planned
  sender set through the canonical CLI surface instead of hand-editing the shared database.
- Updated [docs/Outreach_crew_five_cli_contract.md](/Users/georgyagaev/crew_five/docs/Outreach_crew_five_cli_contract.md),
  [docs/Outreacher_campaign_status_and_enrichment_handoff.md](/Users/georgyagaev/crew_five/docs/Outreacher_campaign_status_and_enrichment_handoff.md),
  and [README.md](/Users/georgyagaev/crew_five/README.md) so sender planning is now explicitly part
  of the `crew_five` contract before send runs.
- Expanded [docs/Outreacher_campaign_status_and_enrichment_handoff.md](/Users/georgyagaev/crew_five/docs/Outreacher_campaign_status_and_enrichment_handoff.md)
  with concrete `campaign:mailbox-assignment:put` examples for single-sender, multi-sender, and clear-set flows.


## [0.2.13] - 2026-03-16
### Added
- Added [20260316230500_add_employee_data_repairs.sql](/Users/georgyagaev/crew_five/supabase/migrations/20260316230500_add_employee_data_repairs.sql)
  and [employeeDataRepairs.ts](/Users/georgyagaev/crew_five/src/services/employeeDataRepairs.ts),
  creating a durable audit trail for applied employee name repairs in `employee_data_repairs`.
- Added [docs/sessions/2026-03-16_15_employee_name_repair_audit_trail.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-16_15_employee_name_repair_audit_trail.md),
  documenting the audit-trail rollout for employee-name repairs.
- Added [docs/tasks/add_employee_name_repair_audit_trail.md](/Users/georgyagaev/crew_five/docs/tasks/add_employee_name_repair_audit_trail.md),
  capturing the remaining audit-trail follow-up from the real-data review of `employee:repair-names`.
- Added [docs/sessions/2026-03-16_14_employee_name_repair_followups.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-16_14_employee_name_repair_followups.md),
  documenting the completed confidence-filter and write-time normalization follow-ups for employee-name repair.
- Added `employee:repair-names` in
  [src/services/employeeNameRepair.ts](/Users/georgyagaev/crew_five/src/services/employeeNameRepair.ts)
  and [src/cli.ts](/Users/georgyagaev/crew_five/src/cli.ts), giving `crew_five` a canonical
  preview/apply repair flow for swapped `first_name` / `last_name` values on two-token Russian names.
- Added `company:import` in
  [src/services/companyStore.ts](/Users/georgyagaev/crew_five/src/services/companyStore.ts)
  and [src/cli.ts](/Users/georgyagaev/crew_five/src/cli.ts), so normalized JSON batches can be
  previewed and imported into canonical `companies` + `employees` rows with shared validation and
  created/updated/skipped summaries.
- Added `company:save-processed` in
  [src/services/companyStore.ts](/Users/georgyagaev/crew_five/src/services/companyStore.ts)
  and [src/cli.ts](/Users/georgyagaev/crew_five/src/cli.ts), giving `Outreacher` one canonical
  mutation surface for processed company bundles with employee upsert by `company_id + full_name`.
- Added `campaign:followup-candidates` in
  [src/services/campaignFollowupCandidates.ts](/Users/georgyagaev/crew_five/src/services/campaignFollowupCandidates.ts)
  and [src/cli.ts](/Users/georgyagaev/crew_five/src/cli.ts), centralizing intro-to-bump eligibility
  on the `crew_five` side instead of forcing `Outreacher` to recompute it from raw tables.
- Added `campaign:detail` in
  [src/services/campaignDetailReadModel.ts](/Users/georgyagaev/crew_five/src/services/campaignDetailReadModel.ts)
  and [src/cli.ts](/Users/georgyagaev/crew_five/src/cli.ts), exposing a composed campaign-scoped
  read model with segment/ICP context plus `companies[].employees[]` drill-down.
- Added analytics extensions in
  [src/services/analytics.ts](/Users/georgyagaev/crew_five/src/services/analytics.ts) and
  [src/cli.ts](/Users/georgyagaev/crew_five/src/cli.ts), including
  `analytics:summary --group-by rejection_reason|offering` and
  `analytics:funnel --campaign-id <id>`.
- Added [docs/sessions/2026-03-16_11_boundary_transfer_execution_plan.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-16_11_boundary_transfer_execution_plan.md),
  turning the agreed boundary-transfer task list into a detailed phased execution plan with
  contracts, acceptance criteria, and test strategy.
- Added [docs/sessions/2026-03-16_12_boundary_transfer_phase1_progress.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-16_12_boundary_transfer_phase1_progress.md),
  summarizing the implementation and verification status of the first three boundary-transfer tasks.
- Added [docs/sessions/2026-03-16_13_boundary_transfer_completion.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-16_13_boundary_transfer_completion.md),
  closing the full boundary-transfer rollout and recording the final verification pass.
- Added [docs/sessions/2026-03-16_10_outreach_workflow_boundary_review.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-16_10_outreach_workflow_boundary_review.md),
  reviewing the shared `Outreach` workflow guide and documenting which workflow responsibilities
  should stay in `Outreacher` versus move into `crew_five`, plus recommended refinements for the
  proposed boundary-transfer task list.
- Campaigns Operator Desk: four-column layout (Campaigns | Companies | Employees | Messages)
  replacing the old stacked `CampaignOpsPage`. Full light/dark theme and EN/RU localization.
- Hover preview + click-pin interaction model with 150ms debounce across columns.
- Resizable column widths via drag handles between all four columns.
- Company context card in Employees column header showing description, region, headcount,
  office qualification, enrichment provider, and last enrichment date.
- Clickable company website links opening in new tab.
- Message list view showing all filtered drafts with resizable list/detail split.
- Segmented controls for message status and sequence filtering.
- Inline draft editing (subject + body) with `POST /api/drafts/:id/content` endpoint,
  full backend stack: `updateDraftContent` in draftStore, liveDeps, mockDeps, route, API client.
- Slide-over drawer for draft/outbound/event trace chain.
- Session log: `docs/sessions/2026-03-16_8_campaigns_operator_desk.md`.

### Changed
- Updated [docs/tasks/add_employee_name_repair_audit_trail.md](/Users/georgyagaev/crew_five/docs/tasks/add_employee_name_repair_audit_trail.md),
  [docs/Database_Description.md](/Users/georgyagaev/crew_five/docs/Database_Description.md),
  [README.md](/Users/georgyagaev/crew_five/README.md), and
  [docs/Outreach_crew_five_cli_contract.md](/Users/georgyagaev/crew_five/docs/Outreach_crew_five_cli_contract.md)
  to reflect the new durable repair-audit table and write behavior.
- Updated [README.md](/Users/georgyagaev/crew_five/README.md),
  [docs/Outreach_crew_five_cli_contract.md](/Users/georgyagaev/crew_five/docs/Outreach_crew_five_cli_contract.md),
  and [docs/tasks/boundary_transfer_tasks.md](/Users/georgyagaev/crew_five/docs/tasks/boundary_transfer_tasks.md)
  to document `employee:repair-names --confidence high|low|all`, plus the new
  `company:save-processed` name-normalization and warning behavior.
- Tightened inbox reply adapter typing in [src/web/types.ts](/Users/georgyagaev/crew_five/src/web/types.ts)
  and [src/web/mockDeps.ts](/Users/georgyagaev/crew_five/src/web/mockDeps.ts) so full compile/test runs
  use the real `InboxRepliesView` shape.
- Reworked the CORS coverage in [src/web/server.test.ts](/Users/georgyagaev/crew_five/src/web/server.test.ts)
  to exercise the adapter request handler without opening a real socket, keeping full test runs green in sandboxed environments.
- Updated [README.md](/Users/georgyagaev/crew_five/README.md) and
  [docs/Outreach_crew_five_cli_contract.md](/Users/georgyagaev/crew_five/docs/Outreach_crew_five_cli_contract.md)
  to document the new `employee:repair-names`, `company:import`, `company:save-processed`, and
  `campaign:followup-candidates`, `campaign:detail`
  command surfaces for the boundary-transfer rollout.
- Updated
  [docs/sessions/2026-03-16_11_boundary_transfer_execution_plan.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-16_11_boundary_transfer_execution_plan.md)
  with a concrete status section, marking the full boundary-transfer execution plan complete.
- Updated [docs/tasks/boundary_transfer_tasks.md](/Users/georgyagaev/crew_five/docs/tasks/boundary_transfer_tasks.md)
  so the agreed boundary-transfer task list now explicitly shows the implemented command surfaces as
  completed.

## [0.2.12] - 2026-03-16
### Added
- Added a standalone Campaigns redesign brief in
  [docs/Campaigns_operator_desk_design_spec.md](/Users/georgyagaev/crew_five/docs/Campaigns_operator_desk_design_spec.md)
  describing the target four-column operator-desk IA for `Campaigns`.
  Later expanded it with edge-case rules, empty/degraded states, and loading/cache behavior so it can act as a
  clearer handoff for external UI design work.
- Added a shared rejection-reason taxonomy in
  [web/src/draftReviewReasons.ts](/Users/georgyagaev/crew_five/web/src/draftReviewReasons.ts)
  so `Campaigns` review can persist structured reject metadata in `drafts.metadata`.
- Added
  [docs/tasks/add_rejection_reason_analytics.md](/Users/georgyagaev/crew_five/docs/tasks/add_rejection_reason_analytics.md)
  to capture the follow-up analytics work for `review_reason_code` and related review metadata.
- Added canonical Web UI run scripts for daily work and isolated validation in
  [package.json](/Users/georgyagaev/crew_five/package.json) and
  [web/package.json](/Users/georgyagaev/crew_five/web/package.json), standardizing on
  `8787/5173` for daily use and `8888/5174` for browser validation.
- Added [docs/sessions/2026-03-16_2_port_conventions_and_runbooks.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-16_2_port_conventions_and_runbooks.md),
  documenting the new local port policy and runbook.
- Added campaign audit coverage and drill-down read models in
  [src/services/campaignAudit.ts](/Users/georgyagaev/crew_five/src/services/campaignAudit.ts)
  and exposed them via `GET /api/campaigns/:campaignId/audit`.
- Added a compact audit surface in
  [web/src/components/CampaignAuditPanel.tsx](/Users/georgyagaev/crew_five/web/src/components/CampaignAuditPanel.tsx),
  wiring `Campaigns` to the new audit endpoint for coverage and anomaly visibility.
- Added `campaign:audit` to the CLI in
  [src/cli.ts](/Users/georgyagaev/crew_five/src/cli.ts), exposing the same
  campaign coverage/anomaly read model used by the Web adapter for terminal-side verification.
- Added reusable Campaigns filter/sort helpers in
  [web/src/pages/campaignOpsFilters.ts](/Users/georgyagaev/crew_five/web/src/pages/campaignOpsFilters.ts)
  so operator controls stay out of the page component and remain unit-testable.
- Added campaign trace helpers in
  [web/src/components/campaignTrace.ts](/Users/georgyagaev/crew_five/web/src/components/campaignTrace.ts)
  to resolve `draft -> outbound -> event` relations for the operator surface.

### Changed
- Updated [README.md](/Users/georgyagaev/crew_five/README.md),
  [web/README.md](/Users/georgyagaev/crew_five/web/README.md),
  [web/e2e/README.md](/Users/georgyagaev/crew_five/web/e2e/README.md), and
  [docs/web_ui_endpoints.md](/Users/georgyagaev/crew_five/docs/web_ui_endpoints.md)
  so the Web adapter and Vite docs use a single canonical port convention instead of ad hoc debug ports.
- Added explicit CORS handling to [src/web/server.ts](/Users/georgyagaev/crew_five/src/web/server.ts) so the canonical
  daily pair `http://localhost:5173 -> http://localhost:8787/api` works without a reverse proxy, and covered it with
  [tests/webServerCors.test.ts](/Users/georgyagaev/crew_five/tests/webServerCors.test.ts).
- Updated [docs/web_ui_endpoints.md](/Users/georgyagaev/crew_five/docs/web_ui_endpoints.md) and
  [web/README.md](/Users/georgyagaev/crew_five/web/README.md) with the new campaign audit endpoint for operator
  completeness checks.
- Updated [README.md](/Users/georgyagaev/crew_five/README.md) and
  [docs/Outreach_crew_five_cli_contract.md](/Users/georgyagaev/crew_five/docs/Outreach_crew_five_cli_contract.md)
  to document the new `campaign:audit` command and align the audit surface across CLI/Web.
- Updated [web/src/pages/CampaignOpsPage.tsx](/Users/georgyagaev/crew_five/web/src/pages/CampaignOpsPage.tsx) so
  secondary section failures (audit/drafts/outbounds/events) surface locally instead of collapsing the whole page into
  one global error banner.
- Updated [web/src/pages/CampaignOpsPage.tsx](/Users/georgyagaev/crew_five/web/src/pages/CampaignOpsPage.tsx) with
  search/filter/sort controls for the campaign list and campaign-company table, while preserving the existing shell and
  shared visual system.
- Updated the Campaigns review/ledger components in
  [web/src/components/CampaignDraftReview.tsx](/Users/georgyagaev/crew_five/web/src/components/CampaignDraftReview.tsx),
  [web/src/components/CampaignOutboundLedger.tsx](/Users/georgyagaev/crew_five/web/src/components/CampaignOutboundLedger.tsx),
  and [web/src/components/CampaignEventLedger.tsx](/Users/georgyagaev/crew_five/web/src/components/CampaignEventLedger.tsx)
  with trace-aware jump actions so operators can move between linked drafts, sends, and events without manual lookup.
- Updated [web/src/components/CampaignDraftReview.tsx](/Users/georgyagaev/crew_five/web/src/components/CampaignDraftReview.tsx),
  [web/src/pages/CampaignOpsPage.tsx](/Users/georgyagaev/crew_five/web/src/pages/CampaignOpsPage.tsx),
  [web/src/pages/CampaignOperatorDesk.tsx](/Users/georgyagaev/crew_five/web/src/pages/CampaignOperatorDesk.tsx),
  [README.md](/Users/georgyagaev/crew_five/README.md),
  [docs/Outreach_crew_five_cli_contract.md](/Users/georgyagaev/crew_five/docs/Outreach_crew_five_cli_contract.md),
  [docs/web_ui_endpoints.md](/Users/georgyagaev/crew_five/docs/web_ui_endpoints.md), and
  [docs/Campaigns_operator_desk_design_spec.md](/Users/georgyagaev/crew_five/docs/Campaigns_operator_desk_design_spec.md)
  to support structured reject reasons (`review_reason_code`, `review_reason_codes`, `review_reason_text`) through
  the existing `draft:update-status` metadata path.
- Updated [web/src/pages/CampaignOperatorDesk.tsx](/Users/georgyagaev/crew_five/web/src/pages/CampaignOperatorDesk.tsx)
  to preserve already-loaded draft context when sparse `POST /api/drafts/:draftId/content` responses are merged into
  local state, and documented the new route in
  [docs/web_ui_endpoints.md](/Users/georgyagaev/crew_five/docs/web_ui_endpoints.md).
- Updated [web/src/pages/CampaignOperatorDesk.tsx](/Users/georgyagaev/crew_five/web/src/pages/CampaignOperatorDesk.tsx)
  so message review actions now behave as a proper state machine:
  `generated -> approve + reject`, `approved -> reject only`, `rejected -> approve only`, `sent -> locked`.

## [0.2.11] - 2026-03-16
### Added
- Added a campaign-scoped event ledger to the operator surface via
  [web/src/components/CampaignEventLedger.tsx](/Users/georgyagaev/crew_five/web/src/components/CampaignEventLedger.tsx),
  embedded in [web/src/pages/CampaignOpsPage.tsx](/Users/georgyagaev/crew_five/web/src/pages/CampaignOpsPage.tsx).
- Added `GET /api/campaigns/:campaignId/events` to the Web adapter and documented it in
  [docs/web_ui_endpoints.md](/Users/georgyagaev/crew_five/docs/web_ui_endpoints.md).
- Added [docs/sessions/2026-03-16_1_campaign_event_ledger.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-16_1_campaign_event_ledger.md),
  covering the campaign-event visibility phase for the `Campaigns` operator surface.

### Changed
- Added a dedicated campaign event read model in
  [src/services/campaignEventReadModels.ts](/Users/georgyagaev/crew_five/src/services/campaignEventReadModels.ts)
  so the Web adapter can resolve `email_events` with outbound, draft, contact, and company context.
- Extended the Web adapter dependency contract with campaign-event support in
  [src/web/types.ts](/Users/georgyagaev/crew_five/src/web/types.ts),
  [src/web/liveDeps.ts](/Users/georgyagaev/crew_five/src/web/liveDeps.ts), and
  [src/web/mockDeps.ts](/Users/georgyagaev/crew_five/src/web/mockDeps.ts).
- Updated [web/src/apiClient.ts](/Users/georgyagaev/crew_five/web/src/apiClient.ts) and related tests so the
  campaign event ledger works in both live and mock modes.

## [0.2.10] - 2026-03-15
### Added
- Added [docs/sessions/2026-03-15_12_web_adapter_route_refactor.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-15_12_web_adapter_route_refactor.md),
  documenting the Web adapter refactor that split the route dispatcher and dependency wiring into smaller modules.

### Changed
- Refactored [src/web/server.ts](/Users/georgyagaev/crew_five/src/web/server.ts) into a thin bootstrap/wiring file
  and moved route handling into domain-focused modules under [src/web/routes](/Users/georgyagaev/crew_five/src/web/routes).
- Extracted Web adapter shared types, draft-row mapping, Smartlead bootstrap, and live/mock dependency factories into:
  [src/web/types.ts](/Users/georgyagaev/crew_five/src/web/types.ts),
  [src/web/draftView.ts](/Users/georgyagaev/crew_five/src/web/draftView.ts),
  [src/web/smartlead.ts](/Users/georgyagaev/crew_five/src/web/smartlead.ts),
  [src/web/liveDeps.ts](/Users/georgyagaev/crew_five/src/web/liveDeps.ts), and
  [src/web/mockDeps.ts](/Users/georgyagaev/crew_five/src/web/mockDeps.ts).
- Split large live adapter helper logic into focused modules under
  [src/web/liveDeps](/Users/georgyagaev/crew_five/src/web/liveDeps) so no new Web adapter file exceeds the repository's
  file-size guardrail.
- Re-ran verification after the refactor: targeted Web adapter route tests, `pnpm build`, `pnpm lint`, and full
  `pnpm test` all pass.

## [0.2.09] - 2026-03-15
### Added
- Added a campaign-scoped outbound ledger to the operator surface via
  [web/src/components/CampaignOutboundLedger.tsx](/Users/georgyagaev/crew_five/web/src/components/CampaignOutboundLedger.tsx),
  embedded in [web/src/pages/CampaignOpsPage.tsx](/Users/georgyagaev/crew_five/web/src/pages/CampaignOpsPage.tsx).
- Added `GET /api/campaigns/:campaignId/outbounds` to the Web adapter and documented it in
  [docs/web_ui_endpoints.md](/Users/georgyagaev/crew_five/docs/web_ui_endpoints.md).
- Added [docs/sessions/2026-03-15_11_campaign_outbound_ledger.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-15_11_campaign_outbound_ledger.md),
  covering the outbound-ledger phase of the Campaigns operator surface.

### Changed
- Added a new campaign-level read model in [src/services/campaigns.ts](/Users/georgyagaev/crew_five/src/services/campaigns.ts)
  so the Web UI can read `email_outbound` records with draft/contact/company context.
- Updated [web/src/apiClient.ts](/Users/georgyagaev/crew_five/web/src/apiClient.ts) and mock adapter wiring so the ledger
  works in both live and mock modes.

## [0.2.08] - 2026-03-15
### Added
- Added operator-facing draft review inside the `Campaigns` workspace surface via
  [web/src/components/CampaignDraftReview.tsx](/Users/georgyagaev/crew_five/web/src/components/CampaignDraftReview.tsx),
  linked from [web/src/pages/CampaignOpsPage.tsx](/Users/georgyagaev/crew_five/web/src/pages/CampaignOpsPage.tsx).
- Added a Web adapter review mutation `POST /api/drafts/:draftId/status` and documented the richer draft read contract in
  [docs/web_ui_endpoints.md](/Users/georgyagaev/crew_five/docs/web_ui_endpoints.md).
- Added [docs/sessions/2026-03-15_10_campaign_draft_review.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-15_10_campaign_draft_review.md),
  capturing the draft review phase for the Campaigns operator surface.

### Changed
- Extended `GET /api/drafts` to support `includeRecipientContext=true` and return richer operator-facing draft rows
  (subject, body, review status, contact/company, recipient resolution, metadata provenance).
- Reused the existing `draftStore` review/status flow in the Web adapter instead of introducing a parallel review model.
- Updated [web/README.md](/Users/georgyagaev/crew_five/web/README.md), [web/src/apiClient.ts](/Users/georgyagaev/crew_five/web/src/apiClient.ts),
  and related tests to reflect the new review surface.

## [0.2.07] - 2026-03-15
### Added
- Added a new `Campaign Ops` operator surface in the Web UI, integrated as a `Campaigns` section inside the
  existing workspace shell in [web/src/App.tsx](/Users/georgyagaev/crew_five/web/src/App.tsx) and backed by the new page
  [web/src/pages/CampaignOpsPage.tsx](/Users/georgyagaev/crew_five/web/src/pages/CampaignOpsPage.tsx).
- Added `GET /api/campaigns/:campaignId/companies` to the Web adapter and documented it in
  [docs/web_ui_endpoints.md](/Users/georgyagaev/crew_five/docs/web_ui_endpoints.md).
- Added [docs/sessions/2026-03-15_9_campaign_ops_mvp.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-15_9_campaign_ops_mvp.md),
  documenting the first operator-facing Campaign Ops implementation.

### Changed
- Added a campaign-level read model in
  [src/services/campaigns.ts](/Users/georgyagaev/crew_five/src/services/campaigns.ts) to expose campaign detail plus
  companies bound to the campaign snapshot.
- Extended [web/src/apiClient.ts](/Users/georgyagaev/crew_five/web/src/apiClient.ts) with `fetchCampaignCompanies()`.
- Added targeted coverage for the new service/API/UI flow in:
  - [tests/campaigns.test.ts](/Users/georgyagaev/crew_five/tests/campaigns.test.ts)
  - [tests/webCampaignOps.test.ts](/Users/georgyagaev/crew_five/tests/webCampaignOps.test.ts)
  - [web/src/apiClient.test.ts](/Users/georgyagaev/crew_five/web/src/apiClient.test.ts)
  - [web/src/App.test.tsx](/Users/georgyagaev/crew_five/web/src/App.test.tsx)
  - [web/src/pages/CampaignOpsPage.test.ts](/Users/georgyagaev/crew_five/web/src/pages/CampaignOpsPage.test.ts)

## [0.2.06] - 2026-03-15
### Added
- Added `docs/sessions/2026-03-15_8_web_ui_and_operator_backbone_roadmap.md`, capturing the recommended next-phase
  roadmap for campaign detail, enrichment visibility, draft review, outbound ledger, and event visibility in the
  Web UI.

## [0.2.05] - 2026-03-15
### Added
- Added `docs/sessions/2026-03-15_7_lint_warning_cleanup.md`, documenting the post-delivery lint cleanup.

### Changed
- Cleaned up the remaining ESLint warnings in examples, tests, and small runtime helpers so `pnpm lint`
  now completes without warnings.

## [0.2.04] - 2026-03-15
### Added
- Added `docs/sessions/2026-03-15_6_outreacher_task_closure_and_repo_hygiene.md`, summarizing final task closure,
  verification, and commit-prep steps for the current `Outreacher` integration batch.

### Changed
- Marked the current `docs/tasks/*.md` items as completed so the task list now matches the implemented `crew_five`
  state.
- Completed final repository hygiene for the current delivery batch by re-running the full test suite and build
  before commit.

## [0.2.03] - 2026-03-15
### Added
- Added `docs/sessions/2026-03-15_5_analytics_error_format_parity.md`, documenting the `analytics:*`
  CLI error-format parity fix for `Outreacher`.

### Changed
- `analytics:summary` now supports `--error-format json` and routes failures through the shared CLI error wrapper.
- `analytics:optimize` now also supports `--error-format json` for adjacent parity with `analytics:summary`.
- Updated `README.md` and `docs/Outreach_crew_five_cli_contract.md` so automation examples include the
  analytics commands in JSON error mode.

## [0.2.02] - 2026-03-15
### Added
- Added `docs/sessions/2026-03-15_4_outreacher_runtime_and_docs_updates.md`, recording the completed runtime +
  documentation work for the current `Outreacher` task set.

### Changed
- Snapshot payloads now persist a stable minimal company shape for `Outreacher`, including:
  - `company_description`
  - `website`
  - `employee_count`
  - `region`
  - `office_qualification`
  - `company_research`
- `enrich:run` now supports a real preview mode via `--dry-run`, including:
  - freshness-based counts
  - `--max-age-days`
  - `--force-refresh`
  - company-level `--limit`
  - comma-separated provider combinations treated as a union
- `campaign:list` now supports `--icp-profile-id`.
- Updated `docs/Outreach_crew_five_cli_contract.md`, `docs/Outreacher_operating_model.md`,
  `docs/Outreach_agent_runner_examples.md`, `README.md`, and the example runners to reflect the finalized
  `Outreacher` integration contract.

## [0.2.01] - 2026-03-15
### Added
- Added `docs/sessions/2026-03-15_2_outreacher_tasks_review_and_options.md`, a consolidated review of all current
  `docs/tasks/*` items from `Outreacher`, including implementation options, recommendations, and suggested execution
  order.
- Added `docs/sessions/2026-03-15_3_outreacher_improvements_execution_plan.md`, a detailed execution plan covering
  the agreed next phases:
  - minimal snapshot company payload parity
  - enrichment preview via `enrich:run --dry-run`
  - `campaign:list --icp-profile-id`
  - final docs/runner refresh
### Changed
- Refined the execution plan for `Outreacher` enrichment preview to use freshness-based semantics instead of simple
  filled/not-filled checks:
  - data older than 90 days is refresh-eligible by default
  - `Outreacher` can force refresh regardless of age
  - provider and provider-combination selection remains part of the contract
- Locked the enrichment preview/operator contract so `enrich:run --limit N` is interpreted as a company-level limit,
  with employee counts treated as secondary informational metrics.
- Simplified the planned freshness model for enrichment preview: use one shared timestamp per entity rather than
  provider-specific freshness timestamps.

## [0.2.00] - 2026-03-15
### Added
- Added repository migration `supabase/migrations/20260315093000_add_icp_profile_offering_domain.sql` to introduce
  `icp_profiles.offering_domain` and backfill current ICP rows to `voicexpert.ru`.
- Added a new session log `docs/sessions/2026-03-15_1_offering_domain_and_provenance.md` documenting the selected
  balanced offering provenance model.

### Changed
- `icp:create` and `icp:coach:profile` now accept `--offering-domain`, and `icp:list` now default-includes
  `offering_domain` in its JSON output.
- `draft:generate` now persists offering provenance in `drafts.metadata`:
  - `offering_domain`
  - `offering_hash`
  - `offering_summary`
- `email:record-outbound` now benefits from the existing metadata inheritance path, so offering provenance is carried
  into `email_outbound.metadata` automatically when sends are recorded.
- Updated `docs/Outreach_crew_five_cli_contract.md`, `docs/Database_Description.md`, `README.md`, and
  `docs/tasks/add_offering_domain_to_icp_profiles.md` to describe the new ICP/offering contract and live migration
  state.

## [0.1.99] - 2026-03-14
### Added
- Added shared recipient resolution logic for outbound orchestration:
  - prefer `employees.work_email`
  - fall back to `employees.generic_email`
  - classify resolved recipients as `corporate`, `personal`, `generic`, or `missing`
- Added `email:record-outbound` so external orchestrators such as `Outreacher` can persist send results into `email_outbound` and mark successful drafts as `sent`.
- Added targeted tests for recipient resolution, recipient-aware draft loading, outbound recording, and CLI wiring.
- Added session log `docs/sessions/2026-03-14_1_outreacher_imap_send_contract.md` documenting the selected `Outreacher -> imap_mcp -> crew_five` send architecture.
- Added ready-to-use `Outreacher` runner helpers for the IMAP send loop in both example runners:
  - `loadDraftsForSend` / `load_drafts_for_send`
  - `recordOutbound` / `record_outbound`
- Added payload templates for `draft:load --include-recipient-context`, `email:record-outbound`, and `event:ingest` in `docs/Outreach_agent_runner_examples.md`.
- Added `docs/Outreacher_operating_model.md`, a full operating guide for `Outreacher` covering send orchestration, inbox polling, follow-up scheduling, reply classification, and pattern analytics against `crew_five` + `imap_mcp`.

### Changed
- `draft:load` now supports `--include-recipient-context`, returning resolved recipient metadata (`recipient_email`, `recipient_email_source`, `recipient_email_kind`, `sendable`) alongside draft rows for send orchestration.
- Updated `docs/Outreach_crew_five_cli_contract.md` to document the IMAP MCP send loop, the outbound-recording payload, and the current live migration state.
- Updated `README.md` with the new `imap_mcp`-oriented send flow and CLI examples.

## [0.1.98] - 2026-03-13
### Added
- Added CLI commands for draft persistence and review workflows:
  - `draft:save` for inserting one or many drafts from JSON payloads.
  - `draft:load` for loading drafts by `campaign_id` with optional status/limit filters.
  - `draft:update-status` for review transitions (`generated|approved|rejected|sent`) with optional reviewer and metadata merge.
- Added CLI list commands for orchestration/wizard flows:
  - `segment:list` with optional ICP filters.
  - `campaign:list` with optional status/segment filters.
- Added repository migration `supabase/migrations/20260313110000_add_icp_profile_learnings.sql` so `icp_profiles` can persist `learnings jsonb`.
- Added `docs/Outreach_crew_five_cli_contract.md` documenting the shared-Supabase integration contract, JSON error handling, command surface, and migration prerequisites for using `crew_five` behind an `Outreach` AI agent.
- Added ready-to-adapt `Outreach` command-runner examples in TypeScript and Python plus a usage note in `docs/Outreach_agent_runner_examples.md`.

### Changed
- `icp:list` now allows richer profile columns, including `phase_outputs`, `learnings`, and `created_at`.
- `icp:hypothesis:list` now reads the real schema (`icp_hypotheses.icp_id`) while preserving CLI-compatible output fields such as `icp_profile_id` and `segment_id`.
- Updated `docs/Database_Description.md` to reflect the current live schema after applying the pending remote Supabase migrations (`icp_profiles.phase_outputs`, `icp_profiles.learnings`, `icp_discovery_*`, `prompt_registry.step` / rollout statuses).

### Fixed
- Wrapped `icp:list` and `icp:hypothesis:list` in the shared `wrapCliAction` flow so list failures no longer surface as unhandled promise rejections.
- Segment snapshots now carry `company_research` in `segment_members.snapshot.company`, aligning downstream consumers with the current enrichment field instead of older company-description assumptions.
- Suppressed `dotenv` tip output during env loading by enabling quiet mode, preventing stdout noise from breaking JSON pipe consumers in `Outreach`.

## [0.1.97] - 2026-01-27
### Changed
- Updated `docs/Database_Description.md` to reflect the current Supabase `public` schema (tables, columns,
  constraints, indexes, and RLS state).

## [0.1.96] - 2026-01-21
### Fixed
- Draft generation now reports insert errors back to the caller (summary includes `failed` + `error` message).
- Pipeline Draft step now shows `failed`/`skippedNoEmail` in the summary and blocks advancing to Send unless drafts were saved.

## [0.1.95] - 2026-01-21
### Fixed
- Draft generation now fills required draft fields (`email_type`, `language`, `pattern_mode`) from the request when
  the LLM response metadata is incomplete, preventing insert failures that left `drafts` empty in Live mode.

## [0.1.94] - 2026-01-20
### Added
- Added helper scripts: `pnpm start:web` (tsx) and `pnpm start:web:dist` (Node on `dist/web/server.js`).
### Fixed
- Draft generation now skips contacts without an email and scans deeper than the requested limit to fulfill the
  requested draft count when possible.
- Built web adapter now runs under Node ESM (`node dist/web/server.js`) by using explicit `.js` specifiers and
  avoiding directory imports in the adapter dependency graph.

## [0.1.93] - 2026-01-20
### Fixed
- Draft generation now builds `EmailDraftRequest` from `segment_members.snapshot.contact/company` when `snapshot.request` is absent, so Live draft generation inserts rows into `drafts` as expected.

## [0.1.92] - 2026-01-20
### Added
- Pipeline Draft step now exposes a `Dry-run` vs `Live (save drafts)` toggle for draft generation.
### Changed
- Draft dry-run no longer unlocks the Send step (prevents Smartlead prepare without persisted drafts).

## [0.1.91] - 2026-01-20
### Added
- Campaign creation is now available from the Pipeline Draft step:
  - `POST /api/campaigns` creates a Supabase campaign bound to a segment snapshot (`segment_id`, `segment_version`).
  - Web UI now supports inline campaign creation and auto-selects it for draft generation.
### Fixed
- Web unit tests no longer try to execute Playwright specs: `web/vite.config.ts` excludes `web/e2e/**` from Vitest.

## [0.1.90] - 2026-01-19
### Changed
- Pipeline workspace Send step now runs “Prepare Smartlead” from the UI (supports dry-run + batch size) instead of preview-only messaging.
- `formatSendSummary` now reflects “Smartlead prepare” semantics.

## [0.1.89] - 2026-01-15
### Changed
- Smartlead “send” now prepares campaigns via the direct Smartlead API: pushes leads from `segment_members` and syncs the first sequence step from Supabase drafts (no one-off MCP sendEmail).
- `POST /api/smartlead/send` now requires `{ campaignId, smartleadCampaignId }` and returns a prepare summary (`leadsPrepared`, `sequencesSynced`, etc.).
### Added
- New tests covering Smartlead prepare (`smartleadSendCommand`) and the web adapter endpoint contract.

## [0.1.88] - 2026-01-15
### Added
- Firecrawl enrichment now runs deterministically via `search → scrape` using `companies.website`, storing prompt-safe `summary + sources` (no raw markdown blobs).
- Enrichment settings now probe providers on save to prevent enabling invalid/expired credentials.
- Enrichment jobs now persist richer `jobs.result` metadata: provider id, per-entity counts, and sampled errors.
### Changed
- Enrichment settings moved from single `primaryProvider` to per-entity primaries: `primaryCompanyProvider` and `primaryEmployeeProvider`.
- Draft/Sim/Send provenance now carries per-entity primaries (`metadata.enrichment_provider` and `payload.enrichment_provider` as `{ company, employee }`).
### Fixed
- Web UI now saves and displays enrichment settings using the V2 shape and shows both company/lead primaries.
- Drafts UI now renders primary provider provenance for both legacy (string) and new (object) metadata shapes.

## [0.1.87] - 2025-12-27
### Added
- New reference doc with real provider outputs (pre-schema): `docs/enrichment_results_2025-12-27_ucmsgroup_topframe_voicexpert.md` captures EXA/Firecrawl/AnySite results plus Firecrawl **Search** outputs (and Parallel auth failures) for `ucmsgroup.ru`, `topframe.ru`, and `voicexpert.ru` to inform the next “fixed schema” decision.

## [0.1.86] - 2025-12-26
### Added
- New reference doc: `docs/ENRICHMENT_PROVIDER_CONTRACT.md` defines the unified provider schema + multi-provider UX contract (primary authoritative + supplemental summaries).
### Fixed
- Segment step no longer shows “0 companies” for filter-based segments: `GET /api/segments` now attaches derived counts (`company_count`, `employee_count`, `total_count`) computed from each segment’s stored `filter_definition`.

## [0.1.85] - 2025-12-26
### Added
- Drafts UI now shows enrichment provenance (primary provider + included providers) by consuming `metadata.enrichment_provider` and `metadata.enrichment_by_provider` from `GET /api/drafts`.
### Changed
- `GET /api/drafts` now returns `metadata` for each draft so later workflow phases can surface provenance consistently.

## [0.1.84] - 2025-12-26
### Added
- Persisted hybrid enrichment provenance on drafts (`drafts.metadata.enrichment_provider` and `drafts.metadata.enrichment_by_provider`) and propagated it into send artifacts (`email_outbound.metadata`) for both SMTP and Smartlead sends.
### Changed
- Sim job creation now includes `payload.enrichment_provider` so simulation requests retain the selected primary provider context even before sim is implemented.

## [0.1.83] - 2025-12-26
### Added
- Hybrid enrichment context for drafting: the AI request now includes `brief.context.enrichment_by_provider` (summarized payloads for all non-primary providers plus a primary marker), enabling “use all providers as supplemental, but primary is authoritative” without blowing up prompt size.
### Changed
- AI system prompt now explicitly instructs the model to treat `brief.context.enrichment_provider` as authoritative when providers conflict, using `enrichment_by_provider` only for gap-filling/validation.

## [0.1.82] - 2025-12-26
### Added
- Per-provider enrichment result storage (`EnrichmentStoreV1`) for `companies.company_research` and `employees.ai_research_data`, so multi-source runs merge `providers.{providerId}` instead of overwriting prior provider outputs.
### Changed
- Draft generation now reads the global `primaryProvider` and injects the primary provider’s company + lead enrichment into the AI request (`brief.company.enrichment`, `brief.context.lead_enrichment`) alongside `brief.context.enrichment_provider`.
- Vitest now runs as two projects (`node` + `web/jsdom`) so `pnpm test` covers the full suite consistently.
### Fixed
- Web Playwright E2E config now loads repo-root `.env` so Supabase-backed E2E tests can initialise without manual env exports.

## [0.1.81] - 2025-12-26
### Added
- Global enrichment settings surface for provider defaults + a single `primaryProvider` (used for both company and employee enrichment downstream): new web endpoints `GET/POST /api/settings/enrichment`, web client helpers (`fetchEnrichmentSettings`, `saveEnrichmentSettings`), and Supabase schema support via `public.app_settings`.
- Multi-provider enrichment endpoint `POST /api/enrich/segment/multi` (sequential per provider) plus web client helper `enqueueSegmentEnrichmentMulti`, enabling one-click runs across multiple selected providers.
### Changed
- Pipeline Enrichment step now lets users toggle providers via compact chips, reset to defaults, and displays the configured primary provider inline; Settings modal adds toggles for default providers and a primary-provider selector while preventing enabling providers without verified API credentials.

## [0.1.80] - 2025-12-20
### Fixed
- ICP profile creation (CLI and `/api/icp/profiles`) now tolerates environments where the `icp_profiles.phase_outputs` column has not yet been migrated by retrying inserts without `phase_outputs` when that specific column-not-found error (including schema-cache variants like “Could not find the 'phase_outputs' column…”) is detected, while still persisting phase outputs when the column is present.
### Verified
- Confirmed that ICP profile creation via the AI coach (`createIcpProfileViaCoach` and `/api/coach/icp`) uses the same fallback logic and successfully persists profiles on the current Supabase project.
- Confirmed that Hypothesis creation (`createIcpHypothesis`, `/api/icp/hypotheses`, and `createIcpHypothesisViaCoach`) already operates against existing columns only and works end-to-end without additional schema changes.
### Changed
- Pipeline step bar styling in `PipelineWorkspaceWithSidebar` now distinguishes the active step from previously completed ones, and clicking an earlier step (ICP or Hypothesis) correctly moves the visual focus back to that step so workflow colors stay in sync when navigating backwards from Segment.

## [0.1.79] - 2025-12-19
### Added
- New `contains` operator to the segment filter DSL, allowing case-insensitive substring matches for text fields (implemented as SQL `ILIKE '%value%'`) across both backend (`src/filters/index.ts`) and web UI types (`web/src/types/filters.ts`). This makes filters like `employees.position contains "Генеральный"` possible without requiring exact matches.
- Segment Builder’s filter row now exposes the `contains` operator in its operator dropdown, reusing the existing text input for values so manual segments and AI-suggested filters can describe roles and titles more naturally.
### Changed
- Filter coach system prompt and documentation (`docs/SEGMENT_FILTER_COACH.md`) updated so AI-generated filter suggestions may use `contains` in addition to `eq`, `in`, `not_in`, `gte`, and `lte`, keeping the LLM’s contract in sync with the backend DSL and validation.

## [0.1.78] - 2025-12-19
### Fixed
- Hardened `/api/filters/preview` company-step logic so `companies.employee_count` and other company-level numeric filters always run on a filter-capable Supabase builder; if the base `from('companies')` builder is missing comparison/list operators, the service now upgrades it via `.select('*')` before applying `eq`/`in`/`not_in`/`gte`/`lte`, avoiding runtime errors like `current.gte is not a function`.
- Extended filter preview tests to cover the mixed-builder case (base builder without `gte`, filter builder returned by `.select('*')`) and to verify that company filters still return realistic company/employee counts when constrained by `companies.employee_count`.

## [0.1.77] - 2025-12-18
### Fixed
- Segment filter preview for `companies.employee_count` now uses a shared allowlisted DSL and an embedded `company:companies(...)` relationship in `getFilterPreviewCounts`, so filters like `companies.employee_count >= 45` return realistic counts instead of `0` matches or PostgREST embed errors.  
- `/api/filters/preview` error handling is aligned with the filter validation helper, returning clear 400 responses when fields are not in the allowlist while preserving existing success semantics for the web adapter.
### Changed
- Segment Builder’s Preview panel now formats validation errors from `/api/filters/preview` into a user-friendly message (including the supported field list) instead of surfacing raw strings like `API error 400: Unknown field: companies.employee_`, making it easier for users to correct invalid filter fields without reading Supabase internals.

## [0.1.76] - 2025-12-18
### Added
- Repository-wide **library-first rule** in `AGENTS.md` for non-core utilities and infrastructure code: before adding new helper logic (>20–30 lines), contributors must check npm for an actively maintained, typed library (≥1k weekly downloads, permissive license, acceptable bundle size for `web/`), adopt it when it cleanly covers ≥70% of the needed functionality, and reserve custom implementations for clearly domain-specific logic (GTM spine behaviour, Supabase schema semantics, `generate_email_draft` contract, segment filter DSL, campaign/judge analytics, Smartlead-specific orchestration). PRs are expected to include a brief note confirming the library-first check.
- Workspace Hub design system hook-up for Segment forms: introduced a shared `WorkspaceColors` palette in `web/src/theme.ts`, wired `PipelineWorkspaceWithSidebar` to use it, and updated the Database Search `SegmentBuilder` and EXA Web Search `ExaWebsetSearch` modals to consume the palette (CTAs now use the orange accent and shared surface/border/text colors) while preserving existing modal structure. Added a “Design System & Colors” section in `AGENTS.md` so future Web UI work reuses the same palette instead of ad-hoc hex values.

## [0.1.75] - 2025-12-17
### Added
- **AI-Assisted Segment Builder & EXA Webset Integration**: Three new segment creation methods in the Pipeline Workspace Segment tab:
  - **Manual Filter Building**: Users can build segments with up to 10 filter rows, supporting field/operator/value combinations with real-time preview counts (companies, employees, total). Filter operators include eq, in, not_in, gte, lte across employees.* and companies.* fields. Powered by new `useFilterPreview` hook with 500ms debouncing and `POST /api/filters/preview` endpoint.
  - **AI-Assisted Filter Suggestions**: AI chat integration generates 1-3 filter suggestions from natural language descriptions via `POST /api/filters/ai-suggest`, with each suggestion showing rationale, target audience, and live preview counts. Users can select suggestions to populate the filter builder. Powered by extended `icpCoach.ts` service.
  - **EXA Web Search**: Direct web search for companies and employees using natural language queries via `POST /api/exa/search`. Results display in tabbed interface (companies/employees) with immediate segment creation. Includes duplicate detection by domain (companies) and email (employees), batch insert with proper FK relationships, and best-effort error recovery. Creates segment_members immediately without requiring separate snapshot step.
- Backend services: `filterPreview.ts` for live filter counts, `exaWebset.ts` for EXA API integration with profile detection and confidence scoring, extended `icpCoach.ts` with `generateSegmentFiltersViaCoach` for AI filter generation.
- Backend endpoints: `POST /api/filters/preview` for filter preview counts, `POST /api/filters/ai-suggest` for AI-generated filter suggestions, `POST /api/exa/search` for EXA web search, `POST /api/segments/exa` for EXA segment persistence with duplicate detection.
- Frontend components: `FilterRow` for individual filter UI with 10 common field suggestions, `SegmentBuilder` modal combining manual filters and AI chat, `AIFilterSuggestions` card display for AI suggestions, `ExaWebsetSearch` modal for EXA search with tabbed results.
- Frontend hooks: `useFilterPreview` for debounced filter preview (500ms), `useExaSearch` for EXA search state management with loading/error handling.
- Type definitions: `web/src/types/filters.ts` for filter UI types, `web/src/types/exaWebset.ts` for EXA result types.
- Comprehensive test coverage: 70+ tests across all components and hooks (FilterRow, SegmentBuilder, AIFilterSuggestions, ExaWebsetSearch, useFilterPreview, useExaSearch).
- Playwright E2E coverage for segment search and enrichment (T029 filter-based and T030 EXA Web Search) implementing `specs/001-segment-search/e2e-test-plan.md`, including UI segment creation, CLI-driven `segment:snapshot` / `enrich:run`, and Supabase assertions for `segments`, `segment_members`, `jobs`, `companies.company_research`, and `employees.ai_research_data`.
### Changed
- Pipeline Workspace Segment tab: "Search Database" button now opens SegmentBuilder modal (replaces AI chat), "EXA Web Search" button now functional and opens ExaWebsetSearch modal.
- Segment list automatically refreshes after creation via both Database Search and EXA Web Search flows.
- Both segment creation methods integrate with existing enrichment workflow: filter-based segments require snapshot before enrichment, EXA segments are immediately enrichable.
### Fixed
- TypeScript compilation issues in web build: excluded test and example files from production build, removed unused imports, fixed duplicate variable declarations.
- Build verification: both backend and frontend compile successfully (frontend bundle: 338KB).
### Documentation
- Added `specs/001-segment-search/enrichment-compatibility-verification.md`: Complete schema verification showing both segment types (filter-based, EXA) are fully compatible with existing enrichment workflow.
- Added `specs/001-segment-search/e2e-test-plan.md`: Comprehensive end-to-end test plans for both Database Search and EXA Web Search workflows with step-by-step instructions, database verification queries, and troubleshooting guide.

## [0.1.74] - 2025-12-15
### Changed
- Updated `docs/web_ui_endpoints.md` to include the `/api/services`, `/api/llm/models`, and
  `/api/inbox/messages` web adapter endpoints, refreshed the Settings and Pipeline workspace screen
  mappings to reflect live usage of these APIs, and bumped the document version to `v0.2` so the
  Web UI endpoint catalog remains in sync with `src/web/server.ts` and `web/src/apiClient.ts`.
 - Added an explicit cross-link from `docs/web_ui_requirements.md` to `docs/web_ui_endpoints.md` so
   readers can jump directly from behaviour/navigation requirements to the concrete Web adapter
   endpoint map.
 - Extended `AGENTS.md` with a Web adapter rule: any creation, modification, or removal of HTTP
   endpoints in `src/web/server.ts` (or their clients in `web/src/apiClient.ts`) must be accompanied
   by an update to `docs/web_ui_endpoints.md` to keep the catalog authoritative.

## [0.1.73] - 2025-12-13
### Added
- Pipeline segment step now surfaces a “Review candidates in ICP Discovery” call-to-action whenever an Exa discovery run has been persisted, using `hasPersistedDiscoveryRun` and `openIcpDiscoveryForLatestRun` to deep-link into the `?view=icp-discovery` web view without adding a new router.  
- `IcpDiscoveryPage` now hydrates `discoveryRunId`, ICP profile, and hypothesis selection from the latest persisted discovery record and auto-loads candidates once on deep-linked visits, while keeping the manual “Load candidates” path unchanged for hand-typed run ids.  
- Parallel.ai enrichment now uses a minimal non-throwing stub client built by `buildParallelClientFromEnv`; `researchCompany` / `researchContact` return `{ provider: 'parallel', summary, sources }`, and the `parallel` adapter in `createEnrichmentProviderRegistry` maps this into a stable `{ provider, entity, company_id/contact_id, summary, sources, payload }` shape for `runSegmentEnrichmentOnce`.
### Changed
- Updated session doc `docs/sessions/2025-12-13_4_exa-discovery-multisource-and-icp-deep-interactive-plan.md` to record the new Exa discovery UX behaviour, the Parallel enrichment stub, and the first ICP Deep Interactive helpers (`resolveCoachRunMode` / `applyCoachResultToState` wired into `handleAiSend`), with further UI toggles deferred to a follow-up session.

## [0.1.72] - 2025-12-13
### Added
- Interactive ICP/Hypothesis coach refinements in the Pipeline Workspace AI Assistant: new helpers
  `appendInteractiveCoachMessage`, `buildInteractiveIcpPrompt`, and `buildInteractiveHypothesisPrompt` now
  construct `userPrompt` strings that combine the latest ICP/hypothesis summaries with the user’s message, and
  transcript entries are tagged with step/entity id while being trimmed to the most recent messages for
  readability.  
- Exa discovery entry improvements in the Pipeline segment step: `handleRunDiscovery` now persists the latest
  discovery metadata via `persistLatestDiscoveryRun`, and the **EXA Web Search** and **Search Database** tiles
  either trigger a discovery run or open the AI Assistant with a guided prompt instead of remaining visual-only.  
### Changed
- Enrichment provider registry tests now assert that unknown providers raise a coded
  `ENRICHMENT_PROVIDER_UNKNOWN` error, documenting the error surface for future Parallel/Firecrawl/Anysite
  routing without changing existing Exa behaviour.

## [0.1.71] - 2025-12-13
### Added
- IcpDiscoveryPage now includes a lightweight “Coach conversation (latest runs)” panel that records user prompts and assistant summaries for ICP and Hypothesis coach runs, using the same phase-derived summary helpers as the Pipeline workspace; helper functions `appendDiscoveryChatMessage`, `formatIcpSummaryForChatDiscovery`, and `formatHypothesisSummaryForChatDiscovery` are covered by new tests and keep formatting logic DRY by delegating to the shared Pipeline helpers.

## [0.1.70] - 2025-12-12
### Changed
- Normalized OpenAI and Anthropic base URLs for both `/models` listing and chat-completion endpoints via `normalizeOpenAiBaseUrl` / `normalizeAnthropicBaseUrl`, reducing 404s when using custom proxies or non-`/v1` bases and aligning the ChatClient tests with the new behaviour.
- Relaxed `resolveModelConfig` so explicit `provider`/`model` pairs from the Web UI or CLI are accepted without requiring a catalog entry, while still providing curated defaults when flags are omitted; this ensures Settings and Prompts tab selections map directly to the provider APIs without hidden overrides.
- Updated live web adapter coach endpoints to always honour `provider`/`model` flags (using `buildChatClientForModel`) for ICP and Hypothesis coach runs instead of silently falling back to the default client when configuration is present but not in the catalog.
- Wired ICP discovery page coach actions to forward both provider/model and the selected Prompt Registry IDs (`taskPrompts.icpDiscovery`/`taskPrompts.hypothesisGen`), so ICP/Hypothesis “Chat with AI” now uses the same prompt + model configuration as the Pipeline workspace.
- Extended the Pipeline Workspace “Current Configuration” sidebar to render ICP and Hypothesis summaries via `buildIcpSummaryFromProfile` / `buildHypothesisSummaryFromSearchConfig`, preferring `icp_profiles.phase_outputs` and `icp_hypotheses.search_config.phases` when present and falling back to existing criteria, with helper-level Vitest coverage and a Playwright-driven browser run validating quick ICP/hypothesis creation and LLM connectivity.

## [0.1.69] - 2025-12-11
### Added
- LLM model listing helpers in `src/services/providers/llmModels.ts` plus a new CLI command `gtm llm:models --provider openai|anthropic` and web endpoint `GET /api/llm/models?provider=…`, providing a concrete proof of OpenAI/Anthropic connectivity using the configured API keys.
- ICP coach Express mode now returns strongly-typed phase payloads for profiles and hypotheses; `createIcpProfileViaCoach` maps these into structured `company_criteria`/`persona_criteria` and a new `icp_profiles.phase_outputs` snapshot column, while hypotheses persist phase 4–5 offers/critiques under `icp_hypotheses.search_config.phases`.
- Web Pipeline Workspace now surfaces provider `/models` errors (for example, OpenAI/Anthropic 401/404 responses) directly in the "Live LLM models" panel via `mapLlmModelsErrorMessage`, making misconfigured keys or base URLs easier to troubleshoot.
- ICP and Hypothesis coach flows now consume `prompt_registry.prompt_text` as the system prompt when a `promptId` is configured, and use the free-text message from the UI as the user prompt; prompt resolution errors (missing row or `prompt_text` column) surface as clear HTTP/CLI errors instead of falling back silently.
- Web API client and Pipeline/ICP pages now forward `userPrompt` and `promptId` fields into `/api/coach/icp` and `/api/coach/hypothesis`, so the Prompts tab Task Configuration directly drives the LLM messages used for ICP/Hypothesis generation.
### Changed
- Provider/Model dropdowns in the Settings modal and Prompts tab Task Configuration now derive their options from the shared model catalog in `src/config/modelCatalog.ts`, filtering models per provider/task and automatically correcting invalid persisted combinations to the nearest valid default.
- Live web adapter `createLiveDeps` continues to fall back to a stub ChatClient when provider env is missing, but per-request overrides for coach/draft generation now rely on the curated model catalog and no longer introduce new silent fallbacks when provider/model flags are misconfigured.

## [0.1.68] - 2025-12-11
### Changed
- Prompts tab creation flows are now step-less in the Web UI: both the dedicated `PromptRegistryPage` and the inline “New prompt entry” form in the Pipeline workspace create registry rows without requiring a `step` value, while still working against environments where the `prompt_registry.step` column is absent.
- Task Configuration on the Prompts tab now uses a flat list of prompts for all tasks (ICP Discovery, Hypothesis Generation, Email Draft, LinkedIn Message); selections are stored per task in local state instead of relying on step-based active prompts.
- Web coach flows (`icp`/`hypothesis`) and draft generation now pass the Task Configuration selections through as explicit prompt IDs (`promptId` / `explicitCoachPromptId`), and `generateDrafts` prefers these explicit IDs over step-based resolution so backend behaviour matches the Prompts tab configuration without hidden fallbacks.
- Task Configuration prompt selections are now persisted per browser via the existing `useSettingsStore` (`localStorage`): after reloading the page, each task’s selected prompt ID is restored and continues to drive coach and draft flows.
- Web adapter coach endpoints `/api/coach/icp` and `/api/coach/hypothesis` now return `{ jobId, profile }` / `{ jobId, hypothesis }` to match existing tests and the Web API client expectations, fixing a runtime `Cannot read properties of undefined (reading 'id')` error in AI-assisted ICP/Hypothesis flows after the `jobs_type_check` constraint was updated to allow `icp` jobs.
- Added first-class OpenAI and Anthropic ChatClients plus a `buildChatClientForModel` factory; the live web adapter now uses the curated model catalog to select a provider/model and build a real LLM client when API keys are present, while tests inject stub chat clients to avoid network calls.
- CLI `runCli` now builds its `ChatClient` via the same model catalog + `buildChatClientForModel` pipeline as the web adapter, with a JSON stub fallback when provider env is missing; helper tests cover both real and stub paths.
- Prompts tab Task Configuration `Provider`/`Model` selectors now read/write the shared Settings store and are used for ICP coach and draft generation: the web adapter builds per-request chat clients based on the selected provider/model when those values are passed in, while unsupported providers (for now, Gemini) surface as runtime errors instead of silently falling back.

## [0.1.67] - 2025-12-10
### Changed
- Prompts tab Task Configuration now reads from the live prompt registry: prompt dropdowns for ICP Discovery, Hypothesis Generation, and Email Draft are populated from `prompt_registry` by step, and the "Active prompt" labels under each task reflect the current active prompt per step.
- Selecting a prompt in Task Configuration or clicking "Set active" in the Prompt Registry table now use a shared helper that calls `/api/prompt-registry/active` and refreshes the registry, keeping task summaries and the registry table in sync without adding new schema or legacy fallbacks.

## [0.1.66] - 2025-12-09
### Changed
- ICP and Hypothesis “Chat with AI” in the Pipeline workspace now resolve the active prompts for `icp_profile` and `icp_hypothesis` from the prompt registry and pass the selected `promptId` through `/api/coach/icp` and `/api/coach/hypothesis`, so coach runs are explicitly tied to Prompts tab configuration.
- The workspace Prompts tab has been wired to the live prompt registry: it loads entries via `/api/prompt-registry`, surfaces rollout status labels, and adds a “Set active” action per prompt that calls `/api/prompt-registry/active` and refreshes the list; draft generation continues to use the active `draft` prompt as before.
- Prompt reference documentation now describes how ICP coach flows use `promptId` from the registry, aligning Web UI, coach services, and analytics with a single prompt-selection mechanism.
- Prompt registry endpoints now normalize rows so the UI works with human `coach_prompt_id` values (not internal UUIDs), and the Prompts tab includes an inline “Create prompt” form that posts to `/api/prompt-registry` and immediately refreshes the table so new `icp_profile`, `icp_hypothesis`, and `draft` prompts can be created without leaving the workspace.
- Live web adapter ICP coach helpers (`generateIcpProfile` / `generateIcpHypothesis`) and coach services now thread optional `promptId` metadata into job payloads, allowing analytics and future tooling to attribute ICP/hypothesis generations to specific prompt variants.
- The inline Create Prompt form now persistently stores `prompt_text` in a new `prompt_registry.prompt_text` column so the textarea saves instead of being a stub, and the compact left sidebar centers the `P/I/A/PR` labels so the collapsed tabs feel aligned.

## [0.1.65] - 2025-12-09
### Added
- Pipeline workspace (`web/src/pages/PipelineWorkspaceWithSidebar.tsx`) is now wired end-to-end for ICP → Hypothesis → Segment → Enrichment → Draft → Send, using the live web adapter endpoints for ICP, hypotheses, segments, enrichment, draft generation (`POST /api/drafts/generate`), campaigns (`GET /api/campaigns`), Smartlead preview (`GET /api/smartlead/campaigns`, `POST /api/smartlead/send`), and the unified services inventory (`GET /api/services`); the UI remains aligned with the original design but now reflects all `.env`-backed providers.
- Web docs (`docs/options/Pipeline Workspace - API Endpoints Inventory.md`) updated to document the implemented services inventory, draft, and Smartlead preview wiring for the pipeline workspace, clarifying that Send runs in dry-run/preview mode from the UI while full delivery remains CLI/Smartlead-dashboard driven.

## [0.1.64] - 2025-12-06
### Changed
- `enrich:run` CLI now supports `--error-format text|json` and is wrapped with shared `wrapCliAction` error handling, so unknown or misconfigured enrichment providers (for example, an invalid `--provider` value) surface as structured `{ ok:false, error:{ code,message } }` payloads instead of unhandled exceptions.
- Extensibility docs (`public-docs/EXTENSIBILITY_AND_CONNECTORS.md`) updated to describe `enrich:run --provider` routing through the enrichment provider registry and the use of stable error codes like `ENRICHMENT_PROVIDER_UNKNOWN` for automation.
 - ICP discovery Web UI “Pre-import review” panel now disables “Promote approved candidates” when no segment or approvals are selected, shows a clear empty state when a discovery run returns zero candidates, and surfaces a richer promotion summary including run id and segment name; a `Run discovery` control has been added next to the Exa query plan in preparation for triggering discovery directly from the UI. 
 - `docs/web_ui_endpoints.md` added as a Web adapter reference, cataloguing all `/api` endpoints in `src/web/server.ts` and mapping them to the Web UI screens and `web/src/apiClient.ts` helpers.

## [0.1.63] - 2025-12-05
### Added
- ICP discovery promotion helper `promoteIcpDiscoveryCandidatesToSegment` wired into the CLI (`icp:discover --promote --segment-id ... --candidate-ids ...`) and web adapter (`POST /api/icp/discovery/promote`), moving approved Exa candidates into `companies` / `segment_members` with ICP tags.
- Web ICP discovery UI now includes a “Promote approved candidates” flow on `IcpDiscoveryPage`, calling the new promotion API and showing a small promotion summary; associated tests cover API usage and success messaging.
- Enrichment provider registry (`createEnrichmentProviderRegistry`) supporting `mock`, `exa`, `parallel`, `firecrawl`, and `anysite` adapters, plus a `--provider` flag on `enrich:run` so enrichment sources can be selected via configuration without changing job semantics.

## [0.1.62] - 2025-12-05
### Added
- Exa enrichment research client (`buildExaResearchClientFromEnv`) and Supabase-bound Exa enrichment adapter wired into the async job-backed `enrich:run --adapter exa` flow for companies and employees.
- Enrichment registry updates and tests so `getEnrichmentAdapter('exa', supabase)` returns the Exa adapter, plus guards that keep Exa on the async path (legacy sync disabled).
- Shape-only HTTP clients for Parallel.ai, Firecrawl.dev, and Anysite.io with env validation helpers and tests, ready to be routed via the enrichment registry in a later phase.
- Database reference and session log updates documenting how Exa enrichment populates `companies.company_research` and `employees.ai_research_data`, with Phase 1 marked complete.

## [0.1.61] - 2025-12-05
### Added
- Parallel.ai and Firecrawl.dev provider env helpers (`loadParallelEnv`, `loadFirecrawlEnv`) plus tests, with README and setup guide updates summarizing required keys and default base URLs.
- Documentation updates clarifying research/enrichment integration: Exa is the primary discovery engine via a small HTTP client, AnySite is used as a targeted enrichment provider (LinkedIn/social/web parsing) via a narrow HTTP interface, and MCP servers for Exa/AnySite are optional façades for external agents.
- Repository guidelines in `AGENTS.md` now explicitly recommend adding short, focused code comments on genuinely tricky parts (invariants, edge cases, non-obvious integrations) while keeping routine code self-explanatory.

## [0.1.60] - 2025-12-05
### Added
- Prompt registry now supports an “active per step” prompt via new web adapter endpoints (`GET /api/prompt-registry?step=…`, `GET /api/prompt-registry/active`, `POST /api/prompt-registry/active`) with dispatch and client tests.
- Web API client and `PromptRegistryPage` now filter entries by step, display an “Active” badge, and expose a “Set active” button that persists the active prompt through the new endpoints.
- Draft generation threads resolved `coach_prompt_id` from the prompt registry into `drafts.metadata.draft_pattern`, so analytics can attribute patterns to the configured coach prompt instead of only the LLM default.

## [0.1.59] - 2025-12-04
### Added
- Web ICP discovery UI now surfaces coach results and job ids next to the “Generate via coach” actions, auto-selects newly created profiles/hypotheses, and reuses existing error alerts for coach failures.
- New CLI commands `icp:coach:profile` and `icp:coach:hypothesis` wrap the coach orchestrator and emit JSON-only `{ jobId, profileId }` / `{ jobId, hypothesisId }` payloads for scripting.
- Coach HTTP responses are standardized to `{ jobId, profile }` / `{ jobId, hypothesis }`, with `web/src/apiClient.ts` returning typed coach results for the UI.

## [0.1.58] - 2025-12-03
### Added
- Generic chat client abstraction `src/services/chatClient.ts` and refactored `AiClient` to delegate to it, with updated tests for draft generation and coach services.
- ICP coach LLM helpers in `src/services/icpCoach.ts` plus orchestration functions `createIcpProfileViaCoach` / `createIcpHypothesisViaCoach` in `src/services/coach.ts`, including `jobs` support for a new `icp` job type via migration `supabase/migrations/20251203190000_extend_jobs_type_icp.sql`.
- Web adapter and CLI wiring updated to construct `AiClient` from chat clients and to expose `/api/coach/icp` / `/api/coach/hypothesis` through the new coach orchestration layer; session plan `docs/sessions/2025-12-03_1_icp-coach-express-plan.md` documents the express ICP flow and prompt location.

## [0.1.57] - 2025-12-02
### Added
- `docs/options/2025-12-02_icp_and_oss_reuse_options.md` capturing OSS reuse options for ICP creation and discovery (SalesGPT coach, AI Sales Assistant Chatbot RAG, Exa/AnySite pipelines, and data-driven ICP suggestions).

## [0.1.56] - 2025-12-02
### Changed
- Web README now calls out Smartlead API as the primary integration path; MCP connector exists but lacks a
  verified secure provider, so API envs should be used for live runs.
- `.env.example` now highlights Smartlead API vars (`SMARTLEAD_API_BASE`/`SMARTLEAD_API_KEY`) and leaves MCP
  entries as optional/fallback.

## [0.1.55] - 2025-12-02
### Changed
- Web README now has step-by-step instructions to start the adapter (live vs mock) and Vite dev server,
  including ports and env hints.

## [0.1.54] - 2025-12-02
### Changed
# 2026-03-21

- Added campaign-level auto-send settings to the `campaigns` table via
  [20260321091500_add_campaign_auto_send_settings.sql](/Users/georgyagaev/crew_five/supabase/migrations/20260321091500_add_campaign_auto_send_settings.sql):
  `auto_send_intro`, `auto_send_bump`, and `bump_min_days_since_intro`.
- Added the canonical auto-send sweep service in
  [campaignAutoSend.ts](/Users/georgyagaev/crew_five/src/services/campaignAutoSend.ts), so the live
  adapter now evaluates intro readiness via `campaign:send-preflight`, bump eligibility via
  `campaign:followup-candidates`, and triggers `Outreach` without inventing a parallel workflow.
- Added the `Outreach` command bridge in
  [sendCampaignTrigger.ts](/Users/georgyagaev/crew_five/src/web/liveDeps/sendCampaignTrigger.ts) and
  the non-overlapping scheduler in
  [autoSendScheduler.ts](/Users/georgyagaev/crew_five/src/web/autoSendScheduler.ts), then wired both
  into the live web adapter bootstrap in [server.ts](/Users/georgyagaev/crew_five/src/web/server.ts).
- Added canonical auto-send settings read/write in
  [campaignAutoSendSettings.ts](/Users/georgyagaev/crew_five/src/services/campaignAutoSendSettings.ts),
  exposed via CLI commands `campaign:auto-send:get` / `campaign:auto-send:put` in
  [cli.ts](/Users/georgyagaev/crew_five/src/cli.ts) and Web routes
  `GET|PUT /api/campaigns/:id/auto-send` in
  [campaignRoutes.ts](/Users/georgyagaev/crew_five/src/web/routes/campaignRoutes.ts).
- Added frontend and `Outreach` handoff docs for the next stage:
  [campaign_auto_send_web_ui.md](/Users/georgyagaev/crew_five/docs/tasks/campaign_auto_send_web_ui.md)
  and
  [Outreacher_auto_send_scheduler_handoff.md](/Users/georgyagaev/crew_five/docs/Outreacher_auto_send_scheduler_handoff.md).
- Recorded the implementation session in
  [2026-03-21_2_auto_send_scheduler_backend.md](/Users/georgyagaev/crew_five/docs/sessions/2026-03-21_2_auto_send_scheduler_backend.md).
- Added the required auto-send runtime variables to
  [.env.example](/Users/georgyagaev/crew_five/.env.example): `AUTO_SEND_ENABLED`,
  `AUTO_SEND_INTERVAL_MINUTES`, `AUTO_SEND_BATCH_LIMIT`, and
  `OUTREACH_SEND_CAMPAIGN_CMD`.
- Added a follow-up design/task note for campaign-local send calendar policy in
  [campaign_send_policy_and_calendar_gate.md](/Users/georgyagaev/crew_five/docs/tasks/campaign_send_policy_and_calendar_gate.md),
  documenting that `ICP` / `offer` may prefill defaults, but runtime send window and timezone must
  be stored explicitly on the campaign and enforced by the scheduler.
- Added a detailed backend implementation brief for the next stage in
  [campaign_send_policy_backend.md](/Users/georgyagaev/crew_five/docs/tasks/campaign_send_policy_backend.md),
  covering schema, services, scheduler integration, CLI/Web surfaces, tests, and required
  handoffs.
# 0.2.45 - 2026-03-22

- Made `Home` the default primary entrypoint; `?view=pipeline` remains the explicit legacy pipeline route.
- Ran final stage live UI E2E smoke and confirmed current operator surfaces work in `Campaigns` and `Builder V2`.
- Installed local Playwright Chromium and documented that the current `web/e2e` suite is a stale
  legacy segment/discovery suite, with a follow-up task to refresh it for the current stage-closeout gate.
