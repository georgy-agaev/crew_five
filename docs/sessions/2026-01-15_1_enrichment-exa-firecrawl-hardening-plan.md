# Session Plan: Enrichment hardening for EXA + Firecrawl (segment → stored results)

Date: 2026-01-15  
Timestamp (UTC): 2026-01-15T20:22:56Z

## Overview

This session hardens enrichment so the **Enrich** button reliably produces **useful, prompt-safe data** for the
currently working providers (**EXA** + **Firecrawl**) using **real segment members**. We explicitly avoid expanding
scope to legacy fallbacks or schema redesign; we only fix what is needed to make the enrichment step dependable
for the workflow right now.

## Scope (only what we need now)

- ✅ Make Firecrawl enrichment run against `companies.website` (not UUIDs).
- ✅ Standardize a deterministic “search → scrape” Firecrawl flow (homepage + best matching pages).
- ✅ Store **prompt-safe** Firecrawl results (summary + sources only; no raw markdown blobs stored).
- ✅ Support **primary provider per entity type**:
  - `primaryCompanyProvider` and `primaryEmployeeProvider` (company vs lead can differ).
- ✅ Enforce provider credential verification **on settings save**:
  - Users cannot enable a provider unless a live probe confirms credentials are valid.
- ✅ Write richer job result metadata so “Enriching…” never feels opaque:
  - Store per-provider counts + sampled errors in `jobs.result`.

  - Company: `companies.company_research.providers.<providerId>`
  - Lead: `employees.ai_research_data.providers.<providerId>`
- ✅ Add unit tests that protect the core behavior and prevent regressions.

Out of scope for this session:

- AnySite and Parallel provider wiring (currently failing due to expired/invalid credentials).
- Any fixed “normalized schema” design beyond the existing store format.
- Centralized enrichment runner refactor (keep logic inside adapters for now).

## Files to change

- `src/integrations/firecrawl.ts` — implement a real Firecrawl HTTP client (`search`, `scrape`) with timeouts and
  URL normalization.
- `src/services/enrichment/registry.ts` — update Firecrawl adapter to fetch company/employee rows from Supabase and
  call Firecrawl using meaningful inputs (website/domain/name).
- `src/services/enrichmentSettings.ts` — move from single `primaryProvider` to
  `primaryCompanyProvider` + `primaryEmployeeProvider`, and validate settings via live provider probes on save.
- `src/services/drafts.ts`, `src/services/sim.ts`, `src/services/aiClient.ts` — update downstream context to use the
  per-entity primaries.
- `src/services/enrichSegment.ts` — write structured per-provider counts/errors into `jobs.result`.
- `tests/enrichment.test.ts` — add Firecrawl adapter behavior tests.
- `tests/enrichmentProviders.test.ts` (or a new `tests/firecrawlClient.test.ts`) — test Firecrawl client request
  formation and env requirements.
- `web/src/apiClient.ts`, `web/src/pages/PipelineWorkspaceWithSidebar.tsx` — update settings payload shape and the
  displayed “primary providers” in the Enrichment step.

## Implementation plan (minimal, end-to-end)

1. Update enrichment settings to V2 (`primaryCompanyProvider` + `primaryEmployeeProvider`) and enforce live credential
   verification on save.
2. Implement Firecrawl client primitives (`search`, `scrape`) with strict timeouts and no retries (MVP).
3. Implement Firecrawl enrichment adapter:
   - deterministic page selection from search results,
   - scrape limited pages,
   - store summary + sources only.
4. Update downstream prompt/context injection (Drafts/Sim/Send) to use per-entity primaries.
5. Add unit tests (mocking `fetch` + mocked Supabase client).
6. Verify with a small live run via Web UI (Enrich with `limit=5`).

## Functions to add / modify

### `normalizeWebsiteUrl(website: string | null): string | null`

Normalizes DB `companies.website` values (often stored as a bare domain) into a valid URL with an `https://`
scheme, trimming whitespace and handling already-normalized URLs.

### `buildFirecrawlClientFromEnv(envLoader?): FirecrawlClient`

