# Session Plan – 2025-11-27 Smartlead Campaign Selection (Planned)

## Overview
- Goal: Let users choose an existing Smartlead campaign (or opt to create new later) in Workflow 0 so Smartlead preview/push can target the correct campaign without legacy MCP fallbacks.
- Scope: Smartlead API list, web adapter route, web API client, and Workflow 0 UI selector; keep all mutations in dry-run for now.

## Plan
- **Smartlead client**: Add `listCampaigns` call for active/ready campaigns via direct API.
- **Adapter route**: Expose `GET /api/smartlead/campaigns` that uses the Smartlead client, returning minimal fields.
- **API client**: Add `fetchSmartleadCampaigns()` for the web UI.
- **UI**: In Workflow 0, add a Smartlead campaign selector (existing vs “create new later”), validate selection before preview/push, and pass `campaignId` through.
- **Tests**: Cover adapter route wiring, API client URL, and UI selection validation.
- **Docs**: Note the new Smartlead campaign selection in README/session log.

## Files to Change
- `src/integrations/smartleadMcp.ts` (or existing Smartlead client) – add `listCampaigns` (active) via direct API.
- `src/web/server.ts` – add `/api/smartlead/campaigns` route; wire to Smartlead client; return id/name/status.
- `src/web/server.test.ts` – test new route wiring.
- `web/src/apiClient.ts` – add `fetchSmartleadCampaigns`.
- `web/src/apiClient.test.ts` – test URL/query handling.
- `web/src/pages/WorkflowZeroPage.tsx` – add Smartlead campaign selector, validation, and include `campaignId` in preview call.
- `web/src/pages/WorkflowZeroPage.test.tsx` – cover selection validation behaviour.
- `README.md` – brief note on Smartlead campaign selection in Workflow 0.

## Completed
- Smartlead client exposes `listActiveCampaigns` for direct API; adapter adds `/api/smartlead/campaigns` and uses the client.
- Web API client includes `fetchSmartleadCampaigns`; Workflow 0 UI now has a Smartlead campaign selector, requires a selection before preview, and caps leadIds (200) sent to preview; server caps leadIds at 500 and returns JSON errors on failure.
- Tests updated (adapter route, api client, UI helper); README notes the new campaign list; full suite green.
- Adapter now hits real Smartlead API for campaigns (no fetch stub); UI surfaces errors if campaign list fetch fails.
- UI dropdown now shows Smartlead campaign names with status labels (active/paused/stopped/completed).

## Functions
- `listSmartleadCampaigns(opts?)` (Smartlead client): Fetch active/ready campaigns via Smartlead API, returning id/name/status.
- `fetchSmartleadCampaigns()` (web apiClient): GET `/smartlead/campaigns` and return minimal list.
- UI handlers in `WorkflowZeroPage`: manage selected Smartlead campaign ID, validate before preview, pass campaignId.

## Tests
- `server routes – smartlead campaigns list` – returns campaigns via client.
- `apiClient – fetchSmartleadCampaigns builds URL` – correct path/params.
- `WorkflowZeroPage – blocks preview without campaign selection` – shows error until campaign chosen.
