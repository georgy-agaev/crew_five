# Appendix A – AI Draft Generation Contract

> Version: v0.2 (2025-11-27)

All components (CLI, Web UI, Supabase RPC, orchestrator services, AI SDK providers) must call the same function:

```ts
function generate_email_draft(
  email_type: EmailType,
  language: string,
  pattern_mode: PatternMode,
  brief: EmailDraftRequest["brief"]
): Promise<EmailDraftResponse>
```

## Request Types
```ts
type EmailType = "intro" | "bump";

type PatternMode =
  | "standard"
  | "reverse_psychology"
  | "provocative_question"
  | "ultra_specific_insight"
  | null;

interface EmailDraftRequest {
  email_type: EmailType;
  language: string;        // e.g., "en", "ru", "fr"
  pattern_mode: PatternMode;

  brief: {
    prospect: {
      full_name: string;
      role: string;
      company_name: string;
      email?: string;
      region?: string;
      timezone?: string;
      linkedin_url?: string;
    };
    company: {
      industry?: string;
      size_segment?: string;
      main_product?: string;
      tech_stack?: string[];
      geo_focus?: string;
      recent_events?: string[];  // funding, hiring, expansion
    };
    context: {
      trigger_event?: string;   // e.g., "just hired a new CRO"
      pain_point?: string;
      goal?: string;
      hypothesis?: string;      // why our product fits
    };
    offer: {
      product_name: string;
      one_liner: string;
      key_benefits: string[];
      proof_points?: string[];  // logos, case studies, numbers
      CTA?: string;             // "open a thread", "15-min call"
    };
    constraints: {
      max_words?: number;
      tone?: string;            // "direct, founder-to-founder"
      level_of_formality?: "formal" | "neutral" | "casual";
      no_hard_selling?: boolean;
    };
  };
}
```

## Response Type
```ts
interface EmailDraftResponse {
  subject: string;
  body: string;
  metadata: {
    model: string;
    language: string;
    pattern_mode: PatternMode;
    email_type: EmailType;
    coach_prompt_id: string;  // e.g., "intro_v2_1"
    quality_score?: number;   // if Judge is enabled
  };
}
```

## Segment Filter DSL (Snapshot Guardrails)
- Filters are an array of clauses `{field, operator, value}` stored on `segments.filter_definition`.
- Allowed operators: `eq`, `in`, `not_in`, `gte`, `lte`. All others are rejected.
- Allowed fields must start with `employees.` or `companies.` and be part of an explicit allowlist
  aligned with the Supabase spine. The current open-core allowlist is:
  - Employee-level: `employees.role` (maps to `employees.position`), `employees.position`.
  - Company-level: `companies.segment`, `companies.employee_count`.
  Unknown fields (including typos like `companies.employee_`) are rejected with a validation error
  that lists the allowed fields.
- Empty filter arrays are invalid.
- Snapshotting fails if no contacts match unless `allowEmpty` is explicitly set; a default guardrail
  caps snapshots at 5000 contacts (overridable per CLI call).
- Snapshots store a filters hash inside each `segment_members.snapshot`; reuse is rejected if the
  current filters hash differs (refresh required). Use `--force-version` to override stale versions
  when intentionally resyncing.
- See README “Segment Filter Definition” and “Campaign Status Transitions” for current operators,
  prefixes, status map, and CLI validation instructions; errors surface as codes with hints.

## Notes
- This contract is immutable; any prompt/model/provider change must produce the same shape.
- Strict vs. graceful data-quality modes operate before the contract is called (ensuring required fields exist or fallbacks defined).
- Pattern Breaker analytics rely on `metadata.pattern_mode` and `metadata.coach_prompt_id` logged with each `draft` and `email_outbound` record.
- Pipeline Express Mode must use a system prompt along the lines of: “You are the Cold/Bump Email Coach in PIPELINE EXPRESS MODE. You receive a structured JSON brief with all information about the prospect, company, context, and offer. Assume the brief is complete and validated. Do not ask questions. Internally reason as usual but output only JSON with {subject, body}. Respect language, pattern_mode, and constraints.” Interactive Coach Mode may ask clarifying questions but still submits the final payload via this contract.

### Draft Pattern & User Edit Flags
- Each generated draft persists an explicit `draft_pattern` derived from `metadata.coach_prompt_id`, `metadata.pattern_mode` (including Pattern Breaker choice), and any experimental `variant` label (e.g., `Cold_Bump_Email_Coach_v2_Enhanced:ultra_specific_insight:A`).
- Drafts also carry a `user_edited` boolean flag in `drafts.metadata`:
  - `false` for pure AI output (including AI rewrites),
  - `true` once a human edits the draft and marks it “ready to send”.
- These fields are used downstream to analyse performance per prompt-pack pattern (including STEP 9.5 Pattern Breaker options) and to compare AI-only vs. user-modified drafts.
