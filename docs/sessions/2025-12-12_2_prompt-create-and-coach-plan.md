# Session Plan – Prompt Creation & ICP Coach Wiring

> Pre-session notes for a follow-up to `2025-12-12_1_llm-model-list-and-coach-wiring-results.md`.  
> Focus: make Prompt Registry entries first-class system prompts for coach flows and persist ICP/hypothesis outputs from phases 1–5.

## Overview

- Goal: Allow users to create/save full system prompts in the Prompt Registry, attach them to specific tasks (ICP profile, hypothesis, drafts), and then use “Chat with AI” to run an ICP coach flow where the first five phases capture:
  - Product value proposition understanding (Phase 1).
  - Full ICP details (Phase 2).
  - Triggers & data providers (Phase 3).
  - Messaging & offers (Phase 4).
  - Skeptical buyer critique (Phase 5).
- The outputs of these phases should be stored as:
  - A durable ICP definition.
  - A set of hypotheses and segment proposals that are usable by the rest of the GTM spine.

## What Already Exists (Today)

- `prompt_registry` schema:
  - Base table: `supabase/migrations/20251201102000_add_prompt_registry.sql`.
  - `step` and extended `rollout_status` values: `20251204190000_update_prompt_registry_step_and_status.sql`.
  - `prompt_text text` column: `20251210102000_add_prompt_text_to_prompt_registry.sql`.
- Prompt creation UI:
  - `web/src/pages/PromptRegistryPage.tsx` exposes a “Create prompt entry” form with:
    - `id`, `version`, `rollout_status`, `description`, `prompt_text`.
  - `web/src/pages/PipelineWorkspaceWithSidebar.tsx` has an inline prompt create form (`buildPromptCreateEntry`) used in the Prompt Registry section; it also includes `prompt_text` in `createPromptRegistryEntry` calls.
- Coach orchestration:
  - `src/services/icpCoach.ts`:
    - Loads the base ICP coach scaffold from `prompts/ICP_Persona_Reseach_Coach_v1_0.md`.
    - Runs in “EXPRESS JSON MODE” (single-shot JSON response) for:
      - `runIcpCoachProfileLlm` → `IcpCoachProfilePayload` with `{ name, description?, companyCriteria, personaCriteria, triggers?, dataSources? }`.
      - `runIcpCoachHypothesisLlm` → `IcpCoachHypothesisPayload` with `{ hypothesisLabel, searchConfig }`.
  - `src/services/coach.ts`:
    - `resolveCoachPromptText` reads `prompt_registry.prompt_text` and surfaces a friendly error if the column or content is missing.
    - `createIcpProfileViaCoach`:
      - Optionally resolves a `promptId` to `prompt_text` (system prompt override).
      - Builds a `userPrompt` from user text / description / name.
      - Calls `runIcpCoachProfileLlm` and then:
        - Inserts into `icp_profiles` via `createIcpProfile`:
          - `company_criteria` extended with `{ triggers, dataSources }` if present.
          - `persona_criteria` from payload.
    - `createIcpHypothesisViaCoach`:
      - Same pattern for hypotheses; stores `hypothesisLabel` and `searchConfig` in `icp_hypotheses`.
- ICP storage:
  - `icp_profiles` and `icp_hypotheses` defined in `20251130220000_add_icp_profiles_and_hypotheses.sql`.
  - Existing flows (CLI + Web) already use these tables and IDs (`icp_profile_id`, `icp_hypothesis_id`) down the spine.

## Requirements (Restated)

1. **Prompt creation as system prompts**
   - Users must be able to create prompts that act as the *system* portion of the LLM prompt (not just a small “variant”).
   - These system prompts should be:
     - Stored in `prompt_registry.prompt_text`.
     - Linked to tasks/steps (`icp_profile`, `icp_hypothesis`, `draft`) via the existing `step` column and the settings/task prompt mappings.
   - When a prompt is selected for a task (`Chat with AI` flows), the coach should use:
     - System prompt = `prompt_text` (or a combination of scaffold + variant).
     - User prompt = user’s free-text question or description.

2. **Persist outputs of phases 1–5**
   - The “first five phases” of the ICP coach (value prop, ICP, triggers/data sources, offers, skeptical critique) must be persisted as:
     - A concrete ICP record (profile) that the system can reuse (e.g., in `icp_profiles`).
     - A set of hypotheses and candidate segments that can drive:
       - `icp_hypotheses` rows.
       - Optional additional segment proposals / discovery runs.

