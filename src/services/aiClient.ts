export type EmailType = 'intro' | 'bump';
export type PatternMode =
  | 'standard'
  | 'reverse_psychology'
  | 'provocative_question'
  | 'ultra_specific_insight'
  | null;

export interface EmailDraftRequest {
  email_type: EmailType;
  language: string;
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
    company: Record<string, unknown>;
    context: Record<string, unknown>;
    offer: {
      product_name: string;
      one_liner: string;
      key_benefits: string[];
      proof_points?: string[];
      CTA?: string;
    };
    constraints: Record<string, unknown>;
  };
}

export interface EmailDraftResponse {
  subject: string;
  body: string;
  metadata: {
    model: string;
    language: string;
    pattern_mode: PatternMode;
    email_type: EmailType;
    coach_prompt_id: string;
    quality_score?: number;
  };
}

export type AiGenerator = (payload: EmailDraftRequest) => Promise<EmailDraftResponse>;

export class AiClient {
  constructor(private readonly generator: AiGenerator) {}

  async generateDraft(request: EmailDraftRequest): Promise<EmailDraftResponse> {
    return this.generator(request);
  }
}
