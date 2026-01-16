# Enrichment Provider Contract (Unified Schema + UX)

> Version: v0.2 (2026-01-15)

This document defines the **minimum common schema contract** for enrichment providers (EXA, Parallel, Firecrawl,
Anysite, Mock) and the **web UX contract** for running multiple providers while treating one provider as authoritative.

## Goals (what we implement now)

- One consistent **input seed** per entity (company + employee) for all providers.
- One consistent **output shape** per provider stored into the per-entity enrichment store.
- One consistent **multi-provider policy**:
  - `primaryCompanyProvider` is authoritative for company-level enrichment.
  - `primaryEmployeeProvider` is authoritative for employee/lead-level enrichment.
  - all other selected providers are supplemental and passed as summaries (hybrid context).
- One consistent **UX**:
  - Settings define default enabled providers + per-entity primary providers.
  - Enrichment step lets users override the selection per run.
  - Providers cannot be enabled when credentials are not verified.

Non-goals (for later): per-field merge rules, user-level settings, rich diff UI.

## Provider IDs

Provider IDs are stable lowercase strings:

- `exa`
- `parallel`
- `firecrawl`
- `anysite`
- `mock`

## Input contract (seed)

Providers must accept the same “seed” object; each provider may ignore fields it does not support.

### `CompanySeedV1`

- `companyId: string` (uuid)
- `name?: string`
- `website?: string` (preferred)
- `domain?: string` (derived from website when possible)
- `locale?: string` (e.g. `en`, `ru`)
- `context?: { segmentId?: string; segmentVersion?: number }`

### `EmployeeSeedV1`

- `employeeId: string` (uuid)
- `companyId: string` (uuid)
- `fullName?: string`
- `position?: string`
- `workEmail?: string`
- `linkedinUrl?: string`
- `locale?: string`
- `context?: { segmentId?: string; segmentVersion?: number }`

## Output contract (provider result)

Each provider writes results into a per-entity store, keyed by provider ID.

### Store location

- Company store: `companies.company_research`
- Employee store: `employees.ai_research_data`

Both are stored as `EnrichmentStoreV1`:

```ts
type EnrichmentStoreV1 = {
  version: 1;
  providers: Record<string, EnrichmentProviderResultV1>;
  lastUpdatedAt: string; // ISO
};
```

### `EnrichmentProviderResultV1`

This is the minimal normalized shape stored under `providers[providerId]`.

```ts
type EnrichmentProviderResultV1 = {
  version: 1;
  entity: "company" | "employee";
  provider: string; // providerId
  collectedAt: string; // ISO

  // Human-readable, short summary (used widely in UI + prompts).
  summary?: string;

  // Structured fields (sparse; only include what is known).
  fields?: Record<string, unknown>;

  // Evidence for claims; URLs should be stable and de-duped.
  sources?: Array<{ url: string; title?: string }>;

  // Provider-specific metadata safe for storage (no secrets).
  meta?: {
    confidence?: number; // 0..1
    latencyMs?: number;
    warnings?: string[];
  };

  // Optional raw payload (only when reasonably sized).
  raw?: unknown;
};
```

Rules:

- `summary` should be <= ~1–2 short paragraphs.
- `raw` should not exceed reasonable size; oversized data must be summarized before storing.
- Secrets/tokens must never be stored.

## Hybrid multi-provider policy (primary authoritative)

At runtime, the system resolves:

- `primaryCompanyProvider` and `primaryEmployeeProvider`
- `providers[]` (enabled set for the run)

Downstream steps use:

- Primary **full context** (authoritative):
  - `brief.company.enrichment` (from primaryCompanyProvider company store)
  - `brief.context.lead_enrichment` (from primaryEmployeeProvider employee store)
- Supplemental **summaries** for all other providers:
  - `brief.context.enrichment_by_provider`
    - primary provider marker: `mode: "primary"` + `primaryFor: ["company" | "employee"]`
    - others: `mode: "summary"` + compact `company_summary`/`lead_summary`

Persistence for later phases:

- Draft rows persist provenance:
  - `drafts.metadata.enrichment_provider`
  - `drafts.metadata.enrichment_by_provider`
- Send artifacts inherit provenance:
  - `email_outbound.metadata` carries the draft metadata forward
- Sim requests carry provenance:
  - `jobs.payload.enrichment_provider`

## Web UX contract (minimal clicks)

### Settings

Global settings (no user table yet):

- Default enabled providers: `defaultProviders[]`
- Primary providers:
  - `primaryCompanyProvider`
  - `primaryEmployeeProvider`

Rules:

- Provider toggles are disabled unless credentials are verified.
- Both primary providers must be members of `defaultProviders[]`.

### Enrichment step

One enrichment CTA (“Enrich”) with dynamic behavior:

- Runs enrichment for all **currently enabled** providers (defaults from Settings, optionally overridden by chips).
- Shows a compact status list per provider (queued/running/completed/error).
- Displays `Primary providers for workflow: company=<...>, lead=<...>`.

Conflict handling in this phase:

- No per-field conflict resolution UI in v0.2.
- Primary providers are authoritative in their respective scopes (company vs lead).

### Draft / Outreach / Send

UX expectation for v0.2:

- UI shows “Primary provider” and “Included providers” as provenance only.
- Hybrid context is used for AI steps; non-AI steps carry provenance in metadata for auditability.

## Open questions (need confirmation before implementation)

1. Should we store `fields` using a fixed schema (e.g., `industry`, `tech_stack`, `funding_stage`) or keep it
   provider-agnostic until we have 2+ providers returning the same fields reliably?
2. Do we want to allow a provider to run on companies only or employees only (per run), or keep “both” only for now?
3. Should the UI ever expose the full `raw` payload (behind a disclosure), or keep it server-side only?
