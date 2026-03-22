# 2025-12-06 – ICP Discovery Web UI Polish

> Timestamp (UTC): 2025-12-06T00:00:00Z  
> Goal: make the ICP discovery “pre-import review” and promotion flow easier to understand and harder to misuse, without changing backend behaviour or schemas.

## Overview
This slice focuses on small UX improvements to the ICP discovery page: clearer feedback when a discovery run returns no candidates, and safer controls around promoting approved companies into a segment. The intent is to reduce “silent no-op” promotions and give users an obvious signal when a run produced zero candidates.

## Changes
- **Pre-import review empty state**
  - When `Load candidates` completes with zero candidates for a non-empty discovery run id, the table now shows a muted row: “No candidates found for this run. Check your ICP filters or rerun discovery.”
  - This avoids showing an empty grid with no explanation and gives users a clear next action.

- **Safer promotion button state**
  - The “Promote approved candidates” button is now disabled if:
    - No target segment is selected, or
    - There are zero approved candidates (`selectedIds.size === 0`), or
    - A promotion is already in progress (`loading`).
  - This prevents accidental clicks that previously surfaced only as error banners and makes readiness to promote more visually obvious.

- **Discovery run affordance**
  - Added a “Run discovery” button next to the Exa query plan that will be used to trigger new discovery runs directly from the UI; for this slice, the control is wired in visually and covered by a presence test, with behaviour wiring planned for a later session once we stabilize the backend run contract.

- **Promotion summary clarity**
  - Promotion success messaging now includes the discovery run id and human-readable segment name (for example, “Promoted 3 companies from run `run-123` into segment “Fintech ICP”.”), making it easier to reconcile UI actions with CLI logs and analytics.

## Tests
- Updated `web/src/pages/IcpDiscoveryPage.test.tsx`:
  - `web_icp_discovery_page_calls_promote_api_for_approved_ids` now asserts that the promote button is enabled once candidates and a segment are available.
  - New test `web_icp_discovery_page_shows_empty_state_when_no_candidates` verifies the empty-state message appears when a run returns zero candidates.

## Completed vs To Do
- **Completed (this session)**  
  - Empty-state messaging for zero-candidate discovery runs on `IcpDiscoveryPage`.  
  - Promotion button disable logic based on selected segment, approved candidates, and in-flight state.  
  - Promotion success message enriched with run id + segment label.  
  - “Run discovery” button added to the query plan panel, with UI-level test coverage.  
  - Tests updated/added under jsdom for ICP discovery UI.  
- **To Do (future phases)**  
  - Optionally surface a short list or count of recently promoted companies (e.g., last run summary) and add richer error messaging when promotion fails due to backend validation (RLS, missing ICP tags, etc.).  
