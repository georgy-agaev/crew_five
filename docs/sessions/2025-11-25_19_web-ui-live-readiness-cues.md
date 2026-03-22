# Session Plan – 2025-11-25 20:06:49

## Overview
Add live-readiness cues and guardrails to the Web UI and adapter: surface Smartlead/Supabase readiness in the header, show send disabled with a clear reason when envs are missing, and keep dry-run defaults explicit. No legacy fallback.

## Scope & Outcomes
- Detect adapter mode + Smartlead/Supabase readiness and surface a banner/badge in UI.
- Disable Smartlead send in live mode if required envs missing; show tooltip/message.
- Adapter returns structured error when Smartlead client cannot be built.

## Tasks
### Completed
- Added `/api/meta` readiness endpoint; UI badge consumes mode + Smartlead readiness, and send disables when not ready.
- Adapter keeps env validation; send page shows Smartlead missing reason; docs/changelog updated.

## Files to Change
- `src/web/server.ts`
- `src/web/server.test.ts`
- `web/src/apiClient.ts`
- `web/src/pages/SendPage.tsx`
- `web/src/App.tsx` (badge/banner)
- `web/README.md`
- `CHANGELOG.md`
- `docs/sessions/2025-11-25_19_web-ui-live-readiness-cues.md`

## Functions (planned)
- `fetchMeta()`: GET `/meta` returning `{ mode, apiBase, smartleadReady, supabaseReady }`.
- `createMeta(deps, mode)`: builds readiness payload based on env/deps creation success.
- `SendPage` guard: disables send when `smartleadReady` is false.
- `renderReadinessBanner(meta)`: shows Live/Mock + provider readiness status.

## Tests (planned)
- `server.meta_reports_mode_and_readiness`: /meta returns mode and provider flags.
- `apiClient.fetchMeta_returns_status`: client parses meta payload.
- `SendPage.disables_send_when_smartlead_not_ready`: button disabled with reason.
- `App.shows_readiness_banner`: banner displays readiness state from meta.
