# Session Plan – 2025-11-25 19:02:44

## Overview
Stabilize the mock Web UI, add parity features, then wire a thin HTTP adapter for live data. No legacy
fallback paths. Default to dry-run for destructive actions.

## Scope & Outcomes
- Unblock builds (fix duplicate state/import bugs, consistent loading/error handling).
- Parity pass: drafts table + status filters, interaction/data-quality toggles, send gating on drafts.
- Live adapter: REST proxy to existing CLI/service handlers; UI/api client pointed to it; documented run
steps.

## Tasks
### Completed
- Fixed duplicate state/import errors in `web/src/pages/CampaignsPage.tsx` and `web/src/pages/EventsPage.tsx`; Vite dev now builds.
- Added shared `Alert` component + styling; applied across pages for consistent loading/error display with tests.
- Strengthened `web/src/apiClient` tests for env base URL/error handling; removed unused mock at `src/web/apiClient.ts`.
- Added drafts table + status filter on Drafts page with helper tests.
- Added interaction/data-quality toggles (Strict + Pipeline Express defaults) to campaign actions with summary display.
- Gated Smartlead send behind approved-drafts confirmation helper; added tests for disabled states.
- Added thin HTTP adapter with mock deps (`src/web/server.ts`) plus dispatch tests; updated `web/README.md`
  with adapter endpoints and Vite dev steps.

### To Do
1) Stabilize & Unblock (completed)
- None.

2) Parity Pass (minimal)
- None (complete).

3) Live Adapter
- Hook adapter to real CLI handlers (currently mock deps are default); add live wiring when services available.

## Functions (planned)
- `fetchCampaigns()`: GET campaigns list from adapter.
- `fetchDrafts(campaignId, status?)`: GET drafts for campaign with optional status filter.
- `triggerDraftGenerate(campaignId, opts)`: POST to draft generation, dry-run by default, optional limit.
- `triggerSmartleadSend(opts)`: POST to Smartlead send; dry-run default; batch size forwarded.
- `fetchEvents({ since, limit })`: GET event rows with optional filters.
- `fetchReplyPatterns({ since, topN })`: GET reply pattern counts for chart/list.
- `startWebAdapter()`: Minimal HTTP server routing REST endpoints to existing CLI/service handlers.
- `validateSendReady(drafts)`: Helper to enable/disable send based on approved drafts.
- `DraftsTable`: Component to render drafts list with status filter and counts.
- `ModeToggles`: UI control for interaction/data-quality toggles (UI state only for now).
- `Alert`/`FieldRow`: Presentational helpers for consistent error/loading and form layout.

## Tests (planned)
- `CampaignsPage.fix_duplicate_state_renders_loading`: loading/error render once correctly.
- `EventsPage.renders_events_and_patterns_after_fetch`: shows events + reply patterns after fetch.
- `DraftsPage.filters_by_status_and_triggers_generate`: status filter applied; generate posts dry-run.
- `SendPage.blocks_send_when_no_approved_drafts`: send disabled when drafts list empty/unapproved.
- `apiClient.uses_base_url_and_throws_on_non_ok`: respects base URL; rejects bad HTTP.
- `apiClient.draft_generate_default_dry_run_true`: sends dry-run=true when omitted.
- `apiClient.send_posts_batch_and_dry_run`: forwards batch size + dry-run.
- `server.routes_forward_to_handlers`: adapter routes reach underlying CLI/service functions.
