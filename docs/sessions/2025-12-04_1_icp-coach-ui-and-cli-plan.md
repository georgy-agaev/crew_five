# Session Plan – ICP Coach UI Polish + CLI Commands

Timestamp (UTC): 2025-12-04T11-09-57Z

## Overview

We will extend the existing “express ICP coach” implementation in two ways:
(1) improve the Web UI ICP workflow so users see meaningful coach output and errors, and (2) add CLI commands that call the same coach orchestration functions for scriptable ICP/hypothesis creation. We’ll reuse the existing coach services and chat client abstractions, avoid new schemas or frameworks, and keep changes focused on the minimal functionality needed for ICP workflows.

---

## Files to Touch

- `web/src/pages/IcpDiscoveryPage.tsx`
  - Add UI elements for coach run status, job id display, and a concise view of generated ICP profiles/hypotheses.
  - Hook into updated API responses from `/api/coach/icp` and `/api/coach/hypothesis`.
- `web/src/apiClient.ts`
  - Extend `generateIcpProfileViaCoach` / `generateHypothesisViaCoach` to handle `{ jobId, ... }` payloads and expose job ids and any relevant fields to the UI.
- `src/web/server.ts`
  - Optionally adjust coach endpoints’ response shape if needed for the UI (e.g., include explicit `jobId`, `profile`, `hypothesis` keys).
- `web/src/pages/IcpDiscoveryPage.test.tsx` and `web/src/pages/IcpDiscoveryPage.test.ts`
  - Add tests for new UI behaviour around coach calls and error display.
- `src/cli.ts`
  - Add new CLI subcommands for `icp:coach:profile` and `icp:coach:hypothesis`.
- `src/commands/icpCoachProfile.ts` (new)
  - CLI handler for profile generation via coach orchestrator.
- `src/commands/icpCoachHypothesis.ts` (new)
  - CLI handler for hypothesis generation via coach orchestrator.
- `tests/cli.test.ts`
  - Extend tests to cover the new CLI commands and their JSON output.
- `docs/AI_SDR_Toolkit_Architecture.md`
  - Update coaching section to mention CLI coach commands and the express ICP workflow.
- `CHANGELOG.md`
  - Record UI/CLI additions and version bump.

---

## Implementation Plan – Web UI Polish

### Step 1 – Decide and Document Coach HTTP Response Shape

**Goal:** Ensure a stable, explicit shape for coach responses that both Web and CLI can rely on.

- Confirm/adjust `/api/coach/icp` response to:
  - `{ jobId: string; profile: { id: string; name: string; description?: string; ... } }` or `{ jobId, ...row }` with a documented contract.
- Confirm/adjust `/api/coach/hypothesis` response to:
  - `{ jobId: string; hypothesis: { id: string; icp_id: string; hypothesis_label: string; ... } }` or `{ jobId, ...row }`.
- Keep existing tests in `src/web/server.test.ts` passing; if response shape changes, update tests accordingly.

### Step 2 – Extend Web API Client to Surface Job and Entity Details

**Goal:** Make the ICP coach job id and created entities available to the React UI.

- Update `web/src/apiClient.ts`:
  - `generateIcpProfileViaCoach` should return a typed object like:
    - `{ id: string; jobId?: string; name?: string; description?: string }`.
  - `generateHypothesisViaCoach` should return:
    - `{ id: string; jobId?: string; hypothesis_label?: string; icp_profile_id?: string }`.
- Ensure error handling preserves server error messages (`error` field in JSON) so the UI can display a helpful alert.

### Step 3 – Enhance IcpDiscoveryPage UI

**Goal:** Provide clear feedback after coach runs, without adding unnecessary complexity or new flows.

- In `web/src/pages/IcpDiscoveryPage.tsx`:
  - On successful profile coach run:
    - Show the created profile name and id (and job id if present) near the “Generate via coach” button.
    - Optionally populate profile dropdown with the new profile and auto-select it.
  - On successful hypothesis coach run:
    - Show the created hypothesis label + id (and job id if present).
    - Update hypotheses dropdown and auto-select the new hypothesis.
  - On errors (400/500 or JSON parsing errors surfaced by the server):
    - Use the existing `error` state and `<Alert>` component to display a concise message like “ICP coach failed: <message>”.
