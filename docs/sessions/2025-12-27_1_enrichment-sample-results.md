# Session: Capture real enrichment outputs (pre-schema)

Date: 2025-12-27
Timestamp (UTC): 2025-12-27T08:50:34Z

## Overview

Before defining a fixed field schema for enrichment, we captured **real provider outputs** for three representative
domains to understand what each provider actually returns (and where it fails):

- `ucmsgroup.ru`
- `topframe.ru`
- `voicexpert.ru`

Providers in scope: **EXA**, **Parallel**, **Firecrawl**, **AnySite**.

## Completed

- Captured provider outputs (and provider errors) in:
  - `docs/enrichment_results_2025-12-27_ucmsgroup_topframe_voicexpert.md`
- Verified that:
  - **Firecrawl** can scrape all three websites (markdown extracted).
  - **Firecrawl Search** (`/v1/search`) returns relevant indexed results for all three domains, allowing a more
    apples-to-apples comparison vs “search-first” providers.
  - **AnySite** succeeds for `ucmsgroup.ru` and `topframe.ru`; for `voicexpert.ru` it returns **502** content from the
    origin via the web parser and returns no LinkedIn matches.
  - **EXA** returns a strong summary for `ucmsgroup.ru`, but did not return usable summaries for `topframe.ru` and
    `voicexpert.ru` in this run (and `sources[]` was empty for all three in this run).
  - **Parallel** endpoint access is blocked by API gateway auth/product routing (current key is rejected).

## Notes / Observations

- `voicexpert.ru` appears reachable to Firecrawl, but AnySite’s web parser received `502 Bad Gateway` at the time of the
  run (likely origin behavior / bot protection / upstream instability).
- Parallel API is reachable (`/health` is OK) but the product routes require a valid key + product access; until the
  key/product issue is resolved we cannot collect Parallel outputs for schema evaluation.

## To Do

- Re-run the same 3 domains once:
  - EXA answers are configured to return sources (if supported), and/or
  - we provide stronger seeds (company name + website + extracted page context) to reduce “no info found” results.
- Resolve Parallel access:
  - confirm correct `PARALLEL_API_BASE` and auth scheme,
  - verify the API key has product access for the desired endpoints.
- After we agree on “what we get in practice”, return to the next task:
  - define a fixed normalized enrichment schema (minimal, reliable, provider-agnostic) + the hybrid downstream context.

## Reference: Enrichment Query Surfaces (Per Provider)

This is a catalog of the practical “query shapes” we can use for enrichment per provider. The intent is to pick a
small subset for MVP (only what we need now), then expand later.

### EXA

**Query surfaces**

- **Answer (LLM-style research)**: `POST /answer` with `{ query: string }`
  - The “query surface” is a single string, so we can embed website/domain/role/locale constraints inline.
- **Websets (search/discovery mechanics usable for enrichment too)**:
  - `POST /websets` with `{ name, queries[] }`
  - `GET /websets/{id}/items?limit=N` → list of `{ url, title? }`

**Seed fields that matter**

- Company: `name`, `website`, `domain`, `country/locale`
- Employee: `fullName`, `role`, `companyName`, `linkedinUrl`, `website`

**Practical bundles**

- Minimal: `POST /answer` using `Website: https://domain` + “what they sell / ICP / differentiators”.
- Balanced: create a webset with 3–6 targeted `site:` queries, fetch top URLs, then call `/answer` and include those
  URLs in the prompt as evidence.
- Deep: balanced + add queries for leadership/team pages + hiring/careers + “reviews/complaints” where relevant.

### Firecrawl

**Query surfaces (verified)**

- **Search**: `POST /v1/search` with `{ query: string, limit?: number }`
  - Query can be SERP-like strings: `site:domain <keywords>`.
- **Scrape**: `POST /v1/scrape` with `{ url, formats: ["markdown"|...], onlyMainContent?: boolean, ... }`
  - Best used after Search selects pages; can also be used directly on homepage.

**Seed fields that matter**

- Company: `website` (scrape), `domain` + keywords (search)
- Employee: web-first; used to find pages mentioning a person/title rather than identity resolution.

**Practical bundles**

