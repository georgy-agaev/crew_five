# Supabase Database Reference

This database acts as the single source of truth for company and employee records that power outreach research, segmentation, and campaign execution within the AI SDR toolkit.

## Key Use Cases
- Ingest and normalize companies before orchestrating outreach workflows.
- Attach employee contacts to each company, including enriched research and historical outreach metadata.
- Log AI-driven research or drafting runs so future sessions can reuse context (planned via `ai_interactions`).
- Build audience segments (region, SME status, financial metrics) and feed them into campaign tooling (Smartlead/Leadmagic, SendEmail adapters, etc.).

## Entity Overview

### `public.companies`
| Type | Description |
| --- | --- |
| Primary Key | `id` (`uuid`, `gen_random_uuid()`) |
| Relationship | Parent for `employees.company_id`; referenced by `employees_company_id_fkey`. |
| Row Count | ≈70 rows |
| RLS | Enabled; policy “Allow all for authenticated users” |

**Purpose**  
Canonical record for every target company, storing registration facts, financials, segmentation attributes, and workflow identifiers.

**Important fields**
- **Identity**: `company_name`, `tin` (unique), `registration_number` (unique), `registration_date`, `region`, `status` (default `'Active'`), `segment`, `source`.
- **Compliance & qualification**: `sme_registry` flag, `office_qualification` (`More`/`Less` via check constraint).
- **Financials**: `revenue`, `balance`, `net_profit_loss`, `employee_count`.
- **Contacts & research**: `ceo_name`, `ceo_position`, `primary_email`, `all_company_emails[]`, `website`, `company_description`, `company_research` (`jsonb`, AI-generated summary and source links).
- **Workflow tracking**: `session_key`, `batch_id`, `workflow_execution_id`, `processing_status` (default `'pending'`), `created_at`, `updated_at`.

**Indexes**
- Primary key on `id`.
- Unique indexes on `tin` and `registration_number`.
- Additional non-unique indexes on `tin`, `registration_number`, `segment`, `status`, and `session_key` for filtering/import pipelines.

**Usage tips**
- Treat `session_key` and `batch_id` as idempotency anchors when importing companies from external lists.
- The `company_research` JSONB blob is populated by enrichment runs (for example via `enrich:run --adapter exa`) and can be fed into prompt packs to personalize outreach openings.
- Use the `status` field to drive lifecycle automation (e.g., `Active` → ready for outreach, `Paused` when campaigns are in-flight).

### `public.employees`
| Type | Description |
| --- | --- |
| Primary Key | `id` (`uuid`, `gen_random_uuid()`) |
| Foreign Keys | `company_id` → `companies.id`; enforced via `employees_company_id_fkey`. |
| Row Count | ≈80 rows |
| RLS | Enabled; policy “Allow all for authenticated users” |

**Purpose**  
Stores individual contacts tied to companies, including outreach performance, testing workflows, and AI enrichment artifacts.

**Important fields**
- **Identity & linkage**: `company_id`, `company_name` snapshot, `full_name` plus `first_name`, `last_name`, `middle_name`, `position`.
- **Contact channels**: `work_email`, `generic_email`, `phone_numbers[]`, `source_urls[]`.
- **Outreach campaign metadata**: `outreach_sent_date`, `outreach_type` (`marketing` or `sales`), `campaign_number`, `campaign_status`, reply state flags (`reply_unsubscribe`, `reply_info_request`, `reply_bounce`), `client_status`.
- **Testing workflow**: `test_date`, `test_status` constrained to (`Начато`, `Идет`, `Завершено:Успех`, `Завершено:Неудача`, `Завершено:Требуется доработка`).
- **Processing & provenance**: `company_session_key`, `employee_session_key`, `processing_status` (`'pending'` default), `source_service`, `ai_research_data` (`jsonb`), timestamps.

**Indexes**
- Primary key on `id`.
- Supporting indexes on `company_id`, `work_email`, `campaign_number`, `client_status`, `outreach_sent_date`, `company_session_key`, and `employee_session_key`.

