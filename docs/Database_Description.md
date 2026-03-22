# Supabase Database Reference (Current Schema)

> Version: v0.7 (2026-03-22)

This document is a shareable, table-by-table reference for the **current** Supabase Postgres schema used by the
AI SDR toolkit.

**Scope**
- Schema: `public` (application tables only).
- Source of truth: live DB introspection (`information_schema`, `pg_catalog`, `pg_indexes`, `pg_policies`).
- “Row count” is from `pg_stat_user_tables.n_live_tup` (approximate; can lag).

## Quick Map (Entities & Relationships)

- `projects` (1) → (N) `icp_profiles`
- `projects` (1) → (N) `offers`
- `projects` (1) → (N) `campaigns`
- `companies` (1) → (N) `employees`
- `segments` (1) → (N) `segment_members`
- `segments` (1) → (N) `campaigns`
- `campaigns` (1) → (N) `campaign_member_additions`
- `campaigns` (1) → (N) `campaign_member_exclusions`
- `campaigns` (1) → (N) `drafts`
- `email_outbound` (1) → (N) `email_events`
- `jobs` optionally attaches to `segments` (for background actions)
- `icp_profiles` (1) → (N) `icp_hypotheses`; `segments` can optionally reference both
- `icp_discovery_runs` optionally attach to `jobs`, `icp_profiles`, and `icp_hypotheses`
- `icp_discovery_runs` (1) → (N) `icp_discovery_candidates`

## Tables (Detailed)

### `public.ai_interactions`

**What it is**: AI transcript/audit table (prompts + responses) keyed by `session_key` and (optional)
`conversation_id`.

**Key facts**
- Primary key: `id` (`uuid`, default `gen_random_uuid()`)
- Approx rows: `0`
- RLS: enabled (`relrowsecurity=true`, `relforcerowsecurity=false`); **no policies found**

**Columns**
| Column | Type | Nullable | Default | Comment |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |  |
| `session_key` | `varchar(255)` | no |  |  |
| `conversation_id` | `varchar(255)` | yes |  |  |
| `prompt` | `text` | yes |  |  |
| `response` | `text` | yes |  |  |
| `model_used` | `varchar(100)` | yes |  |  |
| `confidence_score` | `integer` | yes |  |  |
| `processing_time` | `timestamp (no tz)` | yes | `now()` |  |
| `created_at` | `timestamptz` | yes | `now()` |  |

**Constraints**
- `ai_interactions_pkey`: `PRIMARY KEY (id)`

**Indexes**
- `ai_interactions_pkey`: `CREATE UNIQUE INDEX ai_interactions_pkey ON public.ai_interactions USING btree (id)`
- `idx_ai_interactions_conversation_id`: `CREATE INDEX idx_ai_interactions_conversation_id ON public.ai_interactions USING btree (conversation_id)`
- `idx_ai_interactions_session_key`: `CREATE INDEX idx_ai_interactions_session_key ON public.ai_interactions USING btree (session_key)`

### `public.app_settings`

**What it is**: key/value runtime settings (for example, enrichment provider defaults).

**Key facts**
- Primary key: `key` (`text`)
- Approx rows: `0`
- RLS: disabled (`relrowsecurity=false`)

**Columns**
| Column | Type | Nullable | Default | Comment |
| --- | --- | --- | --- | --- |
| `key` | `text` | no |  |  |
| `value` | `jsonb` | no |  |  |
| `updated_at` | `timestamptz` | no | `now()` |  |

**Constraints**
- `app_settings_pkey`: `PRIMARY KEY (key)`

**Indexes**
- `app_settings_pkey`: `CREATE UNIQUE INDEX app_settings_pkey ON public.app_settings USING btree (key)`

### `public.projects`

**What it is**: canonical business/workspace registry used to group ICP roots, offers, and
campaigns without replacing the execution spine rooted in ICP.

**Key facts**
- Primary key: `id` (`uuid`, default `gen_random_uuid()`)
- Referenced by:
  - `icp_profiles.project_id` (`ON DELETE SET NULL`)
  - `offers.project_id` (`ON DELETE SET NULL`)
  - `campaigns.project_id` (`ON DELETE SET NULL`)
- Approx rows: `0`
- RLS: enabled; **no policies found**

**Columns**
| Column | Type | Nullable | Default | Comment |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |  |
| `key` | `text` | no |  | Stable machine-readable project key. |
| `name` | `text` | no |  | Human-facing project/workspace name. |
| `description` | `text` | yes |  | Optional operator-facing project description. |
| `status` | `text` | no | `'active'::text` | `active` or `inactive`. |
| `created_at` | `timestamptz` | no | `timezone('utc'::text, now())` |  |
| `updated_at` | `timestamptz` | no | `timezone('utc'::text, now())` |  |

**Constraints**
- `projects_pkey`: `PRIMARY KEY (id)`
- `projects_status_check`: `CHECK (status = ANY (ARRAY['active','inactive']))`

**Indexes**
- `projects_pkey`: `CREATE UNIQUE INDEX projects_pkey ON public.projects USING btree (id)`
- `projects_key_uidx`: `CREATE UNIQUE INDEX projects_key_uidx ON public.projects USING btree (key)`

### `public.campaigns`

**What it is**: campaign container that binds a `segment_id` + `segment_version` snapshot to drafting/sending.

**Key facts**
- Primary key: `id` (`uuid`, default `gen_random_uuid()`)
- Foreign keys:
  - `segment_id` → `segments(id)` (`ON DELETE RESTRICT`)
- Approx rows: `1`
- RLS: enabled; **no policies found**

