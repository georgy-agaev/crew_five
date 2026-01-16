# 2025-12-04 – Exa Discovery & Profile Enrichment Plan

> Timestamp (UTC): 2025-12-04T17:28:42Z  
> Goal: Wire Exa Websets + search into ICP discovery and company/profile enrichment using a minimal HTTP-based provider surface, with clear hooks for Parallel/Firecrawl/AnySite later and no new legacy fallbacks.

## Overview
- Implement only the flows we need now: ICP → Exa Websets → candidate staging → human review → companies/employees, plus Exa-powered research into `company_research` / `ai_research_data`.
- Keep integrations HTTP-only inside the backend (no MCP dependency), hide raw provider details behind small TS interfaces, and plug Exa into the existing enrichment adapter path.
- Add just enough schema (discovery run + candidate tables) and API surface (CLI + Web adapter + Web UI) to make Workflow 1 genuinely usable, while leaving Parallel/Firecrawl/AnySite as thin stubs for future sessions.

## Options
- **Option A – Exa-first HTTP providers (chosen for this session)**  
  Exa gets full Websets + research coverage via a small `ExaClient`, wired into ICP discovery + enrichment; Parallel/Firecrawl/AnySite are added later by implementing the same interfaces.
- **Option B – Generic discovery/enrichment provider registry**  
  Define broader `DiscoveryProvider`/`ResearchProvider` interfaces and implement Exa, Parallel, Firecrawl, AnySite in one go; maximally flexible but more code up front than we need today.
- **Option C – HTTP core + optional MCP façade**  
  Same as Option A internally, but additionally expose a thin MCP tool surface (e.g. `exa_websets_search`) that simply calls our HTTP providers; useful if we want external LLM agents to reuse the same flows.

For the next session we will follow **Option A**, making sure the interfaces are shaped so that Options B/C remain possible without rewrites.

## Scope (files to touch)
- **Integrations**
  - `src/integrations/exa.ts` (new) – Exa HTTP client (`createWebset`, `getWebsetItems`) and `buildExaClientFromEnv`. ✅ Implemented with env validation, auth headers, and tests in `tests/exaClient.test.ts`.
  - `src/services/enrichment/registry.ts` – add an `ExaEnrichmentAdapter` (and stubs for Parallel/Firecrawl/AnySite) implementing the existing `EnrichmentAdapter` interface.
- **Services**
  - `src/services/icpDiscovery.ts` (new) – ICP discovery orchestration using Exa Websets, discovery run + candidate writes, and list helpers.
  - `src/services/enrichSegment.ts` – ensure enrichment uses the Exa adapter when `adapter='exa'`, keep async job path as the default (no new legacy modes).
- **CLI**
  - `src/commands/icpDiscover.ts` (new) – `icp:discover` handler that calls `runIcpDiscoveryWithExa` and prints a JSON summary.
  - `src/cli.ts` – wire `icp:discover` with flags (`--icp-profile-id`, `--icp-hypothesis-id`, `--limit`, `--dry-run`, `--error-format`), no legacy fallback flags.
- **Web adapter & UI**
  - `src/web/server.ts` – add `/api/icp/discovery` (POST to start a run, GET to list runs/candidates) delegating to `icpDiscovery` services and Exa client.
  - `web/src/apiClient.ts` – add `triggerIcpDiscovery` and `fetchIcpDiscoveryCandidates` helpers.
  - `web/src/pages/IcpDiscoveryPage.tsx` – replace stub `candidates` array with API-backed candidates for the pre-import review table, and surface any Exa-related errors.
- **Database & config**
  - `supabase/migrations/20251204180000_add_icp_discovery_tables.sql` (new) – `icp_discovery_runs` and `icp_discovery_candidates` tables + RLS policies.
  - `docs/Database_Description.md` – add sections for the new discovery tables and how they relate to `companies`/`employees`/`icp_*`.
  - `.env.example`, `README.md` – document `EXA_API_KEY`/`EXA_API_BASE` (and placeholders for Parallel/Firecrawl/AnySite) and clarify ICP discovery flow is now backed by Exa.
  - `CHANGELOG.md` – note Exa-backed ICP discovery and enrichment landing.
- **Tests**
  - `tests/icpDiscovery.test.ts` (new) – service/DB interaction for discovery runs and candidates.
  - `tests/enrichment.test.ts` – ensure `ExaEnrichmentAdapter` and `enrich:run --adapter exa` behaviour.
  - `tests/cli.test.ts` – CLI wiring and `icp:discover` happy-path + error cases.
  - `web/src/pages/IcpDiscoveryPage.test.tsx` – extend coverage beyond `deriveQueries` to include API-backed candidate rendering.