**Usage tips**
- Query `processing_status='pending'` to identify contacts that still need enrichment or outreach drafting.
- The `ai_research_data` JSONB blob is populated by enrichment runs (for example via `enrich:run --adapter exa`) and can store structured insights (e.g., persona tags) that prompt packs can reuse.
- Reply flag columns (`reply_*`) act as lightweight engagement telemetry and can feed suppression logic before the next campaign batch.

### `public.ai_interactions`
| Type | Description |
| --- | --- |
| Primary Key | `id` (`uuid`) |
| Row Count | 0 rows (placeholder for future logging) |
| RLS | Disabled (restrict access through backend service role until policies are defined) |

Tracks AI session transcripts once wired up, storing `session_key`, `conversation_id`, `prompt`, `response`, `model_used`, `confidence_score`, and timestamps. Indexes exist on `session_key` and `conversation_id` to backtrace conversations quickly.

## Data Flow for Outreach Campaigns
1. **Company intake**  
   - Import companies via CLI or API, ensuring `tin`/`registration_number` uniqueness.  
   - Enrich `company_research`, `segment`, and `status` so downstream filters can build precise cohorts.
2. **Contact enrichment**  
   - Insert employees referencing `company_id`.  
   - Update `ai_research_data` and reply flags as campaigns progress.
3. **Audience selection**  
   - Example: select `companies` with `segment='Fintech' AND sme_registry=true` joined to employees with `position ILIKE '%CTO%'`.  
   - Use `session_key` or `batch_id` to tag which campaign run produced each outreach set.
4. **Campaign execution**  
   - Pass selected employees to Smartlead/Leadmagic modules along with template metadata.  
   - Update `campaign_number`, `outreach_sent_date`, and `campaign_status` when queued.
5. **Feedback loop**  
   - Ingest replies (IMAP) and toggle `reply_*` flags.  
   - Optionally log prompts/responses in `ai_interactions` to audit generation quality.

## Example Queries
```sql
-- Fetch ready-to-outreach CTO contacts in active SME companies
SELECT e.id AS employee_id,
       e.full_name,
       e.work_email,
       c.company_name,
       c.segment,
       c.company_research
FROM employees e
JOIN companies c ON c.id = e.company_id
WHERE c.sme_registry IS TRUE
  AND c.status = 'Active'
  AND e.position ILIKE '%CTO%'
  AND e.processing_status = 'pending';
```
```sql
-- Track campaign-level engagement
SELECT campaign_number,
       COUNT(*) FILTER (WHERE reply_bounce)   AS bounces,
       COUNT(*) FILTER (WHERE reply_unsubscribe) AS unsubscribes,
       COUNT(*) FILTER (WHERE reply_info_request) AS info_requests
FROM employees
WHERE campaign_number IS NOT NULL
GROUP BY campaign_number
ORDER BY campaign_number DESC;
```

## Operational Notes
- **RLS**: currently permissive for any authenticated Supabase client. Tighten policies (e.g., session-based filtering) before exposing tables directly to end users or multi-tenant workspaces.
- **Timestamps**: `created_at`/`updated_at` default to `now()`; ensure application code updates `updated_at` via triggers or explicit writes when mutating rows.
- **Idempotency**: pair `session_key` with `batch_id` to safely rerun ingestion workflows without duplicating companies/employees.
- **Future logging**: once `ai_interactions` is populated, link records back to `companies`/`employees` via `session_key` to trace which prompts fed a specific outreach draft.

This reference should give campaign and tooling engineers a shared vocabulary for building queries, automations, and dashboards on top of the Supabase source of truth.

### `public.icp_profiles`
| Type | Description |
| --- | --- |
| Primary Key | `id` (`uuid`, `gen_random_uuid()`) |
| RLS | Enabled; aligned with campaign/segment ownership policies (one workspace per account in the current setup). |

Stores the normalized Ideal Customer Profile (ICP) for a workspace or campaign family.

