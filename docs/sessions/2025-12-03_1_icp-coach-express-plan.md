# Session Plan – ICP Coach “Express” Generator Wiring

Timestamp (UTC): 2025-12-03T18-47-26Z

## Overview

In this session we will turn the existing ICP coach prompt (`prompts/ICP_Persona_Reseach_Coach_v1_0.md`) into a single-shot “express” ICP generator behind `/api/coach/icp` (and optionally `/api/coach/hypothesis`). The goal is to get a working, AI-powered ICP creation flow for the Web UI and CLI with minimal new code, no multi-phase dialogue, and no live web search.

Key design decisions (per options selected):
- **Coach orchestration lives in services, not the web adapter**: `src/services/coach.ts` will coordinate LLM calls, jobs, and persistence; the web adapter will just delegate.
- **Separate generic LLM chat client**: introduce a small `ChatClient` abstraction that both the email `AiClient` and the ICP coach use.
- **Prompt loading with caching**: ICP coach prompt stays in `prompts/ICP_Persona_Reseach_Coach_v1_0.md`, loaded and cached by code in `src/services/icpCoach.ts` / `src/services/coach.ts` (documented below).
- **Strict-but-forgiving JSON validation**: we enforce required keys (`name`, `companyCriteria`, `personaCriteria`) and default optional ones (`triggers`, `dataSources`) so small prompt changes don’t break runs.
- **Triggers stored in `company_criteria` JSON**: we keep everything under existing JSON columns, no new schema columns for now.
- **Job-based flow (inline for now)**: `/api/coach/icp` will create an `icp` job in `jobs`, run it inline for MVP, and return `{ jobId, status, profile }`, so we can later move to async workers without changing contracts much.
- **Clear error payloads + raw output logging**: invalid JSON outputs become 400s with structured error codes, while raw model text is logged for debugging.
- **End-to-end + unit tests**: we’ll add golden JSON tests, partial/invalid cases, and adapter tests for the coach endpoints.

---

## Files to Touch

- `prompts/ICP_Persona_Reseach_Coach_v1_0.md`
  - Confirm content and (optionally) add a short header comment clarifying “express JSON mode” usage (without changing core semantics).
- `src/services/chatClient.ts` (new)
  - Generic LLM chat client abstraction used by both email and ICP flows.
- `src/services/aiClient.ts`
  - Refactor to delegate to `ChatClient` while keeping the existing `AiClient` interface intact.
- `src/services/icpCoach.ts` (new)
  - LLM-only ICP coach helpers (prompt loading, system/user prompt construction, JSON parsing).
- `src/services/coach.ts`
  - New orchestration functions that call `icpCoach`, create/update jobs, and persist ICP profiles/hypotheses.
- `src/services/jobs.ts` and `supabase/migrations/20251130205000_add_jobs_table.sql`
  - Extend job type to support ICP jobs (`'icp'`) and keep type definitions in sync.
- `src/web/server.ts`
  - Wire coach endpoints to new orchestration functions in `coach.ts` via `createLiveDeps`.
- `tests/chatClient.test.ts` (new)
  - Tests for the chat client/AiClient relationship.
- `tests/icpCoach.test.ts` (new)
  - Unit tests for the ICP coach LLM + parsing logic.
- `src/web/server.test.ts`
  - Extend tests to cover `/api/coach/icp` and `/api/coach/hypothesis` behaviour.
- `CHANGELOG.md` and `docs/AI_SDR_Toolkit_Architecture.md`
  - Document the ICP coach express flow and where the prompt is loaded (`prompts/ICP_Persona_Reseach_Coach_v1_0.md` + `src/services/icpCoach.ts` / `src/services/coach.ts`).

---

## Implementation Plan (Step-by-Step)

### Step 1 – Introduce Chat Client and Refine AiClient

**Goal:** Have a single, reusable chat abstraction that both email and ICP flows can use.

- Add `src/services/chatClient.ts`:
  - Define a minimal `ChatMessage` type and `ChatClient` interface.
  - Provide a simple `createStubChatClient` used in tests and current CLI/web stubs.
- Refactor `src/services/aiClient.ts`:
  - Keep the public `AiClient` API the same.
  - Internally call a `ChatClient` (for now, a stub that returns the current hard-coded draft) so we can later swap in real providers without touching ICP code.

### Step 2 – Introduce ICP Coach LLM Helpers

**Goal:** Centralize LLM usage for ICP generation and keep orchestration separate.

- Add `src/services/icpCoach.ts` with:
  - `loadIcpCoachPrompt` that reads and caches `prompts/ICP_Persona_Reseach_Coach_v1_0.md`.
  - `buildIcpCoachSystemPrompt` that wraps the file with “express JSON mode” instructions.
  - `runIcpCoachProfileLlm` / `runIcpCoachHypothesisLlm` that accept a `ChatClient`, build prompts, and return parsed JSON payloads.

