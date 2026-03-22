import { describe, expect, it, vi } from 'vitest';

import {
  getAnalyticsByOffer,
  getAnalyticsByOffering,
  getAnalyticsByHypothesis,
  getAnalyticsByIcpAndHypothesis,
  getAnalyticsByPatternAndUserEdit,
  getAnalyticsByRecipientType,
  getAnalyticsByRejectionReason,
  getAnalyticsBySenderIdentity,
  getCampaignFunnelAnalytics,
  getAnalyticsBySegmentAndRole,
} from '../src/services/analytics';
import { createProgram } from '../src/cli';

describe('analytics service', () => {
  it('analytics_icp_hypothesis_groups_metrics_by_ids_correctly', async () => {
    const rows = [
      {
        icp_profile_id: 'icp-1',
        icp_hypothesis_id: 'hypo-1',
        event_type: 'delivered',
        outcome_classification: null,
        occurred_at: '2025-01-01T00:00:00Z',
      },
      {
        icp_profile_id: 'icp-1',
        icp_hypothesis_id: 'hypo-1',
        event_type: 'opened',
        outcome_classification: null,
        occurred_at: '2025-01-01T01:00:00Z',
      },
      {
        icp_profile_id: 'icp-1',
        icp_hypothesis_id: 'hypo-1',
        event_type: 'replied',
        outcome_classification: 'meeting',
        occurred_at: '2025-01-01T02:00:00Z',
      },
    ];

    const select = vi.fn().mockReturnValue(Promise.resolve({ data: rows, error: null }));
    const from = vi.fn().mockReturnValue({ select, gte: vi.fn().mockReturnValue({ select }) });
    const client = { from } as any;

    const result = await getAnalyticsByIcpAndHypothesis(client, {});

    expect(from).toHaveBeenCalledWith('analytics_events_flat');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        icp_profile_id: 'icp-1',
        icp_hypothesis_id: 'hypo-1',
        delivered: 1,
        opened: 1,
        replied: 1,
        positive_replies: 1,
      })
    );
  });

  it('analytics_segment_role_breakdown_includes_segment_version_and_role', async () => {
    const rows = [
      {
        segment_id: 'seg-1',
        segment_version: 2,
        role: 'CTO',
        event_type: 'opened',
        outcome_classification: null,
      },
    ];
    const select = vi.fn().mockReturnValue(Promise.resolve({ data: rows, error: null }));
    const from = vi.fn().mockReturnValue({ select, gte: vi.fn().mockReturnValue({ select }) });
    const client = { from } as any;

    const result = await getAnalyticsBySegmentAndRole(client, {});

    expect(from).toHaveBeenCalledWith('analytics_events_flat');
    expect(result).toEqual([
      {
        segment_id: 'seg-1',
        segment_version: 2,
        role: 'CTO',
        delivered: 0,
        opened: 1,
        replied: 0,
        positive_replies: 0,
      },
    ]);
  });

  it('analytics_pattern_user_edit_splits_ai_only_vs_edited', async () => {
    const rows = [
      {
        draft_pattern: 'intro_v1:standard:A',
        user_edited: false,
        event_type: 'replied',
        outcome_classification: 'soft_interest',
      },
      {
        draft_pattern: 'intro_v1:standard:A',
        user_edited: true,
        event_type: 'replied',
        outcome_classification: 'meeting',
      },
    ];
    const select = vi.fn().mockReturnValue(Promise.resolve({ data: rows, error: null }));
    const from = vi.fn().mockReturnValue({ select, gte: vi.fn().mockReturnValue({ select }) });
    const client = { from } as any;

    const result = await getAnalyticsByPatternAndUserEdit(client, {});

    expect(from).toHaveBeenCalledWith('analytics_events_flat');
    expect(result).toEqual([
      {
        draft_pattern: 'intro_v1:standard:A',
        user_edited: false,
        delivered: 0,
        opened: 0,
        replied: 1,
        positive_replies: 1,
      },
      {
        draft_pattern: 'intro_v1:standard:A',
        user_edited: true,
        delivered: 0,
        opened: 0,
        replied: 1,
        positive_replies: 1,
      },
    ]);
  });

  it('analytics_rejection_reason_groups_rejected_drafts_by_primary_reason', async () => {
    const rows = [
      {
        status: 'rejected',
        updated_at: '2026-03-16T10:00:00Z',
        metadata: { review_reason_code: 'marketing_tone' },
      },
      {
        status: 'rejected',
        updated_at: '2026-03-16T11:00:00Z',
        metadata: { review_reason_code: 'marketing_tone' },
      },
      {
        status: 'rejected',
        updated_at: '2026-03-16T12:00:00Z',
        metadata: { review_reason_code: 'too_generic' },
      },
    ];
    const eq = vi.fn().mockReturnValue(Promise.resolve({ data: rows, error: null }));
    const select = vi.fn().mockReturnValue({ eq, gte: vi.fn().mockReturnValue({ eq }) });
    const from = vi.fn().mockReturnValue({ select });
    const client = { from } as any;

    const result = await getAnalyticsByRejectionReason(client, {});

    expect(from).toHaveBeenCalledWith('drafts');
    expect(result).toEqual([
      { review_reason_code: 'marketing_tone', count: 2 },
      { review_reason_code: 'too_generic', count: 1 },
    ]);
  });

  it('analytics_offering_groups_event_metrics_by_draft_offering_domain', async () => {
    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'email_events') {
          return {
            select: vi.fn().mockReturnValue(
              Promise.resolve({
                data: [
                  {
                    draft_id: 'draft-1',
                    outbound_id: 'out-1',
                    event_type: 'delivered',
                    outcome_classification: null,
                    occurred_at: '2026-03-16T10:00:00Z',
                  },
                  {
                    draft_id: 'draft-1',
                    outbound_id: 'out-1',
                    event_type: 'replied',
                    outcome_classification: 'meeting',
                    occurred_at: '2026-03-16T11:00:00Z',
                  },
                ],
                error: null,
              })
            ),
          };
        }
        if (table === 'drafts') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'draft-1',
                    metadata: { offering_domain: 'voicexpert.ru' },
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
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    const result = await getAnalyticsByOffering(client, {});

    expect(result).toEqual([
      {
        offering_domain: 'voicexpert.ru',
        delivered: 1,
        opened: 0,
        replied: 1,
        positive_replies: 1,
      },
    ]);
  });

  it('analytics_offer_groups_event_metrics_by_campaign_offer_id', async () => {
    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'email_events') {
          return {
            select: vi.fn().mockReturnValue(
              Promise.resolve({
                data: [
                  {
                    draft_id: null,
                    outbound_id: 'out-1',
                    event_type: 'delivered',
                    outcome_classification: null,
                    occurred_at: '2026-03-16T10:00:00Z',
                  },
                  {
                    draft_id: null,
                    outbound_id: 'out-1',
                    event_type: 'replied',
                    outcome_classification: 'meeting',
                    occurred_at: '2026-03-16T11:00:00Z',
                  },
                ],
                error: null,
              })
            ),
          };
        }
        if (table === 'email_outbound') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'out-1', draft_id: 'draft-1', campaign_id: 'camp-1' }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'campaigns') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'camp-1', offer_id: 'offer-1' }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'offers') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'offer-1',
                    title: 'Negotiation room audit',
                    project_name: 'VoiceXpert',
                    status: 'active',
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

    const result = await getAnalyticsByOffer(client, {});

    expect(result).toEqual([
      {
        offer_id: 'offer-1',
        offer_title: 'Negotiation room audit',
        project_name: 'VoiceXpert',
        delivered: 1,
        opened: 0,
        replied: 1,
        positive_replies: 1,
      },
    ]);
  });

  it('analytics_hypothesis_groups_event_metrics_by_campaign_hypothesis', async () => {
    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'email_events') {
          return {
            select: vi.fn().mockReturnValue(
              Promise.resolve({
                data: [
                  { outbound_id: 'out-1', event_type: 'delivered', outcome_classification: null },
                  { outbound_id: 'out-1', event_type: 'replied', outcome_classification: 'meeting' },
                ],
                error: null,
              })
            ),
          };
        }
        if (table === 'email_outbound') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'out-1',
                    draft_id: null,
                    campaign_id: 'camp-1',
                    sender_identity: 'sales@example.com',
                    recipient_email_source: 'work',
                    recipient_email_kind: 'corporate',
                  },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === 'campaigns') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'camp-1', offer_id: 'offer-1', icp_hypothesis_id: 'hyp-1' }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'icp_hypotheses') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'hyp-1', hypothesis_label: 'Audit-heavy finance teams' }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'offers') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'offer-1', title: 'Negotiation room audit', project_name: 'VoiceXpert' }],
                error: null,
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    const result = await getAnalyticsByHypothesis(client, {});

    expect(result).toEqual([
      {
        icp_hypothesis_id: 'hyp-1',
        hypothesis_label: 'Audit-heavy finance teams',
        offer_id: 'offer-1',
        offer_title: 'Negotiation room audit',
        project_name: 'VoiceXpert',
        delivered: 1,
        opened: 0,
        replied: 1,
        positive_replies: 1,
      },
    ]);
  });

  it('analytics_recipient_type_groups_event_metrics_by_outbound_recipient_kind', async () => {
    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'email_events') {
          return {
            select: vi.fn().mockReturnValue(
              Promise.resolve({
                data: [
                  { outbound_id: 'out-1', event_type: 'delivered', outcome_classification: null },
                  { outbound_id: 'out-2', event_type: 'replied', outcome_classification: 'meeting' },
                ],
                error: null,
              })
            ),
          };
        }
        if (table === 'email_outbound') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  { id: 'out-1', recipient_email_kind: 'corporate' },
                  { id: 'out-2', recipient_email_kind: 'generic' },
                ],
                error: null,
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    const result = await getAnalyticsByRecipientType(client, {});

    expect(result).toEqual([
      {
        recipient_email_kind: 'corporate',
        delivered: 1,
        opened: 0,
        replied: 0,
        positive_replies: 0,
      },
      {
        recipient_email_kind: 'generic',
        delivered: 0,
        opened: 0,
        replied: 1,
        positive_replies: 1,
      },
    ]);
  });

  it('analytics_sender_identity_groups_event_metrics_by_outbound_sender', async () => {
    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'email_events') {
          return {
            select: vi.fn().mockReturnValue(
              Promise.resolve({
                data: [
                  { outbound_id: 'out-1', event_type: 'opened', outcome_classification: null },
                  { outbound_id: 'out-2', event_type: 'replied', outcome_classification: 'soft_interest' },
                ],
                error: null,
              })
            ),
          };
        }
        if (table === 'email_outbound') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  { id: 'out-1', sender_identity: 'sales-1@example.com' },
                  { id: 'out-2', sender_identity: 'sales-2@example.com' },
                ],
                error: null,
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    const result = await getAnalyticsBySenderIdentity(client, {});

    expect(result).toEqual([
      {
        sender_identity: 'sales-1@example.com',
        delivered: 0,
        opened: 1,
        replied: 0,
        positive_replies: 0,
      },
      {
        sender_identity: 'sales-2@example.com',
        delivered: 0,
        opened: 0,
        replied: 1,
        positive_replies: 1,
      },
    ]);
  });

  it('campaign_funnel_returns_sequence_counts_and_rejection_reasons', async () => {
    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'drafts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'draft-intro-1',
                    campaign_id: 'camp-1',
                    email_type: 'intro',
                    status: 'approved',
                    metadata: {},
                  },
                  {
                    id: 'draft-intro-2',
                    campaign_id: 'camp-1',
                    email_type: 'intro',
                    status: 'rejected',
                    metadata: { review_reason_code: 'marketing_tone' },
                  },
                  {
                    id: 'draft-bump-1',
                    campaign_id: 'camp-1',
                    email_type: 'bump',
                    status: 'approved',
                    metadata: {},
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
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'out-intro-1',
                    campaign_id: 'camp-1',
                    draft_id: 'draft-intro-1',
                    status: 'sent',
                  },
                  {
                    id: 'out-bump-1',
                    campaign_id: 'camp-1',
                    draft_id: 'draft-bump-1',
                    status: 'sent',
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
                  { outbound_id: 'out-intro-1', event_type: 'replied' },
                  { outbound_id: 'out-bump-1', event_type: 'bounced' },
                ],
                error: null,
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    const result = await getCampaignFunnelAnalytics(client, 'camp-1');

    expect(result).toEqual({
      campaign_id: 'camp-1',
      funnel: {
        drafts_generated: 3,
        drafts_approved: 2,
        drafts_rejected: 1,
        intro_sent: 1,
        intro_replied: 1,
        intro_bounced: 0,
        intro_unsubscribed: 0,
        bump_generated: 1,
        bump_approved: 1,
        bump_sent: 1,
        bump_replied: 0,
      },
      rejection_reasons: {
        marketing_tone: 1,
      },
    });
  });

  it('email_event_fks_are_present_for_recent_inserts (sanity helper)', async () => {
    const fkRow = {
      draft_id: 'd1',
      send_job_id: 'job-1',
      segment_id: 'seg-1',
      segment_version: 2,
      employee_id: 'emp-1',
      icp_profile_id: 'icp-1',
      icp_hypothesis_id: 'hyp-1',
      pattern_id: 'p1',
      coach_prompt_id: 'coach-1',
    };
    const select = vi.fn().mockReturnValue(Promise.resolve({ data: [fkRow], error: null }));
    const limit = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ select, limit });
    const client = { from } as any;

    const query: any = client
      .from('analytics_events_flat')
      .select(
        'draft_id, send_job_id, segment_id, segment_version, employee_id, icp_profile_id, icp_hypothesis_id, pattern_id, coach_prompt_id'
      );
    const { data, error } = (await (typeof query.limit === 'function' ? query.limit(5) : query)) as any;
    expect(error).toBeNull();
    expect(data?.[0]).toMatchObject({
      draft_id: 'd1',
      send_job_id: 'job-1',
      segment_id: 'seg-1',
      segment_version: 2,
      employee_id: 'emp-1',
      icp_profile_id: 'icp-1',
      icp_hypothesis_id: 'hyp-1',
      pattern_id: 'p1',
      coach_prompt_id: 'coach-1',
    });
  });
});

