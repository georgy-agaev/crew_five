# Session Plan – 2025-12-12 ICP Coach Phase Storage (Option A → B)

> Timestamp (UTC): 2025-12-12T20:37:36Z  
> Goal: Persist ICP coach phase outputs (1–5) in a structured way using existing ICP tables first (Option A), then add an optional snapshot column on `icp_profiles` (Option B), while continuing to use Prompt Registry as the primary source of system prompts.

## Short Overview

- Implement a clear mapping from the ICP coach LLM JSON output into the existing `icp_profiles` / `icp_hypotheses` tables so that phases 1–5 (value prop, ICP, triggers/data sources, offers, skeptical critique) are reflected in `company_criteria`, `persona_criteria`, and `search_config`.
- Add an optional `phase_outputs jsonb` column to `icp_profiles` to keep a full snapshot of the entire phase 1–5 structure for each Express/Interactive run, without changing the public spine contract.
- Keep Prompt Registry as the source of system prompts for both ICP and Hypothesis tasks: different `promptId`s can drive different system prompts, but the storage layer stays unified.

## Scope and Non-Goals

- In scope:
  - Express mode coach flows (`/coach/icp`, `/coach/hypothesis`) persisting richer structured data for phases 1–5.
  - A light snapshot mechanism on `icp_profiles` capturing phase outputs for later inspection/experiments.
  - Doc updates for prompt usage, ICP storage, and the coach data shapes.
- Out of scope for this session:
  - Full interactive, multi-turn UI for phases 1–5 (we will design for compatibility but not build the entire chat UX here).
  - Any new legacy fallbacks or alternate “file-only” prompt modes (Prompt Registry stays primary; the scaffold file remains just a seed/fallback).

## Implementation Plan (Step-by-Step)

1. **Clarify LLM JSON schema for phases 1–5 (Option A)**
   - Decide and document the JSON structure we expect from the coach for:
     - ICP profile runs: which keys inside `companyCriteria` / `personaCriteria` represent phases 1–3.
     - Hypothesis runs: which keys inside `searchConfig` represent phase 4–5 outputs (offers, critiques, segment proposals).
   - Update `IcpCoachProfilePayload` / `IcpCoachHypothesisPayload` types to reflect these shapes where useful, without over-constraining optional subfields.

2. **Extend ICP coach helpers to handle richer phase data**
   - Keep `runIcpCoachProfileLlm` / `runIcpCoachHypothesisLlm` as the primary entry points.
   - Ensure `validateProfilePayload` / `validateHypothesisPayload` allow and pass through the richer phase data while continuing to enforce the required core keys.

3. **Map phase data into existing ICP tables (Option A)**
   - Update `createIcpProfileViaCoach` to:
     - Merge phase-specific sections into `company_criteria` and `persona_criteria` under stable keys (e.g., `industry`, `pains`, `decisionMakers`, `successFactors`, `disqualifiers`, `caseStudies`, `triggers`, `dataSources`).
   - Update `createIcpHypothesisViaCoach` to:
     - Embed offers and skeptical critiques under `search_config` (e.g., `offers[]`, `critiques[]`, `segmentProposals[]`), so hypotheses fully represent the “ICPs + segment hypotheses” outcome of phases 4–5.

4. **Add `phase_outputs` snapshot to `icp_profiles` (Option B)**
   - Introduce a migration to add `phase_outputs jsonb` to `public.icp_profiles` (nullable, non-breaking).
   - Extend `createIcpProfileViaCoach` so that, when the coach returns a payload containing explicit phase blocks (or when we derive them), we store a normalized snapshot under `phase_outputs`, alongside the flattened `company_criteria` / `persona_criteria`.

5. **Wire Option A/B into jobs and analytics (minimal changes only)**
   - Ensure job payloads in `createIcpProfileViaCoach` / `createIcpHypothesisViaCoach` capture enough information to debug runs (e.g., which `promptId`, provider, model, mode).
   - Keep analytics and existing consumers unchanged; they will continue to read from `icp_profiles` / `icp_hypotheses` without being aware of the new snapshot column.

6. **Update documentation and session notes**
   - Update `docs/Database_Description.md` to describe:
     - The enriched structures inside `company_criteria`, `persona_criteria`, `search_config`.
     - The new `icp_profiles.phase_outputs` snapshot (once added).
   - Amend README/CHANGELOG and this session doc to make the Express-mode coach contract and prompt usage explicit.

7. **Testing and validation**
   - Add/extend Vitest suites for `icpCoach` and `coach` services.
   - Run targeted test files plus `pnpm build` to ensure schema and types remain coherent.

## Files to Touch

- Core services:
  - `src/services/icpCoach.ts` – Extend payload types and validators to support richer phase 1–5 structures while keeping required keys strict.
  - `src/services/coach.ts` – Map extended coach payloads into `icp_profiles` and `icp_hypotheses`, and add `phase_outputs` handling after Option B migration is in place.
- Database:
  - `supabase/migrations/20251212xxxx_add_icp_profile_phase_outputs.sql` (new) – Add `phase_outputs jsonb` to `public.icp_profiles`.
- Tests:
  - `tests/icpCoach.test.ts` – New cases for richer payload shapes.
  - `tests/coach.test.ts` – New cases asserting correct persistence into `icp_profiles` / `icp_hypotheses` and `phase_outputs`.
