# Appendix A – AI Draft Generation Contract

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

## Notes
- This contract is immutable; any prompt/model/provider change must produce the same shape.
- Strict vs. graceful data-quality modes operate before the contract is called (ensuring required fields exist or fallbacks defined).
- Pattern Breaker analytics rely on `metadata.pattern_mode` and `metadata.coach_prompt_id` logged with each `draft` and `email_outbound` record.
- Pipeline Express Mode must use a system prompt along the lines of: “You are the Cold/Bump Email Coach in PIPELINE EXPRESS MODE. You receive a structured JSON brief with all information about the prospect, company, context, and offer. Assume the brief is complete and validated. Do not ask questions. Internally reason as usual but output only JSON with {subject, body}. Respect language, pattern_mode, and constraints.” Interactive Coach Mode may ask clarifying questions but still submits the final payload via this contract.
