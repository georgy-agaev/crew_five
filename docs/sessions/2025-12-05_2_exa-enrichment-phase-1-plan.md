# 2025-12-05 – Exa Enrichment Phase 1 Plan

> Timestamp (UTC): 2025-12-05T00:00:00Z  
> Goal: add a minimal Exa-backed enrichment adapter that can write lightweight research into `company_research` / `ai_research_data` via the existing `enrich:run --adapter exa` flow, without introducing legacy sync paths or MCP dependencies.

## Overview
We’ll build only what’s needed to make `enrich:run --adapter exa` useful in practice: a small Exa enrichment adapter, wiring into the existing async job-based enrichment flow, and tests that confirm research is written into the appropriate JSON columns. In parallel, we will add *shapes only* for `Parallel.ai`, `Firecrawl.dev`, and `Anysite.io` (HTTP clients + adapter skeletons) so future sessions can plug them into the same registry, without wiring them into user-facing commands yet or introducing any new legacy/synchronous modes.

## Scope (files to touch)
- **Integrations**
  - `src/integrations/exa.ts` – extend the Exa client with a minimal `answer`/`research` function suitable for company/person summaries (no general search wrapper yet).
  - `src/integrations/parallel.ts` (new) – define a minimal `ParallelClient` interface and `buildParallelClientFromEnv()` that validates `PARALLEL_API_KEY`/`PARALLEL_API_BASE`, but only exposes the methods needed for future enrichment (no live wiring this session).
  - `src/integrations/firecrawl.ts` (new) – define a minimal `FirecrawlClient` interface and `buildFirecrawlClientFromEnv()` that validates `FIRECRAWL_API_KEY`/`FIRECRAWL_API_BASE`, again as a shape-only client for later use.
  - `src/integrations/anysite.ts` (new) – define a minimal `AnySiteClient` interface and `buildAnySiteClientFromEnv()` that validates `ANYSITE_API_KEY`/`ANYSITE_API_BASE`, matching the same pattern as Parallel/Firecrawl for future LinkedIn/social enrichment.
- **Services**
  - `src/services/enrichment/registry.ts` – introduce an `ExaEnrichmentAdapter` and a `getEnrichmentAdapter` helper that returns either the mock adapter or Exa adapter based on `adapter` name, with Supabase bound in via closure.
  - `src/services/enrichSegment.ts` – ensure the async/job enrichment path uses `getEnrichmentAdapter('exa', supabase)` when `adapter='exa'`, and stays strictly async-only (no new legacy flags).
- **CLI**
  - `src/cli.ts` – keep the existing `enrich:run --adapter exa` surface but ensure we’re not referencing any legacy/fallback flags for the Exa path.
- **Docs**
  - `docs/Database_Description.md` – briefly note how Exa enrichment populates `company_research` and `ai_research_data` for analytics and drafting.
  - `CHANGELOG.md` – add an entry summarizing Exa enrichment support landing.

## Functions (1–3 sentences)
- `buildExaResearchClientFromEnv()` (`src/integrations/exa.ts`)  
  Reads `EXA_API_KEY`/`EXA_API_BASE` and returns a small client with a single `researchCompany`/`researchContact` method that calls Exa (e.g. via `answer`) to produce a short summary and source URLs. It should reuse the base HTTP wrapper behaviour from the existing Exa client.

- `createExaEnrichmentAdapter(supabase, exaClient)` (`src/services/enrichment/registry.ts`)  
  Returns an adapter object that implements the existing `EnrichmentAdapter` interface, with methods that look up companies/contacts, call Exa for research, and write results into `company_research` and `ai_research_data` respectively.

- `getEnrichmentAdapter(name, supabase)` (`src/services/enrichment/registry.ts`)  
  Chooses between the mock adapter and Exa adapter based on `name` (`'mock'` or `'exa'`), binding the provided Supabase client and Exa client; throws a clear error if an unknown adapter name is requested.

- `enrichSegmentWithAdapter(supabase, adapterName, options)` (`src/services/enrichSegment.ts`)  
  Reuses the existing async enrichment workflow but delegates actual enrichment work to `getEnrichmentAdapter`, ensuring that `enrich:run --adapter exa` simply selects a different adapter without changing job semantics.

## Tests (name → behaviour in 5–10 words)
- `exa_research_client_requires_api_key_env`  
  Exa research client throws when API key missing.

- `exa_research_client_calls_answer_with_expected_payload`  
  Constructs Exa answer/research request with company context.

- `exa_enrichment_adapter_updates_company_research`  
  Adapter writes Exa summary JSON into company_research.

- `exa_enrichment_adapter_updates_employee_ai_research_data`  
  Adapter writes Exa persona JSON into ai_research_data.

- `get_enrichment_adapter_returns_exa_when_requested`  
  Registry yields Exa adapter for adapter='exa'.

- `enrich_run_with_exa_adapter_uses_async_job_flow`  
  `enrich:run --adapter exa` enqueues job, stays async-only.

- `parallel_client_requires_api_key_env`  
  Throws when PARALLEL_API_KEY missing or empty.

- `firecrawl_client_requires_api_key_env`  
  Throws when FIRECRAWL_API_KEY missing or empty.

- `anysite_client_requires_api_key_env`  
  Throws when ANYSITE_API_KEY missing or empty.

## Completed vs To Do
- **Completed (previous sessions)**  
  - Exa HTTP client for discovery (`createWebset`, `getWebsetItems`) and discovery runs/candidates schema with job-backed orchestration and Web/CLI wiring.
- **Completed (this session)**  
  - Extended Exa integration with `buildExaResearchClientFromEnv()` providing `researchCompany`/`researchContact` on top of the existing HTTP wrapper, plus tests for env validation and request shape.  
  - Implemented `createExaEnrichmentAdapter` and updated `getEnrichmentAdapter(name, supabase)` so `adapter='exa'` returns a Supabase-bound adapter that calls Exa research and returns JSON summaries for companies and employees.  
  - Updated `runSegmentEnrichmentOnce` to resolve adapters via the registry with Supabase context, and ensured `enrich:run --adapter exa` always uses the async job-backed path (with legacy sync explicitly disallowed for Exa).  
  - Added shape-only HTTP clients for Parallel.ai, Firecrawl.dev, and Anysite.io (`buildParallelClientFromEnv`, `buildFirecrawlClientFromEnv`, `buildAnySiteClientFromEnv`) plus env validation tests (`parallel_client_requires_api_key_env`, `firecrawl_client_requires_api_key_env`, `anysite_client_requires_api_key_env`).  
  - Documented Exa enrichment behaviour in `docs/Database_Description.md` (how `company_research` and `ai_research_data` are populated) and recorded the feature in `CHANGELOG.md`.  
- **To Do (this session)**  
  - None – Exa Enrichment Phase 1 is complete; follow-up work for promotion flows and multisource routing is captured in the Phase 2 session plans for discovery and multisource enrichment.
