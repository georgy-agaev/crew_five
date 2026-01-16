# ICP Creation and OSS Reuse Options

Created: 2025-12-02

This note summarizes how to turn the current ICP plumbing (tables, CLI, Web UI)
into a working ICP discovery flow by reusing existing open-source projects
instead of writing everything from scratch.

It builds on:
- `docs/ai_sdr_gtm_analysis.md`
- `docs/ai_sdr_code_reuse_plan.md`
- `docs/1_icp_discovery_exa_any_site_workflow.md`

---

## Current State Snapshot

- Schema and services exist:
  - `supabase/migrations/20251130220000_add_icp_profiles_and_hypotheses.sql`
    defines `icp_profiles` / `icp_hypotheses` plus FKs on `segments`.
  - `src/services/icp.ts` implements `createIcpProfile` /
    `createIcpHypothesis` / `attachIcpToSegment`.
  - `src/services/coach.ts` exposes helpers:
    - `generateIcpProfileFromBrief`
    - `generateIcpHypothesisForSegment`
    - `generateDraftsForSegmentWithIcp` (threads ICP IDs into drafts).
- CLI wiring exists:
  - `icp:create`, `icp:hypothesis:create`, `icp:list`,
    `icp:hypothesis:list` in `src/cli.ts`.
- Web adapter + UI exist:
  - `/api/icp/profiles`, `/api/icp/hypotheses`, `/api/coach/icp`,
    `/api/coach/hypothesis` in `src/web/server.ts`.
  - `web/src/apiClient.ts` and `web/src/pages/IcpDiscoveryPage.tsx` provide an
    ICP Discovery UI with:
    - manual create profile / hypothesis,
    - "Generate via coach" buttons,
    - stubbed candidate companies and Exa query preview.
- Analytics is wired for ICP:
  - ICP IDs flow through drafts, email events, and analytics views so we can
    measure performance by ICP / hypothesis once creation is real.

Net: the **plumbing is there**, but the **coach logic, Exa/AnySite-backed
discovery, and RAG-powered ICP suggestions are not implemented yet**.

---

## Option 1 – SalesGPT as the ICP Coach (Minimal Change)

**Goal:** Make ICP creation work quickly by reusing SalesGPT's "sales brain"
for structured ICP/profile extraction, without touching the existing schema,
CLI, or Web UI.

- **Borrow from:** `filip-michalsky/SalesGPT` (MIT).
- **Reuse directly:**
  - SalesGPT agent class and conversation/state handling.
  - Prompt templates for discovery, objection handling, and stage-aware
    questioning.
- **How to wire into our stack:**
  - Run SalesGPT in a Python (or Node) sidecar service.
    - Expose `POST /coach/icp-session` that:
      - runs a multi-turn dialog with the user,
      - outputs a structured `IcpBrief`:
        `{ name, description, companyCriteria, personaCriteria, createdBy }`.
  - In `src/web/server.ts`:
    - Update `deps.generateIcpProfile` to:
      - call the SalesGPT sidecar when Web UI hits `/api/coach/icp`,
      - take the returned `IcpBrief` and call
        `generateIcpProfileFromBrief(supabase, brief)`.
    - Update `deps.generateIcpHypothesis` similarly for `/api/coach/hypothesis`
      using `generateIcpHypothesisForSegment` where applicable.
  - Keep:
    - `icp_profiles` / `icp_hypotheses` schema untouched,
    - existing CLI commands (`icp:create`, `icp:hypothesis:create`) as escape
      hatches for manual creation.

**Pros**
- Very fast to ship: only add a sidecar + HTTP calls.
- ICP profiles/hypotheses become **real AI outputs** while preserving all
  existing telemetry and analytics wiring.
- SalesGPT is already designed for sales/discovery conversations, reducing
  prompt engineering work.

**Cons**
- No Exa/AnySite integration yet (pure reasoning, no automated expansion).
- Still need to design which questions SalesGPT should ask in the "ICP
  session" so criteria map cleanly into our JSON.

---

## Option 2 – Full ICP Discovery Flow (SalesGPT + Exa + AnySite)

**Goal:** Implement Workflow 1 ("ICP discovery & prospect expansion") end to
end using existing OSS as blueprints and parsers, not as monoliths.

- **Borrow from:**
  - SalesGPT (`filip-michalsky/SalesGPT`) – ICP discovery conversation.
  - AI Sales Assistant Chatbot (`christancho/ai-sales-assistant-chatbot`) –
    RAG + parsing logic for turning web snippets into structured company/contact
    data.
  - Sales Outreach Automation (LangGraph) and AI-SDR (n8n) – **architecture
    only** (no direct code) for the multi-step SDR pipeline.