3. **Chat with AI UX**
   - Users should interact via the “Chat with AI” flows in:
     - ICP discovery page.
     - Workflow Hub.
   - These flows must:
     - Use the selected system prompt from `prompt_registry` (per step).
     - Use user-entered text as `userPrompt`.
     - Persist the resulting ICP and hypotheses in a structured way.

## Options for Storing Phases 1–5

### Option A – Normalize into Existing ICP Tables (No New Schema)

- Keep all storage within:
  - `icp_profiles` (`company_criteria`, `persona_criteria`, `description`).
  - `icp_hypotheses` (`hypothesis_label`, `search_config`).
- Mapping concept:
  - Phase 1 (Value Proposition):
    - `description` on `icp_profiles`.
    - Extra details under `company_criteria.value_prop`.
  - Phase 2 (ICP):
    - 2.1 Industry & Company Size → `company_criteria.industry`, `company_criteria.company_size`, `company_criteria.example_companies[]`.
    - 2.2 Key Challenges & Pain Points → `company_criteria.pains[]`.
    - 2.3 Decision Makers → `persona_criteria.decision_makers[]`.
    - 2.4 Success Factors → `company_criteria.success_factors[]`.
    - 2.5 Disqualifiers → `company_criteria.disqualifiers[]`.
    - 2.6 Case Studies → `company_criteria.case_studies[]`.
  - Phase 3 (Triggers & Data Providers):
    - Already supported: `company_criteria.triggers`, `company_criteria.dataSources`.
  - Phases 4–5 (Messaging & Offers + Skeptical Critique):
    - Represent offers and critiques as part of `icp_hypotheses.search_config`, e.g.:
      - `offers[]`:
        - `{ personaRole, context, offerText }`.
      - `critiques[]`:
        - `{ offerIndex, roast, suggestion }`.
    - These can double as “segment proposals” when we attach them to specific `icp_hypotheses`.
- Pros:
  - No new tables/columns.
  - Reuses current coach payload shapes (`IcpCoachProfilePayload`, `IcpCoachHypothesisPayload`).
  - Minimal changes to Supabase migrations.
- Cons:
  - Phase boundaries are implicit; everything lives inside nested JSON (harder to reason about per phase).

### Option B – Add Phase Snapshot JSON to `icp_profiles`

- Schema: add `phase_outputs jsonb` to `icp_profiles`:
  - Shape example:
    ```json
    {
      "phase1": { ... },
      "phase2": { ... },
      "phase3": { ... },
      "phase4": { ... },
      "phase5": { ... }
    }
    ```
  - Each phase block stores the rich, structured output from the coach (exactly what the LLM returned).
- Also keep Option A’s mapping into `company_criteria` / `persona_criteria` / `search_config` so the rest of the system can use the distilled data.
- Pros:
  - Single-column snapshot of the entire phase 1–5 output per profile.
  - Easy to evolve the schema of `phase_outputs` without impacting downstream consumers.
- Cons:
  - Requires a small schema migration on `icp_profiles`.
  - Some duplication between `phase_outputs` and the normalized criteria/search_config fields.

### Option C – New `icp_coach_sessions` Table

- New table keyed off `jobs.id`:
  - Columns like `job_id`, `icp_profile_id`, `icp_hypothesis_id`, `phase`, `payload`, `created_at`.
  - Optionally store message logs for full conversational history.
- Use existing `icp_profiles`/`icp_hypotheses` only for the distilled, “current” ICP and segment/hypothesis definitions.
- Pros:
  - Clean separation between:
    - Coach session history.
    - Stable ICP/hypothesis records used by GTM workflows.
  - Supports multi-run, multi-phase experiences and future analytics.
- Cons:
  - Heavier change (new table + services + Web/CLI views).
  - More orchestration work vs. Options A/B.

## Prompt Registry: System Prompt vs Variant Text

- Current behaviour:
  - Prompt Registry forms label `prompt_text` as “Variant prompt text (optional; system scaffold is fixed)”.
  - The root scaffold lives in `prompts/ICP_Persona_Reseach_Coach_v1_0.md` and is used by default.