- Minimal: search `site:domain` + 2–3 keywords → scrape homepage only.
- Balanced: search + scrape top 3–8 pages (about, services, pricing, cases, contacts) → consolidate.
- Deep: search + (potential crawl/map in future once confirmed) + scrape many pages by patterns.

### AnySite

Auth: uses `access-token: <ANYSITE_API_KEY>` header (not `Authorization: Bearer`).

**Web parsing**

- Parse a page: `POST /api/webparser/parse` (required: `url`)
  - Useful request options: `only_main_content`, `extract_contacts`, `social_links_only`, `same_origin_links`,
    `strip_all_tags`, `return_full_html`, `extract_minimal`, `include_tags`, `exclude_tags`, etc.
- Sitemap URLs: `POST /api/webparser/sitemap` (required: `url`)
  - Options: `include_patterns`, `exclude_patterns`, `same_host_only`, `respect_robots`, `count`, `return_details`.

**LinkedIn**

- Find company by keywords: `POST /api/linkedin/google/company` (required: `keywords: string[]`)
  - Options: `with_urn`, `count`.
- Get company details: `POST /api/linkedin/company` (required: `company`)
  - `company` accepts `string` or `{ type, value }` (OpenAPI: `anyOf(string, object{type,value})`).
- Company employees: `POST /api/linkedin/company/employees`
  - Required: `companies: Array<{ type, value }>`, `count`; optional: `keywords`, `first_name`, `last_name`.
- Company employee stats: `POST /api/linkedin/company/employee_stats` (required: `urn: { type, value }`)
- Company posts: `POST /api/linkedin/company/posts` (required: `urn`, `count`)
- Post details: `POST /api/linkedin/post` (required: `urn`)
- Post comments: `POST /api/linkedin/post/comments` (required: `urn`, `count`)

**Identity & contact**

- Emails by LinkedIn profile(s): `POST /api/linkedin/user/email` (required: `profile`)
  - `profile` supports `string` or `string[]` (batch).
- Reverse lookup by email: `POST /api/linkedin/email/user` (required: `email`)

**Social**

- Twitter: `POST /api/twitter/search/posts`, `POST /api/twitter/search/users` (+ user endpoints)
- Reddit: `POST /api/reddit/search/posts`, `POST /api/reddit/posts` (+ user posts/comments)
- YC company: `POST /api/yc/company` (required: `company` slug)

**Seed fields that matter**

- Company: `website` (parse/sitemap), `domain` + `company name` (keywords), `locale`
- Employee: best is `linkedinUrl`; otherwise use first/last name + company `urn` + role keywords.

**Practical bundles**

- Minimal: `webparser/parse(homepage, extract_contacts=true)` + `linkedin/google/company([domain,name])` +
  `linkedin/company(alias)`.
- Balanced: minimal + `webparser/sitemap` (count N + patterns for `/about|/services|/cases|/pricing`) + parse top pages +
  `linkedin/company/posts` (small count) + `linkedin/company/employees` (small count, keywords=role).
- Deep: balanced + `linkedin/post/comments` + Twitter/Reddit searches + email enrichment (if we have profile URLs).

### Parallel

Current status: provider is **not accessible** with the current credentials/product routing (API gateway rejects the
key for protected routes), so we cannot enumerate its true query surfaces yet.

**Intended query surfaces (based on repo interface, pending real API access)**

- Company research: by `companyName`, optionally `website`, `country/locale`
- Contact research: by `fullName`, optionally `role`, `companyName`, `linkedinUrl`, `website`

## Decision Options (How to Avoid Overbuilding)

1. **Search-first normalization** (recommended for fair comparison): always run a “search-like” step first per provider,
   then scrape/parse selected URLs.
2. **Scrape-first normalization** (fastest): always scrape/parse homepage + about/services + contacts; skip search unless
   missing info.
3. **Hybrid minimal + escalate** (most reliable): run minimal calls; if summary is low quality, escalate to broader
   search + more pages.

## Open Questions (Need Confirmation Before a Query Planner)

1. For MVP enrichment, do we enrich **company only**, **employee only**, or **both** per provider run?
2. Page budget per company for the default “balanced” run: **3 pages** or **8 pages**?
3. For AnySite employee enrichment, do we assume employees already have `linkedin_profile_url`, or do we need “find
   employees by role keywords” as the default path?
