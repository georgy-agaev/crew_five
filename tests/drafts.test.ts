import { afterEach, describe, expect, it, vi } from 'vitest';

import { AiClient, type EmailDraftResponse } from '../src/services/aiClient';
import type { ChatClient } from '../src/services/chatClient';
import { generateDrafts } from '../src/services/drafts';
import * as promptRegistry from '../src/services/promptRegistry';

function emptyCampaignExclusionsSelect() {
  return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) } as any;
}

describe('generateDrafts', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('skips contacts without email and keeps scanning to fulfill the draft limit', async () => {
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

    const segmentRows = [
      {
        contact_id: 'contact-no-email',
        company_id: 'company-1',
        snapshot: {
          contact: { full_name: 'No Email', work_email: '', position: 'CTO' },
          company: { id: 'company-1', company_name: 'Acme' },
        },
      },
      {
        contact_id: 'contact-with-email',
        company_id: 'company-1',
        snapshot: {
          contact: { full_name: 'Jane Doe', work_email: 'jane@acme.test', position: 'CTO' },
          company: { id: 'company-1', company_name: 'Acme' },
        },
      },
    ];
    const membersLimit = vi.fn(async (limit: number) => ({
      data: segmentRows.slice(0, limit),
      error: null,
    }));

    const membersMatch = vi.fn().mockReturnValue({ limit: membersLimit });

    const insertSelect = vi.fn().mockResolvedValue({ data: [{ id: 'draft-1' }], error: null });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });

    const from = vi.fn((table: string) => {
      if (table === 'campaigns') {
        return { select: () => ({ eq }) } as any;
      }
      if (table === 'segments') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: { locale: 'en' }, error: null }),
            }),
          }),
        } as any;
      }
      if (table === 'icp_profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        } as any;
      }
      if (table === 'segment_members') {
        return {
          select: () => ({ match: membersMatch }),
        } as any;
      }
      if (table === 'campaign_member_additions') {
        return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) } as any;
      }
      if (table === 'campaign_member_exclusions') return emptyCampaignExclusionsSelect();
      if (table === 'app_settings')
        return { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) } as any;
      if (table === 'companies') return { select: () => ({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) } as any;
      if (table === 'employees') return { select: () => ({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) } as any;
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
      limit: 1,
    });

    expect(membersMatch).toHaveBeenCalledWith({ segment_id: 'seg', segment_version: 1 });
    expect(membersLimit).toHaveBeenCalled();
    expect(insert).toHaveBeenCalled();
    expect(chatClient.complete).toHaveBeenCalledTimes(1);
    expect(summary.generated).toBe(1);

    const insertedPayload = insert.mock.calls[0]?.[0] as any[];
    expect(insertedPayload).toHaveLength(1);
    expect(insertedPayload[0].contact_id).toBe('contact-with-email');
  });

  it('uses employees generic email when snapshot email is missing', async () => {
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

    const membersLimit = vi.fn().mockResolvedValue({
      data: [
        {
          contact_id: 'contact-generic',
          company_id: 'company-1',
          snapshot: {
            contact: { full_name: 'Generic Only', work_email: '', position: 'CEO' },
            company: { id: 'company-1', company_name: 'Acme' },
          },
        },
      ],
      error: null,
    });

    const membersMatch = vi.fn().mockReturnValue({ limit: membersLimit });

    const insertSelect = vi.fn().mockResolvedValue({ data: [{ id: 'draft-1' }], error: null });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });

    const from = vi.fn((table: string) => {
      if (table === 'campaigns') {
        return { select: () => ({ eq }) } as any;
      }
      if (table === 'segments') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: { locale: 'en' }, error: null }),
            }),
          }),
        } as any;
      }
      if (table === 'icp_profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        } as any;
      }
      if (table === 'segment_members') {
        return {
          select: () => ({ match: membersMatch }),
        } as any;
      }
      if (table === 'campaign_member_additions') {
        return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) } as any;
      }
      if (table === 'campaign_member_exclusions') return emptyCampaignExclusionsSelect();
      if (table === 'app_settings')
        return { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) } as any;
      if (table === 'companies') return { select: () => ({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) } as any;
      if (table === 'employees')
        return {
          select: () => ({
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: 'contact-generic',
                  ai_research_data: null,
                  work_email: '',
                  work_email_status: null,
                  generic_email: 'hello@acme.test',
                  generic_email_status: 'valid',
                },
              ],
              error: null,
            }),
          }),
        } as any;
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
      limit: 1,
    });

    expect(summary.generated).toBe(1);
    expect(summary.skippedNoEmail).toBe(0);

    const insertedPayload = insert.mock.calls[0]?.[0] as any[];
    expect(insertedPayload).toHaveLength(1);
    expect(insertedPayload[0].contact_id).toBe('contact-generic');
  });

  it('uses canonical snapshot recipient email without requiring live employee fallback', async () => {
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

    const membersLimit = vi.fn().mockResolvedValue({
      data: [
        {
          contact_id: 'contact-snapshot-recipient',
          company_id: 'company-1',
          snapshot: {
            contact: {
              full_name: 'Snapshot Recipient',
              work_email: '',
              generic_email: 'info@acme.test',
              recipient_email: 'info@acme.test',
              recipient_email_source: 'generic',
              recipient_email_kind: 'generic',
              sendable: true,
              position: 'CEO',
            },
            company: { id: 'company-1', company_name: 'Acme' },
          },
        },
      ],
      error: null,
    });

    const membersMatch = vi.fn().mockReturnValue({ limit: membersLimit });

    const insertSelect = vi.fn().mockResolvedValue({ data: [{ id: 'draft-1' }], error: null });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });

    const from = vi.fn((table: string) => {
      if (table === 'campaigns') {
        return { select: () => ({ eq }) } as any;
      }
      if (table === 'segments') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: { locale: 'en' }, error: null }),
            }),
          }),
        } as any;
      }
      if (table === 'icp_profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        } as any;
      }
      if (table === 'segment_members') {
        return {
          select: () => ({ match: membersMatch }),
        } as any;
      }
      if (table === 'campaign_member_additions') {
        return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) } as any;
      }
      if (table === 'campaign_member_exclusions') return emptyCampaignExclusionsSelect();
      if (table === 'app_settings')
        return { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) } as any;
      if (table === 'companies') return { select: () => ({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) } as any;
      if (table === 'employees') return { select: () => ({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) } as any;
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
      limit: 1,
    });

    expect(summary.generated).toBe(1);
    expect(summary.skippedNoEmail).toBe(0);

    const insertedPayload = insert.mock.calls[0]?.[0] as any[];
    expect(insertedPayload).toHaveLength(1);
    expect(insertedPayload[0].contact_id).toBe('contact-snapshot-recipient');
  });

  it('builds requests from segment member snapshot and inserts drafts', async () => {
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
              contact: { full_name: 'Jane Doe', work_email: 'jane@acme.test', position: 'CTO' },
              company: { id: 'company-1', company_name: 'Acme' },
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
      if (table === 'segments') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: { locale: 'en' }, error: null }),
            }),
          }),
        } as any;
      }
      if (table === 'icp_profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: 'p1',
                  name: 'Tool',
                  description: 'Desc',
                  offering_domain: 'voicexpert.ru',
                  company_criteria: {},
                  persona_criteria: {},
                  phase_outputs: {},
                },
                error: null,
              }),
            }),
          }),
        } as any;
      }
      if (table === 'segment_members') {
        return {
          select: () => ({ match: membersMatch }),
        } as any;
      }
      if (table === 'campaign_member_additions') {
        return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) } as any;
      }
      if (table === 'campaign_member_exclusions') return emptyCampaignExclusionsSelect();
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
      icpProfileId: 'p1',
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
    expect(draftRow.metadata?.offering_domain).toBe('voicexpert.ru');
    expect(draftRow.metadata?.offering_hash).toBe(null);
    expect(draftRow.metadata?.offering_summary).toEqual({
      product_name: 'Tool',
      one_liner: 'Desc',
      key_benefits: [],
      proof_points: [],
      main_cta: null,
    });
    expect(draftRow.metadata?.enrichment_provider).toEqual({ company: 'mock', employee: 'mock' });
    expect(draftRow.metadata?.enrichment_by_provider).toBe(null);
  });

  it('prefers request-level offering provenance when present', async () => {
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
                  prospect: { full_name: 'Jane Doe', role: 'CTO', company_name: 'Acme', email: 'jane@acme.test' },
                  company: {},
                  context: {
                    offering_domain: 'skomplekt.com',
                    offering_hash: 'sha256:abc123',
                    offering_summary: {
                      product_name: 'Skomplekt',
                      one_liner: 'Updated offer',
                    },
                  },
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

    const from = vi.fn((table: string) => {
      if (table === 'campaigns') return { select: () => ({ eq }) } as any;
      if (table === 'segments') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: { locale: 'en' }, error: null }),
            }),
          }),
        } as any;
      }
      if (table === 'icp_profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { id: 'p1', name: 'Tool', offering_domain: 'voicexpert.ru' },
                error: null,
              }),
            }),
          }),
        } as any;
      }
      if (table === 'segment_members') return { select: () => ({ match: membersMatch }) } as any;
      if (table === 'campaign_member_additions')
        return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) } as any;
      if (table === 'campaign_member_exclusions') return emptyCampaignExclusionsSelect();
      if (table === 'app_settings') {
        return { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) } as any;
      }
      if (table === 'companies') return { select: () => ({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) } as any;
      if (table === 'employees') return { select: () => ({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) } as any;
      if (table === 'drafts') return { insert } as any;
      throw new Error(`Unexpected table ${table}`);
    });

    const aiClient = new AiClient({
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
    });

    const summary = await generateDrafts({ from } as any, aiClient, {
      campaignId: 'camp',
      icpProfileId: 'p1',
    });

    expect(summary.generated).toBe(1);
    const insertedPayload = insert.mock.calls[0]?.[0] as any[];
    const draftRow = insertedPayload[0];
    expect(draftRow.metadata?.offering_domain).toBe('skomplekt.com');
    expect(draftRow.metadata?.offering_hash).toBe('sha256:abc123');
    expect(draftRow.metadata?.offering_summary).toEqual({
      product_name: 'Skomplekt',
      one_liner: 'Updated offer',
    });
  });

  it('returns failed counts and error message when draft insert fails', async () => {
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
              contact: { full_name: 'Jane Doe', work_email: 'jane@acme.test', position: 'CTO' },
              company: { id: 'company-1', company_name: 'Acme' },
            },
          },
        ],
        error: null,
      }),
    });

    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: null, error: { message: 'insert failed' } }),
    });

    const from = vi.fn((table: string) => {
      if (table === 'campaigns') return { select: () => ({ eq }) } as any;
      if (table === 'segments')
        return {
          select: () => ({
            eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { locale: 'en' }, error: null }) }),
          }),
        } as any;
      if (table === 'icp_profiles')
        return { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) } as any;
      if (table === 'segment_members') return { select: () => ({ match: membersMatch }) } as any;
      if (table === 'campaign_member_additions')
        return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) } as any;
      if (table === 'campaign_member_exclusions') return emptyCampaignExclusionsSelect();
      if (table === 'app_settings')
        return { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) } as any;
      if (table === 'companies') return { select: () => ({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) } as any;
      if (table === 'employees') return { select: () => ({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) } as any;
      if (table === 'drafts') return { insert } as any;
      throw new Error(`Unexpected table ${table}`);
    });

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

    const summary = await generateDrafts({ from } as any, aiClient, { campaignId: 'camp', limit: 1, dryRun: false });

    expect(summary.generated).toBe(1);
    expect(summary.failed).toBe(1);
    expect((summary as any).error).toContain('insert failed');
  });

  it('supports dry-run without inserts', async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: 'camp', segment_id: 'seg', segment_version: 1 },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ single });
    const membersMatch = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            contact_id: 'c',
            company_id: 'co',
            snapshot: { contact: { full_name: 'Jane', work_email: 'jane@acme.test', position: 'CTO' }, company: { company_name: 'Acme' } },
          },
        ],
        error: null,
      }),
    });
    const supabase = {
      from: (table: string) => {
        if (table === 'campaigns') return { select: () => ({ eq }) };
        if (table === 'segments')
          return { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { locale: 'en' }, error: null }) }) }) };
        if (table === 'segment_members') return { select: () => ({ match: membersMatch }) };
        if (table === 'campaign_member_additions')
          return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
        if (table === 'campaign_member_exclusions') return emptyCampaignExclusionsSelect();
        if (table === 'app_settings') return { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) };
        if (table === 'icp_profiles') return { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) };
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

  it('falls back to request metadata when AI response metadata is incomplete', async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: 'camp', segment_id: 'seg', segment_version: 1, language: 'en', pattern_mode: 'standard' },
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
              contact: { full_name: 'Jane Doe', work_email: 'jane@acme.test', position: 'CTO' },
              company: { id: 'company-1', company_name: 'Acme' },
            },
          },
        ],
        error: null,
      }),
    });

    const insertSelect = vi.fn().mockResolvedValue({ data: [{ id: 'draft-1' }], error: null });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });

    const supabase = {
      from: (table: string) => {
        if (table === 'campaigns') return { select: () => ({ eq }) };
        if (table === 'segments')
          return { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { locale: 'en' }, error: null }) }) }) };
        if (table === 'segment_members') return { select: () => ({ match: membersMatch }) };
        if (table === 'campaign_member_additions')
          return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
        if (table === 'campaign_member_exclusions') return emptyCampaignExclusionsSelect();
        if (table === 'app_settings') return { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) };
        if (table === 'icp_profiles') return { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) };
        if (table === 'companies') return { select: () => ({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
        if (table === 'employees') return { select: () => ({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
        if (table === 'drafts') return { insert };
        throw new Error('unexpected');
      },
    } as any;

    const chatClient: ChatClient = {
      complete: vi.fn().mockResolvedValue(
        JSON.stringify({
          subject: 'Hello',
          body: 'Body',
          metadata: {},
        })
      ),
    };
    const aiClient = new AiClient(chatClient);

    const summary = await generateDrafts(supabase, aiClient, { campaignId: 'camp', variant: 'A' });
    expect(summary.generated).toBe(1);

    const insertedPayload = insert.mock.calls[0]?.[0] as any[];
    expect(insertedPayload).toHaveLength(1);
    expect(insertedPayload[0].email_type).toBe('intro');
    expect(insertedPayload[0].language).toBe('en');
    expect(insertedPayload[0].pattern_mode).toBe('standard');
  });

  it('fail-fast aborts on insert error', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'camp', segment_id: 'seg', segment_version: 1 }, error: null });
    const eq = vi.fn().mockReturnValue({ single });
    const membersMatch = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            contact_id: 'c',
            company_id: 'co',
            snapshot: {
              contact: { full_name: 'Jane', work_email: 'jane@acme.test', position: 'CTO' },
              company: { company_name: 'Acme' },
            },
          },
        ],
        error: null,
      }),
    });
    const insert = vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue({ error: new Error('insert fail') }) });
    const supabase = {
      from: (table: string) => {
        if (table === 'campaigns') return { select: () => ({ eq }) };
        if (table === 'segments')
          return { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { locale: 'en' }, error: null }) }) }) };
        if (table === 'segment_members') return { select: () => ({ match: membersMatch }) };
        if (table === 'campaign_member_additions')
          return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
        if (table === 'campaign_member_exclusions') return emptyCampaignExclusionsSelect();
        if (table === 'app_settings') return { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) };
        if (table === 'icp_profiles') return { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) };
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
                  prospect: { full_name: 'Jane Doe', role: 'CTO', company_name: 'Acme', email: 'jane@acme.test' },
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
      if (table === 'segments') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: { locale: 'en' }, error: null }),
            }),
          }),
        } as any;
      }
      if (table === 'icp_profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        } as any;
      }
      if (table === 'segment_members') {
        return {
          select: () => ({ match: membersMatch }),
        } as any;
      }
      if (table === 'campaign_member_additions') {
        return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) } as any;
      }
      if (table === 'campaign_member_exclusions') return emptyCampaignExclusionsSelect();
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
                  prospect: { full_name: 'Jane Doe', role: 'CTO', company_name: 'Acme', email: 'jane@acme.test' },
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
      if (table === 'segments') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: { locale: 'en' }, error: null }),
            }),
          }),
        } as any;
      }
      if (table === 'icp_profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        } as any;
      }
      if (table === 'segment_members') {
        return {
          select: () => ({ match: membersMatch }),
        } as any;
      }
      if (table === 'campaign_member_additions') {
        return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) } as any;
      }
      if (table === 'campaign_member_exclusions') return emptyCampaignExclusionsSelect();
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
                  prospect: { full_name: 'Jane Doe', role: 'CTO', company_name: 'Acme', email: 'jane@acme.test' },
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
      if (table === 'segments') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: { locale: 'en' }, error: null }),
            }),
          }),
        } as any;
      }
      if (table === 'icp_profiles') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        } as any;
      }
      if (table === 'segment_members') return { select: () => ({ match: membersMatch }) } as any;
      if (table === 'campaign_member_additions')
        return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) } as any;
      if (table === 'campaign_member_exclusions') return emptyCampaignExclusionsSelect();
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

  it('includes manually attached campaign audience rows in generation', async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: 'camp', segment_id: 'seg', segment_version: 1, language: 'en', pattern_mode: 'standard' },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ single });

    const membersMatch = vi.fn().mockResolvedValue({
      data: [
        {
          company_id: 'company-1',
          contact_id: 'contact-1',
          snapshot: {
            contact: { full_name: 'Alice', work_email: 'alice@acme.test', position: 'CEO' },
            company: { company_name: 'Acme' },
          },
        },
      ],
      error: null,
    });

    const additionsEq = vi.fn().mockResolvedValue({
      data: [
        {
          campaign_id: 'camp',
          company_id: 'company-2',
          contact_id: 'contact-2',
          source: 'manual_attach',
          snapshot: {
            contact: { full_name: 'Bob', work_email: 'bob@beta.test', position: 'CTO' },
            company: { company_name: 'Beta' },
          },
          attached_at: '2026-03-21T12:00:00Z',
        },
      ],
      error: null,
    });
    const additionsSelect = vi.fn().mockReturnValue({ eq: additionsEq });

    const insertSelect = vi.fn().mockResolvedValue({ data: [{ id: 'draft-1' }, { id: 'draft-2' }], error: null });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });

    const supabase = {
      from: (table: string) => {
        if (table === 'campaigns') return { select: () => ({ eq }) };
        if (table === 'segments')
          return { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { locale: 'en' }, error: null }) }) }) };
        if (table === 'segment_members') return { select: () => ({ match: membersMatch }) };
        if (table === 'campaign_member_additions') return { select: additionsSelect };
        if (table === 'campaign_member_exclusions') return emptyCampaignExclusionsSelect();
        if (table === 'app_settings') return { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) };
        if (table === 'icp_profiles') return { select: () => ({ eq: () => ({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }) }) };
        if (table === 'companies') return { select: () => ({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
        if (table === 'employees') return { select: () => ({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
        if (table === 'drafts') return { insert };
        throw new Error(`Unexpected table ${table}`);
      },
    } as any;

    const aiClient = new AiClient({
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
    });

    const summary = await generateDrafts(supabase, aiClient, { campaignId: 'camp' });

    expect(summary.generated).toBe(2);
    const insertedPayload = insert.mock.calls[0]?.[0] as any[];
    expect(insertedPayload.map((row: any) => row.contact_id)).toEqual(['contact-1', 'contact-2']);
  });
});
