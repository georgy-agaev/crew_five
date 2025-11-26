# Session Plan – 2025-11-25 20:00:38

## Overview
Finish live-mode wiring for the Web UI: propagate mode toggles to adapter payloads, wire Smartlead send to real MCP client when configured, and add light UX cues for live vs mock. No legacy fallbacks.

## Scope & Outcomes
- Draft generate requests carry interaction/data-quality flags to the adapter; adapter forwards or stores them.
- Smartlead send uses real MCP client when env present; still dry-run default in UI.
- UI shows live/mock badge and keeps dry-run defaults clear.

## Tasks
1) Propagate mode flags
- Update `web/src/apiClient.ts` + `CampaignsPage` to send interaction/data-quality mode in draft generate payload.
- Adapter `generateDrafts` accepts and forwards mode flags to underlying handler (stub store for now if handler lacks fields).

2) Smartlead send live wiring
- Use live Smartlead MCP client in adapter when env set; keep dry-run default in UI.
- Add guardrail: surface error if Smartlead env missing in live mode.

3) UX cue
- Ensure badge displays `VITE_WEB_ADAPTER_MODE` and clarifies dry-run default on send/generate buttons.

4) Docs/changelog/session
- Update `web/README.md` for mode flags in payloads and Smartlead env requirement; bump changelog; mark tasks done in this session doc.

### Completed
- Mode flags now flow from UI/api client into adapter `generateDrafts`.
- Live Smartlead env validation retained; UI badge shows adapter mode and dry-run defaults remain.
- Docs updated (web README, changelog); tests green.

## Files to Change
- `web/src/apiClient.ts`
- `web/src/pages/CampaignsPage.tsx`
- `src/web/server.ts`
- `web/src/App.tsx` (badge/dry-run hint)
- `web/README.md`
- `CHANGELOG.md`
- `docs/sessions/2025-11-25_18_web-ui-live-mode-finishing-touches.md`

## Functions (planned)
- `triggerDraftGenerate(campaignId, opts)`: include interactionMode/dataQualityMode in POST body.
- `generateDrafts` adapter handler: accept mode flags; forward to service or record for logging.
- `startWebAdapter`/`createLiveDeps`: use real Smartlead client when env present; throw otherwise in live mode.
- `renderModeBadge(mode, dryRunDefault)`: displays adapter mode and dry-run defaults.

## Tests (planned)
- `apiClient.sends_mode_flags_in_generate`: payload includes interaction/dataQuality.
- `CampaignsPage.includes_modes_in_summary`: summary string shows selected modes.
- `server.generateDrafts_forwards_mode_flags`: adapter passes modes to handler.
- `server.smartlead_requires_env_in_live_mode`: throws when Smartlead env missing.
- `App.shows_mode_badge_with_dry_run_note`: badge renders mode and dry-run note.
