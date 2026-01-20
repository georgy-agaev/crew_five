# Session: Campaign selection/creation before Drafts

> Timestamp: 2026-01-20 08:58:05 +0100

## Overview

Draft generation requires an internal `campaignId`, but the Pipeline Draft step previously had no way to create a
campaign (only `GET /api/campaigns`). This session adds campaign creation end-to-end so the workflow can proceed to
Drafts → Smartlead prepare.

## Completed

- Added `POST /api/campaigns` to the web adapter (`src/web/server.ts`) and wired it to `src/services/campaigns.ts`.
- Added `createCampaign(...)` to the Web UI client (`web/src/apiClient.ts`) plus unit coverage.
- Updated Pipeline Draft step to support creating a campaign inline:
  - Finalizes/snapshots the currently selected segment to obtain `segmentVersion`.
  - Creates and auto-selects the new campaign so “Generate drafts” can proceed.
- Fixed Web unit test discovery to exclude Playwright specs:
  - `web/vite.config.ts` now limits Vitest to `src/**/*.test.*` and excludes `e2e/**`.
- Updated endpoint catalog: `docs/web_ui_endpoints.md`.

## Notes / Findings

- `pnpm -C web lint` currently fails with many pre-existing lint errors (e2e and test files). Not addressed in this
  session; root `pnpm lint` remains green (warnings only).

## To Do

- Confirm draft generation works end-to-end for a freshly created campaign (Draft step → drafts persisted).
- Add a dedicated “Create campaign” entry point outside Pipeline Draft (optional, UX polish).
- Add a small e2e smoke test that creates a campaign then generates drafts (Playwright).

