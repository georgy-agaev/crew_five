# Session – ICP & Hypothesis Creation Live Fixes

> Date: 2025-12-20  
> Timestamp (UTC): 2025-12-20T23:20:00Z  
> Scope: Make ICP profile creation work against the current Supabase schema (without `phase_outputs`) and verify that Hypothesis creation works end-to-end, so ICP and Hypothesis can both be entered from the web UI.

## Short Overview

- Diagnose why `POST /api/icp/profiles` returns 500 (“Server error”) in the ICP tab and fix it without breaking environments that already have the `phase_outputs` column.  
- Confirm that `createIcpProfile` and `createIcpProfileViaCoach` both work against the live Supabase project, and that `createIcpHypothesis` correctly persists hypotheses tied to ICP profiles.  
- Document the fallback behaviour and capture follow-up tasks (e2e UI verification, future migration rollout) for the next session.

## Completed Tasks

- **Identify live schema mismatch for `icp_profiles`**  
  - Used Supabase MCP (`list_tables`) and confirmed that the live `public.icp_profiles` table does **not** yet have the `phase_outputs` column, while the TypeScript service assumes it exists.  
  - Reproduced the failure path via a small `tsx` script using `loadEnv` + `initSupabaseClient` + `createIcpProfile`, which raised `PGRST204: Could not find the 'phase_outputs' column of 'icp_profiles' in the schema cache`.

- **Add safe fallback around `phase_outputs` in `createIcpProfile`**  
  - Updated `src/services/icp.ts` so `createIcpProfile` builds a `baseRow` with only guaranteed columns (`name`, `description`, `company_criteria`, `persona_criteria`, `created_by`).  
  - Implemented `attemptInsert(includePhaseOutputs: boolean)` helper and a module-level flag `icpProfilesSupportsPhaseOutputs`:
    - First call: tries inserting `baseRow` plus `phase_outputs`.  
    - On a Supabase error whose message mentions `phase_outputs` and either “does not exist” **or** “could not find”, retries once without `phase_outputs` and flips the flag so future inserts skip the column entirely.  
  - Kept behaviour unchanged for environments where the column already exists (they will continue to receive populated `phase_outputs`).

- **Strengthen ICP service tests**  
  - Extended `tests/icp.test.ts` with `icp_profile_create_retries_without_phase_outputs_when_column_missing` to assert:
    - First insert payload includes `phase_outputs`.  
    - Second insert payload omits `phase_outputs` after a mock “column does not exist” error.  
    - Returned profile uses the second insert’s data.

- **Verify ICP creation against the live Supabase project**  
  - Ran a `tsx` script using `loadEnv` and `initSupabaseClient` that calls `createIcpProfile` with a simple payload:  
    - Successfully created `Test ICP via script 2` with ID `a5bb7d2d-1195-481f-8a06-593125579ea8`.  
  - Confirmed via MCP SQL that `public.icp_profiles` now contains at least one row.

- **Verify Hypothesis creation against the live project**  
  - Called `createIcpHypothesis` directly with `icpProfileId = 'a5bb7d2d-1195-481f-8a06-593125579ea8'`, label `Test Hypothesis via script`, and a small `searchConfig`.  
  - Hypothesis was created successfully with ID `a252cc81-f258-4e2a-a2b4-f50bc31fc5c4` and correct `icp_id` FK, and MCP SQL shows non-zero rows in `public.icp_hypotheses`.

- **Verify ICP coach path (`/api/coach/icp`) against live Supabase**  
  - Constructed a stub `ChatClient` whose `complete()` returns a well-formed ICP coach payload (including `phases`).  
  - Ran `createIcpProfileViaCoach` with the real Supabase client and the stub chat client:  
    - A new job row was created for type `icp`.  
    - `createIcpProfile` was invoked with `phaseOutputs`, triggering the same fallback logic if the column is missing.  
    - ICP profile `Coach ICP` was successfully persisted (ID `6752753e-0546-420b-8e72-d6df88e61ff1`) with merged `company_criteria`/`persona_criteria`.

- **Improve workflow step highlighting when navigating backwards**  
  - Updated the Pipeline steps bar styling in `web/src/pages/PipelineWorkspaceWithSidebar.tsx` so the **current** step is visually distinct even when previous steps are completed.  
  - Adjusted `handleSelectExisting` so clicking an earlier step card (ICP, Hypothesis, Segment) moves `currentStep` back to that step instead of always advancing, keeping the step colors in sync with the active view.

- **Document behaviour in session docs and changelog**  
  - Updated `docs/sessions/2025-12-19_2_segment-preview-live-debug.md` Details/Remarks to note that earlier ICP failures were due to attempts to write into a non-existent `phase_outputs` column and that `createIcpProfile` now falls back cleanly.  
  - Added a new changelog entry `0.1.80` in `CHANGELOG.md` describing the `phase_outputs` fallback for ICP profile creation.

## Options Considered

- **Option A – Force migration now (phase_outputs mandatory)**  
  - Pros: Strict schema; simpler service layer.  
  - Cons: Breaks any environment where migrations have not yet run; not acceptable for the user’s current live Supabase project.

- **Option B – Remove `phase_outputs` usage from code**  
  - Pros: Eliminates the mismatch entirely.  
  - Cons: Throws away the ICP coach phase snapshot feature that the rest of the codebase and tests already depend on.

- **Option C – Add a backward-compatible fallback in the service layer (chosen)**  
  - Pros: Keeps phase snapshot support where the column exists, while allowing creation on older schemas; change localized to `createIcpProfile`.  
  - Cons: Slightly more complex service code; relies on error-message pattern matching until migrations are fully rolled out.

## To Do (Next Sessions)

- **UI-level verification of ICP and Hypothesis flows**  
  - Run the web adapter in live mode (`WEB_ADAPTER_MODE=live pnpm tsx src/web/server.ts`) and confirm from the browser that:
    - ICP Quick Entry (`Save ICP`) uses `/api/icp/profiles` and succeeds (no “Server error”).  
    - ICP Chat with AI uses `/api/coach/icp` and surfaces the newly created profile in the “Choose Existing” list.  
    - Hypothesis Quick Entry and Chat with AI create hypotheses tied to the selected ICP via `/api/icp/hypotheses`.

- **Migrate `phase_outputs` column in the live Supabase project**  
  - Apply the existing migration `supabase/migrations/20251212210000_add_icp_profile_phase_outputs.sql` to the live database when operationally safe.  
  - After migration, consider adding an observability hook (or temporary logging) to confirm that `icpProfilesSupportsPhaseOutputs` stays `true` and that phase snapshots are persisted.

- **End-to-end UI tests for ICP/Hypothesis**  
  - Use Chrome DevTools MCP to script a minimal e2e flow:
    - Create ICP → Create Hypothesis → Verify both appear in the Pipeline workspace and ICP discovery views.  
  - Capture logs/screenshots and attach them to a future session doc as evidence.

## Notes on Current Behaviour

- ICP and Hypothesis creation via the CLI, the web adapter, and the coach endpoints all share the same underlying service functions (`createIcpProfile`, `createIcpProfileViaCoach`, `createIcpHypothesis`, `createIcpHypothesisViaCoach`). The new fallback logic ensures that none of these paths attempt to write to columns that do not exist in the current Supabase schema.  
- Once the `phase_outputs` column is present in the live database, ICP coach flows will automatically start persisting rich phase snapshots again without needing further code changes.
