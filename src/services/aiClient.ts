import type { ChatClient, ChatMessage } from './chatClient.js';
import { emitTrace, finishTrace, isTracingEnabled, startTrace } from './tracing.js';

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

export class AiClient {
  constructor(private readonly chatClient: ChatClient) {}

  private buildMessages(request: EmailDraftRequest): ChatMessage[] {
    const system: ChatMessage = {
      role: 'system',
      content:
        'You are an email draft generator. You receive a JSON payload describing the prospect, company, context, and offer. ' +
        'If `brief.context.enrichment_provider` is present, it is an object like { primaryCompanyProvider, primaryEmployeeProvider }. ' +
        'Treat company data as authoritative from primaryCompanyProvider and lead/person data as authoritative from primaryEmployeeProvider when sources conflict. ' +
        'If `brief.context.enrichment_by_provider` is present, it contains supplemental provider summaries to fill gaps or validate; do not override the primary providers. ' +
        'Respond with a single JSON object containing {subject, body, metadata} only. Do not include any extra text.',
    };

    const user: ChatMessage = {
      role: 'user',
      content: JSON.stringify(request),
    };

    return [system, user];
  }

  async generateDraft(request: EmailDraftRequest): Promise<EmailDraftResponse> {
    const messages = this.buildMessages(request);

    const run = async () => {
      const raw = await this.chatClient.complete(messages);
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error('AI draft generator returned non-JSON response');
      }

      if (!parsed || typeof parsed !== 'object') {
        throw new Error('AI draft generator returned invalid JSON payload');
      }

      const obj = parsed as any;
      if (typeof obj.subject !== 'string' || typeof obj.body !== 'string' || typeof obj.metadata !== 'object') {
        throw new Error('AI draft generator returned payload missing subject/body/metadata');
      }

      return obj as EmailDraftResponse;
    };

    if (!isTracingEnabled()) {
      return run();
    }

    const trace = startTrace({
      span: 'ai.generateDraft',
      service: 'aiClient',
      model: 'unknown',
    });
    try {
      const resp = await run();
      emitTrace(finishTrace(trace, 'ok'));
      return resp;
    } catch (err: any) {
      emitTrace(finishTrace(trace, 'error', err?.message));
      throw err;
    }
  }
}
