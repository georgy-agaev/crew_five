# Session Plan – 2025-11-27 Smartlead Campaign Create (Planned)

## Overview
- Goal: Add a safe path to create a Smartlead campaign via API, with dry-run by default, exposed through the adapter, API client, and Workflow 0 UI (“create new” option).
- Scope: Smartlead client create helper, web adapter POST route, web API client, UI control to create + auto-select new campaign. Keep mutations dry-run by default; no legacy MCP fallbacks.

## Plan
- **Smartlead client**: Add `createCampaign` to direct API: POST `/api/v1/campaigns?api_key=...` (fields: name, status active, optional notes), returning `{ id, name, status }`.
- **Adapter route**: POST `/api/smartlead/campaigns` (body: name, dryRun?); invokes client; dry-run returns a stubbed payload without calling Smartlead.
- **API client**: Add `createSmartleadCampaign({ name, dryRun? })`.
- **UI**: In Workflow 0, add “Create new campaign” control next to the selector; on submit, call create endpoint, refresh list, auto-select new campaign, surface errors inline.
- **Tests**: Adapter route success/dry-run; API client URL/payload; UI prevents empty name and selects newly created campaign.
- **Docs**: Note new POST endpoint and UI flow in README/session log.

## Files to Touch
- `src/integrations/smartleadMcp.ts` – add `createCampaign`.
- `src/web/server.ts` – add POST `/api/smartlead/campaigns`; wire dry-run and client call.
- `src/web/server.test.ts` – tests for create route (dry-run and pass-through).
- `web/src/apiClient.ts` – add `createSmartleadCampaign`.
- `web/src/apiClient.test.ts` – cover create URL/payload.
- `web/src/pages/WorkflowZeroPage.tsx` – add “create new” UI; trigger create + refresh list; validation.
- `web/src/pages/WorkflowZeroPage.test.tsx` – test UI helper validation/selection logic.
- `README.md` – brief note about Smartlead campaign create endpoint/UI.

## Functions
- `createCampaign(params)` (Smartlead client): POST to Smartlead API to create a campaign; returns id/name/status.
- `createSmartleadCampaign(payload)` (web apiClient): POST `/smartlead/campaigns` with name/dryRun.
- UI handler: `handleCreateSmartleadCampaign(name)`; calls API, refreshes list, auto-selects new id.

## Tests
- `server routes – smartlead campaign create dry-run` – returns stub without calling client.
- `server routes – smartlead campaign create success` – calls client with name, returns id.
- `apiClient – createSmartleadCampaign posts name` – payload and URL correct.
- `WorkflowZeroPage – create campaign requires name` – shows error if empty; selects new campaign on success.

## Completed
- Smartlead client now exposes `createCampaign` (direct API) and existing list calls remain.
- Adapter exposes POST `/api/smartlead/campaigns` with dry-run default; errors returned as JSON.
- Web API client adds `createSmartleadCampaign`; UI gained “Create & select” flow and displays campaign status labels.
- README and session log updated; tests updated (adapter route, api client); full suite green.