**Columns**
| Column | Type | Nullable | Default | Comment |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |  |
| `name` | `text` | no |  |  |
| `segment_id` | `uuid` | no |  |  |
| `segment_version` | `integer` | no |  |  |
| `project_id` | `uuid` | yes |  | Optional project/workspace boundary for this campaign. |
| `offer_id` | `uuid` | yes |  | Canonical optional link to the offer registry row used by this campaign. |
| `icp_hypothesis_id` | `uuid` | yes |  | Canonical optional link to the operational hypothesis preset used by this campaign wave. |
| `sender_profile_id` | `uuid` | yes |  |  |
| `prompt_pack_id` | `uuid` | yes |  |  |
| `status` | `text` | no | `'draft'::text` |  |
| `interaction_mode` | `text` | no | `'express'::text` |  |
| `data_quality_mode` | `text` | no | `'strict'::text` |  |
| `schedule` | `jsonb` | yes |  |  |
| `throttle` | `jsonb` | yes |  |  |
| `metadata` | `jsonb` | yes |  |  |
| `auto_send_intro` | `boolean` | no | `false` | Enables scheduler-triggered intro sends for this campaign. |
| `auto_send_bump` | `boolean` | no | `false` | Enables scheduler-triggered bump sends for this campaign. |
| `bump_min_days_since_intro` | `integer` | no | `3` | Canonical minimum delay in days before a bump becomes eligible. |
| `send_timezone` | `text` | no | `'Europe/Moscow'::text` | Canonical campaign-local timezone used by the auto-send scheduler calendar gate. |
| `send_window_start_hour` | `integer` | no | `9` | Inclusive local-hour start for auto-send eligibility. |
| `send_window_end_hour` | `integer` | no | `17` | Exclusive local-hour end for auto-send eligibility. |
| `send_weekdays_only` | `boolean` | no | `true` | When true, scheduler skips Saturdays and Sundays for this campaign. |
| `created_by` | `text` | yes |  |  |
| `created_at` | `timestamptz` | no | `now()` |  |
| `updated_at` | `timestamptz` | no | `now()` |  |

**Constraints**
- `campaigns_pkey`: `PRIMARY KEY (id)`
- `campaigns_segment_id_fkey`: `FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE RESTRICT`
- `campaigns_project_id_fkey`: `FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL`
- `campaigns_offer_id_fkey`: `FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE SET NULL`
- `campaigns_icp_hypothesis_id_fkey`: `FOREIGN KEY (icp_hypothesis_id) REFERENCES icp_hypotheses(id) ON DELETE SET NULL`
- `campaigns_status_check`: `CHECK (status = ANY (ARRAY['draft','ready','generating','review','scheduled','sending','complete','paused']))`
- `campaigns_interaction_mode_check`: `CHECK (interaction_mode = ANY (ARRAY['express','coach']))`
- `campaigns_data_quality_mode_check`: `CHECK (data_quality_mode = ANY (ARRAY['strict','graceful']))`

**Indexes**
- `campaigns_pkey`: `CREATE UNIQUE INDEX campaigns_pkey ON public.campaigns USING btree (id)`
- `campaigns_project_id_idx`: `CREATE INDEX campaigns_project_id_idx ON public.campaigns USING btree (project_id)`
- `campaigns_offer_id_idx`: `CREATE INDEX campaigns_offer_id_idx ON public.campaigns USING btree (offer_id)`
- `campaigns_icp_hypothesis_id_idx`: `CREATE INDEX campaigns_icp_hypothesis_id_idx ON public.campaigns USING btree (icp_hypothesis_id)`
- `campaigns_segment_idx`: `CREATE INDEX campaigns_segment_idx ON public.campaigns USING btree (segment_id)`
- `campaigns_status_idx`: `CREATE INDEX campaigns_status_idx ON public.campaigns USING btree (status)`

### `public.offers`

**What it is**: minimal offer registry for reusable outbound offer definitions that can be linked to
campaigns without forcing `Outreach` or the Web UI to keep offer context only in local runtime
memory.

**Key facts**
- Primary key: `id` (`uuid`, default `gen_random_uuid()`)
- Referenced by:
  - `offers.project_id` → `projects(id)` (`ON DELETE SET NULL`)
  - `campaigns.offer_id` (`ON DELETE SET NULL`)
- Approx rows: `0`
- RLS: enabled; **no policies found**

**Columns**
| Column | Type | Nullable | Default | Comment |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |  |
| `project_id` | `uuid` | yes |  | Optional project/workspace boundary for this offer. |
| `title` | `text` | no |  | Canonical human-facing offer title. |
| `project_name` | `text` | yes |  | Optional project/product grouping label. |
| `description` | `text` | yes |  | Optional operator-facing offer description. |
| `status` | `text` | no | `'active'::text` | `active` or `inactive`. |
| `created_at` | `timestamptz` | no | `timezone('utc'::text, now())` |  |
| `updated_at` | `timestamptz` | no | `timezone('utc'::text, now())` |  |

**Constraints**
- `offers_pkey`: `PRIMARY KEY (id)`
- `offers_project_id_fkey`: `FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL`
- `offers_status_check`: `CHECK (status = ANY (ARRAY['active','inactive']))`

**Indexes**
- `offers_pkey`: `CREATE UNIQUE INDEX offers_pkey ON public.offers USING btree (id)`
- `offers_project_id_idx`: `CREATE INDEX offers_project_id_idx ON public.offers USING btree (project_id)`

### `public.campaign_member_additions`

**What it is**: campaign-scoped audience additions that extend a frozen campaign wave without
rewriting its source `segment_members` snapshot.

**Key facts**
- Primary key: `id` (`uuid`, default `gen_random_uuid()`)
- Foreign keys:
  - `campaign_id` → `campaigns(id)` (`ON DELETE CASCADE`)
  - `company_id` → `companies(id)` (`ON DELETE CASCADE`)
  - `contact_id` → `employees(id)` (`ON DELETE CASCADE`)
- Approx rows: `0`
- RLS: enabled; **no policies found**

**Columns**
| Column | Type | Nullable | Default | Comment |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |  |
| `campaign_id` | `uuid` | no |  |  |
| `company_id` | `uuid` | no |  |  |
| `contact_id` | `uuid` | no |  |  |
| `source` | `text` | no | `'manual_attach'::text` | Attach origin such as `manual_attach` or `import_workspace`. |
| `attached_by` | `text` | yes |  | Operator / runtime that performed the attach. |
| `attached_at` | `timestamptz` | no | `now()` |  |
| `metadata` | `jsonb` | yes |  | Optional attach metadata. |
| `snapshot` | `jsonb` | yes |  | Frozen minimal company/contact context captured at attach time. |

**Constraints**
- `campaign_member_additions_pkey`: `PRIMARY KEY (id)`
- `campaign_member_additions_campaign_id_contact_id_key`: `UNIQUE (campaign_id, contact_id)`
- `campaign_member_additions_campaign_id_fkey`: `FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE`
- `campaign_member_additions_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE`
- `campaign_member_additions_contact_id_fkey`: `FOREIGN KEY (contact_id) REFERENCES employees(id) ON DELETE CASCADE`