- Desired behaviour:
  - Treat `prompt_registry.prompt_text` as the *actual system prompt* used for the coach:
    - For example, a user might copy the entire ICP coach scaffold and then adapt sections 1–5 for a specific market.
  - The pipeline should:
    - Load `prompt_text` for the selected `coach_prompt_id` and use it as the system prompt override.
    - Continue to fall back to the static scaffold when there is no `prompt_text` entry.
  - The Prompt Registry UI should reflect this:
    - Replace “variant text” copy with “System Prompt Text”.
    - Make “Create Prompt” fully functional for steps `icp_profile`, `icp_hypothesis`, `draft`.

## Usage Modes – Decision

We will support **both** Express and Interactive modes, driven by usage pattern:

- **Express mode (for known ICPs/Hypotheses)**
  - For users who already have a validated ICP/hypothesis set and want to:
    - Make small adjustments or enrich details.
    - Quickly (re)generate ICP/hypothesis records without a long conversation.
  - Implementation direction:
    - Keep and extend the current “EXPRESS JSON MODE” coach:
      - Single-shot JSON response covering phases 1–5.
      - Uses the selected `prompt_registry.prompt_text` as the primary system prompt when available.
    - Persist outputs directly into:
      - `icp_profiles` / `icp_hypotheses` (Option A).
      - Optionally into `icp_profiles.phase_outputs` once that column is added (Option B).

- **Interactive mode (for new users / brainstorming new ICPs & hypotheses)**
  - For:
    - New workspaces that don’t yet know their ICP.
    - Teams exploring or stress-testing new ICPs and hypotheses.
  - Implementation direction:
    - “Chat with AI” flows (ICP Discovery page + Workflow Hub):
      - Use the same Prompt Registry system prompt as Express mode (`coach_prompt_id` → `prompt_text`).
      - Guide the user through phases 1–5 with multi-turn back-and-forth.
    - At the end of phase 5:
      - Synthesize a consolidated JSON payload compatible with the Express coach schema.
      - Persist ICP + hypotheses using the same mapping as Express mode (Option A + optional Option B snapshot).
    - A dedicated `icp_coach_sessions` table (Option C) remains a future enhancement if we decide to store full per-phase transcripts and richer session analytics.

## Implementation Status (end of 2025-12-12)

- **Decisions applied**
  - Option B was adopted: `icp_profiles.phase_outputs jsonb` has been added via migration and is now populated by `createIcpProfileViaCoach` using the typed phase structures from `src/services/icpCoach.ts`.  
  - Express mode remains the only execution mode, but both Pipeline Workspace and ICP Discovery flows thread `prompt_registry.prompt_text` through as the system prompt when a task prompt is selected, with the Markdown scaffold used only as a fallback.

- **Completed this session chain**
  - Updated Prompt Registry UI copy in `web/src/pages/PromptRegistryPage.tsx` so `prompt_text` is clearly treated as **System prompt text** (placeholder, help text, and list row labels), removing the “variant text / fixed scaffold” wording.  
  - Added a small DOM test in `web/src/pages/PromptRegistryPage.test.ts` (running under jsdom) to assert that the textarea uses the new “System prompt text …” placeholder, and wired this test into `vitest.config.ts`.  
  - Implemented typed phase mapping and snapshot persistence (see `docs/sessions/2025-12-12_3_icp-coach-phase-storage-plan.md` and `docs/sessions/2025-12-12_4_icp-coach-interactive-ui-and-e2e-plan.md`) so phases 1–5 land in `company_criteria` / `persona_criteria` / `search_config` plus `icp_profiles.phase_outputs`.
  - Wired Chat with AI flows on the ICP Discovery page and Pipeline Workspace to pass `userPrompt`, `promptId`, `provider`, and `model` through to the coach endpoints, with UI summaries showing the resulting ICP/hypothesis structures.

- **Remaining for future sessions**
  - Design and, if needed, implement a true multi-turn Interactive mode that walks users through phases 1–5 while reusing the same typed payloads and storage (`phase_outputs` / `search_config.phases`).  
  - Consider introducing an `icp_coach_sessions` table (Option C) once we want durable per-phase transcripts and richer analytics that go beyond the current per-profile snapshot.  
  - Add operator-facing documentation and screenshots that explain how to author system prompts in the Prompt Registry (per task) and how those prompts influence ICP/hypothesis outputs in both Express and future Interactive flows.
