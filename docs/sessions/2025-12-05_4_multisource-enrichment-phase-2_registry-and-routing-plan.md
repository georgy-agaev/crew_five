# 2025-12-05 – Multisource Enrichment Phase 2: Registry & Routing Plan

> Timestamp (UTC): 2025-12-05T00:00:00Z  
> Goal: evolve the enrichment layer from a single Exa adapter into a small, pluggable registry that can route enrichment calls between Exa, Parallel.ai, Firecrawl.dev, and Anysite.io, without changing job semantics or introducing new legacy modes.

## Overview
Once the Exa enrichment adapter is in place (Phase 1), we’ll introduce a provider-agnostic enrichment registry, so that adding new providers becomes a configuration choice rather than a branching exercise in business logic. This phase will focus on clean interfaces, routing, and env-based selection, while keeping `enrich:run` async and JSON-only.

## Scope (files to touch)
- **Integrations**
  - `src/integrations/exa.ts`, `src/integrations/parallel.ts`, `src/integrations/firecrawl.ts`, `src/integrations/anysite.ts` – ensure each client exposes a consistent `researchCompany`/`researchContact`-style surface and clear env validation.
- **Registry & services**
  - `src/services/enrichment/registry.ts` – introduce `EnrichmentProviderRegistry` with a map of provider names to adapter factories for Exa/Parallel/Firecrawl/Anysite.
  - `src/services/enrichSegment.ts` – update to accept a provider name (e.g. `exa`, `parallel`, `firecrawl`, `anysite`) and resolve the adapter through the registry, keeping the job orchestration unchanged.
- **CLI & config**
  - `src/cli.ts` – add a `--provider` flag to `enrich:run` (distinct from adapter) so users can choose enrichment source when using a single adapter name.
  - `.env.example`, `README.md` – document the new provider env vars and how to switch between them.

## Functions (1–3 sentences)
- `createEnrichmentProviderRegistry(supabase)` (`src/services/enrichment/registry.ts`)  
  Builds a registry object mapping provider names (e.g. `'exa'`, `'parallel'`, `'firecrawl'`, `'anysite'`) to adapter factories, with each factory responsible for constructing a provider-specific adapter using the corresponding HTTP client and Supabase context.

- `resolveEnrichmentAdapter(providerName, registry)` (`src/services/enrichment/registry.ts`)  
  Returns the adapter instance for a given provider name or throws a clear error if the provider is unknown or misconfigured (e.g. missing API key), so the caller can surface a structured error.

- `enrichSegmentWithProvider(supabase, providerName, options)` (`src/services/enrichSegment.ts`)  
  Reuses the existing job and iteration logic but obtains the adapter via `resolveEnrichmentAdapter`, allowing different providers to be swapped in without changing the segment/enrichment orchestration.

## Tests (name → behaviour in 5–10 words)
- `enrichment_provider_registry_registers_exa_parallel_firecrawl_anysite`  
  Registry contains entries for all configured providers.

- `resolve_enrichment_adapter_throws_for_unknown_provider`  
  Unknown provider yields clear, code-tagged error.

- `enrich_run_with_parallel_provider_uses_parallel_adapter`  
  `enrich:run --provider parallel` routes to Parallel adapter.

- `enrich_run_with_firecrawl_provider_uses_firecrawl_adapter`  
  Firecrawl provider calls Firecrawl client integration.

- `enrich_run_with_anysite_provider_uses_anysite_adapter`  
  Anysite provider calls Anysite client integration.

## Completed vs To Do
- **Completed (previous sessions)**  
  - Core enrichment orchestration and job infrastructure already exist and support a mock adapter and (after Phase 1) an Exa adapter.  
- **Completed (this phase)**  
  - Normalized provider client surfaces for Exa (`buildExaResearchClientFromEnv`) and shape-only clients for Parallel (`buildParallelClientFromEnv`), Firecrawl (`buildFirecrawlClientFromEnv`), and Anysite (`buildAnySiteClientFromEnv`), all with env validation.  
  - Implemented `createEnrichmentProviderRegistry(supabase)` and updated `getEnrichmentAdapter(name, supabase)` so providers (`mock`, `exa`, `parallel`, `firecrawl`, `anysite`) are resolved via a registry with cached adapters.  
  - Extended `enrich:run` with a `--provider` flag so users can choose enrichment providers without changing job semantics; async jobs now carry the provider/adapter name and resolve adapters through the registry.  
  - Added tests (`enrichment_provider_registry_registers_exa_parallel_firecrawl_anysite`, `resolve_enrichment_adapter_throws_for_unknown_provider`) and wired env defaults in the enrichment test suite for predictable behaviour.  
- **To Do (future phases)**  
  - Wire Parallel/Firecrawl/Anysite adapters to real enrichment behaviour, add provider-specific telemetry and cost controls, and extend README/`.env.example` with provider selection guidance.