- Docs:
  - `docs/Database_Description.md` – Document ICP profile/hypothesis JSON shapes and the `phase_outputs` snapshot.
  - `CHANGELOG.md` – Note the new ICP coach storage behaviour and snapshot column.
  - This session file – mark tasks as Completed/To Do as we progress.

## Key Functions (New or Updated) and Their Roles

- `runIcpCoachProfileLlm(chatClient, input: IcpCoachProfileInput)`  
  - Continues to call the ICP coach LLM for profile-building, but will now accept/rout richer JSON structures for phases 1–3 (and optionally 4–5 where relevant) inside `companyCriteria` / `personaCriteria`.  
  - Validates required keys while passing through phase-specific subfields unchanged into `IcpCoachProfilePayload`.

- `runIcpCoachHypothesisLlm(chatClient, input: IcpCoachHypothesisInput)`  
  - Calls the coach LLM to generate a hypothesis and associated search/segment configuration, now allowing nested structures for offers, critiques, and segment proposals inside `searchConfig`.  
  - Ensures `hypothesisLabel` and `searchConfig` exist and defers detailed interpretation of nested fields to downstream mapping.

- `validateProfilePayload(obj, fallbackName): IcpCoachProfilePayload`  
  - Enforces presence of `companyCriteria` and `personaCriteria` and a non-empty `name`; extended to tolerate additional, phase-specific keys inside these objects without discarding them.  
  - Serves as the single normalization point for ICP coach Express-mode responses.

- `validateHypothesisPayload(obj): IcpCoachHypothesisPayload`  
  - Enforces a non-empty `hypothesisLabel` and object-type `searchConfig`.  
  - Extended to allow and preserve nested structures for offers/segment proposals used by Option A/B.

- `createIcpProfileViaCoach(client, chatClient, input)`  
  - Orchestrates ICP profile creation: creates a job, invokes `runIcpCoachProfileLlm`, then writes into `icp_profiles`.  
  - Will be extended to:
    - Merge phase 1–3 (and related) fields into `company_criteria` / `persona_criteria` under stable keys (Option A).  
    - Optionally persist an entire `phase_outputs` snapshot on the profile (Option B).

- `createIcpHypothesisViaCoach(client, chatClient, input)`  
  - Orchestrates hypothesis creation: creates a job, invokes `runIcpCoachHypothesisLlm`, writes into `icp_hypotheses`.  
  - Will embed offers and skeptical critique results under `search_config` so that hypotheses carry the “hypothesis + segment proposal” output from phases 4–5.

## Planned Tests (Names and Behaviour)

- `icp_coach_profile_accepts_richer_company_and_persona_criteria`  
  - Ensures extra phase fields pass through profile payload unchanged.

- `icp_coach_hypothesis_accepts_offers_and_critiques_in_search_config`  
  - Validates hypothesis payload keeps nested offers/critiques objects.

- `coach_create_icp_profile_maps_phase_data_into_company_persona_criteria`  
  - Asserts LLM phase sections land in `company_criteria` / `persona_criteria`.

- `coach_create_icp_hypothesis_embeds_offers_and_segments_in_search_config`  
  - Ensures offers/segment proposals are persisted under `search_config`.

- `coach_create_icp_profile_persists_phase_outputs_snapshot_when_available`  
  - Confirms `phase_outputs` column is populated with normalized phase JSON.

- `coach_create_icp_profile_handles_missing_phase_snapshot_gracefully`  
  - Verifies profiles still save when phase snapshot is absent.

## Options and Trade-offs (Within A/B Path)

- **Chosen for this session – Option 2: Strongly-typed A + structured B**  
  - Define explicit TypeScript interfaces for each phase structure and enforce them in `icpCoach.ts` validators.  
  - Map those typed structures into `company_criteria` / `persona_criteria` / `search_config` and into a structured `phase_outputs` snapshot.  
  - Higher coupling to prompt wording, but gives clearer contracts and safer refactors.

- Option 1 – Minimal A + thin B (not chosen)  
  - Would only push clearly-needed fields into the JSON columns and keep `phase_outputs` raw; we are intentionally taking a stronger typing route instead.

- Option 3 – Introduce session-level logging (future)  
  - Still deferred; if we need richer per-phase analytics later, we can add a dedicated sessions view/table on top of A/B.

## Initial Status

- **Completed this session**  
  - Defined strongly-typed phase structures in `src/services/icpCoach.ts` for phases 1–5 (profile + hypothesis) and updated validators to pass phase JSON through safely.  
  - Extended `createIcpProfileViaCoach` in `src/services/coach.ts` to map phase data into `company_criteria` / `persona_criteria` and to persist a structured `phase_outputs` snapshot via `createIcpProfile`.  
  - Updated `createIcpProfile` in `src/services/icp.ts` and added migration `20251212210000_add_icp_profile_phase_outputs.sql` so `icp_profiles.phase_outputs` is available and populated for coach runs.  
  - Added/updated tests in `tests/icpCoach.test.ts`, `tests/coach.test.ts`, and `tests/icp.test.ts`; all pass under `pnpm test`, and `pnpm lint`/`pnpm build` remain green.

- **To Do (future sessions)**  
  - Wire Interactive (multi-turn) coach flows to reuse the same typed phase structures and storage (`phase_outputs`).  
  - Add optional session-level analytics or a dedicated coach sessions view/table if needed.  
  - Expand docs with concrete JSON examples per phase once prompts stabilize.
