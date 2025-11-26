# Session Plan – 2025-11-25 19:43:23

## Overview
Wire the Web UI to a live HTTP adapter that forwards to existing CLI/service handlers, keep dry-run defaults, and remove remaining mock seams. No legacy fallback paths.

## Scope & Outcomes
- Replace mock deps in `src/web/server.ts` with real handler wiring and keep mock as dev fallback flag.
- Point `web/src/apiClient.ts` to the adapter (base URL/env), ensure consistent error messaging.
- Add minimal UI polish: show adapter base URL hint, keep send/draft actions dry-run by default.
- Tests green across root + web packages.

## Tasks
### Completed
1) Adapter Wiring
- Added `createLiveDeps` in `src/web/server.ts` using Supabase + stub AI/Smartlead, env switch for mock mode.
- Main entry now selects live vs mock via `WEB_ADAPTER_MODE`; dispatch tests cover live deps.

2) API Client Alignment
- App shows adapter base URL hint; API client already honors `VITE_API_BASE` and errors; tests cover base/error.

3) Docs & Cleanup
- `web/README.md` updated with live adapter env/run steps and mock flag.
- `CHANGELOG.md` updated (0.1.33) plus this session doc.

## Files to Change
- `src/web/server.ts`
- `web/src/apiClient.ts`
- `web/src/App.tsx` (or layout/header for base URL hint)
- `web/README.md`
- `CHANGELOG.md`
- `docs/sessions/2025-11-25_16_web-ui-live-adapter-implementation.md`

## Functions (planned)
- `createWebAdapter(deps)`: HTTP server bridging REST routes to provided deps/handlers.
- `startWebAdapter(deps, port)`: boot server with live deps and log address.
- `createLiveDeps(config)`: build adapter deps that invoke real CLI/service handlers (Supabase/Smartlead/drafts/events).
- `fetchCampaigns|fetchDrafts|triggerDraftGenerate|triggerSmartleadSend|fetchEvents|fetchReplyPatterns`: client calls honoring `VITE_API_BASE`, throwing on non-OK responses.
- `renderBaseUrlNotice(base)`: small UI element showing which adapter/base is in use.

## Tests (planned)
- `server.uses_live_deps_for_campaigns`: live deps called when route hit.
- `server.drafts_generate_forwards_payload`: payload forwarded to handler with defaults.
- `apiClient.honors_vite_api_base`: GET uses env base URL.
- `apiClient.raises_on_http_error`: non-OK responses throw with status message.
- `App.shows_base_url_notice`: UI renders current adapter base URL.
