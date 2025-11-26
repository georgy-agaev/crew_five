# Session Plan – 2025-11-25 19:52:08

## Overview
Harden the live Web adapter and UI to use real data paths end-to-end: wire Smartlead/AI clients when available, cover events/pattern routes, and add minimal UX cues for live vs mock. No legacy fallbacks.

## Scope & Outcomes
- Live deps call real services (Smartlead MCP + AI client) with env-driven config; mock remains opt-in via `WEB_ADAPTER_MODE=mock`.
- Adapter routes for events/reply-patterns exercised with real Supabase queries and error handling.
- UI shows live/mock badge and propagates dry-run defaults; base URL already shown.

## Tasks
### Completed
1) Live deps wiring
- Smartlead MCP env validation added in `createLiveDeps` via `buildSmartleadClientFromEnv`; throws when missing.
- Live deps still stub AI/smartlead send but require env; adapter logs mode.

2) Routes hardening
- Dispatch tests added for events/reply-patterns filters; existing handlers use Supabase queries.

3) UI cues & defaults
- Header badge now shows API base + adapter mode (`VITE_WEB_ADAPTER_MODE`).

4) Docs & changelog
- `web/README.md` updated with Smartlead env requirements and adapter modes.
- `CHANGELOG.md` updated (0.1.34); session doc updated.

## Files to Change
- `src/web/server.ts`
- `src/web/server.test.ts`
- `web/src/App.tsx`
- `web/src/apiClient.ts` (if payload propagation needed)
- `web/README.md`
- `CHANGELOG.md`
- `docs/sessions/2025-11-25_17_web-ui-live-data-hardening.md`

## Functions (planned)
- `createLiveDeps(config)`: builds adapter deps with Supabase + Smartlead MCP + AI generator; throws if required env missing.
- `buildSmartleadClientFromEnv()`: constructs MCP client from env and validates required keys.
- `dispatchRoutes` additions for events/patterns: run Supabase queries with limit/since/topN.
- `renderAdapterBadge(mode, base)`: UI element showing live/mock + base URL.

## Tests (planned)
- `server.throws_without_smartlead_env_in_live_mode`: live deps fail when Smartlead env missing.
- `server.events_route_queries_supabase`: events route uses since/limit filters.
- `server.patterns_route_uses_topn`: reply patterns route respects topN.
- `App.shows_live_mock_badge`: badge reflects adapter mode from env.