**Indexes**
- `campaign_member_additions_pkey`: `CREATE UNIQUE INDEX campaign_member_additions_pkey ON public.campaign_member_additions USING btree (id)`
- `campaign_member_additions_campaign_id_contact_id_key`: `CREATE UNIQUE INDEX campaign_member_additions_campaign_id_contact_id_key ON public.campaign_member_additions USING btree (campaign_id, contact_id)`
- `campaign_member_additions_campaign_idx`: `CREATE INDEX campaign_member_additions_campaign_idx ON public.campaign_member_additions USING btree (campaign_id)`
- `campaign_member_additions_campaign_company_idx`: `CREATE INDEX campaign_member_additions_campaign_company_idx ON public.campaign_member_additions USING btree (campaign_id, company_id)`
- `campaign_member_additions_campaign_contact_idx`: `CREATE INDEX campaign_member_additions_campaign_contact_idx ON public.campaign_member_additions USING btree (campaign_id, contact_id)`

### `public.campaign_member_exclusions`

**What it is**: campaign-scoped contact exclusions layered on top of the frozen segment snapshot.
Used by next-wave support to keep the new wave auditable while excluding blocked contacts from the
effective audience.

**Key facts**
- Primary key: `id` (`uuid`, default `gen_random_uuid()`)
- Foreign keys:
  - `campaign_id` → `campaigns(id)` (`ON DELETE CASCADE`)
  - `company_id` → `companies(id)` (`ON DELETE SET NULL`)
  - `contact_id` → `employees(id)` (`ON DELETE CASCADE`)
- RLS: enabled; **no policies found**

**Columns**
| Column | Type | Nullable | Default | Comment |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |  |
| `campaign_id` | `uuid` | no |  | Target campaign wave. |
| `company_id` | `uuid` | yes |  | Optional company link for operator context. |
| `contact_id` | `uuid` | no |  | Excluded contact. |
| `source` | `text` | no | `'next_wave_exclusion'::text` | Backend/source that created the exclusion row. |
| `reason` | `text` | yes |  | Canonical blocked reason code. |
| `excluded_by` | `text` | yes |  | Optional operator/runtime actor. |
| `metadata` | `jsonb` | yes |  | Optional provenance metadata. |
| `excluded_at` | `timestamptz` | no | `now()` |  |

**Constraints**
- `campaign_member_exclusions_pkey`: `PRIMARY KEY (id)`
- `campaign_member_exclusions_campaign_id_contact_id_key`: `UNIQUE (campaign_id, contact_id)`
- `campaign_member_exclusions_campaign_id_fkey`: `FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE`
- `campaign_member_exclusions_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL`
- `campaign_member_exclusions_contact_id_fkey`: `FOREIGN KEY (contact_id) REFERENCES employees(id) ON DELETE CASCADE`

**Indexes**
- `campaign_member_exclusions_pkey`: `CREATE UNIQUE INDEX campaign_member_exclusions_pkey ON public.campaign_member_exclusions USING btree (id)`
- `campaign_member_exclusions_campaign_id_contact_id_key`: `CREATE UNIQUE INDEX campaign_member_exclusions_campaign_id_contact_id_key ON public.campaign_member_exclusions USING btree (campaign_id, contact_id)`
- `campaign_member_exclusions_campaign_idx`: `CREATE INDEX campaign_member_exclusions_campaign_idx ON public.campaign_member_exclusions USING btree (campaign_id)`
- `campaign_member_exclusions_campaign_company_idx`: `CREATE INDEX campaign_member_exclusions_campaign_company_idx ON public.campaign_member_exclusions USING btree (campaign_id, company_id)`
- `campaign_member_exclusions_campaign_contact_idx`: `CREATE INDEX campaign_member_exclusions_campaign_contact_idx ON public.campaign_member_exclusions USING btree (campaign_id, contact_id)`

### `public.companies`

**What it is**: canonical company record used across segmentation, enrichment, drafting, and sending.

**Key facts**
- Primary key: `id` (`uuid`, default `gen_random_uuid()`)
- Approx rows: `0`
- RLS: enabled; policy: `Allow all for authenticated users` (ALL)

**Columns**
| Column | Type | Nullable | Default | Comment |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |  |
| `company_name` | `varchar(255)` | no |  |  |
| `tin` | `varchar(12)` | yes |  |  |
| `registration_number` | `varchar(15)` | yes |  |  |
| `registration_date` | `date` | yes |  |  |
| `region` | `varchar(100)` | yes |  |  |
| `sme_registry` | `boolean` | yes | `false` |  |
| `status` | `text` | yes | `'Active'::character varying` |  |
| `website` | `text` | yes |  |  |
| `ceo_name` | `varchar(255)` | yes |  |  |
| `ceo_position` | `varchar(255)` | yes |  |  |
| `primary_email` | `text` | yes |  |  |
| `revenue` | `numeric(15,2)` | yes |  |  |
| `balance` | `numeric(15,2)` | yes |  |  |
| `net_profit_loss` | `numeric(15,2)` | yes |  |  |
| `employee_count` | `integer` | yes |  |  |
| `source` | `varchar(255)` | yes |  |  |
| `segment` | `varchar(200)` | yes |  |  |
| `company_description` | `varchar(500)` | yes |  |  |
| `office_qualification` | `varchar(10)` | yes |  |  |
| `all_company_emails` | `text[]` | yes |  |  |
| `created_at` | `timestamptz` | yes | `now()` |  |
| `updated_at` | `timestamptz` | yes | `now()` |  |
| `company_research` | `text` | yes |  | AI company Research |
| `session_key` | `varchar(255)` | yes |  |  |
| `batch_id` | `varchar(50)` | yes |  |  |
| `processing_status` | `varchar(50)` | yes | `'pending'::character varying` |  |
| `workflow_execution_id` | `varchar(100)` | yes |  |  |

**Constraints**
- `companies_pkey`: `PRIMARY KEY (id)`
- `companies_tin_key`: `UNIQUE (tin)`
- `companies_registration_number_key`: `UNIQUE (registration_number)`
- `companies_office_qualification_check`: `CHECK (office_qualification::text = ANY (ARRAY['More','Less']::text[]))`

