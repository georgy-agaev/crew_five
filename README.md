# AI SDR GTM Toolkit (Open Core)

This repo contains the open-core AI SDR GTM Toolkit: CLI + Web UI +
Supabase schema for running outbound campaigns along a single GTM spine. The
public code is designed to be extended with private or commercial connectors
without changing the core APIs.

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

## Working Agreements
1. **Single Spine**: all GTM flows must traverse `segment → segment_members → campaign → drafts → email_outbound → email_events`.
2. **AI Contract**: every draft generation call uses the `generate_email_draft` interface (a versioned contract maintained privately); prompt updates stay behind this contract.
3. **SMTP First**: SMTP adapter is the default sending provider, Smartlead is optional.
4. **Mode Parity**: CLI and Web UI expose the same controls (Strict/Graceful, Interactive Coach/Pipeline Express).
5. **Changelog Discipline**: record notable decisions and doc updates in `CHANGELOG.md` with semantic version bumps.

## Python Virtual Environment
- Created `.venv/` using `python3.10 -m venv .venv`. Activate via `source .venv/bin/activate` before running any DSPy/GEPA scripts or Supabase helpers, then `deactivate` when finished.
- Keep Python dependencies isolated to this env; document new requirements in the README when tooling is added.

## Next Steps
- Read `public-docs/GETTING_STARTED.md` for install and configuration details.
- Review `public-docs/ARCHITECTURE_OVERVIEW.md` for the GTM spine and module layout.
- Explore `public-docs/EXTENSIBILITY_AND_CONNECTORS.md` to understand how to plug in new providers.
- Use the CLI to manage the spine tables end to end:
  - Install deps: `pnpm install`
- Run tests: `pnpm test`
- Segment creation: `pnpm cli segment:create --name "Fintech" --locale en --filter '{"field":"employees.role","operator":"eq","value":"CTO"}'`
  - Segment snapshot: `pnpm cli segment:snapshot --segment-id <id> [--segment-version 2] [--allow-empty] [--max-contacts 5000] [--force-version]`
  - Campaign creation: `pnpm cli campaign:create --name "Q1 Push" --segment-id <id> --segment-version 1 --snapshot-mode refresh [--allow-empty] [--max-contacts 5000] [--force-version] [--dry-run]`
  - Campaign update: `pnpm cli campaign:update --campaign-id <id> [--prompt-pack-id <id>] [--schedule <json>] [--throttle <json>]`
  - Validate filters (no DB): `pnpm cli filters:validate --filter '[{"field":"employees.role","operator":"eq","value":"CTO"}]' [--format json|text|terse]`
  - Email send scaffold: `pnpm cli email:send --provider smtp --sender-identity noreply@example.com [--throttle-per-minute 50] [--summary-format json|text] [--dry-run] [--log-json] [--fail-on-error] [--batch-id <id>]`
  - Event ingest stub: `pnpm cli event:ingest --payload '{"provider":"stub","event_type":"delivered","provider_event_id":"123"}' [--dry-run] [--error-format json]`
  - Draft generation: `pnpm cli draft:generate --campaign-id <id> [--dry-run] [--fail-fast] [--limit 100]`
  - Campaign status change: `pnpm cli campaign:status --campaign-id <id> --status <nextStatus> [--error-format json]`
  Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` env vars are present (see `.env.example` once added).

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
  - List campaigns: `pnpm cli smartlead:campaigns:list [--dry-run] [--format json|text]`
  - Push leads into a Smartlead campaign:  
    `pnpm cli smartlead:leads:push --campaign-id <id> [--limit <n>] [--dry-run] [--error-format json]`
   - Sync a primary email sequence to Smartlead:  
     `pnpm cli smartlead:sequences:sync --campaign-id <id> [--step <n>] [--variant-label <label>] [--dry-run]`
   - Advanced/legacy commands (MCP-based ingest) are available but outside the direct API scope for
     now (`smartlead:events:pull`, `smartlead:send`).

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