- Keep the existing “manual create” flow intact; only enhance coach-related actions.

### Step 4 – Add/Update Web UI Tests

**Goal:** Prevent regressions and validate the new UI behaviours.

- In `web/src/pages/IcpDiscoveryPage.test.tsx` and/or `web/src/pages/IcpDiscoveryPage.test.ts`:
  - Add tests that:
    - Mock `generateIcpProfileViaCoach` to return `{ id, jobId }` and verify UI shows the id and auto-selects the profile.
    - Mock `generateHypothesisViaCoach` to return `{ id, jobId }` and verify UI shows the id and auto-selects the hypothesis.
    - Simulate API errors and confirm the `<Alert>` displays the coach-specific message.

---

## Implementation Plan – CLI Coach Commands

### Step 5 – Add CLI Handler Modules

**Goal:** Provide thin handlers that reuse the existing coach orchestration service and print JSON.

- New file: `src/commands/icpCoachProfile.ts`
  - Function: `icpCoachProfileCommand(client, chatClient, options)`.
  - Inputs:
    - `supabaseClient`, a `ChatClient` (likely the same stub used by CLI), and `{ name: string; description?: string; websiteUrl?: string; valueProp?: string }`.
  - Behaviour:
    - Calls `createIcpProfileViaCoach(supabaseClient, chatClient, input)`.
    - Prints `JSON.stringify({ jobId, profileId: profile.id })` to stdout.
- New file: `src/commands/icpCoachHypothesis.ts`
  - Function: `icpCoachHypothesisCommand(client, chatClient, options)`.
  - Inputs:
    - `supabaseClient`, a `ChatClient`, and `{ icpProfileId: string; label?: string; icpDescription?: string }`.
  - Behaviour:
    - Calls `createIcpHypothesisViaCoach(...)`.
    - Prints `JSON.stringify({ jobId, hypothesisId: hypothesis.id })`.

### Step 6 – Wire Commands into CLI

**Goal:** Expose simple, script-friendly CLI entry points.

- In `src/cli.ts`:
  - Reuse the `ChatClient` stub already created in `runCli` for draft generation.
  - Add:
    - `icp:coach:profile`:
      - Flags: `--name <name>` (required), `--description <text>`, `--website-url <url>`, `--value-prop <text>`.
      - Uses `wrapCliAction` to handle errors; on success logs `{ jobId, profileId }`.
    - `icp:coach:hypothesis`:
      - Flags: `--icp-profile-id <id>` (required), `--label <label>`, `--icp-description <text>`.
      - Same error handling; on success logs `{ jobId, hypothesisId }`.
  - Keep arguments and output minimal; no extra text around JSON so scripts can consume it easily.

### Step 7 – CLI Tests

**Goal:** Ensure new commands are wired correctly and produce stable JSON.

- In `tests/cli.test.ts`:
  - Add tests:
    - `cli_icp_coach_profile_calls_orchestrator_and_prints_json`:
      - Inject a mock `createIcpProfileViaCoach` via dependency overrides (or mock `src/services/coach`).
      - Run the program with `['node', 'cli', 'icp:coach:profile', '--name', 'ICP']`.
      - Assert:
        - Orchestrator called with expected payload.
        - Logged output parses as JSON with `{ jobId, profileId }`.
    - `cli_icp_coach_hypothesis_calls_orchestrator_and_prints_json`:
      - Similar pattern for `icp:coach:hypothesis`.
    - `cli_icp_coach_profile_requires_name` and `cli_icp_coach_hypothesis_requires_icp_profile_id`:
      - Ensure CLI exits non-zero and prints a useful error when required arguments are missing.

---

## Function Inventory (New / Updated)

### Web / UI

- `generateIcpProfileViaCoach` (updated, `web/src/apiClient.ts`)
  - Calls `/api/coach/icp` and returns a typed object including `id`, optional `jobId`, and any other relevant profile fields; surfaces API error text when available.

- `generateHypothesisViaCoach` (updated, `web/src/apiClient.ts`)
  - Calls `/api/coach/hypothesis` and returns `{ id, jobId?, hypothesis_label?, icp_profile_id? }` for UI consumption.

- `IcpDiscoveryPage` (updated, `web/src/pages/IcpDiscoveryPage.tsx`)
  - After coach profile/hypothesis generation, shows the created entity’s id + name/label (and job id), auto-selects it in the dropdowns, and displays any errors via the existing alert component.