## To Do
- **1. Exa env + HTTP client (minimal surface)**  
  ✅ Completed in this slice (`src/integrations/exa.ts`, `tests/exaClient.test.ts`).  
  - `buildExaClientFromEnv()` now validates `EXA_API_KEY`, respects `EXA_API_BASE`, and issues authenticated HTTP requests for `createWebset`/`getWebsetItems`, with tests covering missing key and auth/base URL behaviour.

- **2. Supabase schema for ICP discovery staging (RLS-on)**  
  ✅ Partially completed in this slice (`supabase/migrations/20251205120000_add_icp_discovery_tables.sql`).  
  - `icp_discovery_runs` now exists with `id`, `job_id`, `icp_profile_id`, `icp_hypothesis_id`, `provider`, `status`, `metadata`, timestamps, and indexes; `icp_discovery_candidates` exists with `run_id`, basic company fields, `confidence`, `raw` JSON, and indexes.  
  - RLS policies and docs wiring (`docs/Database_Description.md`) remain To Do for a follow-up doc/DB session.

- **3. Service layer: `icpDiscovery` orchestration (Exa-only for now)**  
  ✅ First slice completed as job-backed run creation (`src/services/icpDiscovery.ts`, `tests/icpDiscovery.test.ts`).  
  - `runIcpDiscoveryWithExa` now creates a `jobs` row (`type='icp'`), inserts an `icp_discovery_runs` row, calls `ExaClient.createWebset`, and updates both run and job to `running` with `provider_run_id` stored in `metadata`.  
  - Candidate polling/normalization (`getWebsetItems` → `icp_discovery_candidates`) and `listIcpDiscoveryCandidates` are deferred to a dedicated “candidate ingestion” session.

- **4. CLI: `icp:discover` command (no legacy modes)**  
  ✅ Minimal implementation completed (`src/commands/icpDiscover.ts`, `src/cli.ts`, `tests/cli.test.ts`).  
  - `icp:discover` now requires `--icp-profile-id` (with optional `--icp-hypothesis-id`/`--limit`), calls `runIcpDiscoveryWithExa`, and prints a JSON summary `{ jobId, runId, provider, status }` suitable for scripting; dry-run/query-plan support is deferred to a later refinement.

- **5. Web adapter + API client: ICP discovery endpoints**  
  ✅ Completed in this slice (`src/web/server.ts`, `web/src/apiClient.ts`, `web/src/apiClient.test.ts`).  
  - `src/web/server.ts` now routes `POST /api/icp/discovery` and `GET /api/icp/discovery/candidates` through `runIcpDiscovery` and `listIcpDiscoveryCandidates` in the live deps, returning 501 when Exa is not configured; `src/web/server.test.ts` covers both code paths with stubbed deps.  
  - `web/src/apiClient.ts` exposes `triggerIcpDiscovery` and `fetchIcpDiscoveryCandidates`, with tests asserting payloads and URLs.

- **6. Web UI: IcpDiscoveryPage backed by staging tables**  
  ✅ Partially completed in this slice (`web/src/pages/IcpDiscoveryPage.tsx`, `web/src/pages/IcpDiscoveryPage.test.tsx`).  
  - The stub `candidates` array has been removed; the pre-import review table now displays candidates loaded via `fetchIcpDiscoveryCandidates`, using a pasted `runId` and optional ICP ids, and maps them into UI companies via `mapDiscoveryCandidatesToCompanies` (tested).  
  - A future iteration can add a true “Run ICP discovery” button that calls `triggerIcpDiscovery` directly from the UI; for now, discovery runs are triggered via CLI and reviewed in the UI.

- **7. Profile enrichment: plug Exa into the enrichment adapter path**
  - Extend `src/services/enrichment/registry.ts`:
    - Introduce an `ExaEnrichmentAdapter` that, given `{ company_id }` or `{ contact_id }`, fetches the corresponding row (using a Supabase client provided by closure) and calls Exa `answer` (or `search+contents`) to produce a small research JSON blob.
    - Keep the adapter focused: for this session, only write “who they are / what they do” summaries plus 1–3 source URLs into `company_research` and `ai_research_data`, reusing existing columns.
  - Update `enrichSegment.ts` (and the legacy path in `enrich.ts` only as needed) to obtain the Exa adapter via a helper that binds Supabase, e.g. `getEnrichmentAdapter(name, client)`, and adjust tests accordingly.
  - Ensure `enrich:run --adapter exa` stays purely async/job-based; no new legacy flags.

- **8. Parallel/Firecrawl/AnySite stubs (no full flows yet)**
  - Add minimal config placeholders and TS interfaces in `src/integrations/exa.ts` or a sibling file for:
    - `ParallelClient` (for future heavy research runs),
    - `FirecrawlClient` (for future multi-page crawl/snapshots),
    - `AnySiteClient` (for future LinkedIn/social enrichment).
  - Do not wire these into any user-facing commands yet; limit this session to defining shapes and env placeholders so later sessions can attach them to discrete flows.