- **New components (thin):**
  - **ICP Discovery Agent service**:
    - Input: `icp_profile` + `icp_hypothesis` records (from Option 1) and/or
      the form fields from `IcpDiscoveryPage`.
    - Step 1 – Query planning:
      - Reuse `deriveQueries` from `IcpDiscoveryPage.tsx` as a base.
      - Enrich with patterns copied conceptually from the LangGraph and n8n
        repos (company-level, persona-level, trigger-level queries).
    - Step 2 – Exa search:
      - Call `exa_websets_search` via Exa MCP server.
      - Collect URLs + snippets.
    - Step 3 – Parsing & normalization:
      - Reuse AI Sales Assistant Chatbot's extraction code to map snippets to:
        `{ company_name, domain, country, size, tags, person_names, titles }`.
    - Step 4 – Candidate emission:
      - Expose a simple HTTP endpoint (e.g. `/icp/candidates`) that returns
        candidate companies in the same shape currently stubbed in
        `IcpDiscoveryPage.tsx`.
  - **Supabase write path:**
    - After user approves candidates in the UI, call a new backend endpoint
      (e.g. `/icp/import`) that:
      - creates/updates `companies` and `employees`,
      - tags rows with `icp_id`, `hypothesis_id`, `source = "exa_websets"`,
        `confidence_score`, and `exa_metadata` as described in
        `docs/1_icp_discovery_exa_any_site_workflow.md`.
    - Reuse AI Sales Assistant Chatbot-style schemas for storing raw snippets
      and metadata where useful.

**Pros**
- Delivers the Workflow 1 vision: ICP → Exa discovery → review → Supabase →
  campaigns.
- Heavy reuse of proven RAG/parsing code avoids building a custom web
  extraction pipeline.
- Keeps our open-core spine intact: all new logic lives in separate, optional
  services called by the CLI/Web adapter.

**Cons**
- More moving parts (Exa MCP, discovery agent, RAG sidecar).
- Requires cost/rate-limit guardrails (as already discussed in the workflow
  doc).

---

## Option 3 – Data-Driven ICP Suggestions from Our Own History (RAG-First)

**Goal:** Let the system propose ICP profiles and hypotheses by mining our own
historical performance data, again reusing existing OSS RAG code.

- **Borrow from:**
  - AI Sales Assistant Chatbot's RAG and summarization code.
  - (Optionally) SalesGPT's objection/qualification patterns to interpret
    "good fit" traits.
- **Flow:**
  - Periodic batch job or CLI command (`icp:learn-from-events`):
    - Pulls high-quality deals/campaigns from Supabase (e.g. segments/campaigns
      with strong positive reply patterns from `email_events`).
    - Uses the chatbot's ingestion pipeline to feed:
      - company metadata,
      - contact roles,
      - replies / call transcripts (where available),
      - into an embeddings + RAG store.
    - Runs summarization prompts (borrowed from the chatbot repo) to derive:
      - 2–3 candidate `icp_profiles` (industries, size, geo, tech stack).
      - hypotheses describing why those ICPs work.
    - Writes suggestions via `generateIcpProfileFromBrief` and
      `generateIcpHypothesisForSegment`, tagging them as `source = "learned"`.
  - UI:
    - Small addition to `IcpDiscoveryPage`:
      - "Suggest ICPs from history" button calling a new `/icp/suggest` API.

**Pros**
- Uses our **own performance data** to bootstrap ICPs instead of only relying
  on user intuition.
- Almost all complex pieces (embeddings, retrieval, summarization) are reused
  from AI Sales Assistant Chatbot.

**Cons**
- Requires some volume of historical data to be meaningful.
- Needs careful filtering so we don't overfit on noisy or small samples.

---

## Option 4 – Minimalist: Only RAG + Prompt Packs, No External Sidecars

**Goal:** If we want to avoid adding new services for now, we can still improve
ICP creation using existing building blocks in this repo plus OSS prompt/RAG
patterns.

- **Borrow from:**
  - AI Sales Assistant Chatbot for RAG schema and ingestion scripts.
  - SalesGPT / other OSS prompt patterns only as text inspiration.
- **Implementation:**
  - Port the chatbot's RAG schema into Supabase (if not already covered by our
    migrations), and ingest GTM docs / past deals.
  - Use our existing `AiClient` and prompt packs (Appendix A contract +
    upcoming ICP prompt packs) to:
    - generate `companyCriteria` / `personaCriteria` directly inside
      `generateIcpProfileFromBrief` (via a coach prompt),
    - generate `searchConfig` suggestions in
      `generateIcpHypothesisForSegment`.
  - No extra HTTP sidecars: all logic remains inside Node + Supabase.

**Pros**
- Keeps architecture simpler (no new services).
- Still avoids reinventing RAG and ICP prompt structures by copying patterns
  from OSS.

**Cons**
- We lose out on proven SalesGPT conversation flows and dedicated parsing code.
- Harder to reuse complex examples (like LangGraph/n8n SDR flows) without a
  long-term plan for orchestration.

---

## Recommendation

- **Short term (MVP ICP creation):** implement **Option 1**.
  - Add a SalesGPT-based coach sidecar.
  - Wire `/api/coach/icp` and `/api/coach/hypothesis` to it via
    `generateIcpProfileFromBrief` / `generateIcpHypothesisForSegment`.
  - Keep CLI + Web already in place; focus only on the coach brain.
- **Next step (prospect expansion):** layer **Option 2** on top.
  - Use Exa MCP + AI Sales Assistant Chatbot parsing to replace stub candidates
    in `IcpDiscoveryPage` with real data and write approved companies into
    Supabase tagged by ICP/hypothesis.
- **Parallel experiment:** explore **Option 3** once real reply data exists,
  so the system can suggest new ICPs and hypotheses based on what already
  works.

All options keep the open-core spine intact and rely on SalesGPT / AI Sales
Assistant Chatbot primarily as **reusable brains and RAG plumbing**, not as
full-stack replacements.

