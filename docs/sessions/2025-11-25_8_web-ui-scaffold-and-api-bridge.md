# Session Plan – 2025-11-25 13:40:05

## Overview
Create a minimal web scaffold (React/Vite) and a thin API bridge that reuses existing CLI/service handlers. No new business logic; focus on wiring and environment setup.

## Tasks
- Completed: Scaffold `web/` app (React/Vite) with TypeScript, basic layout.
- Completed: Add a minimal API client (mock) reusing existing flows (fetch campaigns, trigger drafts, trigger send) with tests.
- To Do: Add env handling for Supabase/Smartlead keys (client-safe subset) and document setup.
- To Do: Update docs/changelog/session log.

## Files to Touch
- `web/` (new) – Vite app, layout, basic routing.
- `web/src/api/client.ts` – wrappers for existing CLI/service calls (mock).
- `README.md`, `CHANGELOG.md`, this session doc.

## Functions
- `fetchCampaigns()` – mock fetch campaigns list.
- `triggerDraftGenerate(campaignId, opts)` – call draft generation endpoint (mock).
- `triggerSmartleadSend(opts)` – call Smartlead send endpoint (mock).

## Tests
- `apiClient.calls_cli_endpoints_mocked` – stubs fetch, ensures correct payloads. (Implemented as mock API client tests.)
- `web.builds_and_renders_shell` – basic render smoke test (pending).

## Status
- Web scaffold and mock API client added with tests. Env/docs pending.
