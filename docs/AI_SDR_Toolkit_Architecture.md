# AI SDR Toolkit — Architecture & Delivery Plan

## Vision
- CLI-native assistant that helps GTM engineers research prospects, collect company context, craft multilingual outreach (EN/RU/ES/FR), and automate follow-ups.
- Uses curated prompt packs (e.g., `Cold_Bump_Email_Coach_v2_Enhanced.md`) plus DSPy/GEPA optimization and provider routing to keep messaging consistent and measurable.
- Connects to prospect data sources (manual intake + APIs), research services (EXA Websets, Smartlead, Leadmagic), email channels (SendEmail APIs, IMAP), and benchmarking tools (Inspect) to close the loop from drafting to performance tracking.

## High-Level Architecture

### CLI & Runtime
- Node/TypeScript CLI powered by `@vercel/ai`; commands such as `prompt:*`, `workflow:*`, `company:*`, `email:*`, `benchmark:*`.
- Central config (YAML/TOML) storing API keys, routing policies, locales, cadences; CLI validates secrets via `.env` + Doppler/Supabase Vault.
- Local cache (SQLite/Redis) memoizes EXA fetches and LLM completions for offline or rate-limited scenarios.

### Prompt Packs & Coaching Engine
- Prompt specifications are Markdown files parsed into a JSON schema (metadata, supported languages, Express/Standard flow, Pattern Breakers, quality checklist).
- `prompt-pack` module exposes versioning, linting, and simulation commands; prompt packs feed DSPy programs that guide interactive sessions.
- Cold Bump Coach prompt becomes the canonical example and template for future packs (research coach, ICP scoring, objection handling, etc.).

### DSPy + GEPA Workflow Layer
- DSPy collects user answers step-by-step, performs retrieval/reasoning, and generates candidate outputs (Standard/Direct/Casual + Pattern Breaker variants).
- GEPA enforces guardrails (tone, sentence limit, compliance) and can inject policy remediations before returning to user.
- Runs produce structured logs (inputs, outputs, deltas) stored in Supabase for analytics and future fine-tuning.

### Data & Persistence
- Supabase Postgres schema:
  - `companies` (manual intake): `id`, `name`, `tax_id`, `jurisdiction`, `primary_language`, `metadata`, audit fields.
  - `leads`, `campaigns`, `prompt_versions`, `runs`, `email_outbound`, `email_inbound`, `benchmark_results`.
  - pgvector tables for research embeddings; RLS policies scoped per workspace/user.
- CLI provides `company:add`, `company:list`, `company:import` commands; manual intake validates tax IDs and links to campaigns.

### Research & Outreach Integrations
- **Research adapters:** EXA Websets + future data APIs share a unified interface (`search`, `summarize`, `enrich`) with caching and retry policies.
- **Campaign APIs:** Smartlead/Leadmagic modules enqueue outreach steps, capture remote IDs, and sync statuses back to Supabase.
- **Email module:** 
  - Outbound: pluggable `SendEmail` adapters (Resend/SendGrid style signature) with header overrides, batching, logging.
  - Inbound: IMAP client (`imapflow`/`node-imap`) to fetch, tag, and archive replies; ties responses to campaigns and feeds feedback loop.

### Benchmarking & Observability
- Inspect task definitions stored as YAML; `benchmark:run` executes prompts across selected models/providers and persists KPIs (persona accuracy, compliance, tone).
- Routing policies use benchmark tags to pick providers (e.g., GPT-4 for reasoning tasks, Anthropic for empathetic tone).
- Instrumentation via `pino` logs + OpenTelemetry/LangSmith exporters, ensuring run IDs align across CLI, Supabase, and external services.

## Multilingual Strategy
- Language detector (fastText or provider API) selects locale at session start or prompts user when ambiguous.
- Prompt packs contain locale-specific instructions, examples, tone presets, and regulatory notes (e.g., Russian privacy wording).
- DSPy modules branch per language to adjust sentence length, CTA style, and cultural cues while reusing shared logic.
- Glossaries map company/product terms; fallback translation pipeline engaged only when a language is unsupported, with user confirmation.

## MVP Scope & Timeline

| Stream | Key Deliverables | Effort (solo) |
| --- | --- | --- |
| Platform Foundations | CLI skeleton, config loader, Supabase schema, manual `company:*` commands with tax ID support | 1.5 weeks |
| Prompt Packs & Coaching | Prompt-pack parser, Cold Bump Coach flow, DSPy/GEPA integration, multilingual handling, run logging | 2 weeks |
| Integrations & Outreach | EXA adapter + caching, Smartlead/Leadmagic stubs, SendEmail API abstraction, IMAP read/list, email logging tables | 1.5 weeks |
| Benchmarking & Polish | Inspect harness, `benchmark:run`, routing policies, telemetry hooks, docs/tests | 1 week |
| **Total MVP** | ~6 weeks solo (4–5 weeks with two engineers in parallel) | |

## Sprint Plan (2-Week Cadence)

### Sprint 1 – Platform Foundations
- Scaffold Node/TS CLI, config validation, dotenv secrets.
- Design/apply Supabase migrations (`companies`, `leads`, `runs`).
- Implement manual company intake (`company:add/list`, tax ID validation) and persistence tests.
- Baseline logging + error handling.

### Sprint 2 – Prompt Packs & Multilingual Coaching
- Build prompt-pack schema/parser + validation CLI.
- Implement Cold Bump Coach workflow with Standard/Express modes, Pattern Breakers, quality checklist.
- Integrate DSPy + GEPA services (likely via Python sidecar) and store session artifacts in Supabase.
- Add language detection + locale-specific prompt behavior (EN/RU/ES/FR) with tests.

### Sprint 3 – Integrations & Outreach Automation
- Develop EXA Websets adapter with caching + retries.
- Add Smartlead/Leadmagic enqueue modules and link campaigns to company records.
- Implement SendEmail abstraction (Resend/SendGrid adapter) + outbound logging.
- Build IMAP client commands (`email:list-folders`, `email:fetch`, `email:watch`) and inbound logging tables.

### Sprint 4 – Benchmarking & Optimization
- Create Inspect scenario loader and `benchmark:run` CLI command; store results for analytics.
- Introduce routing policies informed by benchmark tags and provider costs/latency.
- Add observability hooks (OpenTelemetry/LangSmith) and tracing IDs across systems.
- Capture DSPy training datasets + feedback loop metrics (responses, tone success) for future tuning.

### Sprint 5 – Polish & Launch Prep
- Documentation (usage guides, prompt pack authoring handbook, API setup instructions).
- Robust error handling, localization refinements, smoke tests.
- Packaging/versioning strategy (`npm` release, binary via `pkg`/`nexe`), backlog grooming for next integrations (CRM sync, additional prompts).

## Next Steps
- Confirm stack/deployment preferences (pure Node vs. hybrid Node+Python service).
- Approve Supabase schema draft and secrets management approach.
- Prioritize additional prompt packs and integrations to feed into post-MVP roadmap.