### CLI

- `icpCoachProfileCommand` (new, `src/commands/icpCoachProfile.ts`)
  - Thin wrapper around `createIcpProfileViaCoach` that takes CLI options, invokes the orchestrator, and prints `{ jobId, profileId }` as JSON.

- `icpCoachHypothesisCommand` (new, `src/commands/icpCoachHypothesis.ts`)
  - Similar wrapper around `createIcpHypothesisViaCoach`, printing `{ jobId, hypothesisId }`.

- CLI `icp:coach:profile` / `icp:coach:hypothesis` (updated wiring in `src/cli.ts`)
  - Commands that parse flags, call the above handlers, and use `wrapCliAction` for consistent error formatting.

---

## Test Plan (Names + Behaviours)

### Web UI Tests

- `icp_page_shows_profile_and_job_id_after_coach_run`
  - Successful coach call; UI shows new profile id/name + job id.

- `icp_page_shows_hypothesis_and_job_id_after_coach_run`
  - Successful coach hypothesis; UI shows new hypothesis label/id + job id.

- `icp_page_auto_selects_generated_profile_and_hypothesis`
  - After coach generation, dropdowns select newly created profile/hypothesis.

- `icp_page_displays_coach_error_in_alert`
  - API error from coach endpoints appears as readable message in `<Alert>`.

### CLI Tests

- `cli_icp_coach_profile_calls_orchestrator_and_prints_json`
  - New command invokes orchestrator with correct payload; output is `{ jobId, profileId }`.

- `cli_icp_coach_hypothesis_calls_orchestrator_and_prints_json`
  - Hypothesis command calls orchestrator; output is `{ jobId, hypothesisId }`.

- `cli_icp_coach_profile_requires_name_argument`
  - Missing `--name` causes non-zero exit and clear error message.

- `cli_icp_coach_hypothesis_requires_icp_profile_id_argument`
  - Missing `--icp-profile-id` causes non-zero exit and clear error message.

---

## Status Summary

### Completed in This Session

- Standardized coach HTTP response envelopes in the web adapter (`{ jobId, profile }` / `{ jobId, hypothesis }`) and updated `src/web/server.test.ts` accordingly.
- Updated `web/src/apiClient.ts` so `generateIcpProfileViaCoach` and `generateHypothesisViaCoach` return typed objects that include `id` and `jobId`, with tests in `web/src/apiClient.test.ts`.
- Enhanced `IcpDiscoveryPage` to show concise “Coach result” lines (name/label, id, job id) and auto-select the newly created profile/hypothesis after coach runs.
- Added CLI handlers `icpCoachProfileCommand` and `icpCoachHypothesisCommand`, wired `icp:coach:profile` and `icp:coach:hypothesis` into `src/cli.ts`, and verified JSON-only `{ jobId, profileId }` / `{ jobId, hypothesisId }` output.
- Extended `tests/cli.test.ts` with integration-style tests for the new CLI commands, reusing the shared `ChatClient`/`AiClient` wiring.
- Updated `docs/AI_SDR_Toolkit_Architecture.md` and `CHANGELOG.md` to document the express ICP coach flow, Web UI behaviour, and new CLI commands.

### To Do / Future Enhancements

- Add focused React tests for `IcpDiscoveryPage` that explicitly assert the presence of the “Coach result” lines (including job ids) and error alerts for failed coach calls.
- Add CLI tests for missing required flags on `icp:coach:profile` (`--name`) and `icp:coach:hypothesis` (`--icp-profile-id`) that validate non-zero exit and clear error messages.
- Optionally introduce a small shared type module for coach response envelopes (server + Web) to further reduce duplication and make future schema evolution easier.


## Scope Guardrails

- No changes to Supabase schema beyond already-added `jobs.type = 'icp'`; no new tables.
- No Exa or AnySite integration yet (hypotheses only carry `searchConfig` as JSON for future use).
- No changes to underlying ICP profile/hypothesis schemas or existing CLI commands (`icp:create`, `icp:hypothesis:create`), other than reusing the orchestrator where appropriate.
- Coach behaviour remains express single-shot; we will not implement multi-turn sessions or tool/browsing support in this session. 