**Indexes**
- `companies_pkey`: `CREATE UNIQUE INDEX companies_pkey ON public.companies USING btree (id)`
- `companies_tin_key`: `CREATE UNIQUE INDEX companies_tin_key ON public.companies USING btree (tin)`
- `companies_registration_number_key`: `CREATE UNIQUE INDEX companies_registration_number_key ON public.companies USING btree (registration_number)`
- `idx_companies_tin`: `CREATE INDEX idx_companies_tin ON public.companies USING btree (tin)`
- `idx_companies_registration_number`: `CREATE INDEX idx_companies_registration_number ON public.companies USING btree (registration_number)`
- `idx_companies_segment`: `CREATE INDEX idx_companies_segment ON public.companies USING btree (segment)`
- `idx_companies_status`: `CREATE INDEX idx_companies_status ON public.companies USING btree (status)`
- `idx_companies_session_key`: `CREATE INDEX idx_companies_session_key ON public.companies USING btree (session_key)`

### `public.drafts`

**What it is**: generated email drafts for a (campaign × contact × company), including review status and LLM
metadata.

**Key facts**
- Primary key: `id` (`uuid`, default `gen_random_uuid()`)
- Foreign keys:
  - `campaign_id` → `campaigns(id)` (`ON DELETE CASCADE`)
  - `company_id` → `companies(id)` (`ON DELETE CASCADE`)
  - `contact_id` → `employees(id)` (`ON DELETE CASCADE`)
- Approx rows: `1`
- RLS: enabled; **no policies found**

**Columns**
| Column | Type | Nullable | Default | Comment |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |  |
| `campaign_id` | `uuid` | no |  |  |
| `contact_id` | `uuid` | no |  |  |
| `company_id` | `uuid` | no |  |  |
| `email_type` | `text` | no |  |  |
| `language` | `text` | no |  |  |
| `pattern_mode` | `text` | yes |  |  |
| `variant_label` | `text` | yes |  |  |
| `subject` | `text` | yes |  |  |
| `body` | `text` | yes |  |  |
| `ai_score` | `numeric` | yes |  |  |
| `ai_sdk_request_id` | `text` | yes |  |  |
| `status` | `text` | no | `'generated'::text` |  |
| `reviewer` | `text` | yes |  |  |
| `metadata` | `jsonb` | yes |  |  |
| `created_at` | `timestamptz` | no | `now()` |  |
| `updated_at` | `timestamptz` | no | `now()` |  |

**Constraints**
- `drafts_pkey`: `PRIMARY KEY (id)`
- `drafts_campaign_id_fkey`: `FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE`
- `drafts_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE`
- `drafts_contact_id_fkey`: `FOREIGN KEY (contact_id) REFERENCES employees(id) ON DELETE CASCADE`
- `drafts_status_check`: `CHECK (status = ANY (ARRAY['generated','approved','rejected','sent']))`

**Indexes**
- `drafts_pkey`: `CREATE UNIQUE INDEX drafts_pkey ON public.drafts USING btree (id)`
- `drafts_contact_idx`: `CREATE INDEX drafts_contact_idx ON public.drafts USING btree (contact_id)`
- `drafts_campaign_status_idx`: `CREATE INDEX drafts_campaign_status_idx ON public.drafts USING btree (campaign_id, status)`

### `public.email_events`

**What it is**: downstream email provider events (deliver/open/click/reply/...) plus optional outcome
classification.

**Key facts**
- Primary key: `id` (`uuid`, default `gen_random_uuid()`)
- Foreign keys:
  - `outbound_id` → `email_outbound(id)` (`ON DELETE CASCADE`)
  - `draft_id` → `drafts(id)` (`ON DELETE SET NULL`)
  - `employee_id` → `employees(id)` (`ON DELETE SET NULL`)
  - `segment_id` → `segments(id)` (`ON DELETE SET NULL`)
  - `send_job_id` → `jobs(id)` (`ON DELETE SET NULL`)
  - `icp_profile_id` → `icp_profiles(id)` (`ON DELETE SET NULL`)
  - `icp_hypothesis_id` → `icp_hypotheses(id)` (`ON DELETE SET NULL`)
- Approx rows: `0`
- RLS: enabled; **no policies found**

**Columns**
| Column | Type | Nullable | Default | Comment |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |  |
| `outbound_id` | `uuid` | no |  |  |
| `event_type` | `text` | no |  |  |
| `outcome_classification` | `text` | yes |  |  |
| `provider_event_id` | `text` | yes |  |  |
| `occurred_at` | `timestamptz` | no | `now()` |  |
| `payload` | `jsonb` | yes |  |  |
| `created_at` | `timestamptz` | no | `now()` |  |
| `draft_id` | `uuid` | yes |  |  |
| `send_job_id` | `uuid` | yes |  |  |
| `segment_id` | `uuid` | yes |  |  |
| `segment_version` | `integer` | yes |  |  |
| `employee_id` | `uuid` | yes |  |  |
| `icp_profile_id` | `uuid` | yes |  |  |
| `icp_hypothesis_id` | `uuid` | yes |  |  |
| `pattern_id` | `text` | yes |  |  |
| `coach_prompt_id` | `text` | yes |  |  |

**Constraints**
- `email_events_pkey`: `PRIMARY KEY (id)`
- `email_events_outbound_id_fkey`: `FOREIGN KEY (outbound_id) REFERENCES email_outbound(id) ON DELETE CASCADE`
- `email_events_draft_id_fkey`: `FOREIGN KEY (draft_id) REFERENCES drafts(id) ON DELETE SET NULL`
- `email_events_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL`
- `email_events_segment_id_fkey`: `FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE SET NULL`
- `email_events_send_job_id_fkey`: `FOREIGN KEY (send_job_id) REFERENCES jobs(id) ON DELETE SET NULL`
- `email_events_icp_profile_id_fkey`: `FOREIGN KEY (icp_profile_id) REFERENCES icp_profiles(id) ON DELETE SET NULL`
- `email_events_icp_hypothesis_id_fkey`: `FOREIGN KEY (icp_hypothesis_id) REFERENCES icp_hypotheses(id) ON DELETE SET NULL`
- `email_events_event_type_check`: `CHECK (event_type = ANY (ARRAY['delivered','opened','clicked','replied','bounced','unsubscribed','complaint']))`
- `email_events_outcome_classification_check`: `CHECK (outcome_classification = ANY (ARRAY['meeting','soft_interest','decline','angry','neutral']))`

