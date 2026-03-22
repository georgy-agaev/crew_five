# AI SDR GTM Toolkit (Open Core)

This repo contains the open-core AI SDR GTM Toolkit: CLI + Web UI +
Supabase schema for running outbound campaigns along a single GTM spine. The
public code is designed to be extended with private or commercial connectors
without changing the core APIs.

## License

This repository is licensed under the Apache License 2.0.

- Canonical license text: [LICENSE](/Users/georgyagaev/crew_five/LICENSE)
- The public open-core surface remains reusable under `Apache-2.0`
- Private/commercial extensions should continue to live outside this repository
  and integrate through the documented public interfaces

Product requirements, detailed roadmaps, and internal working notes are kept in
private docs outside this public repository. Public-facing usage and
architecture docs live in `public-docs/`.

## Directory Guide
- `src/` – CLI, services, integrations, and web adapter.
- `web/` – React-based Workflow Hub UI.
- `supabase/migrations/` – Supabase schema migrations for the GTM spine.
- `tests/` – Vitest suites for CLI/adapter logic.
- `web/src/**/*.test.tsx` – Vitest suites for Web UI flows.
- `public-docs/` – public user-facing docs (getting started, architecture, extensibility).
- `prompts/` – tracked prompt templates (sanitized), plus working prompt drafts.
- `CHANGELOG.md` – log of project-level changes.
- `ast-grep.yml` – AST guardrails for CLI/web patterns and error handling.
- `.env` – local environment configuration (create based on your own setup).

### Provider Env Summary
- Supabase: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (required by `loadEnv` and web adapter live mode).
- LLMs (live model listing + draft/coach flows):
  - OpenAI: `OPENAI_API_KEY` (required), optional `OPENAI_API_BASE` (defaults to `https://api.openai.com/v1`).
  - Anthropic: `ANTHROPIC_API_KEY` (required), optional `ANTHROPIC_API_BASE` (defaults to `https://api.anthropic.com/v1`) and `ANTHROPIC_API_VERSION` (defaults to `2023-06-01`).
  - Gemini: `GEMINI_API_KEY` (used by draft generation/catalog but not yet wired to live `/models` listing).
  - The web adapter exposes `GET /api/llm/models?provider=openai|anthropic`, backed by the provider `/v1/models` endpoints; the Prompts tab and Settings use these responses to populate Provider/Model dropdowns.
- Smartlead: `SMARTLEAD_API_BASE`/`SMARTLEAD_API_KEY` or legacy MCP envs (see Smartlead section below).
- Exa (ICP discovery + enrichment): `EXA_API_KEY` (and optional `EXA_API_BASE`) used by Websets discovery and the Exa research client for `enrich:run --provider exa`.
- Parallel (planned research provider): `PARALLEL_API_KEY` (required) and optional `PARALLEL_API_BASE` (defaults to `https://api.parallel.ai`), validated by `loadParallelEnv`.
- Firecrawl (planned crawl provider): `FIRECRAWL_API_KEY` (required) and optional `FIRECRAWL_API_BASE` (defaults to `https://api.firecrawl.dev`), validated by `loadFirecrawlEnv`.
- Anysite (planned profile lookup provider): `ANYSITE_API_KEY` (required) and optional `ANYSITE_API_BASE` (defaults to `https://api.anysite.io`), validated by `loadAnySiteEnv`.

## Working Agreements
1. **Single Spine**: all GTM flows must traverse `segment → segment_members → campaign → drafts → email_outbound → email_events`.
2. **AI Contract**: every draft generation call uses the `generate_email_draft` interface (a versioned contract maintained privately); prompt updates stay behind this contract.
3. **SMTP First**: SMTP adapter is the default sending provider, Smartlead is optional.
4. **Mode Parity**: CLI and Web UI expose the same controls (Strict/Graceful, Interactive Coach/Pipeline Express).
5. **Changelog Discipline**: record notable decisions and doc updates in `CHANGELOG.md` with semantic version bumps.

## Solution-First Development Rule

- For non-core utilities and infrastructure code larger than ~20–30 lines, follow a strict solution-first sequence:
  1. Prefer existing higher-level services or platform features (for example, Supabase built-ins, official SaaS integrations, or internal shared services) when they can safely satisfy the need.
  2. If no suitable service exists, search vetted JS/TS registries such as npm or jsr for a maintained, typed library with healthy adoption (≥1k weekly downloads or equivalent), a permissive license, and acceptable bundle size in `web/`, and adopt it if it covers ≥70% of the required functionality.
  3. Only write new custom code when no suitable service or library exists, or when the logic is clearly domain-specific (for example, GTM spine behaviour, Supabase schema semantics, the `generate_email_draft` contract, segment filter DSL, campaign/judge analytics, Smartlead-specific orchestration).
