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
- Updated Pipeline Draft step to support **Live** draft generation:
  - Added a “Draft execution” toggle (`Dry-run` vs `Live (save drafts)`).
  - Dry-run no longer unlocks the Send step (prevents proceeding without persisted drafts).
- Fixed draft generation to work with current `segment_members.snapshot` shape:
  - `src/services/drafts.ts` now builds `EmailDraftRequest` from `snapshot.contact` + `snapshot.company` when `snapshot.request` is missing.
  - This resolves “generated=0, dryRun=false” cases where drafts were never inserted.
- Hardened draft generation eligibility and limit semantics:
  - Draft generation now **skips contacts without an email** and scans deeper than the requested draft limit to
    fulfill it when possible (e.g., limit=1 still generates a draft if any segment member has an email).
  - This aligns with Smartlead prepare semantics (contacts without email would be skipped anyway).
- Fixed `dist/web/server.js` runtime under Node ESM:
  - Updated the adapter dependency graph to use explicit `.js` specifiers and avoid directory imports, so the built
    adapter can be run via `pnpm build && node dist/web/server.js`.
- Fixed Web unit test discovery to exclude Playwright specs:
  - `web/vite.config.ts` now limits Vitest to `src/**/*.test.*` and excludes `e2e/**`.
- Updated endpoint catalog: `docs/web_ui_endpoints.md`.

## Notes / Findings

- Current campaign/segment data (production Supabase):
  - `First Campaign`: 235 `segment_members`, but only 19 have non-empty `work_email`.
  - With the updated generator, requesting more drafts than eligible contacts will cap at the number of contacts
    with emails.
- `pnpm -C web lint` currently fails with many pre-existing lint errors (e2e and test files). Not addressed in this
  session; root `pnpm lint` remains green (warnings only).

## To Do

- Confirm draft generation works end-to-end for a freshly created campaign (Draft step → drafts persisted).
- Add a dedicated “Create campaign” entry point outside Pipeline Draft (optional, UX polish).
- Add a small e2e smoke test that creates a campaign then generates drafts (Playwright).
- Improve visibility of “no eligible contacts (no email)” in the Draft UI (UX polish).