**Indexes**
- `email_events_pkey`: `CREATE UNIQUE INDEX email_events_pkey ON public.email_events USING btree (id)`
- `email_events_outbound_idx`: `CREATE INDEX email_events_outbound_idx ON public.email_events USING btree (outbound_id)`
- `email_events_draft_idx`: `CREATE INDEX email_events_draft_idx ON public.email_events USING btree (draft_id)`
- `email_events_employee_idx`: `CREATE INDEX email_events_employee_idx ON public.email_events USING btree (employee_id)`
- `email_events_event_type_idx`: `CREATE INDEX email_events_event_type_idx ON public.email_events USING btree (event_type)`
- `email_events_segment_idx`: `CREATE INDEX email_events_segment_idx ON public.email_events USING btree (segment_id, segment_version)`

### `public.email_outbound`

**What it is**: outbound send attempts / send records (provider, status, provider message id), linking back to a
draft/campaign/contact/company when known.

**Key facts**
- Primary key: `id` (`uuid`, default `gen_random_uuid()`)
- Foreign keys:
  - `campaign_id` → `campaigns(id)` (`ON DELETE SET NULL`)
  - `company_id` → `companies(id)` (`ON DELETE SET NULL`)
  - `contact_id` → `employees(id)` (`ON DELETE SET NULL`)
  - `draft_id` → `drafts(id)` (`ON DELETE SET NULL`)
- Approx rows: `0`
- RLS: enabled; **no policies found**

**Columns**
| Column | Type | Nullable | Default | Comment |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |  |
| `campaign_id` | `uuid` | yes |  |  |
| `draft_id` | `uuid` | yes |  |  |
| `contact_id` | `uuid` | yes |  |  |
| `company_id` | `uuid` | yes |  |  |
| `provider` | `text` | no |  |  |
| `provider_message_id` | `text` | yes |  |  |
| `sender_identity` | `text` | yes |  |  |
| `pattern_mode` | `text` | yes |  |  |
| `persona_cluster` | `text` | yes |  |  |
| `status` | `text` | no | `'queued'::text` |  |
| `sent_at` | `timestamptz` | yes | `now()` |  |
| `error` | `text` | yes |  |  |
| `metadata` | `jsonb` | yes |  |  |

**Constraints**
- `email_outbound_pkey`: `PRIMARY KEY (id)`
- `email_outbound_campaign_id_fkey`: `FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL`
- `email_outbound_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL`
- `email_outbound_contact_id_fkey`: `FOREIGN KEY (contact_id) REFERENCES employees(id) ON DELETE SET NULL`
- `email_outbound_draft_id_fkey`: `FOREIGN KEY (draft_id) REFERENCES drafts(id) ON DELETE SET NULL`
- `email_outbound_provider_provider_message_id_key`: `UNIQUE (provider, provider_message_id)`
- `email_outbound_status_check`: `CHECK (status = ANY (ARRAY['queued','sent','failed']))`

**Indexes**
- `email_outbound_pkey`: `CREATE UNIQUE INDEX email_outbound_pkey ON public.email_outbound USING btree (id)`
- `email_outbound_campaign_idx`: `CREATE INDEX email_outbound_campaign_idx ON public.email_outbound USING btree (campaign_id)`
- `email_outbound_contact_idx`: `CREATE INDEX email_outbound_contact_idx ON public.email_outbound USING btree (contact_id)`
- `email_outbound_provider_provider_message_id_key`: `CREATE UNIQUE INDEX email_outbound_provider_provider_message_id_key ON public.email_outbound USING btree (provider, provider_message_id)`

### `public.employees`

**What it is**: company contacts (people) plus enrichment/outreach metadata.

**Key facts**
- Primary key: `id` (`uuid`, default `gen_random_uuid()`)
- Foreign keys:
  - `company_id` → `companies(id)` (`ON DELETE CASCADE`)
- Approx rows: `0`
- RLS: enabled; policy: `Allow all for authenticated users` (ALL)

**Columns**
| Column | Type | Nullable | Default | Comment |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |  |
| `company_id` | `uuid` | no |  |  |
| `full_name` | `varchar(255)` | no |  |  |
| `first_name` | `varchar(100)` | yes |  |  |
| `last_name` | `varchar(100)` | yes |  |  |
| `middle_name` | `varchar(100)` | yes |  |  |
| `position` | `varchar(255)` | yes |  |  |
| `source_urls` | `text[]` | yes |  |  |
| `phone_numbers` | `text[]` | yes |  |  |
| `work_email` | `varchar(255)` | yes |  |  |
| `generic_email` | `varchar(255)` | yes |  |  |
| `outreach_sent_date` | `date` | yes |  |  |
| `outreach_type` | `varchar(20)` | yes |  |  |
| `campaign_number` | `integer` | yes |  |  |
| `campaign_status` | `varchar(50)` | yes |  |  |
| `reply_unsubscribe` | `boolean` | yes | `false` |  |
| `reply_info_request` | `boolean` | yes | `false` |  |
| `reply_bounce` | `boolean` | yes | `false` |  |
| `test_date` | `date` | yes |  |  |
| `test_status` | `varchar(50)` | yes |  |  |
| `client_status` | `boolean` | yes | `false` |  |
| `created_at` | `timestamptz` | yes | `now()` |  |
| `updated_at` | `timestamptz` | yes | `now()` |  |
| `source_service` | `text` | yes |  | email source service |
| `company_name` | `varchar` | yes |  | Company name |
| `company_session_key` | `varchar(255)` | yes |  |  |
| `employee_session_key` | `varchar(255)` | yes |  |  |
| `ai_research_data` | `jsonb` | yes |  |  |
| `processing_status` | `varchar(50)` | yes | `'pending'::character varying` |  |

**Constraints**
- `employees_pkey`: `PRIMARY KEY (id)`
- `employees_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE`
- `employees_outreach_type_check`: `CHECK (outreach_type::text = ANY (ARRAY['marketing','sales']::text[]))`
- `employees_test_status_check`: `CHECK (test_status::text = ANY (ARRAY['Начато','Идет','Завершено:Успех','Завершено:Неудача','Завершено:Требуется доработка']::text[]))`

