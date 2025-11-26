# Web UI (React + Vite)

Minimal mock Web UI for campaigns/drafts/send/events/settings. Keep CLI/Web parity; dry-run defaults stay
on for destructive actions.

## Quick start
- Install deps: `pnpm install && pnpm --dir web install`.
- Start adapter (root): `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SMARTLEAD_MCP_URL=... SMARTLEAD_MCP_TOKEN=... pnpm tsx src/web/server.ts`
  - Defaults to live mode using Supabase + stub AI/Smartlead send. Set `WEB_ADAPTER_MODE=mock` to use in-memory data.
- Run UI (web): `VITE_API_BASE=http://localhost:8787/api pnpm --dir web dev` (defaults to `/api` if unset).
- Tests: `pnpm --dir web test`; root tests: `pnpm test` (includes adapter tests).

## API endpoints (adapter)
- `GET /api/campaigns` – list campaigns (mocked in dev server).
- `GET /api/drafts?campaignId=<id>&status=<status?>` – list drafts.
- `POST /api/drafts/generate` – `{ campaignId, dryRun?, limit? }`.
- `POST /api/smartlead/send` – `{ dryRun?, batchSize? }`.
- `GET /api/events?since&limit` – list event rows.
- `GET /api/reply-patterns?since&topN` – reply pattern counts.

The adapter is deliberately thin; live mode uses Supabase + Smartlead env config with a stubbed AI generator.
Use `WEB_ADAPTER_MODE=mock` to force in-memory data for dev. Live mode requires Supabase and Smartlead env vars.

## Mode flags
- Draft generation POST includes optional `dataQualityMode` (`strict|graceful`) and `interactionMode` (`express|coach`).
- UI defaults remain dry-run for both draft generate and send; badge shows adapter mode (`VITE_WEB_ADAPTER_MODE`).
- Adapter meta endpoint: `GET /api/meta` → `{ mode, apiBase, smartleadReady, supabaseReady }`.