**Important fields**
- **Identity**: `name`, `description`.
- **Criteria JSON**:
  - `company_criteria jsonb` – structured filters and context derived from the coach’s phases 1–3, including:
    - `valueProp` – one-line value proposition synthesized from Phase 1.
    - `industries[]`, `companySizes[]`, `exampleCompanies[]` – industry/size definitions with examples.
    - `pains[]`, `successFactors[]`, `disqualifiers[]`, `caseStudies[]`.
    - `triggers`, `dataSources` – trigger list and data-source hints for discovery.
  - `persona_criteria jsonb` – persona-centric details (typically from Phase 2), such as:
    - `roles[]` (e.g., `['CTO','VP Sales']`).
    - `decisionMakers[]` – objects with `{ role, concerns }`.
- **Phase snapshot**:
  - `phase_outputs jsonb` – strongly-typed snapshot of ICP coach phases 1–3 (and any additional phases we choose to persist) as returned by the Express-mode coach, including:
    - `phase1.valueProp`.
    - `phase2.industryAndSize`, `phase2.pains`, `phase2.decisionMakers`, `phase2.successFactors`, `phase2.disqualifiers`, `phase2.caseStudies`.
    - `phase3.triggers`, `phase3.dataSources`.
- **Provenance**: `created_by`, `created_at`.

### `public.icp_hypotheses`
| Type | Description |
| --- | --- |
| Primary Key | `id` (`uuid`, `gen_random_uuid()`) |
| Foreign Keys | `icp_id` → `icp_profiles.id` |
| RLS | Enabled; mirrors `icp_profiles` policies. |

Represents testable hypotheses and search configurations attached to a given ICP profile.

**Important fields**
- `hypothesis_label` – human-readable label used in analytics and UI.
- `search_config jsonb` – criteria used for discovery/segments, typically populated by the ICP coach from phases 4–5:
  - Core filters: `region[]`, `size[]`, or other search parameters.
  - `phases` (optional, structured) – snapshot of coach outputs:
    - `phase4.offers[]` – offers per persona with `{ personaRole, context, offer }`.
    - `phase5.critiques[]` – skeptical buyer critique entries `{ offerIndex, roast, suggestion }`.
- `status` – `'draft' | 'active' | 'deprecated'`.

### `public.icp_discovery_runs`
| Type | Description |
| --- | --- |
| Primary Key | `id` (`uuid`, `gen_random_uuid()`) |
| Foreign Keys | `job_id` → `jobs.id`; `icp_profile_id` → `icp_profiles.id`; `icp_hypothesis_id` → `icp_hypotheses.id` |
| RLS | Enabled; follow same “authenticated read/write within account” policies as `icp_profiles`/`icp_hypotheses` (to be refined for multi-tenant workspaces). |

Tracks individual ICP discovery runs, each tied to an ICP profile + hypothesis, an Exa Webset/Webset run id, and a background job record (`jobs.type='icp'`). The `metadata` JSONB field currently stores `provider_run_id` (Exa Webset id) and can be extended with query-plan details later.

**Important fields**
- **Linkage**: `job_id`, `icp_profile_id`, `icp_hypothesis_id`, `provider` (currently `'exa'`).
- **Status**: `status` (`'created'`, `'running'`, `'completed'`, `'failed'`), timestamps.
- **Metadata**: `metadata jsonb` including `provider_run_id` and any future query-plan or cost estimates.

### `public.icp_discovery_candidates`
| Type | Description |
| --- | --- |
| Primary Key | `id` (`uuid`, `gen_random_uuid()`) |
| Foreign Keys | `run_id` → `icp_discovery_runs.id` (on delete cascade) |
| RLS | Enabled; mirror `icp_discovery_runs` policies so a user sees only candidates for runs they own. |

Stores company-level candidates returned from Exa discovery for a given run before they are promoted into `companies`/`segment_members`. These rows are meant for pre-import review in the ICP discovery UI.

**Important fields**
- **Linkage**: `run_id`, implicitly tied back to an ICP profile + hypothesis via `icp_discovery_runs`.
- **Candidate identity**: `candidate_name`, `domain`, `url`, `country`, `size_hint`.
- **Scoring & provenance**: `confidence numeric`, `raw jsonb` (full Exa item for audit/debugging).