**Indexes**
- `employees_pkey`: `CREATE UNIQUE INDEX employees_pkey ON public.employees USING btree (id)`
- `idx_employees_company_id`: `CREATE INDEX idx_employees_company_id ON public.employees USING btree (company_id)`
- `idx_employees_work_email`: `CREATE INDEX idx_employees_work_email ON public.employees USING btree (work_email)`
- `idx_employees_campaign_number`: `CREATE INDEX idx_employees_campaign_number ON public.employees USING btree (campaign_number)`
- `idx_employees_client_status`: `CREATE INDEX idx_employees_client_status ON public.employees USING btree (client_status)`
- `idx_employees_outreach_sent_date`: `CREATE INDEX idx_employees_outreach_sent_date ON public.employees USING btree (outreach_sent_date)`
- `idx_employees_company_session_key`: `CREATE INDEX idx_employees_company_session_key ON public.employees USING btree (company_session_key)`
- `idx_employees_employee_session_key`: `CREATE INDEX idx_employees_employee_session_key ON public.employees USING btree (employee_session_key)`

### `public.employee_data_repairs`

**What it is**: durable audit trail for applied employee data repairs, currently used for
name normalization (`first_name` / `last_name` swaps).

**Key facts**
- Primary key: `id` (`uuid`, default `gen_random_uuid()`)
- Foreign keys:
  - `employee_id` → `employees(id)` (`ON DELETE CASCADE`)
- Approx rows: `0`
- RLS: enabled; **no policies found**

**Columns**
| Column | Type | Nullable | Default | Comment |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |  |
| `employee_id` | `uuid` | no |  | repaired employee |
| `repair_type` | `text` | no |  | currently `name_swap` |
| `source` | `text` | no |  | `employee:repair-names` or `company:save-processed` |
| `confidence` | `text` | no |  | `high` or `low` |
| `original_first_name` | `varchar(100)` | yes |  |  |
| `original_last_name` | `varchar(100)` | yes |  |  |
| `repaired_first_name` | `varchar(100)` | yes |  |  |
| `repaired_last_name` | `varchar(100)` | yes |  |  |
| `applied_at` | `timestamptz` | no | `now()` |  |

**Constraints**
- `employee_data_repairs_pkey`: `PRIMARY KEY (id)`
- `employee_data_repairs_employee_id_fkey`: `FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE`
- `employee_data_repairs_repair_type_check`: `CHECK (repair_type = ANY (ARRAY['name_swap']::text[]))`
- `employee_data_repairs_source_check`: `CHECK (source = ANY (ARRAY['employee:repair-names','company:save-processed']::text[]))`
- `employee_data_repairs_confidence_check`: `CHECK (confidence = ANY (ARRAY['high','low']::text[]))`

**Indexes**
- `employee_data_repairs_unique_repair_idx`: unique repair fingerprint index for idempotent writes
- `employee_data_repairs_employee_idx`: `CREATE INDEX employee_data_repairs_employee_idx ON public.employee_data_repairs USING btree (employee_id, applied_at DESC)`

### `public.fallback_templates`

**What it is**: fallback JSON templates (by `category` + `locale`) used when prompt packs/providers are not
available.

**Key facts**
- Primary key: `id` (`uuid`, default `gen_random_uuid()`)
- Approx rows: `0`
- RLS: enabled; **no policies found**

**Columns**
| Column | Type | Nullable | Default | Comment |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |  |
| `category` | `text` | no |  |  |
| `locale` | `text` | no | `'en'::text` |  |
| `payload` | `jsonb` | no |  |  |
| `description` | `text` | yes |  |  |
| `created_at` | `timestamptz` | no | `now()` |  |
| `updated_at` | `timestamptz` | no | `now()` |  |

**Constraints**
- `fallback_templates_pkey`: `PRIMARY KEY (id)`
- `fallback_templates_category_locale_key`: `UNIQUE (category, locale)`

**Indexes**
- `fallback_templates_pkey`: `CREATE UNIQUE INDEX fallback_templates_pkey ON public.fallback_templates USING btree (id)`
- `fallback_templates_category_locale_key`: `CREATE UNIQUE INDEX fallback_templates_category_locale_key ON public.fallback_templates USING btree (category, locale)`

### `public.icp_profiles`

**What it is**: stored ICP definitions (company + persona criteria) used by the ICP coach and segment discovery.

**Key facts**
- Primary key: `id` (`uuid`, default `gen_random_uuid()`)
- Approx rows: `4`
- RLS: enabled; **no policies found**

**Columns**
| Column | Type | Nullable | Default | Comment |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |  |
| `name` | `text` | no |  |  |
| `description` | `text` | yes |  |  |
| `project_id` | `uuid` | yes |  | Optional project/workspace boundary for this ICP root. |
| `company_criteria` | `jsonb` | yes |  |  |
| `persona_criteria` | `jsonb` | yes |  |  |
| `offering_domain` | `text` | yes |  |  |
| `phase_outputs` | `jsonb` | yes |  |  |
| `learnings` | `jsonb` | yes |  |  |
| `created_by` | `text` | yes |  |  |
| `created_at` | `timestamptz` | no | `now()` |  |

**Constraints**
- `icp_profiles_pkey`: `PRIMARY KEY (id)`
- `icp_profiles_project_id_fkey`: `FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL`

**Indexes**
- `icp_profiles_pkey`: `CREATE UNIQUE INDEX icp_profiles_pkey ON public.icp_profiles USING btree (id)`
- `icp_profiles_project_id_idx`: `CREATE INDEX icp_profiles_project_id_idx ON public.icp_profiles USING btree (project_id)`

### `public.icp_discovery_runs`

**What it is**: run-level metadata for ICP discovery jobs, linking a discovery execution to a background job,
an ICP profile, and an optional hypothesis.

**Key facts**
- Primary key: `id` (`uuid`, default `gen_random_uuid()`)
- Foreign keys:
  - `job_id` → `jobs(id)` (`ON DELETE SET NULL`)
  - `icp_profile_id` → `icp_profiles(id)` (`ON DELETE SET NULL`)
  - `icp_hypothesis_id` → `icp_hypotheses(id)` (`ON DELETE SET NULL`)
- Approx rows: `0`
- RLS: disabled

**Columns**
| Column | Type | Nullable | Default | Comment |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |  |
| `job_id` | `uuid` | yes |  |  |
| `icp_profile_id` | `uuid` | yes |  |  |
| `icp_hypothesis_id` | `uuid` | yes |  |  |
| `provider` | `text` | no | `'exa'::text` |  |
| `status` | `text` | no | `'created'::text` |  |
| `metadata` | `jsonb` | no | `'{}'::jsonb` |  |
| `created_at` | `timestamptz` | no | `now()` |  |
| `updated_at` | `timestamptz` | no | `now()` |  |