- In pull requests, add a brief note confirming this check (for example, `Solution-first rule checked: using <service/lib>` or `Solution-first rule checked: custom domain logic`).

## Python Virtual Environment
- Created `.venv/` using `python3.10 -m venv .venv`. Activate via `source .venv/bin/activate` before running any DSPy/GEPA scripts or Supabase helpers, then `deactivate` when finished.
- Keep Python dependencies isolated to this env; document new requirements in the README when tooling is added.

## Next Steps
- Read `public-docs/GETTING_STARTED.md` for install and configuration details.
- Review `public-docs/ARCHITECTURE_OVERVIEW.md` for the GTM spine and module layout.
- Explore `public-docs/EXTENSIBILITY_AND_CONNECTORS.md` to understand how to plug in new providers.
- Canonical local Web UI ports:
  - daily work: adapter `http://localhost:8787/api` + Vite UI `http://localhost:5173`
  - isolated browser validation only: adapter `http://localhost:8888/api` + Vite UI `http://localhost:5174`
- Canonical local Web UI scripts:
  - adapter live: `pnpm dev:web:live`
  - adapter mock: `pnpm dev:web:mock`
  - adapter validation: `pnpm dev:web:validation`
  - Vite daily UI with built-in `/api` proxy to `8787`: `pnpm --dir web dev`
  - Vite daily UI: `pnpm --dir web dev:canonical`
  - Vite validation UI: `pnpm --dir web dev:validation`
- For a shared-base `Outreach -> crew_five` setup, see `docs/Outreach_crew_five_cli_contract.md`.
- For the full operating model of `Outreacher + crew_five + imap_mcp` (send loop, inbox polling, follow-up scheduling, reply classification, pattern analytics), see `docs/Outreacher_operating_model.md`.
- Ready-to-adapt agent runners live in `examples/outreach-crew-five-runner.ts` and `examples/outreach_crew_five_runner.py`; see `docs/Outreach_agent_runner_examples.md`.
- For `Outreacher -> imap_mcp -> crew_five` send orchestration, use `draft:load --include-recipient-context`, then `email:record-outbound`, then `event:ingest`; the detailed contract lives in `docs/Outreach_crew_five_cli_contract.md`.
- Use the CLI to manage the spine tables end to end:
  - Install deps: `pnpm install`
- Run tests: `pnpm test`
  - Data hygiene and import:
    - `pnpm cli employee:repair-names [--dry-run] [--confidence high|low|all] [--error-format json]`
    - `pnpm cli company:import --file <normalized-companies.json> [--dry-run] [--error-format json]`
    - `pnpm cli company:save-processed --payload '<json>' [--error-format json]`
  - Follow-up planning:
    - `pnpm cli offer:list [--status active|inactive] [--error-format json]`
    - `pnpm cli offer:create --title "<title>" [--project-name "<name>"] [--description "<text>"] [--status active|inactive] [--error-format json]`
    - `pnpm cli offer:update --offer-id <id> [--title "<title>"] [--project-name "<name>"] [--description "<text>"] [--status active|inactive] [--error-format json]`
    - `pnpm cli campaign:followup-candidates --campaign-id <id> [--error-format json]`
    - `pnpm cli campaign:detail --campaign-id <id> [--error-format json]`
    - `pnpm cli campaign:attach-companies --campaign-id <id> --company-ids '["<companyId>"]' [--attached-by <id>] [--source manual_attach|import_workspace] [--error-format json]`
    - `pnpm cli campaign:launch:preview --payload '<json>' [--error-format json]`
    - `pnpm cli campaign:launch --payload '<json>' [--error-format json]`
    - `pnpm cli campaign:next-wave:preview --campaign-id <id> [--error-format json]`
    - `pnpm cli campaign:next-wave:create --payload '<json>' [--error-format json]`
    - `pnpm cli campaign:auto-send:get --campaign-id <id> [--error-format json]`
    - `pnpm cli campaign:auto-send:put --campaign-id <id> --payload '<json>' [--error-format json]`
    - `pnpm cli campaign:send-policy:get --campaign-id <id> [--error-format json]`
    - `pnpm cli campaign:send-policy:put --campaign-id <id> --payload '<json>' [--error-format json]`
    - `pnpm cli campaign:mailbox-assignment:get --campaign-id <id> [--error-format json]`
    - `pnpm cli campaign:mailbox-assignment:put --campaign-id <id> --payload '<json>' [--error-format json]`
    - `pnpm cli campaign:send-preflight --campaign-id <id> [--error-format json]`
  - Segment list: `pnpm cli segment:list [--icp-profile-id <id>] [--icp-hypothesis-id <id>] [--error-format json]`
