import { afterEach, describe, expect, it, vi } from 'vitest';

import { AiClient, type EmailDraftResponse } from '../src/services/aiClient';
import type { ChatClient } from '../src/services/chatClient';
import { generateDrafts } from '../src/services/drafts';
import * as promptRegistry from '../src/services/promptRegistry';

describe('generateDrafts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches campaign context, calls AI client, and inserts drafts', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'camp',
        segment_id: 'seg',
        segment_version: 1,
        language: 'en',
        pattern_mode: 'standard',
      },
      error: null,
    });

    const eq = vi.fn().mockReturnValue({ single });

    const membersMatch = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            contact_id: 'contact-1',
            company_id: 'company-1',
            snapshot: {
              request: {
                email_type: 'intro',
                language: 'en',
                pattern_mode: 'standard',
                brief: {
                  prospect: { full_name: 'Jane Doe', role: 'CTO', company_name: 'Acme' },
                  company: {},
                  context: {},
                  offer: { product_name: 'Tool', one_liner: 'Desc', key_benefits: ['a'] },
                  constraints: {},
                },
              },
            },
          },
        ],
        error: null,
      }),
    });

    const insertSelect = vi.fn().mockResolvedValue({ data: [{ id: 'draft-1' }], error: null });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });

    const appSettingsSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });
    const companiesSelect = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    const employeesSelect = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    const from = vi.fn((table: string) => {
      if (table === 'campaigns') {
        return { select: () => ({ eq }) } as any;
      }
      if (table === 'segment_members') {
        return {
          select: () => ({ match: membersMatch }),
        } as any;
      }
      if (table === 'app_settings') return { select: appSettingsSelect } as any;
      if (table === 'companies') return { select: companiesSelect } as any;
      if (table === 'employees') return { select: employeesSelect } as any;
      if (table === 'drafts') {
        return { insert } as any;
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const supabase = { from } as any;

    const aiResponse: EmailDraftResponse = {
      subject: 'Hello',
      body: 'Body',
      metadata: {
        model: 'mock',
        language: 'en',
        pattern_mode: 'standard',
        email_type: 'intro',
        coach_prompt_id: 'intro_v1',
      },
    };
    const chatClient: ChatClient = {
      complete: vi.fn().mockResolvedValue(JSON.stringify(aiResponse)),
    };
    const aiClient = new AiClient(chatClient);

    const summary = await generateDrafts(supabase, aiClient, {
      campaignId: 'camp',
      variant: 'A',
      provider: 'openai',
      model: 'gpt-4o-mini',
    });

    expect(eq).toHaveBeenCalledWith('id', 'camp');
    expect(membersMatch).toHaveBeenCalledWith({ segment_id: 'seg', segment_version: 1 });
    expect(insert).toHaveBeenCalled();
    expect(insertSelect).toHaveBeenCalled();
    expect(summary.generated).toBe(1);
    expect(summary.gracefulUsed).toBe(0);

    const insertedPayload = insert.mock.calls[0]?.[0] as any[];
    expect(Array.isArray(insertedPayload)).toBe(true);
    const draftRow = insertedPayload[0];
    expect(draftRow.metadata?.draft_pattern).toBe('intro_v1:standard:A');
    expect(draftRow.metadata?.user_edited).toBe(false);
    expect(draftRow.metadata?.provider).toBe('openai');
    expect(draftRow.metadata?.model).toBe('gpt-4o-mini');
    expect(draftRow.metadata?.enrichment_provider).toEqual({ company: 'mock', employee: 'mock' });
    expect(draftRow.metadata?.enrichment_by_provider).toBe(null);
  });

  it('supports dry-run without inserts', async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: 'camp', segment_id: 'seg', segment_version: 1 },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ single });
    const membersMatch = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({ data: [{ contact_id: 'c', company_id: 'co', snapshot: { request: {} } }], error: null }),
    });
    const supabase = {
      from: (table: string) => {
        if (table === 'campaigns') return { select: () => ({ eq }) };
        if (table === 'segment_members') return { select: () => ({ match: membersMatch }) };
        if (table === 'app_settings') return { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) };
        if (table === 'companies') return { select: () => ({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
        if (table === 'employees') return { select: () => ({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
        if (table === 'drafts') return { insert: vi.fn() };
        throw new Error('unexpected');
      },
    } as any;

    const chatClient: ChatClient = {
      complete: vi.fn().mockResolvedValue(
        JSON.stringify({
          subject: 'Hello',
          body: 'Body',
          metadata: {
            model: 'mock',
            language: 'en',
            pattern_mode: 'standard',
            email_type: 'intro',
            coach_prompt_id: 'intro_v1',
          },
        })
      ),
    };
    const aiClient = new AiClient(chatClient);
    const summary = await generateDrafts(supabase, aiClient, { campaignId: 'camp', dryRun: true });
    expect(summary.generated).toBe(0);
    expect(summary.skipped).toBeGreaterThanOrEqual(0);
  });

  it('fail-fast aborts on insert error', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'camp', segment_id: 'seg', segment_version: 1 }, error: null });
    const eq = vi.fn().mockReturnValue({ single });
    const membersMatch = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({
        data: [{ contact_id: 'c', company_id: 'co', snapshot: { request: {} } }],
        error: null,
      }),
    });
    const insert = vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue({ error: new Error('insert fail') }) });
    const supabase = {
      from: (table: string) => {
        if (table === 'campaigns') return { select: () => ({ eq }) };
        if (table === 'segment_members') return { select: () => ({ match: membersMatch }) };
        if (table === 'app_settings') return { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) };
        if (table === 'companies') return { select: () => ({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
        if (table === 'employees') return { select: () => ({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
        if (table === 'drafts') return { insert };
        throw new Error('unexpected');
      },
    } as any;
    const chatClient: ChatClient = {
      complete: vi.fn().mockResolvedValue(
        JSON.stringify({
          subject: 's',
          body: 'b',
          metadata: { email_type: 'intro', language: 'en', pattern_mode: 'p', coach_prompt_id: 'c' },
        })
      ),
    };
    const aiClient = new AiClient(chatClient);

    await expect(generateDrafts(supabase, aiClient, { campaignId: 'camp', failFast: true })).rejects.toThrow(/insert fail/);
  });

  it('draft_generation_uses_resolved_prompt_id_when_step_provided', async () => {
    const resolveSpy = vi.spyOn(promptRegistry, 'resolvePromptForStep').mockResolvedValue('resolved_intro_v2');

    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'camp',
        segment_id: 'seg',
        segment_version: 1,
        language: 'en',
        pattern_mode: 'standard',
      },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ single });

    const membersMatch = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            contact_id: 'contact-1',
            company_id: 'company-1',
            snapshot: {
              request: {
                email_type: 'intro',
                language: 'en',
                pattern_mode: 'standard',
                brief: {
                  prospect: { full_name: 'Jane Doe', role: 'CTO', company_name: 'Acme' },
                  company: {},
                  context: {},
                  offer: { product_name: 'Tool', one_liner: 'Desc', key_benefits: ['a'] },
                  constraints: {},
                },
              },
            },
          },
        ],
        error: null,
      }),
    });

    const insertSelect = vi.fn().mockResolvedValue({ data: [{ id: 'draft-1' }], error: null });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });

    const appSettingsSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });
    const companiesSelect = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    const employeesSelect = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    const from = vi.fn((table: string) => {
      if (table === 'campaigns') {
        return { select: () => ({ eq }) } as any;
      }
      if (table === 'segment_members') {
        return {
          select: () => ({ match: membersMatch }),
        } as any;
      }
      if (table === 'app_settings') return { select: appSettingsSelect } as any;
      if (table === 'companies') return { select: companiesSelect } as any;
      if (table === 'employees') return { select: employeesSelect } as any;
      if (table === 'drafts') {
        return { insert } as any;
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const supabase = { from } as any;

    const aiResponse: EmailDraftResponse = {
      subject: 'Hello',
      body: 'Body',
      metadata: {
        model: 'mock',
        language: 'en',
        pattern_mode: 'standard',
        email_type: 'intro',
        coach_prompt_id: 'intro_v1',
      },
    };
    const chatClient: ChatClient = {
      complete: vi.fn().mockResolvedValue(JSON.stringify(aiResponse)),
    };
    const aiClient = new AiClient(chatClient);

    const summary = await generateDrafts(supabase, aiClient, {
      campaignId: 'camp',
      variant: 'B',
      coachPromptStep: 'draft',
    } as any);

    expect(summary.generated).toBe(1);
    expect(resolveSpy).toHaveBeenCalledWith(supabase, { step: 'draft', explicitId: undefined });

    const insertedPayload = insert.mock.calls[0]?.[0] as any[];
    const draftRow = insertedPayload[0];
    expect(draftRow.metadata?.coach_prompt_id).toBe('resolved_intro_v2');
    expect(draftRow.metadata?.draft_pattern).toBe('resolved_intro_v2:standard:B');
  });

  it('draft_generation_uses_explicit_prompt_id_when_provided', async () => {
    const resolveSpy = vi.spyOn(promptRegistry, 'resolvePromptForStep').mockResolvedValue('should_not_be_used');

    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'camp',
        segment_id: 'seg',
        segment_version: 1,
        language: 'en',
        pattern_mode: 'standard',
      },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ single });

    const membersMatch = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            contact_id: 'contact-1',
            company_id: 'company-1',
            snapshot: {
              request: {
                email_type: 'intro',
                language: 'en',
                pattern_mode: 'standard',
                brief: {
                  prospect: { full_name: 'Jane Doe', role: 'CTO', company_name: 'Acme' },
                  company: {},
                  context: {},
                  offer: { product_name: 'Tool', one_liner: 'Desc', key_benefits: ['a'] },
                  constraints: {},
                },
              },
            },
          },
        ],
        error: null,
      }),
    });

    const insertSelect = vi.fn().mockResolvedValue({ data: [{ id: 'draft-1' }], error: null });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });

    const appSettingsSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });
    const companiesSelect = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    const employeesSelect = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
    });

    const from = vi.fn((table: string) => {
      if (table === 'campaigns') {
        return { select: () => ({ eq }) } as any;
      }
      if (table === 'segment_members') {
        return {
          select: () => ({ match: membersMatch }),
        } as any;
      }
      if (table === 'app_settings') return { select: appSettingsSelect } as any;
      if (table === 'companies') return { select: companiesSelect } as any;
      if (table === 'employees') return { select: employeesSelect } as any;
      if (table === 'drafts') {
        return { insert } as any;
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const supabase = { from } as any;

    const aiResponse: EmailDraftResponse = {
      subject: 'Hello',
      body: 'Body',
      metadata: {
        model: 'mock',
        language: 'en',
        pattern_mode: 'standard',
        email_type: 'intro',
        coach_prompt_id: 'intro_v1',
      },
    };
    const chatClient: ChatClient = {
      complete: vi.fn().mockResolvedValue(JSON.stringify(aiResponse)),
    };
    const aiClient = new AiClient(chatClient);

    const summary = await generateDrafts(supabase, aiClient, {
      campaignId: 'camp',
      variant: 'C',
      coachPromptStep: 'draft',
      explicitCoachPromptId: 'explicit_intro_v3',
    } as any);

    expect(summary.generated).toBe(1);
    expect(resolveSpy).not.toHaveBeenCalled();

    const insertedPayload = insert.mock.calls[0]?.[0] as any[];
    const draftRow = insertedPayload[0];
    expect(draftRow.metadata?.coach_prompt_id).toBe('explicit_intro_v3');
    expect(draftRow.metadata?.draft_pattern).toBe('explicit_intro_v3:standard:C');
  });

  it('injects primary provider enrichment into the request context', async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: 'camp', segment_id: 'seg', segment_version: 1 },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ single });
    const membersMatch = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            contact_id: 'contact-1',
            company_id: 'company-1',
            snapshot: {
              request: {
                email_type: 'intro',
                language: 'en',
                pattern_mode: 'standard',
                brief: {
                  prospect: { full_name: 'Jane Doe', role: 'CTO', company_name: 'Acme' },
                  company: {},
                  context: {},
                  offer: { product_name: 'Tool', one_liner: 'Desc', key_benefits: ['a'] },
                  constraints: {},
                },
              },
            },
          },
        ],
        error: null,
      }),
    });

    const insertSelect = vi.fn().mockResolvedValue({ data: [], error: null });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });

    const from = vi.fn((table: string) => {
      if (table === 'campaigns') return { select: () => ({ eq }) } as any;
      if (table === 'segment_members') return { select: () => ({ match: membersMatch }) } as any;
      if (table === 'app_settings') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  value: {
                    version: 2,
                    defaultProviders: ['exa', 'firecrawl'],
                    primaryCompanyProvider: 'firecrawl',
                    primaryEmployeeProvider: 'exa',
                  },
                },
                error: null,
              }),
            }),
          }),
        } as any;
      }
      if (table === 'companies') {
        return {
          select: () => ({
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'company-1',
                  company_research: {
                    version: 1,
                    providers: { exa: { summary: 'company exa' }, firecrawl: { summary: 'company firecrawl', html: '<html />' } },
                    lastUpdatedAt: '2025-12-26T00:00:00.000Z',
                  },
                },
              ],
              error: null,
            }),
          }),
        } as any;
      }
      if (table === 'employees') {
        return {
          select: () => ({
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'contact-1',
                  ai_research_data: {
                    version: 1,
                    providers: { exa: { summary: 'employee exa' }, firecrawl: { summary: 'employee firecrawl', blobs: Array.from({ length: 50 }, (_, i) => `x${i}`) } },
                    lastUpdatedAt: '2025-12-26T00:00:00.000Z',
                  },
                },
              ],
              error: null,
            }),
          }),
        } as any;
      }
      if (table === 'drafts') return { insert } as any;
      throw new Error(`Unexpected table ${table}`);
    });

    const supabase = { from } as any;
    const chatClient: ChatClient = {
      complete: vi.fn().mockImplementation(async (messages) => {
        const req = JSON.parse(messages[messages.length - 1].content);
        expect(req.brief.company.enrichment.summary).toBe('company firecrawl');
        expect(req.brief.context.lead_enrichment.summary).toBe('employee exa');
        expect(req.brief.context.enrichment_provider).toEqual({ company: 'firecrawl', employee: 'exa' });
        expect(req.brief.context.enrichment_by_provider.exa.mode).toBe('primary');
        expect(req.brief.context.enrichment_by_provider.exa.primaryFor).toContain('employee');
        expect(req.brief.context.enrichment_by_provider.firecrawl.mode).toBe('primary');
        expect(req.brief.context.enrichment_by_provider.firecrawl.primaryFor).toContain('company');
        return JSON.stringify({
          subject: 's',
          body: 'b',
          metadata: { email_type: 'intro', language: 'en', pattern_mode: 'standard', coach_prompt_id: 'c', model: 'm' },
        });
      }),
    };
    const aiClient = new AiClient(chatClient);

    const summary = await generateDrafts(supabase, aiClient, { campaignId: 'camp' });
    expect(summary.generated).toBe(1);
    const insertedPayload = insert.mock.calls[0]?.[0] as any[];
    expect(insertedPayload[0]?.metadata?.enrichment_provider).toEqual({ company: 'firecrawl', employee: 'exa' });
    expect(insertedPayload[0]?.metadata?.enrichment_by_provider?.exa?.mode).toBe('primary');
    expect(insertedPayload[0]?.metadata?.enrichment_by_provider?.firecrawl?.mode).toBe('primary');
  });
});