**Constraints**
- `icp_discovery_runs_pkey`: `PRIMARY KEY (id)`
- `icp_discovery_runs_job_id_fkey`: `FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL`
- `icp_discovery_runs_icp_profile_id_fkey`: `FOREIGN KEY (icp_profile_id) REFERENCES icp_profiles(id) ON DELETE SET NULL`
- `icp_discovery_runs_icp_hypothesis_id_fkey`: `FOREIGN KEY (icp_hypothesis_id) REFERENCES icp_hypotheses(id) ON DELETE SET NULL`

**Indexes**
- `icp_discovery_runs_pkey`: `CREATE UNIQUE INDEX icp_discovery_runs_pkey ON public.icp_discovery_runs USING btree (id)`
- `icp_discovery_runs_job_idx`: `CREATE INDEX icp_discovery_runs_job_idx ON public.icp_discovery_runs USING btree (job_id)`
- `icp_discovery_runs_icp_idx`: `CREATE INDEX icp_discovery_runs_icp_idx ON public.icp_discovery_runs USING btree (icp_profile_id, icp_hypothesis_id)`

### `public.icp_discovery_candidates`

**What it is**: candidate companies surfaced by an ICP discovery run, stored with raw provider payload and a
lightweight confidence/size summary for later approval or promotion into segments.

**Key facts**
- Primary key: `id` (`uuid`, default `gen_random_uuid()`)
- Foreign keys:
  - `run_id` → `icp_discovery_runs(id)` (`ON DELETE CASCADE`)
- Approx rows: `0`
- RLS: disabled

**Columns**
| Column | Type | Nullable | Default | Comment |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |  |
| `run_id` | `uuid` | no |  |  |
| `candidate_name` | `text` | yes |  |  |
| `domain` | `text` | yes |  |  |
| `url` | `text` | yes |  |  |
| `country` | `text` | yes |  |  |
| `size_hint` | `text` | yes |  |  |
| `confidence` | `numeric` | yes |  |  |
| `raw` | `jsonb` | no | `'{}'::jsonb` |  |
| `created_at` | `timestamptz` | no | `now()` |  |
| `updated_at` | `timestamptz` | no | `now()` |  |

**Constraints**
- `icp_discovery_candidates_pkey`: `PRIMARY KEY (id)`
- `icp_discovery_candidates_run_id_fkey`: `FOREIGN KEY (run_id) REFERENCES icp_discovery_runs(id) ON DELETE CASCADE`

**Indexes**
- `icp_discovery_candidates_pkey`: `CREATE UNIQUE INDEX icp_discovery_candidates_pkey ON public.icp_discovery_candidates USING btree (id)`
- `icp_discovery_candidates_run_idx`: `CREATE INDEX icp_discovery_candidates_run_idx ON public.icp_discovery_candidates USING btree (run_id)`

### `public.icp_hypotheses`

**What it is**: hypotheses attached to an ICP profile, now usable both as discovery context and as
an operational execution preset for campaign waves.

**Key facts**
- Primary key: `id` (`uuid`, default `gen_random_uuid()`)
- Foreign keys:
  - `icp_id` → `icp_profiles(id)` (`ON DELETE CASCADE`)
  - `offer_id` → `offers(id)` (`ON DELETE SET NULL`)
- Approx rows: `1`
- RLS: enabled; **no policies found**

**Columns**
| Column | Type | Nullable | Default | Comment |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |  |
| `icp_id` | `uuid` | no |  |  |
| `hypothesis_label` | `text` | no |  |  |
| `offer_id` | `uuid` | yes |  | Optional canonical offer linked to this hypothesis preset. |
| `search_config` | `jsonb` | yes |  |  |
| `targeting_defaults` | `jsonb` | yes |  | Reusable targeting defaults for campaign creation. |
| `messaging_angle` | `text` | yes |  | Canonical high-level messaging angle for this preset. |
| `pattern_defaults` | `jsonb` | yes |  | Optional reusable tone/pattern defaults. |
| `notes` | `text` | yes |  | Operator notes for reuse and learnings. |
| `status` | `text` | no | `'draft'::text` |  |
| `created_at` | `timestamptz` | no | `now()` |  |

**Constraints**
- `icp_hypotheses_pkey`: `PRIMARY KEY (id)`
- `icp_hypotheses_icp_id_fkey`: `FOREIGN KEY (icp_id) REFERENCES icp_profiles(id) ON DELETE CASCADE`
- `icp_hypotheses_offer_id_fkey`: `FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE SET NULL`
- `icp_hypotheses_status_check`: `CHECK (status = ANY (ARRAY['draft','active','deprecated']))`

**Indexes**
- `icp_hypotheses_pkey`: `CREATE UNIQUE INDEX icp_hypotheses_pkey ON public.icp_hypotheses USING btree (id)`
- `icp_hypotheses_offer_id_idx`: `CREATE INDEX icp_hypotheses_offer_id_idx ON public.icp_hypotheses USING btree (offer_id)`

### `public.jobs`

**What it is**: background job tracking for async tasks (enrich/send/sim/icp), including payload + optional
result.

**Key facts**
- Primary key: `id` (`uuid`, default `gen_random_uuid()`)
- Foreign keys:
  - `segment_id` → `segments(id)` (`ON DELETE SET NULL`)
- Approx rows: `2`
- RLS: enabled; **no policies found**

**Columns**
| Column | Type | Nullable | Default | Comment |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |  |
| `type` | `text` | no |  |  |
| `status` | `text` | no |  |  |
| `segment_id` | `uuid` | yes |  |  |
| `segment_version` | `integer` | yes |  |  |
| `payload` | `jsonb` | no | `'{}'::jsonb` |  |
| `result` | `jsonb` | yes |  |  |
| `created_at` | `timestamptz` | no | `now()` |  |
| `updated_at` | `timestamptz` | no | `now()` |  |

**Constraints**
- `jobs_pkey`: `PRIMARY KEY (id)`
- `jobs_segment_id_fkey`: `FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE SET NULL`
- `jobs_type_check`: `CHECK (type = ANY (ARRAY['send','enrich','sim','icp']))`
- `jobs_status_check`: `CHECK (status = ANY (ARRAY['created','running','completed','failed','not_implemented']))`