- Segment creation: `pnpm cli segment:create --name "Fintech" --locale en --filter '{"field":"employees.role","operator":"eq","value":"CTO"}'`
  - Segment snapshot: `pnpm cli segment:snapshot --segment-id <id> [--segment-version 2] [--allow-empty] [--max-contacts 5000] [--force-version]`
  - Campaign list: `pnpm cli campaign:list [--status <status>] [--segment-id <id>] [--icp-profile-id <id>] [--error-format json]`
  - Campaign audit: `pnpm cli campaign:audit --campaign-id <id> [--error-format json]`
  - Campaign launch preview: `pnpm cli campaign:launch:preview --payload '{"name":"Q1 Push","segmentId":"<id>","segmentVersion":1,"offerId":"<offerId>","snapshotMode":"reuse"}' [--error-format json]`
  - Campaign launch: `pnpm cli campaign:launch --payload '{"name":"Q1 Push","segmentId":"<id>","segmentVersion":1,"offerId":"<offerId>","snapshotMode":"reuse","senderPlan":{"source":"outreacher","assignments":[]}}' [--error-format json]`
  - Next-wave preview: `pnpm cli campaign:next-wave:preview --campaign-id <sourceCampaignId> [--error-format json]`
  - Next-wave create: `pnpm cli campaign:next-wave:create --payload '{"sourceCampaignId":"<sourceCampaignId>","name":"Q2 Push","createdBy":"operator"}' [--error-format json]`
  - Campaign auto-send settings: `pnpm cli campaign:auto-send:put --campaign-id <id> --payload '{"autoSendIntro":true,"autoSendBump":true,"bumpMinDaysSinceIntro":3}' [--error-format json]`
  - Campaign send policy: `pnpm cli campaign:send-policy:put --campaign-id <id> --payload '{"sendTimezone":"Europe/Moscow","sendWindowStartHour":9,"sendWindowEndHour":17,"sendWeekdaysOnly":true}' [--error-format json]`
  - Campaign send preflight: `pnpm cli campaign:send-preflight --campaign-id <id> [--error-format json]`
  - Campaign creation: `pnpm cli campaign:create --name "Q1 Push" --segment-id <id> --segment-version 1 [--offer-id <offerId>] --snapshot-mode refresh [--allow-empty] [--max-contacts 5000] [--force-version] [--dry-run]`
  - Campaign update: `pnpm cli campaign:update --campaign-id <id> [--prompt-pack-id <id>] [--schedule <json>] [--throttle <json>]`
  - Validate filters (no DB): `pnpm cli filters:validate --filter '[{"field":"employees.role","operator":"eq","value":"CTO"}]' [--format json|text|terse]`
  - Email send scaffold: `pnpm cli email:send --provider smtp --sender-identity noreply@example.com [--throttle-per-minute 50] [--summary-format json|text] [--dry-run] [--log-json] [--fail-on-error] [--batch-id <id>]`
  - Record an outbound send performed by an external orchestrator (for example, `imap_mcp`):
    `pnpm cli email:record-outbound --payload '<json>' [--error-format json]`
  - Event ingest stub: `pnpm cli event:ingest --payload '{"provider":"stub","event_type":"delivered","provider_event_id":"123"}' [--dry-run] [--error-format json]`
  - Draft generation: `pnpm cli draft:generate --campaign-id <id> [--dry-run] [--fail-fast] [--limit 100] [--icp-profile-id <id>] [--icp-hypothesis-id <id>] [--variant <label>] [--graceful] [--preview-graceful] [--force-version]`
  - Draft save/load/review:
    - `pnpm cli draft:save --payload '<json-or-json-array>' [--error-format json]`
    - `pnpm cli draft:load --campaign-id <id> [--status generated|approved|rejected|sent] [--limit <n>] [--include-recipient-context] [--error-format json]`
    - `pnpm cli draft:update-status --draft-id <id> --status generated|approved|rejected|sent [--reviewer <id>] [--metadata <json>] [--error-format json]`
      For rejected drafts, persist review metadata such as `review_reason_code`,
      `review_reason_codes`, and `review_reason_text` inside `drafts.metadata`.
  - Campaign status change: `pnpm cli campaign:status --campaign-id <id> --status <nextStatus> [--error-format json]`
  - Enrichment: `pnpm cli enrich:run --segment-id <id> [--adapter mock] [--provider exa|parallel|firecrawl|anysite|exa,firecrawl] [--limit <n>] [--max-age-days 90] [--force-refresh] [--run-now] [--legacy-sync] [--dry-run]`
  - Analytics:
    - `pnpm cli analytics:summary --group-by icp|segment|pattern|rejection_reason|offering|offer [--since <iso>] [--error-format json]`
    - `pnpm cli analytics:funnel --campaign-id <id> [--error-format json]`
    - `pnpm cli analytics:optimize [--since <iso>] [--error-format json]`
  - ICP utilities:  
    - `pnpm cli icp:list [--columns id,name,description,offering_domain] [--error-format json]`  
    - `pnpm cli icp:create --name "<name>" [--offering-domain voicexpert.ru]`
    - `pnpm cli icp:coach:profile --name "<name>" [--offering-domain voicexpert.ru] [--error-format json]`
    - `pnpm cli icp:hypothesis:list [--icp-profile-id <id>] [--segment-id <id>] [--columns id,icp_profile_id,offer_id,segment_id,status] [--error-format json]`
    - `pnpm cli icp:hypothesis:create --icp-profile-id <id> --label "<label>" [--offer-id <offerId>] [--targeting-defaults '<json>'] [--messaging-angle "<text>"] [--pattern-defaults '<json>'] [--notes "<text>"] [--error-format json]`
    - `pnpm cli campaign:create --name "<name>" --segment-id <id> [--offer-id <offerId>] [--icp-hypothesis-id <hypothesisId>] [--snapshot-mode reuse|refresh] [--error-format json]`
  - Provider/model selection:
    - Web UI: set defaults in Settings (assistant/icp/hypothesis/draft). The Prompts tab Task Configuration uses live provider `/models` output (via `/api/llm/models`) to populate Model dropdowns; if the provider is unreachable, the UI falls back to the curated catalog and shows an error.
    - CLI: override via `--provider`/`--model` on `draft:generate` (openai|anthropic|gemini, catalog-validated). Use `pnpm cli llm:models --provider openai|anthropic` to list live models for debugging.
