# AI SDR GTM System Workspace

This repo tracks specs and planning artifacts for the AI SDR GTM System. It keeps product requirements, architecture notes, setup instructions, and change history in one place while engineering work spins up.

## Directory Guide
- `docs/AI_SDR_GTM_PRD.md` – canonical product requirements document (Version 0.1, 2025‑11‑21).
- `docs/appendix_ai_contract.md` – immutable `generate_email_draft` contract referenced by PRD.
- `docs/AI_SDR_Toolkit_Architecture.md` – CLI/architecture overview driving the implementation approach.
- `docs/GMT_system_plan.md` – staged rollout plan for outreach system.
- `docs/Setup_Guide.md` – local environment prerequisites (macOS focused).
- `docs/Setup_smartlead_mcp.md` – Smartlead MCP setup/integration options (optional provider).
- `docs/Database_Description.md` – current Supabase schema reference.
- `docs/sessions/YYYY-MM-DD_<n>_<slug>.md` – session backlog + outcomes (see `docs/sessions/2025-11-21_1_initial-prd-and-structure.md`).
- `Cold_*.md` – prompt-pack source files for Interactive Coach / Pipeline Express modes.
- `CHANGELOG.md` – log of project-level changes (keep updated with each PRD revision or major decision).
- `.env.example` – template for the Supabase environment variables needed by the CLI.

## Working Agreements
1. **Single Spine**: all GTM flows must traverse `segment → segment_members → campaign → drafts → email_outbound → email_events`.
2. **AI Contract**: every draft generation call uses the `generate_email_draft` interface (Appendix A); prompt updates stay behind this contract.
3. **SMTP First**: SMTP adapter is the default sending provider, Smartlead is optional.
4. **Mode Parity**: CLI and Web UI expose the same controls (Strict/Graceful, Interactive Coach/Pipeline Express).
5. **Changelog Discipline**: record notable decisions and doc updates in `CHANGELOG.md` with semantic version bumps.

## Python Virtual Environment
- Created `.venv/` using `python3.10 -m venv .venv`. Activate via `source .venv/bin/activate` before running any DSPy/GEPA scripts or Supabase helpers, then `deactivate` when finished.
- Keep Python dependencies isolated to this env; document new requirements in the README when tooling is added.

## Next Steps
- Translate PRD sections into Supabase migrations and CLI/Web tickets.
- Keep prompt-pack updates synchronized between Interactive Coach and Pipeline Express versions.
- Expand the changelog as new versions (0.2, 0.3, …) of the PRD/specs are published.
- Use the new CLI to manage the spine tables end to end:
  - Install deps: `pnpm install`
  - Run tests: `pnpm test`
  - Segment creation: `pnpm cli segment:create --name "Fintech" --locale en --filter '{"field":"employees.role","operator":"eq","value":"CTO"}'`
  - Segment snapshot: `pnpm cli segment:snapshot --segment-id <id> [--segment-version 2] [--allow-empty] [--max-contacts 5000] [--force-version]`
  - Campaign creation: `pnpm cli campaign:create --name "Q1 Push" --segment-id <id> --segment-version 1 --snapshot-mode refresh [--allow-empty] [--max-contacts 5000] [--force-version]`
  - Campaign update: `pnpm cli campaign:update --campaign-id <id> [--prompt-pack-id <id>] [--schedule <json>] [--throttle <json>]`
  - Validate filters (no DB): `pnpm cli filters:validate --filter '[{"field":"employees.role","operator":"eq","value":"CTO"}]' [--format json|text|terse]`
  - Email send scaffold: `pnpm cli email:send --provider smtp --sender-identity noreply@example.com [--throttle-per-minute 50] [--summary-format json|text] [--dry-run] [--log-json] [--fail-on-error] [--batch-id <id>]`
  - Event ingest stub: `pnpm cli event:ingest --payload '{"provider":"stub","event_type":"delivered","provider_event_id":"123"}' [--dry-run]`
  - Draft generation: `pnpm cli draft:generate --campaign-id <id> [--dry-run] [--fail-fast] [--limit 100]`
  - Campaign status change: `pnpm cli campaign:status --campaign-id <id> --status <nextStatus>`
  Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` env vars are present (see `.env.example` once added).

### Smartlead MCP (optional)
- Use Smartlead MCP to avoid building a custom Smartlead connector. Setup steps live in
  `docs/Setup_smartlead_mcp.md`.
- Add `.env` entries: `SMARTLEAD_MCP_URL`, `SMARTLEAD_MCP_TOKEN`, `SMARTLEAD_MCP_WORKSPACE_ID`
  (optional). Keep secrets out of git.
- Start with ingest-first (list/pull via MCP → `event:ingest`) before enabling outbound send; always
  support `--dry-run` and idempotent ingest on `provider_event_id`.
- CLI commands:
  - List campaigns: `pnpm cli smartlead:campaigns:list [--dry-run] [--format json|text]`
  - Pull events and ingest: `pnpm cli smartlead:events:pull [--dry-run] [--format json|text] [--since <iso>] [--limit <n>]`
    - `--since` requires Zulu ISO 8601 (e.g., 2025-01-01T00:00:00Z); `--limit` is clamped to 500.
    - Optional guardrails: `--retry-after-cap-ms <n>` (default 5000) caps wait on Retry-After; `--assume-now-occurred-at` fills missing timestamps (otherwise rejected).
   - Send via Smartlead: `pnpm cli smartlead:send [--dry-run] [--batch-size <n>]`
   - Reply patterns: events carry `reply_label` (replied/positive/negative); use pattern counts to inform prompts/enrichment. Route `onAssumeNow`/pattern logs into telemetry if enabled.
   - Web UI (mock): `cd web && pnpm install && pnpm dev` (React/Vite scaffold with mock API client). Tests: `cd web && pnpm test`.

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
