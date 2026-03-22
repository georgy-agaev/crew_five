# Session Plan – 2025-12-13 ICP Coach Interactive Mode (Phase 1)

> Timestamp (UTC): 2025-12-13T00:22:59Z  
> Goal: Layer a minimal “interactive” ICP coach experience on top of the existing Express JSON contract and typed phase storage, without changing the backend schema or coach payloads.

## Short Overview

- Reuse the current Express-mode coach endpoints (`/api/coach/icp`, `/api/coach/hypothesis`) and typed phase structures as the only LLM contract for now.
- Make the “Chat with AI” experiences in the Pipeline Workspace and ICP Discovery feel more interactive by:
  - Capturing user prompts and coach results in a lightweight chat transcript.
  - Surfacing phase-derived summaries (value prop, ICP details, offers, critiques) inline as assistant messages.
- Keep storage unchanged: `icp_profiles`, `icp_hypotheses`, and `icp_profiles.phase_outputs` remain the single source of truth.

## Scope (Phase 1)

- Frontend-only enhancements:
  - Add transient chat transcripts around ICP and Hypothesis coach calls in:
    - `web/src/pages/PipelineWorkspaceWithSidebar.tsx` (AI Assistant modal).
    - Optionally, `web/src/pages/IcpDiscoveryPage.tsx` (for ICP-specific runs).
  - Use existing coach responses (including `phase_outputs` and `search_config.phases`) to render structured assistant messages after each run.
- No new HTTP endpoints, DB tables, or coach methods.
- No changes to the Express-mode phase schema defined in `src/services/icpCoach.ts`.

## Files to Change

- `web/src/pages/PipelineWorkspaceWithSidebar.tsx`
  - Extend the AI Assistant modal to maintain a small `messages` array for the current session:
    - `{ role: 'user' | 'assistant'; text: string; meta?: { type: 'icpSummary' | 'hypothesisSummary' } }`.
  - When `handleAiSend` runs in `icp` or `hypothesis` step:
    - Append the user message before calling the coach endpoint.
    - After a successful coach call:
      - Use `buildIcpSummaryFromProfile` / `buildHypothesisSummaryFromSearchConfig` on the returned profile/hypothesis.
      - Append an assistant message containing a short textual summary built from those helpers.
  - Ensure the transcript is cleared when closing the AI Assistant or changing steps to avoid cross-contamination between ICP and Hypothesis flows.

- `web/src/pages/IcpDiscoveryPage.tsx` (optional, if scope permits)
  - Mirror the same pattern for the dedicated ICP discovery coach buttons:
    - Maintain a local transcript showing the last user prompt and the derived ICP/hypothesis summaries for that page.
    - Keep this view read-only and focused on the most recent run.

- `web/src/pages/PipelineWorkspaceWithSidebar.test.ts`
  - Add helper-level tests for a new formatter that turns `buildIcpSummaryFromProfile` / `buildHypothesisSummaryFromSearchConfig` outputs into human-readable strings suitable for assistant messages.

## Functions to Implement or Extend

- `formatIcpSummaryForChat(summary)` (new, pure helper)
  - Input: result of `buildIcpSummaryFromProfile`.
  - Output: a single string (2–4 sentences / bullet-style) that concisely describes:
    - Value prop.
    - Industries and company sizes.
    - Key pains and triggers.
  - Used only inside the Pipeline Workspace AI Assistant to render assistant messages.

- `formatHypothesisSummaryForChat(summary)` (new, pure helper)
  - Input: result of `buildHypothesisSummaryFromSearchConfig`.
  - Output: a single string summarizing:
    - Hypothesis label and regions.
    - Offers and critiques (at most a couple of items).

- `appendChatMessage(role, text, meta?)` (inline in `PipelineWorkspaceWithSidebar.tsx`)
  - Small local function that appends a message to the AI Assistant transcript state while preserving immutability.

- `handleAiSend` (existing)
  - Extend behaviour:
    - Before calling coach endpoints, push the user message into the transcript.
    - After `generateIcpProfileViaCoach` / `generateHypothesisViaCoach` resolves:
      - Build summaries via the formatting helpers.
      - Append an assistant message using the formatted summary.

## Planned Tests

**In `web/src/pages/PipelineWorkspaceWithSidebar.test.ts`**

- `formatIcpSummaryForChat_includes_value_prop_and_industries`
  - Given a populated ICP summary, expect the formatted string to contain the value prop and at least one industry token.

- `formatHypothesisSummaryForChat_includes_label_offers_and_critiques`
  - Given a populated hypothesis summary, expect the formatted string to contain the label and fragments of the first offer and critique.

- (Optional, light behaviour test)
  - `ai_chat_appendChatMessage_appends_messages_immutably`
    - Asserts that the helper used to append chat messages returns a new array and preserves the original messages.

## Completed vs To Do (for this session)

- **Completed (pre-session context carried in)**  
  - Typed coach phase structures and `icp_profiles.phase_outputs` snapshot wiring are live and tested.  
  - Prompt Registry `prompt_text` is now treated as the primary system prompt for coach flows.  
  - Pipeline Workspace sidebar shows ICP and Hypothesis summaries derived from the typed phases.

- **To Do (this session: Phase 1 interactive)**  
  - Implement `formatIcpSummaryForChat` / `formatHypothesisSummaryForChat` plus tests. ✅  
  - Add a minimal AI Assistant transcript state in `PipelineWorkspaceWithSidebar` that records user prompts and assistant summaries for ICP/Hypothesis coach runs. ✅  
  - Wire `handleAiSend` to append user + assistant messages using the new helpers, keeping behaviour strictly on top of existing Express-mode coach calls (no schema or contract changes). ✅  
  - Re-run `pnpm lint`, `pnpm build`, and targeted Vitest suites for the updated files. ✅