**Indexes**
- `jobs_pkey`: `CREATE UNIQUE INDEX jobs_pkey ON public.jobs USING btree (id)`
- `jobs_segment_idx`: `CREATE INDEX jobs_segment_idx ON public.jobs USING btree (segment_id, segment_version)`
- `jobs_type_status_idx`: `CREATE INDEX jobs_type_status_idx ON public.jobs USING btree (type, status)`

### `public.prompt_registry`

**What it is**: registry of prompt text keyed by `coach_prompt_id`, including rollout status/versioning.

**Key facts**
- Primary key: `id` (`uuid`, default `gen_random_uuid()`)
- Approx rows: `0`
- RLS: enabled; **no policies found**

**Columns**
| Column | Type | Nullable | Default | Comment |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |  |
| `coach_prompt_id` | `text` | no |  |  |
| `step` | `text` | yes |  |  |
| `description` | `text` | yes |  |  |
| `version` | `text` | yes |  |  |
| `prompt_text` | `text` | yes |  |  |
| `rollout_status` | `text` | no | `'active'::text` |  |
| `created_at` | `timestamptz` | no | `now()` |  |
| `updated_at` | `timestamptz` | no | `now()` |  |

**Constraints**
- `prompt_registry_pkey`: `PRIMARY KEY (id)`
- `prompt_registry_rollout_status_check`: `CHECK (rollout_status = ANY (ARRAY['pilot','active','retired','deprecated']))`

**Indexes**
- `prompt_registry_pkey`: `CREATE UNIQUE INDEX prompt_registry_pkey ON public.prompt_registry USING btree (id)`
- `prompt_registry_coach_prompt_id_idx`: `CREATE INDEX prompt_registry_coach_prompt_id_idx ON public.prompt_registry USING btree (coach_prompt_id)`

### `public.segment_members`

**What it is**: frozen membership rows for a segment snapshot (`segment_id` + `segment_version`) with a denormalized
`snapshot` payload (company + contact at time of membership).

**Key facts**
- Primary key: `id` (`uuid`, default `gen_random_uuid()`)
- Foreign keys:
  - `segment_id` → `segments(id)` (`ON DELETE CASCADE`)
  - `company_id` → `companies(id)` (`ON DELETE CASCADE`)
  - `contact_id` → `employees(id)` (`ON DELETE CASCADE`)
- Approx rows: `705`
- RLS: enabled; **no policies found**

**Columns**
| Column | Type | Nullable | Default | Comment |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |  |
| `segment_id` | `uuid` | no |  |  |
| `segment_version` | `integer` | no |  |  |
| `contact_id` | `uuid` | no |  |  |
| `company_id` | `uuid` | no |  |  |
| `snapshot` | `jsonb` | no |  |  |
| `added_at` | `timestamptz` | no | `now()` |  |

**Constraints**
- `segment_members_pkey`: `PRIMARY KEY (id)`
- `segment_members_segment_id_fkey`: `FOREIGN KEY (segment_id) REFERENCES segments(id) ON DELETE CASCADE`
- `segment_members_company_id_fkey`: `FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE`
- `segment_members_contact_id_fkey`: `FOREIGN KEY (contact_id) REFERENCES employees(id) ON DELETE CASCADE`
- `segment_members_segment_id_contact_id_key`: `UNIQUE (segment_id, contact_id)`

**Indexes**
- `segment_members_pkey`: `CREATE UNIQUE INDEX segment_members_pkey ON public.segment_members USING btree (id)`
- `segment_members_segment_id_contact_id_key`: `CREATE UNIQUE INDEX segment_members_segment_id_contact_id_key ON public.segment_members USING btree (segment_id, contact_id)`
- `segment_members_segment_idx`: `CREATE INDEX segment_members_segment_idx ON public.segment_members USING btree (segment_id)`
- `segment_members_contact_idx`: `CREATE INDEX segment_members_contact_idx ON public.segment_members USING btree (contact_id)`

### `public.segments`

**What it is**: segment definitions (filter DSL stored as JSONB) plus versioning and optional ICP links.

**Key facts**
- Primary key: `id` (`uuid`, default `gen_random_uuid()`)
- Foreign keys:
  - `icp_profile_id` → `icp_profiles(id)` (`ON DELETE SET NULL`)
  - `icp_hypothesis_id` → `icp_hypotheses(id)` (`ON DELETE SET NULL`)
- Approx rows: `0`
- RLS: enabled; **no policies found**

**Columns**
| Column | Type | Nullable | Default | Comment |
| --- | --- | --- | --- | --- |
| `id` | `uuid` | no | `gen_random_uuid()` |  |
| `name` | `text` | no |  |  |
| `description` | `text` | yes |  |  |
| `locale` | `text` | yes | `'en'::text` |  |
| `filter_definition` | `jsonb` | no |  |  |
| `version` | `integer` | no | `1` |  |
| `created_by` | `text` | yes |  |  |
| `created_at` | `timestamptz` | no | `now()` |  |
| `updated_at` | `timestamptz` | no | `now()` |  |
| `icp_profile_id` | `uuid` | yes |  |  |
| `icp_hypothesis_id` | `uuid` | yes |  |  |

**Constraints**
- `segments_pkey`: `PRIMARY KEY (id)`
- `segments_icp_profile_id_fkey`: `FOREIGN KEY (icp_profile_id) REFERENCES icp_profiles(id) ON DELETE SET NULL`
- `segments_icp_hypothesis_id_fkey`: `FOREIGN KEY (icp_hypothesis_id) REFERENCES icp_hypotheses(id) ON DELETE SET NULL`

**Indexes**
- `segments_pkey`: `CREATE UNIQUE INDEX segments_pkey ON public.segments USING btree (id)`
- `segments_locale_idx`: `CREATE INDEX segments_locale_idx ON public.segments USING btree (locale)`
- `segments_name_idx`: `CREATE INDEX segments_name_idx ON public.segments USING gin (to_tsvector('simple'::regconfig, COALESCE(name, ''::text)))`

## Notes / Operational Guidance

- **Segment versioning**: several tables carry `(segment_id, segment_version)` but only `segment_id` is enforced by
  FK. Treat `segment_version` as an application-level snapshot pointer for reproducibility.
- **RLS**: many tables have `relrowsecurity=true` but **no policies**. In that state, Postgres denies access to
  non-owners, so expect reads/writes via service role (or add explicit policies before exposing client-side).
- **Timestamps**: `updated_at` defaults to `now()` in many tables but will not auto-update on UPDATE unless the
  application writes it (or a trigger is added).
