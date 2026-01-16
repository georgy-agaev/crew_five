# AnySite Integration Notes

> Version: v0.1 (2025-12-05)

## 1. Purpose

This document captures how the AI SDR Toolkit integrates with AnySite, and the
boundaries we intentionally keep between discovery, promotion, and enrichment.
It is the source of truth for how AnySite is used in the open-core repo.

## 2. Role of AnySite in the System

- **Discovery vs. enrichment**
  - Exa (Websets + search) is the primary engine for discovering *new* companies
    and contacts from ICP profiles and hypotheses.
  - AnySite is used **only for enrichment and research** on records that already
    exist in Supabase (`companies`, `employees`), not for net-new discovery.

- **What AnySite provides**
  - LinkedIn profile and company data (headlines, roles, locations, posts,
    engagement).
  - Social context from other platforms (Twitter/X, Reddit, Instagram) where
    needed for SIM and personalization.
  - Web parsing and sitemap extraction to enrich company/offer research.

## 3. Integration Pattern (Core App)

- **Small HTTP client, narrow interface**
  - Core code uses a small AnySite HTTP client that exposes a handful of
    operations, for example:
    - `fetchLinkedInProfileInsights(company, contact)`
    - `fetchLinkedInCompanyInsights(company)`
    - `parseWebpage(url)`
  - The HTTP client hides AnySite’s 60 MCP tools and raw API surface; the rest
    of the app talks only to these higher-level helpers.

- **Enrichment adapters**
  - The enrichment pipeline uses an `EnrichmentAdapter` interface with methods
    like:
    - `fetchCompanyInsights({ company_id })`
    - `fetchEmployeeInsights({ contact_id })`
  - `AnySiteEnrichmentAdapter` implements this interface using the AnySite HTTP
    client and is wired into `enrich:run --adapter anysite_*` once ready.
  - Enrichment always:
    - Reads from `companies` / `employees` (typically via `segment_members`),
    - Writes to existing fields such as `company_research`,
      `ai_research_data`, `linkedin_profile_url`, and social metadata JSON.

- **Promotion as a separate step**
  - Exa discovery writes into staging tables (`icp_discovery_runs` and
    `icp_discovery_candidates`).
  - A small promotion service (planned) moves approved candidates into
    `companies` / `employees` and `segment_members`.
  - AnySite enrichment only runs **after** promotion, against these canonical
    tables.

## 4. MCP Usage and Agents

- **MCP as an optional façade**
  - AnySite’s full MCP server (60 tools) may be configured for external agents
    (e.g., Claude Desktop, code agents) that need rich, interactive tool use.
  - For the open-core CLI and Web adapter:
    - MCP is treated as an implementation detail or façade behind the small
      HTTP client.
    - The app does not depend directly on individual MCP tools, only on the
      narrowed HTTP interface described above.

- **Principle of least power**
  - Agents see only the minimal subset of tools they need (for example, a
    “LinkedIn enrichment” meta-tool), not the full 60-tool surface.
  - This reduces coupling and makes it easier to swap or update AnySite
    capabilities without touching core flows.

## 5. Configuration & Env Vars

- AnySite credentials are stored in `.env` or external secret managers (e.g.,
  1Password CLI) and are never committed to the repo.
- The AnySite client will be configured with:
  - API key / token (exact env var naming to be finalized alongside the client
    implementation).
  - Optional base URL override for non-default deployments.
- All providers (Exa, AnySite, Firecrawl, Parallel) follow the same pattern:
  - Small `load*Env` helpers validate required keys and default base URLs.
  - Callers fail fast with clear error messages when env vars are missing.

## 6. Compliance and Rate Limits

- AnySite is used for **research and drafting support**, not for:
  - Automated LinkedIn posting,
  - Mass connection requests,
  - High-volume scraping beyond allowed limits.
- Integration must respect:
  - AnySite’s terms of service,
  - Platform-specific policies (LinkedIn, Twitter/X, Reddit, etc.),
  - Reasonable rate limits and timeouts per call.
- Batch enrichment is always:
  - Scoped to explicit segments,
  - Capped in size,
  - Logged so we can trace which campaigns and ICPs consumed which AnySite
    calls.

## 7. Future Extensions

- **Deeper persona context**
  - Pull summarized themes from LinkedIn posts/comments for SIM and offer-roast
    prompts.
  - Feed “topics of interest” and engagement patterns into draft generation and
    analytics.

- **Cross-channel research**
  - Use AnySite’s Reddit/Twitter tools to augment Exa and Firecrawl findings
    when deeper social proof is needed.

- **Content planning**
  - Combine AnySite’s social data with ICP segments to propose content
    calendars (LinkedIn posts, talking points) while keeping publishing manual.

All such extensions must continue to respect the core rule: discovery remains
Exa-centric and staged; AnySite enriches only approved, canonical records via a
small, well-defined interface.