### Step 3 – Define Minimal Data Shapes for ICP Coach

**Goal:** Formalize what we expect from the JSON-only output while reusing existing ICP services.

- In `src/services/icpCoach.ts`, define TypeScript interfaces:
  - `IcpCoachProfilePayload` with:
    - `name: string`
    - `description?: string`
    - `companyCriteria: Record<string, unknown>`
    - `personaCriteria: Record<string, unknown>`
    - `triggers?: unknown`
    - `dataSources?: unknown`
  - `IcpCoachHypothesisPayload` with:
    - `hypothesisLabel: string`
    - `searchConfig: Record<string, unknown>`
- These map naturally into:
  - `generateIcpProfileFromBrief` (companyCriteria/personaCriteria).
  - `generateIcpHypothesisForSegment` (hypothesisLabel/searchConfig).

### Step 4 – Implement `createIcpProfileViaCoach` (Orchestration)

**Goal:** Implement a single function that takes a name/description/value prop, calls the LLM via `icpCoach`, creates an `icp` job, persists the profile, and updates the job.

**Function:** `createIcpProfileViaCoach(supabaseClient, chatClient, input)`

- **Inputs:**
  - `supabaseClient` for persistence and job writes.
  - `chatClient` implementing the generic chat interface.
  - `input: { name: string; description?: string; websiteUrl?: string; valueProp?: string; }`.
- **Behaviour:**
  - Creates a new `jobs` row with `type: 'icp'`, `status: 'created'`, and payload describing the request (`mode: 'profile'`, input fields).
  - Calls `runIcpCoachProfileLlm` with the ICP prompt and user context to get `IcpCoachProfilePayload`.
  - Validates required fields; optional `triggers`/`dataSources` defaulted and embedded under `company_criteria`.
  - Persists an ICP profile via `generateIcpProfileFromBrief`, embedding triggers/dataSources into `company_criteria`.
  - Updates the job to `status: 'completed'` with `result: { profileId, icpProfile: row }`.
  - Returns `{ jobId, profile }` to callers (web adapter, CLI, etc.).

### Step 5 – Implement `createIcpHypothesisViaCoach` (Orchestration)

**Goal:** Mirror the profile function for hypotheses to support `/api/coach/hypothesis`.

**Function:** `createIcpHypothesisViaCoach(supabaseClient, chatClient, input)`

- **Inputs:**
  - `{ icpProfileId: string; hypothesisLabel?: string; segmentId?: string; icpDescription?: string; }`.
- **Behaviour:**
  - Creates a `jobs` row with `type: 'icp'`, `status: 'created'`, and payload (`mode: 'hypothesis'`, `icpProfileId`, etc.).
  - Calls `runIcpCoachHypothesisLlm` to obtain `{ hypothesisLabel, searchConfig }`.
  - Persists via `generateIcpHypothesisForSegment` or `createIcpHypothesis`.
  - Updates the job to `status: 'completed'` with `result: { hypothesisId, hypothesis }`.
  - Returns `{ jobId, hypothesis }`.

### Step 6 – Wire Web Adapter to Coach Orchestrator

**Goal:** Connect the new orchestration functions to existing HTTP endpoints without changing DB shape.

- In `src/web/server.ts`:
  - Keep `AdapterDeps.generateIcpProfile` / `generateIcpHypothesis` signatures.
  - In `createLiveDeps`:
    - Implement `generateIcpProfile` to:
      1. Validate `name` (400 if missing).
      2. Call `createIcpProfileViaCoach` with `{ name, description, websiteUrl }`.
      3. Return `{ jobId, ...profile }` (or just the profile for now, noting the job in docs).
    - Implement `generateIcpHypothesis` to:
      1. Validate `icpProfileId` (400 if missing).
      2. Call `createIcpHypothesisViaCoach`.
      3. Return `{ jobId, ...hypothesis }`.
  - Ensure existing `createIcpProfile` / `createIcpHypothesis` RPCs remain unchanged for manual create paths.

### Step 7 – Add/Update Tests

**Goal:** Protect behaviour for coach endpoints and parsing logic.

- New test file: `tests/chatClient.test.ts`
  - Tests for chat client + AiClient delegation.
- New test file: `tests/icpCoach.test.ts`
  - Unit tests for parsing, minimal validation, and error paths.
- Update `src/web/server.test.ts`:
  - Add scenarios for `/api/coach/icp` and `/api/coach/hypothesis` with orchestrator deps.

---

## Function Inventory (New / Updated)