## Functions (1–3 sentences)
- `buildExaClientFromEnv()` (`src/integrations/exa.ts`)  
  Reads `EXA_API_KEY`/`EXA_API_BASE` from the environment, validates configuration, and returns a minimal `ExaClient` with `createWebset`, `getWebsetItems`, and `answer`/`search` methods; throws a clear error when misconfigured.

- `runIcpDiscoveryWithExa(supabase, exaClient, input)` (`src/services/icpDiscovery.ts`)  
  Given an ICP profile + hypothesis (and optional limit), builds an Exa Websets query plan, persists an `icp_discovery_runs` row, calls Exa, polls for completion, and writes normalized candidates into `icp_discovery_candidates` before returning a summary.

- `listIcpDiscoveryCandidates(supabase, filters)` (`src/services/icpDiscovery.ts`)  
  Fetches candidate rows from `icp_discovery_candidates` filtered by `runId`/`icpProfileId`/`icpHypothesisId`, returning a UI/CLI-friendly DTO (`{ id, name, domain, country, size, confidence }`).

- `discoverCompaniesForIcpCommand(client, exaClient, options)` (`src/commands/icpDiscover.ts`)  
  CLI handler for `icp:discover` that validates options, performs a dry-run query-plan preview when requested, calls `runIcpDiscoveryWithExa` otherwise, and prints structured JSON suitable for scripting.

- `getEnrichmentAdapter(name, supabase?)` (`src/services/enrichment/registry.ts`)  
  Returns the configured `EnrichmentAdapter` implementation (mock or Exa-based) and, when a Supabase client is provided, binds it into the adapter so it can look up company/contact rows before calling external providers.

- `ExaEnrichmentAdapter.fetchCompanyInsights({ company_id })` (`src/services/enrichment/registry.ts`)  
  Loads the company row, calls Exa to obtain a short company summary and source URLs, and returns a JSON object suitable for writing into `company_research`.

- `ExaEnrichmentAdapter.fetchEmployeeInsights({ contact_id })` (`src/services/enrichment/registry.ts`)  
  Optionally uses company + contact context to call Exa for persona-focused snippets (or leaves this as a thin stub for now), returning JSON for `ai_research_data`.

- `triggerIcpDiscovery` / `fetchIcpDiscoveryCandidates` (`web/src/apiClient.ts`)  
  Thin Web UI helpers that POST to start a discovery run and GET candidates for the currently selected ICP/hypothesis, reusing the same DTO shape as the service.

## Tests (name → behaviour)
- `exa_client_requires_api_key_env` – throws when EXA_API_KEY missing or empty.
- `icp_discovery_run_creates_webset_and_run_row` – persists run with provider/webset ids.
- `icp_discovery_persists_candidates_with_icp_and_run_tags` – candidates include ICP/hypothesis/run identifiers.
- `icp_discover_cli_respects_dry_run_and_limit` – dry-run avoids Exa calls, prints plan.
- `icp_discover_cli_outputs_summary_in_json_format` – emits machine-readable summary on success.
- `icp_discovery_api_returns_501_when_exa_disabled` – web adapter signals not configured instead of crashing.
- `web_icp_discovery_page_renders_api_backed_candidates` – replaces stub list with fetched candidates.
- `web_icp_discovery_page_shows_error_on_api_failure` – displays Alert when discovery/candidate fetch fails.
- `exa_enrichment_adapter_updates_company_research` – writes Exa summary into `company_research`.
- `exa_enrichment_adapter_updates_employee_ai_research_data` – writes Exa JSON into `ai_research_data` for contacts.
- `enrich_run_with_exa_adapter_uses_async_job_flow` – `enrich:run --adapter exa` enqueues job and respects dry-run.

## Completed
- ICP profiles/hypotheses schema and services are in place (`icp_profiles`, `icp_hypotheses`, `createIcpProfile`, `createIcpHypothesis`), and the coach-based JSON generator is already wired through `/api/coach/icp` and `/api/coach/hypothesis`.
- `companies` and `employees` already include `company_research` and `ai_research_data` fields, and segment-level enrichment plumbing (`enrich:run`, `SegmentEnrichmentSummary`, `EnrichmentAdapter`) exists with a working mock adapter.
- ICP discovery UI scaffolding is present in `web/src/pages/IcpDiscoveryPage.tsx` (ICP/hypothesis selectors, derived query plan section, and a pre-import review table) and just needs to be backed by real discovery data.
- Exa is called out in the PRD and architecture docs as the primary engine for ICP discovery & expansion, and an Exa API key has been added to `.env` for this project.
- RLS is now enabled on the core Supabase tables, so new `icp_discovery_*` tables will be created with RLS on from day one and aligned policies.
