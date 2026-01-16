# Session Plan – 2025-11-25 13:40:05

## Overview
Implement Campaigns and Drafts views: list campaigns, view details, and show drafts filtered by status with a trigger for draft generation (dry-run + limit).

## Tasks
- Completed: Campaigns page with list and link to drafts; loading/error states.
- Completed: Drafts view with dry-run + limit action; wired to API client.
- Completed: Wire API client calls (live adapter) and loading/error states.
- To Do: Update docs/changelog/session log.

## Files to Touch
- `web/src/pages/Campaigns.tsx`, `web/src/pages/CampaignDetail.tsx`.
- `web/src/components/DraftTable.tsx`.
- `web/src/api/client.ts` – campaigns/drafts calls.
- `README.md`, `CHANGELOG.md`, this session doc.

## Functions
- `useCampaigns()` – fetch and cache campaigns.
- `useDrafts(campaignId, status?)` – fetch drafts by campaign/status.
- `runDraftGenerate(campaignId, opts)` – trigger generation (dry-run + limit).

## Tests
- `campaigns.renders_and_calls_api` – campaigns list loads via API.
- `drafts.triggers_generate_action` – button triggers draft generation with params.

## Status
- Campaigns/Drafts pages implemented with mock API. Docs/changelog updates pending.