### `src/services/chatClient.ts`

- `ChatMessage`, `ChatClient`
  - Minimal types for messages and a chat client interface (system/user messages in, text out).

- `createStubChatClient()`
  - Returns a ChatClient that can be configured in tests and used as the current stub in CLI/web.

### `src/services/aiClient.ts`

- `AiClient`
  - Now delegates to a `ChatClient` internally to generate email drafts while keeping the public `generateDraft` API and tracing behaviour unchanged.

### `src/services/icpCoach.ts`

- `loadIcpCoachPrompt(): Promise<string>`
  - Reads and caches `prompts/ICP_Persona_Reseach_Coach_v1_0.md`; this is the authoritative ICP coach prompt location for code.

- `buildIcpCoachSystemPrompt(basePrompt: string): string`
  - Wraps the base ICP coach prompt with a short prefix instructing the model to run phases 1–3 internally and return JSON-only output.

- `runIcpCoachProfileLlm(chatClient, input): Promise<IcpCoachProfilePayload>`
  - Calls the LLM once with the ICP prompt and user context (name, description, website URL/value prop) and parses the JSON into `companyCriteria` and `personaCriteria` plus optional `triggers`/`dataSources`.

- `runIcpCoachHypothesisLlm(chatClient, input): Promise<IcpCoachHypothesisPayload>`
  - Generates a single hypothesis and Exa-style `searchConfig` from an existing ICP description using the same prompt and JSON-only contract.

### `src/services/coach.ts`

- `createIcpProfileViaCoach(supabaseClient, chatClient, input)`
  - Orchestrates ICP profile creation via the coach: creates an `icp` job, calls the LLM, validates/parses the JSON, embeds triggers/dataSources into `company_criteria`, persists with `generateIcpProfileFromBrief`, updates the job result, and returns `{ jobId, profile }`.

- `createIcpHypothesisViaCoach(supabaseClient, chatClient, input)`
  - Orchestrates hypothesis creation via the coach: creates an `icp` job, calls the LLM, persists with `generateIcpHypothesisForSegment`/`createIcpHypothesis`, updates the job result, and returns `{ jobId, hypothesis }`.

### `src/web/server.ts` (via `createLiveDeps`)

- `generateIcpProfile(payload: Record<string, unknown>): Promise<any>`
  - Uses `createIcpProfileViaCoach` to get criteria from the LLM, persists via `generateIcpProfileFromBrief`, and returns the created ICP profile row (plus job id when needed).

- `generateIcpHypothesis(payload: Record<string, unknown>): Promise<any>`
  - Uses `createIcpHypothesisViaCoach` to obtain `hypothesisLabel`/`searchConfig`, persists with `generateIcpHypothesisForSegment`, and returns the created hypothesis row (plus job id when needed).

---

## Test Plan (Names + Behaviours)

### `tests/chatClient.test.ts`

- `ai_client_delegates_to_chat_client_for_drafts`
  - AiClient uses ChatClient under the hood to generate drafts.

### `tests/icpCoach.test.ts`

- `icp_coach_profile_parses_valid_json_payload`
  - LLM returns well-formed JSON; parsed into expected criteria fields.

- `icp_coach_profile_rejects_non_json_or_missing_fields`
  - Non-JSON or missing `companyCriteria`/`personaCriteria` triggers validation error.

- `icp_coach_hypothesis_parses_label_and_search_config`
  - Hypothesis generator maps JSON `hypothesisLabel` and `searchConfig` correctly.

### `src/web/server.test.ts`

- `coach_icp_endpoint_creates_profile_via_coach_orchestrator`
  - `/api/coach/icp` calls orchestrator, persists ICP, returns created row (and job id when wired).

- `coach_icp_endpoint_returns_400_when_name_missing`
  - ICP coach endpoint validates `name` and fails fast with 400.

- `coach_hypothesis_endpoint_creates_hypothesis_via_coach_orchestrator`
  - `/api/coach/hypothesis` calls hypothesis coach, persists hypothesis, returns created row.

- `coach_hypothesis_endpoint_returns_400_when_icp_profile_id_missing`
  - Validates `icpProfileId` presence and returns 400 on missing input.

---

## Scope Guardrails (Out of Scope for This Session)

- Minimal change to Supabase schema: we will only extend the `jobs.type` check constraint to include `'icp'`; `icp_profiles` / `icp_hypotheses` remain as-is.
- No Exa MCP or AnySite integration yet (hypothesis `searchConfig` is JSON-only and stored for future use).
- No generic “tools / web browsing” support for the LLM; prompt mentions of web search are treated as guidance, not implemented capabilities.
- No new CLI commands; CLI may consume ICPs later but is not touched in this session.

