# Session Plan – 2025-11-25 18:31:17

## Overview
Hook the Web UI to real CLI/service data via a thin HTTP adapter. Keep scope to read ops (campaigns, drafts, events/patterns) and simple actions (draft generate, send) with dry-run defaults. No legacy fallback; no PII in UI logs.

## Tasks
- To Do: Add a backend adapter (HTTP or local API) that proxies to existing CLI/service handlers.
- To Do: Replace mock API calls in the web app with real fetch calls to the adapter; keep dry-run default for actions.
- To Do: Add minimal error/loading states to all pages.
- To Do: Update docs/changelog/session log.

## Files to Touch
- `web/src/apiClient.ts` – call real endpoints (campaigns, drafts, send, events/patterns).
- `web/src/pages/*` – wire loading/error states; default dry-run for actions.
- Backend adapter (new, e.g., `src/web/server.ts` or `api/`): endpoints for campaigns, drafts, send, events/patterns.
- `README.md`, `CHANGELOG.md`, this session doc – document setup and endpoints.

## Functions
- `fetchCampaigns()` – GET campaigns from adapter.
- `fetchDrafts(campaignId, status?)` – GET drafts by campaign/status.
- `runDraftGenerate(campaignId, opts)` – POST draft generation (dry-run default).
- `runSmartleadSend(opts)` – POST send (dry-run default, batchSize).
- `fetchEvents({ since, limit })` – GET events.
- `fetchReplyPatterns({ since, topN })` – GET pattern counts.

## Tests
- `apiClient.fetches_live_campaigns` – hits adapter and parses list.
- `apiClient.runs_draft_generate_dry_run_default` – dry-run flag sent.
- `apiClient.runs_send_with_batch` – batch size/dry-run forwarded.
- `apiClient.fetches_events_and_patterns` – events/patterns parsed from adapter.
