/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, expect, it, vi } from 'vitest';

import {
  createCampaign,
  getCampaignDetail,
  getCampaignSpineContext,
  listCampaignCompanies,
  listCampaignOutbounds,
} from '../src/services/campaigns';
import { assertCampaignStatusTransition, getAllowedTransitions } from '../src/status';

describe('createCampaign', () => {
  it('stores campaign with default modes', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'camp-1', interaction_mode: 'express' } });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });
    const supabase = { from } as any;

    const payload = {
      name: 'Q1 Fintech Push',
      segmentId: 'segment-1',
      segmentVersion: 1,
      offerId: 'offer-1',
      icpHypothesisId: 'hyp-1',
      senderProfileId: 'sender-1',
      promptPackId: 'prompt-1',
      schedule: { startAt: '2025-11-22' },
      throttle: { perHour: 50 },
      createdBy: 'cli-user',
      projectId: 'project-1',
    };

    const result = await createCampaign(supabase, payload);

    expect(from).toHaveBeenCalledWith('campaigns');
    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        name: 'Q1 Fintech Push',
        segment_id: 'segment-1',
        segment_version: 1,
        project_id: 'project-1',
        offer_id: 'offer-1',
        icp_hypothesis_id: 'hyp-1',
        interaction_mode: 'express',
        data_quality_mode: 'strict',
        status: 'draft',
      }),
    ]);
    expect(result).toEqual({ id: 'camp-1', interaction_mode: 'express' });
  });

  it('validates campaign status transitions (table-driven)', () => {
    const valid: Array<[string, string]> = [
      ['draft', 'ready'],
      ['draft', 'review'],
      ['ready', 'generating'],
      ['generating', 'review'],
      ['generating', 'sending'],
      ['sending', 'paused'],
      ['paused', 'sending'],
      ['sending', 'complete'],
      ['paused', 'complete'],
    ];

    valid.forEach(([from, to]) => {
      expect(() => assertCampaignStatusTransition(from, to)).not.toThrow();
    });

    const invalid: Array<[string, string]> = [
      ['sending', 'draft'],
      ['complete', 'draft'],
      ['ready', 'draft'],
      ['review', 'draft'],
      ['review', 'complete'],
    ];

    invalid.forEach(([from, to]) => {
      expect(() => assertCampaignStatusTransition(from as any, to as any)).toThrow(/ERR_STATUS_INVALID/);
    });
  });

  it('campaign_spine_context_returns_segment_and_version_for_send', async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: 'camp-1', segment_id: 'segment-1', segment_version: 2 },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const supabase = { from } as any;

    const ctx = await getCampaignSpineContext(supabase, 'camp-1');

    expect(from).toHaveBeenCalledWith('campaigns');
    expect(select).toHaveBeenCalledWith('id, segment_id, segment_version');
    expect(eq).toHaveBeenCalledWith('id', 'camp-1');
    expect(ctx).toEqual({
      id: 'camp-1',
      segment_id: 'segment-1',
      segment_version: 2,
    });
  });

  it('campaign_detail_returns_operator_fields', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'camp-1',
        name: 'Q1 Push',
        status: 'draft',
        segment_id: 'segment-1',
        segment_version: 2,
        project_id: 'project-1',
        offer_id: 'offer-1',
        created_at: '2026-03-15T10:00:00Z',
        updated_at: '2026-03-15T11:00:00Z',
      },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const supabase = { from } as any;

    const detail = await getCampaignDetail(supabase, 'camp-1');

    expect(select).toHaveBeenCalledWith(
      'id,name,status,segment_id,segment_version,project_id,offer_id,icp_hypothesis_id,created_at,updated_at'
    );
    expect(detail.name).toBe('Q1 Push');
    expect(detail.segment_version).toBe(2);
    expect(detail.project_id).toBe('project-1');
    expect(detail.offer_id).toBe('offer-1');
  });

  it('listCampaignCompanies groups segment snapshot rows by company', async () => {
    const campaignSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'camp-1',
        name: 'Q1 Push',
        status: 'draft',
        segment_id: 'segment-1',
        segment_version: 2,
        created_at: '2026-03-15T10:00:00Z',
        updated_at: '2026-03-15T11:00:00Z',
      },
      error: null,
    });
    const campaignEq = vi.fn().mockReturnValue({ single: campaignSingle });
    const campaignSelect = vi.fn().mockReturnValue({ eq: campaignEq });

    const membersMatch = vi.fn().mockResolvedValue({
      data: [
        {
          company_id: 'comp-2',
          contact_id: 'contact-1',
          snapshot: {
            company: {
              company_name: 'Beta',
              website: 'https://beta.example',
              employee_count: 20,
              region: 'Paris',
              office_qualification: 'Less',
              company_description: 'Beta desc',
              company_research: { facts: ['x'] },
            },
          },
        },
        {
          company_id: 'comp-2',
          contact_id: 'contact-2',
          snapshot: {
            company: {
              company_name: 'Beta',
            },
          },
        },
        {
          company_id: 'comp-1',
          contact_id: 'contact-3',
          snapshot: {
            company: {
              company_name: 'Alpha',
              company_description: 'Alpha desc',
            },
          },
        },
      ],
      error: null,
    });
    const membersSelect = vi.fn().mockReturnValue({ match: membersMatch });

    const companiesIn = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'comp-2',
          company_name: 'Beta',
          website: 'https://beta.example',
          employee_count: 20,
          region: 'Paris',
          office_qualification: 'Less',
          company_description: 'Beta desc',
          company_research: {
            lastUpdatedAt: new Date().toISOString(),
            providers: { firecrawl: {}, exa: {} },
          },
          updated_at: '2026-03-15T11:00:00Z',
        },
        {
          id: 'comp-1',
          company_name: 'Alpha',
          company_description: 'Alpha desc',
          company_research: null,
          updated_at: '2025-12-01T11:00:00Z',
        },
      ],
      error: null,
    });
    const companiesSelect = vi.fn().mockReturnValue({ in: companiesIn });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'campaigns') {
          return { select: campaignSelect };
        }
        if (table === 'segment_members') {
          return { select: membersSelect };
        }
        if (table === 'campaign_member_additions') {
          return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
        }
        if (table === 'campaign_member_exclusions') {
          return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
        }
        if (table === 'companies') {
          return { select: companiesSelect };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    } as any;

    const result = await listCampaignCompanies(supabase, 'camp-1');

    expect(membersSelect).toHaveBeenCalledWith('company_id,contact_id');
    expect(membersMatch).toHaveBeenCalledWith({
      segment_id: 'segment-1',
      segment_version: 2,
    });
    expect(result.campaign.name).toBe('Q1 Push');
    expect(result.companies).toHaveLength(2);
    expect(result.companies[0]).toMatchObject({
      company_id: 'comp-1',
      company_name: 'Alpha',
      contact_count: 1,
      enrichment: {
        status: 'missing',
        last_updated_at: null,
        provider_hint: null,
      },
    });
    expect(result.companies[1]).toMatchObject({
      company_id: 'comp-2',
      company_name: 'Beta',
      contact_count: 2,
      company_description: 'Beta desc',
      website: 'https://beta.example',
      enrichment: {
        status: 'fresh',
        provider_hint: 'exa/firecrawl',
      },
    });
  });

  it('listCampaignCompanies includes manually attached companies', async () => {
    const campaignSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'camp-1',
        name: 'Q1 Push',
        status: 'draft',
        segment_id: 'segment-1',
        segment_version: 2,
      },
      error: null,
    });
    const campaignEq = vi.fn().mockReturnValue({ single: campaignSingle });
    const campaignSelect = vi.fn().mockReturnValue({ eq: campaignEq });

    const membersMatch = vi.fn().mockResolvedValue({
      data: [
        {
          company_id: 'comp-1',
          contact_id: 'contact-1',
          snapshot: { company: { company_name: 'Alpha' } },
        },
      ],
      error: null,
    });
    const membersSelect = vi.fn().mockReturnValue({ match: membersMatch });

    const additionsEq = vi.fn().mockResolvedValue({
      data: [
        {
          campaign_id: 'camp-1',
          company_id: 'comp-2',
          contact_id: 'contact-2',
          source: 'manual_attach',
          snapshot: {
            company: {
              company_name: 'Beta',
              website: 'https://beta.example',
              employee_count: 10,
            },
          },
          attached_at: '2026-03-21T12:00:00Z',
        },
      ],
      error: null,
    });
    const additionsSelect = vi.fn().mockReturnValue({ eq: additionsEq });

    const companiesIn = vi.fn().mockResolvedValue({
      data: [
        { id: 'comp-1', company_research: null, updated_at: null },
        { id: 'comp-2', company_research: null, updated_at: null },
      ],
      error: null,
    });
    const companiesSelect = vi.fn().mockReturnValue({ in: companiesIn });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'campaigns') return { select: campaignSelect };
        if (table === 'segment_members') return { select: membersSelect };
        if (table === 'campaign_member_additions') return { select: additionsSelect };
        if (table === 'campaign_member_exclusions')
          return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
        if (table === 'companies') return { select: companiesSelect };
        throw new Error(`Unexpected table ${table}`);
      }),
    } as any;

    const result = await listCampaignCompanies(supabase, 'camp-1');

    expect(result.companies).toHaveLength(2);
    expect(result.companies.map((row) => row.company_id)).toEqual(['comp-1', 'comp-2']);
  });

  it('listCampaignCompanies falls back to canonical company fields when snapshot is sparse', async () => {
    const campaignSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'camp-1',
        name: 'Q1 Push',
        status: 'draft',
        segment_id: 'segment-1',
        segment_version: 2,
      },
      error: null,
    });
    const campaignEq = vi.fn().mockReturnValue({ single: campaignSingle });
    const campaignSelect = vi.fn().mockReturnValue({ eq: campaignEq });

    const membersMatch = vi.fn().mockResolvedValue({
      data: [
        {
          company_id: 'comp-1',
          contact_id: 'contact-1',
          snapshot: {
            company: {
              company_name: 'Alpha',
            },
          },
        },
      ],
      error: null,
    });
    const membersSelect = vi.fn().mockReturnValue({ match: membersMatch });

    const companiesIn = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'comp-1',
          company_name: 'Alpha',
          website: 'https://alpha.example',
          employee_count: 42,
          region: 'Москва',
          office_qualification: 'Less',
          company_description: 'Alpha description',
          company_research: null,
          updated_at: null,
        },
      ],
      error: null,
    });
    const companiesSelect = vi.fn().mockReturnValue({ in: companiesIn });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'campaigns') return { select: campaignSelect };
        if (table === 'segment_members') return { select: membersSelect };
        if (table === 'campaign_member_additions') {
          return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
        }
        if (table === 'campaign_member_exclusions') {
          return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
        }
        if (table === 'companies') return { select: companiesSelect };
        throw new Error(`Unexpected table ${table}`);
      }),
    } as any;

    const result = await listCampaignCompanies(supabase, 'camp-1');

    expect(result.companies[0]).toMatchObject({
      company_id: 'comp-1',
      company_name: 'Alpha',
      website: 'https://alpha.example',
      employee_count: 42,
      region: 'Москва',
      office_qualification: 'Less',
      company_description: 'Alpha description',
    });
  });

  it('listCampaignOutbounds returns operator-facing send ledger rows', async () => {
    const campaignSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'camp-1',
        name: 'Q1 Push',
        status: 'review',
        segment_id: 'segment-1',
        segment_version: 2,
        created_at: '2026-03-15T10:00:00Z',
        updated_at: '2026-03-15T11:00:00Z',
      },
      error: null,
    });
    const campaignEq = vi.fn().mockReturnValue({ single: campaignSingle });
    const campaignSelect = vi.fn().mockReturnValue({ eq: campaignEq });

    const outboundOrderSent = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'out-1',
          status: 'sent',
          provider: 'imap_mcp',
          provider_message_id: '<msg-1@example.com>',
          sender_identity: 'sales-1@example.com',
          sent_at: '2026-03-15T12:00:00Z',
          created_at: '2026-03-15T12:00:00Z',
          error: null,
          pattern_mode: 'direct',
          draft_id: 'draft-1',
          contact_id: 'contact-1',
          company_id: 'company-1',
          metadata: {
            recipient_email: 'alice@example.com',
            recipient_email_source: 'work',
            recipient_email_kind: 'corporate',
          },
        },
      ],
      error: null,
    });
    const outboundEq = vi.fn().mockReturnValue({ order: outboundOrderSent });
    const outboundSelect = vi.fn().mockReturnValue({ eq: outboundEq });

    const draftsIn = vi.fn().mockResolvedValue({
      data: [{ id: 'draft-1', email_type: 'intro', status: 'sent', subject: 'Hello there' }],
      error: null,
    });
    const draftsSelect = vi.fn().mockReturnValue({ in: draftsIn });

    const contactsIn = vi.fn().mockResolvedValue({
      data: [{ id: 'contact-1', full_name: 'Alice Doe', position: 'CEO' }],
      error: null,
    });
    const contactsSelect = vi.fn().mockReturnValue({ in: contactsIn });

    const companiesIn = vi.fn().mockResolvedValue({
      data: [{ id: 'company-1', company_name: 'Example Co', website: 'https://example.com' }],
      error: null,
    });
    const companiesSelect = vi.fn().mockReturnValue({ in: companiesIn });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'campaigns') {
          return { select: campaignSelect };
        }
        if (table === 'email_outbound') {
          return { select: outboundSelect };
        }
        if (table === 'drafts') {
          return { select: draftsSelect };
        }
        if (table === 'employees') {
          return { select: contactsSelect };
        }
        if (table === 'companies') {
          return { select: companiesSelect };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    } as any;

    const result = await listCampaignOutbounds(supabase, 'camp-1');

    expect(outboundSelect).toHaveBeenCalledWith(
      'id,status,provider,provider_message_id,sender_identity,sent_at,error,pattern_mode,metadata,draft_id,contact_id,company_id'
    );
    expect(outboundEq).toHaveBeenCalledWith('campaign_id', 'camp-1');
    expect(result.campaign.status).toBe('review');
    expect(result.outbounds[0]).toMatchObject({
      id: 'out-1',
      provider: 'imap_mcp',
      subject: 'Hello there',
      contact_name: 'Alice Doe',
      company_name: 'Example Co',
      recipient_email: 'alice@example.com',
      recipient_email_source: 'work',
      recipient_email_kind: 'corporate',
    });
  });
});