Turns `FIRECRAWL_API_KEY` + `FIRECRAWL_API_BASE` into a real HTTP client, enforcing required env vars and applying
per-request timeouts (to avoid UI “Enriching…” hangs).

### `FirecrawlClient.search(input: { query: string; limit?: number }): Promise<SearchResult[]>`

Calls `POST /v1/search` and returns a compact list of `{ url, title?, description? }`. This is used to pick high
value pages before scraping.

### `FirecrawlClient.scrape(input: { url: string }): Promise<ScrapeResult>`

Calls `POST /v1/scrape` (markdown format) and returns metadata plus **truncated** markdown excerpt(s) to keep the
stored payload prompt-safe.

### `createFirecrawlEnrichmentAdapter(supabase, firecrawl): EnrichmentAdapter` (modify)

For companies, loads `company_name` + `website` and runs Firecrawl `search → scrape` on a small set of pages.
Stores only `summary` + `sources` (no full markdown). Employee Firecrawl enrichment is optional because
`primaryEmployeeProvider` will default to EXA for now.

### `getPrimaryProvidersForWorkflow(supabase): Promise<{ company: string; employee: string }>`

Reads enrichment settings and returns the current per-entity primary providers for downstream steps.

### `probeEnrichmentProvider(providerId): Promise<{ ok: boolean; reason?: string }>`

Executes a minimal live “credential probe” (cheap request) for the provider. Used only during settings save to
prevent enabling a provider with missing/expired/invalid credentials.

## Test plan (unit tests)

Add/extend tests to cover behavior with fetch and Supabase mocked.

### `firecrawl_client_requires_api_key_env`

Throws a helpful error when `FIRECRAWL_API_KEY` is missing.

### `firecrawl_client_search_sends_authorized_json_request`

Uses Bearer auth and correct body for `/v1/search`.

### `firecrawl_enrichment_stores_summary_and_sources_only`

Ensures Firecrawl provider result avoids large raw markdown.

### `firecrawl_enrichment_adapter_uses_company_website_not_company_id`

Fetches company row and scrapes the website, not UUID.

### `run_segment_enrichment_once_firecrawl_writes_store_under_provider_key`

`companies.company_research.providers.firecrawl` is inserted/merged correctly.

### `draft_generation_uses_primary_company_and_employee_providers`

Company enrichment comes from company-primary; lead from employee-primary.

### `set_enrichment_settings_rejects_unverified_providers`

Settings save fails when provider probe fails.

## Validation (manual / E2E)

- In Web UI, select a real segment and run **Enrich** with providers `exa` + `firecrawl` and a small `limit` (e.g. 5).
- Confirm via Network tab:
  - `POST /api/enrich/segment/multi` returns per-provider `completed` status when `runNow=true`.
- Confirm via Supabase:
  - `companies.company_research` contains `EnrichmentStoreV1.providers.firecrawl` and `providers.exa`.
  - `employees.ai_research_data` contains `providers.exa` (employee primary) even when company primary is Firecrawl.

## Completed

- Enrichment settings upgraded to V2 (`primaryCompanyProvider`, `primaryEmployeeProvider`) and wired end-to-end (API,
  UI, downstream services).
- Provider credential verification enforced on Settings save (live probe), preventing enabling invalid/expired keys.
- Firecrawl integration implemented (deterministic `search → scrape` using `companies.website` with prompt-safe
  storage: summary + sources only).
- Downstream hybrid context updated to use per-entity primaries across Drafts/Send/Sim provenance.
- Enrichment jobs now store richer `jobs.result` metadata (provider + per-entity counts + sampled errors).
- Unit tests updated/added; `pnpm test`, `pnpm build`, `pnpm lint` pass (lint has warnings only).

## To Do

- Run a small live enrichment pass in Web UI (limit=5) and capture screenshots/logs for the session record.
- Restore Parallel/AnySite provider credentials (currently rejected by probes) and validate their adapters.
- Decide on fixed schema for shared fields after collecting 2+ providers with overlapping outputs.