- If the Web UI or CLI reports a models error (for example, `OpenAI models error 401: Invalid API key provided.` or `Anthropic models error 404: Not Found`), the Workspace Hub surfaces the provider's message directly in the "Live LLM models" panel. Check that:
  - The corresponding `*_API_KEY` env var is set and valid.
  - Any custom `*_API_BASE` value includes the correct `/v1` segment or matches your proxy's `/models` routing.
  - You can reproduce the error by calling `pnpm cli llm:models --provider openai|anthropic` from the CLI.
  Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` env vars are present (see `.env.example` once added).
- For offering-aware draft generation, store `offering_domain` on ICP profiles and pass
  `metadata.offering_hash` + `metadata.offering_summary` when drafts are saved from external orchestrators such as
  `Outreacher`; `email:record-outbound` preserves that provenance in `email_outbound.metadata`.
- `employee:repair-names` supports explicit confidence selection:
  - `high` = safe default for apply mode
  - `low` = preview/apply only low-confidence candidates when explicitly requested
  - `all` = include both confidence bands
- applied employee-name repairs are recorded in `employee_data_repairs` with original values,
  repaired values, confidence, and source
- `company:save-processed` now normalizes obvious high-confidence swapped `first_name` / `last_name`
  employee values before writing and returns warnings when low-confidence candidates are left unchanged.
- `company:import` preview/apply surfaces expose `match_field` for dedup matches and add
  `TIN mismatch` warnings when a row matches by `registration_number` but the incoming TIN differs from the DB TIN.
- For enrichment-aware orchestration, use `enrich:run --dry-run` as the preview path. Freshness is based on one
  shared enrichment timestamp per company/employee store, with a default refresh threshold of `90` days; `--limit`
  is interpreted as a company-level limit.
- Apply migrations before exercising new analytics/enrichment features:
  - `supabase db push` (dev) or `supabase db reset` (local only, destructive).
  - Newest migrations: `20251201120000_add_email_event_fk_columns.sql`, `20251201120500_update_analytics_events_flat_view.sql`.

## Security Checks
- ESLint security suite: `pnpm lint` (uses `eslint` + `@typescript-eslint` + `security` + `security-node`).
- AST guardrails: `pnpm run scan:ast-grep` (matches `ast-grep.yml` rules).
- Secret scan: `pnpm run scan:secrets` (requires `gitleaks` installed locally; CI runs the action).
- Dependency audit: `pnpm run audit` (fails on high/critical; CI installs with `--ignore-scripts`).

### Smartlead Integration (optional)
- Use Smartlead as a delivery provider without requiring a local MCP server. Setup steps live in
  internal docs; the open-core repository exposes the CLI and env contract.
- Add `.env` entries for direct API use:
  - `SMARTLEAD_API_BASE`
  - `SMARTLEAD_API_KEY`
  - `SMARTLEAD_WORKSPACE_ID` (optional)
  Legacy MCP-style envs (`SMARTLEAD_MCP_URL`, `SMARTLEAD_MCP_TOKEN`, `SMARTLEAD_MCP_WORKSPACE_ID`)
  are still accepted but should be considered deprecated.
- Start with a minimal loop (list campaigns, push leads, sync sequences) before automating any
  Smartlead-side sends; always support `--dry-run` when mutating remote state.
- CLI commands:
  - List campaigns: `pnpm cli smartlead:campaigns:list [--dry-run] [--format json|text] [--error-format json]`
  - Push leads into a Smartlead campaign:  
    `pnpm cli smartlead:leads:push --campaign-id <id> [--limit <n>] [--dry-run] [--error-format json]`
   - Sync a primary email sequence to Smartlead:  
     `pnpm cli smartlead:sequences:sync --campaign-id <id> [--step <n>] [--variant-label <label>] [--dry-run]`
   - Advanced/legacy commands (MCP-based ingest) are available but outside the direct API scope for
     now (`smartlead:events:pull`, `smartlead:send` which remains experimental; prefer dry-run and treat as preview-only).
- Missing Smartlead envs fail fast with `SMARTLEAD_CONFIG_MISSING`; use `--error-format json` on Smartlead commands to capture structured errors in automation pipelines.

### Web UI Workflow Hub
- Run the mock/live adapter: `cd web && pnpm install && pnpm dev` (env: `VITE_API_BASE` defaults to `/api`).
- Views:
  - **Client selection & first email**: guided flow for Workflow 0 (audience filters, contact review, base email +
    bump, draft generation, Smartlead readiness cue).
- **ICP discovery & expansion**: ICP form → Exa query plan → candidate approval; highlights MCP guardrails/caps.
- **Prospect reaction SIM**: Full SIM vs offer roast setup with seed personas, alignment score, and actionable notes.
- **Ops desk**: existing Campaigns/Drafts/Send/Events views with Smartlead readiness badge.
- Workflow 0 pulls companies/contacts from Supabase (`/api/companies`, `/api/contacts`), lists Smartlead campaigns (`/api/smartlead/campaigns` with statuses), and supports Smartlead campaign creation via `/api/smartlead/campaigns` (UI button); preview send is dry-run by default.
- Tests: `pnpm vitest run` (root) or `cd web && pnpm test`.

### Segment Filter Definition
Segments store `filter_definition` as an array of clauses, e.g.
`[{"field":"employees.role","operator":"eq","value":"CTO"}]`. Supported operators now:
`eq`, `in`, `not_in`, `gte`, `lte`. Unknown fields/operators and empty filter lists are
rejected. Only `employees.*` or `companies.*` fields are allowed. Snapshotting fails if no
contacts match unless `--allow-empty` is passed; a guardrail caps snapshots at 5000 contacts
by default (override with `--max-contacts`). Snapshots store a filters hash in member snapshots;
reuse fails if the hash mismatches (refresh required). Use `--force-version` to override a stale
segment version when intentionally syncing versions.
Filter validation errors emit code `ERR_FILTER_VALIDATION` with allowed prefixes/operators; the
`filters:validate` command supports `json|text|terse` formats and exits non-zero on errors.

### Campaign Status Transitions
Allowed transitions (source of truth: `src/status.ts`):
- draft → ready | review
- ready → generating
- generating → review | sending
- review → ready | generating
- sending → paused | complete
- paused → sending | complete
All other transitions are rejected. `campaign:update` is allowed only in draft/ready/review statuses.