describe('analytics CLI', () => {
  it('analytics_summary_command_prints_key_metrics_for_recent_range', async () => {
    const rows = [
      {
        icp_profile_id: 'icp-1',
        icp_hypothesis_id: 'hypo-1',
        event_type: 'delivered',
        outcome_classification: null,
        occurred_at: '2025-01-01T00:00:00Z',
      },
    ];

    const select = vi.fn().mockReturnValue(Promise.resolve({ data: rows, error: null }));
    const gte = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ select, gte });
    const supabaseClient = { from } as any;

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      smartleadClient: {} as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'analytics:summary',
      '--group-by',
      'icp',
      '--since',
      '2025-01-01T00:00:00Z',
    ]);

    expect(logSpy).toHaveBeenCalled();
    const printed = (logSpy.mock.calls[0] as any[])[0] as string;
    expect(printed).toMatch(/icp_profile_id/);

    logSpy.mockRestore();
  });

  it('analytics_queries_handle_no_data_without_throwing', async () => {
    const select = vi.fn().mockReturnValue(Promise.resolve({ data: null, error: null }));
    const gte = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ select, gte });
    const supabaseClient = { from } as any;

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      smartleadClient: {} as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync(['node', 'gtm', 'analytics:summary', '--group-by', 'icp']);

    expect(logSpy).toHaveBeenCalled();
    const printed = (logSpy.mock.calls[0] as any[])[0] as string;
    expect(printed).toMatch(/results/);

    logSpy.mockRestore();
  });

  it('analytics_summary_formats_pattern_group', async () => {
    const rows = [
      {
        draft_pattern: 'intro_v1:standard:A',
        user_edited: false,
        event_type: 'delivered',
        outcome_classification: null,
      },
    ];
    const select = vi.fn().mockReturnValue(Promise.resolve({ data: rows, error: null }));
    const gte = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ select, gte });
    const supabaseClient = { from } as any;

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      smartleadClient: {} as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync(['node', 'gtm', 'analytics:summary', '--group-by', 'pattern']);

    const payload = JSON.parse((logSpy.mock.calls[0] as any[])[0] as string);
    expect(payload.groupBy).toBe('pattern');
    expect(payload.results[0]).toHaveProperty('draft_pattern');

    logSpy.mockRestore();
  });

  it('analytics_summary_accepts_error_format_json_without_unknown_option', async () => {
    const rows = [
      {
        draft_pattern: 'intro_v1:standard:A',
        user_edited: false,
        event_type: 'delivered',
        outcome_classification: null,
      },
    ];
    const select = vi.fn().mockReturnValue(Promise.resolve({ data: rows, error: null }));
    const gte = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ select, gte });
    const supabaseClient = { from } as any;

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      smartleadClient: {} as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'analytics:summary',
      '--group-by',
      'pattern',
      '--error-format',
      'json',
    ]);

    const payload = JSON.parse((logSpy.mock.calls[0] as any[])[0] as string);
    expect(payload.groupBy).toBe('pattern');
    expect(payload.results[0]).toHaveProperty('draft_pattern');

    logSpy.mockRestore();
  });

  it('analytics_summary_formats_rejection_reason_group', async () => {
    const supabaseClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'drafts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    status: 'rejected',
                    updated_at: '2026-03-16T10:00:00Z',
                    metadata: { review_reason_code: 'marketing_tone' },
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

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      smartleadClient: {} as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync(['node', 'gtm', 'analytics:summary', '--group-by', 'rejection_reason']);

    const payload = JSON.parse((logSpy.mock.calls[0] as any[])[0] as string);
    expect(payload.groupBy).toBe('rejection_reason');
    expect(payload.results[0]).toHaveProperty('review_reason_code', 'marketing_tone');

    logSpy.mockRestore();
  });

  it('analytics_summary_formats_offer_group', async () => {
    const supabaseClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'email_events') {
          return {
            select: vi.fn().mockReturnValue(
              Promise.resolve({
                data: [
                  {
                    draft_id: null,
                    outbound_id: 'out-1',
                    event_type: 'delivered',
                    outcome_classification: null,
                  },
                ],
                error: null,
              })
            ),
          };
        }
        if (table === 'email_outbound') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'out-1', draft_id: null, campaign_id: 'camp-1' }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'campaigns') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'camp-1', offer_id: 'offer-1' }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'offers') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'offer-1', title: 'Negotiation room audit', project_name: 'VoiceXpert' }],
                error: null,
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      smartleadClient: {} as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync(['node', 'gtm', 'analytics:summary', '--group-by', 'offer']);

    const payload = JSON.parse((logSpy.mock.calls[0] as any[])[0] as string);
    expect(payload.groupBy).toBe('offer');
    expect(payload.results[0]).toHaveProperty('offer_id', 'offer-1');

    logSpy.mockRestore();
  });

  it('analytics_summary_formats_hypothesis_group', async () => {
    const supabaseClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'email_events') {
          return {
            select: vi.fn().mockReturnValue(
              Promise.resolve({
                data: [{ outbound_id: 'out-1', event_type: 'delivered', outcome_classification: null }],
                error: null,
              })
            ),
          };
        }
        if (table === 'email_outbound') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'out-1', campaign_id: 'camp-1' }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'campaigns') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'camp-1', icp_hypothesis_id: 'hyp-1', offer_id: null }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'icp_hypotheses') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'hyp-1', hypothesis_label: 'Audit-heavy finance teams' }],
                error: null,
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      smartleadClient: {} as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync(['node', 'gtm', 'analytics:summary', '--group-by', 'hypothesis']);

    const payload = JSON.parse((logSpy.mock.calls[0] as any[])[0] as string);
    expect(payload.groupBy).toBe('hypothesis');
    expect(payload.results[0]).toHaveProperty('icp_hypothesis_id', 'hyp-1');

    logSpy.mockRestore();
  });

  it('analytics_funnel_command_prints_campaign_funnel_payload', async () => {
    const supabaseClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'drafts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'draft-intro-1',
                    campaign_id: 'camp-1',
                    email_type: 'intro',
                    status: 'approved',
                    metadata: {},
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
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'out-intro-1',
                    campaign_id: 'camp-1',
                    draft_id: 'draft-intro-1',
                    status: 'sent',
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
                data: [{ outbound_id: 'out-intro-1', event_type: 'replied' }],
                error: null,
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      smartleadClient: {} as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'analytics:funnel',
      '--campaign-id',
      'camp-1',
      '--error-format',
      'json',
    ]);

    const payload = JSON.parse((logSpy.mock.calls[0] as any[])[0] as string);
    expect(payload.campaign_id).toBe('camp-1');
    expect(payload.funnel.intro_sent).toBe(1);

    logSpy.mockRestore();
  });
});
