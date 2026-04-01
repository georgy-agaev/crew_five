import { describe, expect, it, vi } from 'vitest';

import { getCampaignReadModel } from '../src/services/campaignDetailReadModel';

describe('campaignDetailReadModel', () => {
  it('returns campaign, segment, icp, and company employee drill-down', async () => {
    const offersSelect = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({
        data: [{ id: 'offer-1', project_id: 'project-1', title: 'Negotiation room audit', project_name: 'VoiceXpert' }],
        error: null,
      }),
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'offer-1',
            project_id: 'project-1',
            title: 'Negotiation room audit',
            project_name: 'VoiceXpert',
            description: 'Audit offer',
            status: 'active',
          },
          error: null,
        }),
      }),
    });
    const segmentMembersSelect = vi.fn().mockReturnValue({
      match: vi.fn().mockResolvedValue({
        data: [
          {
            company_id: 'company-1',
            contact_id: 'contact-1',
            snapshot: {
              company: {
                company_name: 'ООО Пример',
                company_description: 'Описание бизнеса',
                website: 'https://example.ru',
                employee_count: 55,
                region: 'Москва',
                office_qualification: 'More',
                company_research: { providers: { exa: {} }, lastUpdatedAt: '2026-03-10T10:00:00Z' },
              },
            },
          },
        ],
        error: null,
      }),
    });
    const campaignMemberAdditionsSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'campaigns') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'camp-1', project_id: 'project-1', offer_id: 'offer-1', icp_hypothesis_id: 'hyp-camp-1' }],
                error: null,
              }),
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'camp-1',
                    name: 'Q1 Push',
                    status: 'review',
                    segment_id: 'segment-1',
                    segment_version: 2,
                    project_id: 'project-1',
                    offer_id: 'offer-1',
                    icp_hypothesis_id: 'hyp-camp-1',
                    created_at: '2026-03-15T10:00:00Z',
                    updated_at: '2026-03-15T11:00:00Z',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'segments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'segment-1',
                    name: 'SMB Moscow',
                    icp_profile_id: 'icp-1',
                    icp_hypothesis_id: 'hyp-1',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'icp_profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'icp-1',
                    name: 'VoiceXpert ICP',
                    project_id: 'project-1',
                    description: 'Teams running audit-heavy negotiation rooms',
                    offering_domain: 'voicexpert.ru',
                    company_criteria: { industries: ['Audit', 'Legal'] },
                    persona_criteria: { roles: ['Finance Director', 'Office Lead'] },
                    phase_outputs: { phase1: { valueProp: 'Audit negotiation room refresh' } },
                    learnings: ['Avoid generic AV language'],
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'icp_hypotheses') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'hyp-camp-1', icp_id: 'icp-1' }],
                error: null,
              }),
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'hyp-camp-1',
                    hypothesis_label: 'Operational audit hypothesis',
                    icp_id: 'icp-1',
                    status: 'active',
                    offer_id: 'offer-1',
                    messaging_angle: 'Negotiation room refresh for audit-heavy teams',
                    search_config: { audience: 'audit-heavy' },
                    targeting_defaults: { country: 'RU' },
                    pattern_defaults: { intro: 'direct' },
                    notes: 'Prioritize negotiation room language',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'projects') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'project-1',
                    key: 'vx',
                    name: 'VoiceXpert Workspace',
                    description: 'Primary outbound workspace',
                    status: 'active',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'offers') {
          return {
            select: offersSelect,
          };
        }
        if (table === 'segment_members') {
          return {
            select: segmentMembersSelect,
          };
        }
        if (table === 'campaign_member_additions') {
          return {
            select: campaignMemberAdditionsSelect,
          };
        }
        if (table === 'campaign_member_exclusions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === 'companies') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'company-1',
                    company_research: { providers: { exa: {} }, lastUpdatedAt: '2026-03-10T10:00:00Z' },
                    updated_at: '2026-03-10T10:00:00Z',
                  },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === 'employees') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'contact-1',
                    company_id: 'company-1',
                    full_name: 'Инна Федина',
                    position: 'Финансовый директор',
                    work_email: 'inna@example.ru',
                    generic_email: 'info@example.ru',
                  },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === 'drafts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'draft-intro-1',
                    contact_id: 'contact-1',
                    company_id: 'company-1',
                    email_type: 'intro',
                    status: 'approved',
                  },
                  {
                    id: 'draft-bump-1',
                    contact_id: 'contact-1',
                    company_id: 'company-1',
                    email_type: 'bump',
                    status: 'generated',
                  },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === 'email_outbound') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'out-1',
                    campaign_id: 'camp-1',
                    contact_id: 'contact-1',
                    company_id: 'company-1',
                    draft_id: 'draft-intro-1',
                    status: 'sent',
                    sent_at: '2026-03-12T10:00:00Z',
                    metadata: null,
                  },
                ],
                error: null,
              }),
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'out-1',
                    campaign_id: 'camp-1',
                    contact_id: 'contact-1',
                    company_id: 'company-1',
                    draft_id: 'draft-intro-1',
                    status: 'sent',
                    sent_at: '2026-03-12T10:00:00Z',
                  },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === 'email_events') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  {
                    outbound_id: 'out-1',
                    event_type: 'replied',
                    occurred_at: '2026-03-13T10:00:00Z',
                  },
                ],
                error: null,
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    const result = await getCampaignReadModel(client, 'camp-1');

    expect(segmentMembersSelect).toHaveBeenCalledWith('company_id,contact_id');
    expect(campaignMemberAdditionsSelect).toHaveBeenCalledWith(
      'campaign_id,company_id,contact_id,source,attached_at'
    );
    expect(offersSelect).toHaveBeenCalledWith(
      'id,project_id,title,project_name,description,status,created_at,updated_at'
    );

    expect(result.campaign.name).toBe('Q1 Push');
    expect(result.segment).toMatchObject({
      id: 'segment-1',
      name: 'SMB Moscow',
    });
    expect(result.icp_profile).toMatchObject({
      id: 'icp-1',
      name: 'VoiceXpert ICP',
      description: 'Teams running audit-heavy negotiation rooms',
      offering_domain: 'voicexpert.ru',
      company_criteria: { industries: ['Audit', 'Legal'] },
      persona_criteria: { roles: ['Finance Director', 'Office Lead'] },
      phase_outputs: { phase1: { valueProp: 'Audit negotiation room refresh' } },
      learnings: ['Avoid generic AV language'],
    });
    expect(result.icp_hypothesis).toMatchObject({
      id: 'hyp-camp-1',
      icp_id: 'icp-1',
      name: 'Operational audit hypothesis',
      status: 'active',
      offer_id: 'offer-1',
      messaging_angle: 'Negotiation room refresh for audit-heavy teams',
      search_config: { audience: 'audit-heavy' },
      targeting_defaults: { country: 'RU' },
      pattern_defaults: { intro: 'direct' },
      notes: 'Prioritize negotiation room language',
    });
    expect(result.offer).toMatchObject({
      id: 'offer-1',
      project_id: 'project-1',
      title: 'Negotiation room audit',
      project_name: 'VoiceXpert',
      status: 'active',
    });
    expect(result.project).toMatchObject({
      id: 'project-1',
      key: 'vx',
      name: 'VoiceXpert Workspace',
      status: 'active',
    });
    expect(result.companies).toHaveLength(1);
    expect(result.companies[0]).toMatchObject({
      company_id: 'company-1',
      company_name: 'ООО Пример',
      contact_count: 1,
      composition_summary: {
        total_contacts: 1,
        segment_snapshot_contacts: 1,
        manual_attach_contacts: 0,
      },
      employees: [
        {
          contact_id: 'contact-1',
          full_name: 'Инна Федина',
          position: 'Финансовый директор',
          audience_source: 'segment_snapshot',
          attached_at: null,
          work_email: 'inna@example.ru',
          generic_email: 'info@example.ru',
          draft_counts: {
            total: 2,
            intro: 1,
            bump: 1,
            approved: 1,
            generated: 1,
            rejected: 0,
            sent: 0,
          },
          outbound_count: 1,
          replied: true,
          exposure_summary: {
            total_exposures: 1,
            last_icp_hypothesis_id: 'hyp-camp-1',
            last_offer_id: 'offer-1',
            last_offer_title: 'Negotiation room audit',
            last_sent_at: '2026-03-12T10:00:00Z',
          },
        },
      ],
    });
    expect(result.companies[0].employees[0].execution_exposures).toEqual([
      expect.objectContaining({
        campaign_id: 'camp-1',
        icp_hypothesis_id: 'hyp-camp-1',
        offer_id: 'offer-1',
        offer_title: 'Negotiation room audit',
        project_name: 'VoiceXpert',
      }),
    ]);
  });

  it('includes manually attached employees in the campaign read model', async () => {
    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'campaigns') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'camp-1', offer_id: null, icp_hypothesis_id: null }],
                error: null,
              }),
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'camp-1',
                    name: 'Q1 Push',
                    status: 'review',
                    segment_id: 'segment-1',
                    segment_version: 2,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'segments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'segment-1', name: 'SMB Moscow', icp_profile_id: null, icp_hypothesis_id: null },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'segment_members') {
          return {
            select: vi.fn().mockReturnValue({
              match: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === 'campaign_member_additions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    campaign_id: 'camp-1',
                    company_id: 'company-2',
                    contact_id: 'contact-2',
                    source: 'manual_attach',
                    snapshot: {
                      contact: { full_name: 'Боб', work_email: 'bob@example.ru', position: 'CTO' },
                      company: { company_name: 'ООО Бета', company_description: 'Описание', employee_count: 10 },
                    },
                    attached_at: '2026-03-21T12:00:00Z',
                  },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === 'campaign_member_exclusions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === 'companies') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'company-2', company_research: null, updated_at: null }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'employees') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'contact-2',
                    company_id: 'company-2',
                    full_name: 'Боб',
                    position: 'CTO',
                    work_email: 'bob@example.ru',
                    generic_email: null,
                  },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === 'drafts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === 'email_outbound') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === 'email_events') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    const result = await getCampaignReadModel(client, 'camp-1');

    expect(result.companies).toHaveLength(1);
    expect(result.companies[0].company_id).toBe('company-2');
    expect(result.companies[0].employees[0]).toMatchObject({
      contact_id: 'contact-2',
      full_name: 'Боб',
      work_email: 'bob@example.ru',
      audience_source: 'manual_attach',
      attached_at: '2026-03-21T12:00:00Z',
    });
    expect(result.companies[0].composition_summary).toMatchObject({
      total_contacts: 1,
      segment_snapshot_contacts: 0,
      manual_attach_contacts: 1,
    });
  });

  it('degrades optional context to null instead of failing the whole read model', async () => {
    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'campaigns') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'camp-1', offer_id: null, icp_hypothesis_id: null }],
                error: null,
              }),
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'camp-1',
                    name: 'Q1 Push',
                    status: 'review',
                    segment_id: 'segment-1',
                    segment_version: 2,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'segments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: new Error('segments lookup failed'),
                }),
              }),
            }),
          };
        }
        if (table === 'segment_members') {
          return {
            select: vi.fn().mockReturnValue({
              match: vi.fn().mockResolvedValue({
                data: [
                  {
                    company_id: 'company-1',
                    contact_id: 'contact-1',
                    snapshot: {
                      company: { company_name: 'ООО Пример' },
                      contact: { full_name: 'Инна Федина', work_email: 'inna@example.ru' },
                    },
                  },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === 'campaign_member_additions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === 'campaign_member_exclusions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === 'companies') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'company-1', company_research: null, updated_at: null }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'employees') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'contact-1',
                    company_id: 'company-1',
                    full_name: 'Инна Федина',
                    position: 'CEO',
                    work_email: 'inna@example.ru',
                    generic_email: null,
                  },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === 'drafts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === 'email_outbound') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === 'email_events') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    const result = await getCampaignReadModel(client, 'camp-1');

    expect(result.segment).toBeNull();
    expect(result.icp_profile).toBeNull();
    expect(result.icp_hypothesis).toBeNull();
    expect(result.companies[0].employees[0].contact_id).toBe('contact-1');
  });

  it('chunks employee lookups for large campaign audiences', async () => {
    const employeeIdChunks: string[][] = [];
    const contactIds = Array.from({ length: 205 }, (_, index) => `contact-${index + 1}`);

    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'campaigns') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'camp-1',
                    name: 'Q1 Push',
                    status: 'review',
                    segment_id: 'segment-1',
                    segment_version: 2,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'segments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'segment-1',
                    name: 'SMB Moscow',
                    icp_profile_id: null,
                    icp_hypothesis_id: null,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'segment_members') {
          return {
            select: vi.fn().mockReturnValue({
              match: vi.fn().mockResolvedValue({
                data: contactIds.map((contactId, index) => ({
                  company_id: 'company-1',
                  contact_id: contactId,
                  snapshot: {
                    company: { company_name: 'ООО Пример' },
                    contact: { full_name: `Контакт ${index + 1}`, work_email: `${contactId}@example.ru` },
                  },
                })),
                error: null,
              }),
            }),
          };
        }
        if (table === 'campaign_member_additions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === 'campaign_member_exclusions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === 'companies') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'company-1', company_research: null, updated_at: null }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'employees') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockImplementation(async (_field: string, ids: string[]) => {
                employeeIdChunks.push(ids);
                return {
                  data: ids.map((id) => ({
                    id,
                    company_id: 'company-1',
                    full_name: id,
                    position: 'CEO',
                    work_email: `${id}@example.ru`,
                    generic_email: null,
                  })),
                  error: null,
                };
              }),
            }),
          };
        }
        if (table === 'drafts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === 'email_outbound') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === 'email_events') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    const result = await getCampaignReadModel(client, 'camp-1');

    expect(result.companies[0].employees).toHaveLength(205);
    expect(employeeIdChunks).toHaveLength(3);
    expect(employeeIdChunks.map((chunk) => chunk.length)).toEqual([100, 100, 5]);
  });

  it('exposes per-contact block reasons and company composition summary', async () => {
    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'campaigns') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'camp-1', offer_id: null, icp_hypothesis_id: null }],
                error: null,
              }),
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'camp-1',
                    name: 'Q1 Push',
                    status: 'review',
                    segment_id: 'segment-1',
                    segment_version: 2,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'segments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'segment-1',
                    name: 'SMB Moscow',
                    icp_profile_id: null,
                    icp_hypothesis_id: null,
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'segment_members') {
          return {
            select: vi.fn().mockReturnValue({
              match: vi.fn().mockResolvedValue({
                data: [
                  { company_id: 'company-1', contact_id: 'contact-1', snapshot: { company: { company_name: 'ООО Пример' } } },
                  { company_id: 'company-1', contact_id: 'contact-2', snapshot: { company: { company_name: 'ООО Пример' } } },
                  { company_id: 'company-1', contact_id: 'contact-3', snapshot: { company: { company_name: 'ООО Пример' } } },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === 'campaign_member_additions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === 'campaign_member_exclusions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === 'companies') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'company-1', company_research: null, updated_at: null }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'employees') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'contact-1',
                    company_id: 'company-1',
                    full_name: 'Нет Email',
                    position: 'CEO',
                    work_email: null,
                    work_email_status: null,
                    generic_email: null,
                    generic_email_status: null,
                  },
                  {
                    id: 'contact-2',
                    company_id: 'company-1',
                    full_name: 'Был bounce',
                    position: 'CTO',
                    work_email: 'cto@example.ru',
                    work_email_status: 'valid',
                    generic_email: null,
                    generic_email_status: null,
                  },
                  {
                    id: 'contact-3',
                    company_id: 'company-1',
                    full_name: 'Уже использован',
                    position: 'CFO',
                    work_email: 'cfo@example.ru',
                    work_email_status: 'valid',
                    generic_email: null,
                    generic_email_status: null,
                  },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === 'drafts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === 'email_outbound') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'out-2',
                    campaign_id: 'camp-1',
                    contact_id: 'contact-2',
                    company_id: 'company-1',
                    draft_id: null,
                    status: 'sent',
                    sent_at: null,
                    metadata: null,
                  },
                  {
                    id: 'out-3',
                    campaign_id: 'camp-1',
                    contact_id: 'contact-3',
                    company_id: 'company-1',
                    draft_id: null,
                    status: 'sent',
                    sent_at: null,
                    metadata: null,
                  },
                ],
                error: null,
              }),
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: 'out-2', contact_id: 'contact-2', company_id: 'company-1', draft_id: null, status: 'sent' },
                  { id: 'out-3', contact_id: 'contact-3', company_id: 'company-1', draft_id: null, status: 'sent' },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === 'email_events') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  { outbound_id: 'out-2', event_type: 'bounced' },
                  { outbound_id: 'out-2', event_type: 'unsubscribed' },
                ],
                error: null,
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    const result = await getCampaignReadModel(client, 'camp-1');
    const company = result.companies[0];
    const noEmail = company.employees.find((employee) => employee.contact_id === 'contact-1');
    const bounced = company.employees.find((employee) => employee.contact_id === 'contact-2');
    const alreadyUsed = company.employees.find((employee) => employee.contact_id === 'contact-3');

    expect(noEmail).toMatchObject({
      sendable: false,
      block_reasons: ['no_sendable_email'],
      eligible_for_new_intro: false,
    });
    expect(bounced).toMatchObject({
      sendable: true,
      block_reasons: ['bounced', 'unsubscribed', 'already_used'],
      eligible_for_new_intro: false,
    });
    expect(alreadyUsed).toMatchObject({
      sendable: true,
      block_reasons: ['already_used'],
      eligible_for_new_intro: false,
    });
    expect(company.composition_summary).toEqual({
      total_contacts: 3,
      segment_snapshot_contacts: 3,
      manual_attach_contacts: 0,
      sendable_contacts: 2,
      eligible_for_new_intro_contacts: 0,
      blocked_no_sendable_email_contacts: 1,
      blocked_bounced_contacts: 1,
      blocked_unsubscribed_contacts: 1,
      blocked_already_used_contacts: 2,
      contacts_with_drafts: 0,
      contacts_with_sent_outbound: 2,
    });
  });
});
