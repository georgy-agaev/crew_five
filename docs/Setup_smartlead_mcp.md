# Smartlead MCP Setup (Optional)

Use the Smartlead MCP server to avoid building a custom Smartlead connector. This guide keeps the
integration focused on configuration and thin client wiring so we can stay on core AI SDR tasks.

## What This Covers
- Running the Smartlead MCP server locally or in your infra.
- Securing access tokens outside git.
- Wiring environment variables and MCP client config for this repo.
- Integration options (ingest-first vs. full loop) with guardrails (`dryRun`, idempotency).

## Prerequisites
- Smartlead account with MCP server access (see Smartlead docs).
- Node 18+ and `pnpm` installed locally.
- This repo checked out with `.env` gitignored (keep tokens out of git).

## Install the Smartlead MCP Server
Pick one:
- **npm (local)**: `npm install -g smartlead-mcp && smartlead-mcp start`
- **Docker** (example): `docker run -p 3001:3001 ghcr.io/smartlead-ai/smartlead-mcp:latest`
- **Hosted**: use your team’s MCP endpoint if provided.

## Configure Environment Variables
Add these to your local `.env` (never commit secrets):
- `SMARTLEAD_MCP_URL` – base URL for the MCP server (e.g., `http://localhost:3001`)
- `SMARTLEAD_MCP_TOKEN` – auth token for the MCP server
- `SMARTLEAD_MCP_WORKSPACE_ID` – optional, if your org requires scoping

Also add the same keys to `.env.example` without real values.

## Wire the MCP Client
Point your MCP client config (where other MCP servers are defined) to the Smartlead MCP server:
- `name: smartlead`
- `url: $SMARTLEAD_MCP_URL`
- `headers: Authorization: Bearer $SMARTLEAD_MCP_TOKEN`
Keep this config out of version control.

## Integration Options (choose one to start)
1) **Docs + wrapper only**: add a thin `smartleadMcp` client wrapper to call MCP methods; reuse
   existing orchestrators; no new CLI surface yet.
2) **Read/ingest first**: add list/pull commands (campaigns/events) that feed existing
   `event:ingest`; keep outbound on SMTP while we validate ingest paths.
3) **Full loop**: send + ingest + list commands; toggle orchestrators to use Smartlead MCP when
   configured. Always support `--dry-run` and enforce idempotency (`provider_event_id` hashes).

We can start with option 2 for fastest value, then expand to option 3 when stable.

## Guardrails & Testing
- Always support `--dry-run` for Smartlead actions; log a single summary to avoid duplicate logs.
- Deduplicate ingest on `provider_event_id` and include an idempotency hash in storage.
- Tests use mocked MCP client responses (no live Smartlead calls). Cover success, failure, dry-run,
  and idempotent ingest paths.

## What to Update in Code (when we wire this)
- Add `src/integrations/smartleadMcp.ts` (typed wrapper with `dryRun` support).
- Expose minimal CLI commands (e.g., `smartlead:campaigns:list`, `smartlead:events:pull`,
  `smartlead:send`) that delegate to the wrapper.
- Reuse existing send/draft/status orchestrators instead of duplicating pipelines.

## Security
- Keep MCP tokens in `.env`/secret manager (1Password CLI, etc.).
- Do not commit Smartlead configs or tokens.
- Rotate tokens periodically; document rotations in session logs.

## CLI Usage (ingest-first)
- List campaigns: `pnpm cli smartlead:campaigns:list [--dry-run] [--format json|text]`
- Pull events and ingest via existing pipeline: `pnpm cli smartlead:events:pull [--dry-run] [--format json|text] [--since <iso>] [--limit <n>]`
  - `--dry-run` skips the MCP call and ingestion, returning a summary only.
  - `--since` pulls events after a timestamp; `--limit` caps fetched events.
  - `--since` must be Zulu ISO 8601 (e.g., `2025-01-01T00:00:00Z`); `--limit` is clamped to 500.
  - Optional: `--retry-after-cap-ms <n>` caps Retry-After waits (default 5000ms); `--assume-now-occurred-at` fills missing `occurred_at` (use only if acceptable).
  - Error bodies are truncated to a short snippet in failures; retry cap can be overridden via env `SMARTLEAD_MCP_RETRY_AFTER_CAP_MS`.
- Reply patterns: events carry `reply_label` (replied/positive/negative). Use pattern counts to guide prompt/enrichment updates; log `assume-now` usage if you enable that flag.
