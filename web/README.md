# Web UI (React + Vite)

Minimal mock Web UI for campaigns/drafts/send/events/settings. Keep CLI/Web parity; dry-run defaults stay
on for destructive actions.

## Step-by-step: run the Web UI
1) Install deps (root + web): `pnpm install && pnpm --dir web install`.
2) Use only these port pairs locally:
   - Daily work: adapter `8787`, Vite UI `5173`
   - Isolated browser validation only: adapter `8888`, Vite UI `5174`
   Avoid ad hoc ports such as `8788`/`8789`; those were temporary debugging ports only.
3) Start the adapter from repo root (choose one):
   - Live Supabase + Smartlead API on canonical port: `pnpm dev:web:live`
   - Mock/in-memory data on canonical port: `pnpm dev:web:mock`
   - Live validation adapter on isolated port: `pnpm dev:web:validation`
   - Built dist (Node ESM): `pnpm build && WEB_ADAPTER_MODE=mock pnpm start:web:dist`
   The adapter listens on `http://localhost:8787/api` by default; validation runs use `http://localhost:8888/api`.
   Live mode still needs the Supabase + Smartlead API env vars; Smartlead send stays stubbed.
4) Start the Vite dev server (web):
   - Daily UI with built-in `/api` proxy to the daily adapter: `pnpm --dir web dev`
   - Daily UI: `pnpm --dir web dev:canonical`
   - Validation UI: `pnpm --dir web dev:validation`
5) Open the UI at `http://localhost:5173` for daily work and use the readiness badge to confirm adapter mode/health.
6) Optional: tests via `pnpm --dir web test` (web) and `pnpm test` (root, includes adapter tests).

## Port policy
- Daily work must use `8787` (adapter) + `5173` (Vite UI).
- Browser validation or isolated repros must use `8888` (adapter) + `5174` (Vite UI).
- Do not mix the pairs. If the daily UI is on `5173`, either run `pnpm --dir web dev` with the built-in `/api -> http://localhost:8787` proxy or point `VITE_API_BASE` to `http://localhost:8787/api`.

## Troubleshooting
- If `Campaigns` shows list data but detail routes return `404`, you are usually hitting a stale adapter on `8787`.
  Stop the old process and restart with `pnpm dev:web:live`.
- If you need a second adapter for browser validation, start it only on `8888` and point only the validation UI to it
  via `pnpm --dir web dev:validation`.

## API endpoints (adapter)
- `GET /api/campaigns` – list campaigns (mocked in dev server).
- `GET /api/campaigns/<campaignId>/companies` – campaign-bound snapshot companies and enrichment visibility.
- `GET /api/campaigns/<campaignId>/audit` – campaign audit summary plus drill-down issues for completeness checks.
- `GET /api/campaigns/<campaignId>/outbounds` – campaign-bound outbound ledger.
- `GET /api/campaigns/<campaignId>/events` – campaign-bound event ledger (replies, bounces, unsubscribes, etc.).
- `GET /api/drafts?campaignId=<id>&status=<status?>&includeRecipientContext=true` – list drafts, optionally with recipient context for review.
- `POST /api/drafts/<draftId>/status` – `{ status, reviewer?, metadata? }`.
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
