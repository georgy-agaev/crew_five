# Web UI (React + Vite)

Minimal mock Web UI for campaigns/drafts/send/events/settings. Keep CLI/Web parity; dry-run defaults stay
on for destructive actions.

## Step-by-step: run the Web UI
1) Install deps (root + web): `pnpm install && pnpm --dir web install`.
2) Start the adapter from repo root (choose one):
   - Live Supabase + Smartlead API: `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... SMARTLEAD_API_BASE=... SMARTLEAD_API_KEY=... pnpm tsx src/web/server.ts`
   - Mock/in-memory data: `WEB_ADAPTER_MODE=mock pnpm tsx src/web/server.ts`
   - Built dist (Node ESM): `pnpm build && WEB_ADAPTER_MODE=mock pnpm start:web:dist`
   The adapter listens on `http://localhost:8787/api` by default (`PORT` overrides). Live mode needs the
   Supabase + Smartlead API env vars; Smartlead send stays stubbed.
3) Start the Vite dev server (web): `VITE_API_BASE=http://localhost:8787/api pnpm --dir web dev`.
   Omit `VITE_API_BASE` only if the adapter is reverse-proxied to `/api` from the same origin.
4) Open the UI at `http://localhost:5173` and use the readiness badge to confirm adapter mode/health.
5) Optional: tests via `pnpm --dir web test` (web) and `pnpm test` (root, includes adapter tests).

## API endpoints (adapter)
- `GET /api/campaigns` – list campaigns (mocked in dev server).
- `GET /api/drafts?campaignId=<id>&status=<status?>` – list drafts.
- `POST /api/drafts/generate` – `{ campaignId, dryRun?, limit? }`.
- `POST /api/smartlead/send` – `{ dryRun?, batchSize? }`.
- `GET /api/events?since&limit` – list event rows.
 - `GET /api/reply-patterns?since&topN` – reply pattern counts.

The adapter is deliberately thin; live mode uses Supabase + Smartlead env config with a stubbed AI generator.
Use `WEB_ADAPTER_MODE=mock` to force in-memory data for dev. Live mode requires Supabase and Smartlead env vars.

## Smartlead API vs MCP
- Default integration targets the Smartlead API (`SMARTLEAD_API_BASE` + `SMARTLEAD_API_KEY`).
- An MCP-style (REST API HTTP) connector exists, but we have not identified a secure MCP endpoint from a
  verified provider, so it is not the preferred path. Use the API envs above for live runs.

## Mode flags
- Draft generation POST includes optional `dataQualityMode` (`strict|graceful`) and `interactionMode` (`express|coach`).
- UI defaults remain dry-run for both draft generate and send; badge shows adapter mode (`VITE_WEB_ADAPTER_MODE`).
- Adapter meta endpoint: `GET /api/meta` → `{ mode, apiBase, smartleadReady, supabaseReady }`.
