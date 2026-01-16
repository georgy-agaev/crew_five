# Session: Enrichment provider defaults + primary provider (multi-source UX)

Date: 2025-12-26

## Overview

This session introduces a global settings surface for enrichment providers (default enabled providers + a single
`primaryProvider` used for both company and employee enrichment downstream) and a low-click UX to run enrichment
across one or multiple selected providers from the Enrichment step.

## Completed

- Added a global settings storage table `public.app_settings` (migration: `supabase/migrations/20251226230000_add_app_settings.sql`).
- Implemented enrichment settings service helpers in `src/services/enrichmentSettings.ts`.
- Added web adapter endpoints:
  - `GET /api/settings/enrichment`
  - `POST /api/settings/enrichment`
  - `POST /api/enrich/segment/multi`
- Enrichment API now auto-creates/refreshes a finalized segment snapshot before enqueueing enrichment jobs, so the Web UI
  does not require a separate manual snapshot step.
- Web-triggered enrichment now uses a safe default cap (`limit=25`) when `runNow=true` and no explicit limit is provided,
  preventing multi-provider runs from hanging on large segments.
  - Note: this cap applies to enrichment processing (selected members), not to snapshot creation; snapshot creation must
    remain uncapped to avoid errors like “Contact count X exceeds max 25”.
- Updated Web UI:
  - Settings modal now lets users enable default enrichment providers and pick a single primary provider.
  - Enrichment step now shows provider chips (toggle per run), a “Reset to defaults” action, and displays the
    current primary provider.
- Persisted enrichment results per provider (per-entity, per-adapter) to avoid overwrites:
  - Company enrichment now stores `company_research` as `EnrichmentStoreV1` (`{ version: 1, providers: { [providerId]: ... } }`).
  - Employee enrichment now stores `ai_research_data` as `EnrichmentStoreV1` with the same per-provider `providers` map.
  - Each provider run merges into the store instead of replacing the whole column.
- Draft generation now uses the configured `primaryProvider` to build an “effective view” for downstream steps:
  - On draft generation, we inject `brief.company.enrichment` and `brief.context.lead_enrichment` from the primary provider’s stored results.
  - We also add `brief.context.enrichment_provider` so the prompt can explain which provider was used.
  - Hybrid supplemental mode: we additionally inject `brief.context.enrichment_by_provider`, which contains:
    - A lightweight primary marker for the `primaryProvider` (`mode: "primary"`, plus size metadata).
    - Summarized payloads for all other providers (`mode: "summary"`, `company_summary` / `lead_summary`), so the model can
      fill gaps or validate without overriding the primary provider.
- Persisted the same hybrid context for later workflow phases (Outreach/Sim/Send) via metadata propagation:
  - Draft inserts now store `metadata.enrichment_provider` and `metadata.enrichment_by_provider` so downstream phases can
    reuse the chosen primary provider and supplemental summaries without re-computing.
  - Send flows (`sendQueuedDrafts` and `smartleadSendCommand`) now propagate draft metadata into `email_outbound.metadata`,
    keeping enrichment provenance available during Send and for later analytics/debugging.
  - Sim job creation now includes `payload.enrichment_provider` (resolved from the same global settings) so simulation
    requests carry the primary provider context even before the sim engine is implemented.
- Drafts list UI now surfaces this provenance so users can confirm the chosen primary provider:
  - `GET /api/drafts` returns the draft `metadata` so the UI can show `enrichment_provider` + included providers.
  - Drafts page renders compact columns for “Enrichment (primary)” and “Providers”.
- Documented a unified enrichment provider schema + multi-provider UX contract in `docs/ENRICHMENT_PROVIDER_CONTRACT.md`.
- Added/updated unit tests:
  - `src/web/server.test.ts` covers settings endpoints + multi-enrich route.
  - `web/src/apiClient.test.ts` covers client calls for the new endpoints.
  - `tests/enrichmentStore.test.ts` covers store parsing and merge semantics.
  - `tests/enrichment.test.ts` and `tests/drafts.test.ts` updated for the new store format + prompt injection.
- Test runner improvements:
  - `vitest.config.ts` now runs two projects (`node` + `web/jsdom`) so `pnpm test` executes both suites correctly.
- Updated docs:
  - `docs/web_ui_endpoints.md` updated with new endpoints and version bump.
  - `CHANGELOG.md` updated with a new release entry.
- Updated E2E harness:
  - `web/playwright.config.ts` now loads repo-root `.env` for Supabase/service keys so `pnpm test:e2e` works without manual exports.

## Notes / Observations

- Segment list counts are now computed directly from the stored `filter_definition` (using the same allowlisted filter
  preview engine) so newly created filter-based segments show realistic company/contact counts immediately without
  requiring a snapshot up-front. Segments without a compatible `filter_definition` still display `0` counts.

## To Do

- Normalize provider adapters so all sources accept meaningful inputs (company website/name, employee full name,
  role, etc.) and return consistent result shapes.
- Add a compact UI for conflict visibility: show which provider returned which fields; highlight differences; keep
  “primary provider” as the only required resolution mechanism for now.
- Decide whether segment creation should eagerly snapshot into `segment_members` (for immediate enrichability) or stay
  lazy (snapshot-on-enrich), now that counts are not tied to snapshots anymore.
- Apply the new `app_settings` migration to the target Supabase project if it hasn’t been deployed yet.
