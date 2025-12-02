import { describe, expect, it, vi } from 'vitest';

import { classifyReply, getReplyPatterns, ingestEmailEvent, mapProviderEvent } from '../src/services/emailEvents';

describe('emailEvents', () => {
  it('maps and persists events', async () => {
    const limit = vi.fn().mockResolvedValue({ data: [], error: null });
    const eq2 = vi.fn().mockReturnValue({ limit });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const selectDedup = vi.fn().mockReturnValue({ eq: eq1 });

    const single = vi.fn().mockResolvedValue({ data: { id: 'evt-1' }, error: null });
    const selectInsert = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select: selectInsert });

    const outboundSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'out1', draft_id: null, campaign_id: null, contact_id: 'emp1', metadata: {} },
          error: null,
        }),
      }),
    });

    const client = {
      from: (table: string) => {
        if (table === 'email_events') {
          return { select: selectDedup, insert };
        }
        if (table === 'email_outbound') {
          return { select: outboundSelect };
        }
        return { select: vi.fn(), insert: vi.fn() };
      },
    } as any;

    const payload = {
      provider: 'stub',
      provider_event_id: 'abc',
      event_type: 'delivered',
      contact_id: 'contact-1',
      outbound_id: 'outbound-1',
    };

    const result = await ingestEmailEvent(client, payload);
    expect(insert).toHaveBeenCalled();
    expect(result.inserted).toBe(1);
  });

  it('dedupes on provider_event_id', async () => {
    const limit = vi.fn().mockResolvedValue({ data: [{ id: 'existing' }], error: null });
    const eq2 = vi.fn().mockReturnValue({ limit });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const selectDedup = vi.fn().mockReturnValue({ eq: eq1 });
    const client = {
      from: () => ({
        select: selectDedup,
      }),
    } as any;
    const payload = { provider: 'stub', provider_event_id: 'abc', event_type: 'delivered' };
    const result = await ingestEmailEvent(client, payload);
    expect(result.deduped).toBe(true);
  });

  it('ensures analytics foreign keys are present on mapped event', () => {
    const normalized = mapProviderEvent({
      provider: 'stub',
      provider_event_id: 'evt-123',
      event_type: 'delivered',
      contact_id: 'contact-1',
      outbound_id: 'out-1',
      draft_id: 'draft-1',
      send_job_id: 'job-1',
      segment_id: 'seg-1',
      segment_version: 2,
      employee_id: 'emp-1',
      icp_profile_id: 'icp-1',
      icp_hypothesis_id: 'hyp-1',
      pattern_id: 'pattern-1',
      coach_prompt_id: 'coach-1',
    } as any);

    expect(normalized).toMatchObject({
      segment_id: 'seg-1',
      segment_version: 2,
      draft_id: 'draft-1',
      send_job_id: 'job-1',
      employee_id: 'emp-1',
      icp_profile_id: 'icp-1',
      icp_hypothesis_id: 'hyp-1',
      pattern_id: 'pattern-1',
      coach_prompt_id: 'coach-1',
    });
  });

  it('rejects invalid payload', async () => {
    expect(() => mapProviderEvent({ provider: '', event_type: '' } as any)).toThrow(/provider and event_type/);
  });

  it('supports dry-run without insert', async () => {
    const insert = vi.fn();
    const select = vi.fn().mockReturnValue({ data: [], error: null });
    const client = { from: () => ({ select, insert }) } as any;
    const payload = { provider: 'stub', provider_event_id: 'abc', event_type: 'delivered' };
    const result = await ingestEmailEvent(client, payload, { dryRun: true });
    expect(result.dryRun).toBe(true);
    expect(insert).not.toHaveBeenCalled();
  });

  it('classifies replies', () => {
    expect(classifyReply('reply', null)).toBe('replied');
    expect(classifyReply('delivered', 'meeting')).toBe('positive');
    expect(classifyReply('delivered', 'angry')).toBe('negative');
    expect(classifyReply('delivered', null)).toBeNull();
  });

  it('counts reply patterns with topN and since', async () => {
    const data = [
      { reply_label: 'replied', count: 2 },
      { reply_label: 'positive', count: 1 },
    ];
    const group = vi.fn().mockResolvedValue({ data, error: null });
    const not = vi.fn().mockReturnValue({ gte: vi.fn().mockReturnValue({ group }) });
    const select = vi.fn().mockReturnValue({ not, gte: vi.fn().mockReturnValue({ group }) });
    const client = { from: () => ({ select }) } as any;

    const patterns = await getReplyPatterns(client, { topN: 1, since: '2025-01-01T00:00:00Z' });
    expect(patterns).toEqual([{ reply_label: 'replied', count: 2 }]);
  });

  it('builds stable idempotency when provider_event_id is missing', () => {
    const normalizedA = mapProviderEvent({
      provider: 'stub',
      event_type: 'delivered',
      contact_id: 'c1',
      outbound_id: 'out1',
      occurred_at: '2025-01-01T00:00:00Z',
    });
    const normalizedB = mapProviderEvent({
      provider: 'stub',
      event_type: 'delivered',
      contact_id: 'c1',
      outbound_id: 'out1',
      occurred_at: '2025-01-01T00:00:00Z',
    });
    expect(normalizedA.idempotency_key).toBe(normalizedB.idempotency_key);
  });

  it('enriches events with outbound/draft/campaign context', async () => {
    const selectEvents = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    });
    const selectOutbound = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'out1', draft_id: 'd1', campaign_id: 'camp1', contact_id: 'emp1', metadata: {} },
          error: null,
        }),
      }),
    });
    const selectDraft = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            metadata: {
              draft_pattern: 'p1',
              coach_prompt_id: 'coach-1',
              icp_profile_id: 'icp-1',
              icp_hypothesis_id: 'hyp-1',
            },
            campaign_id: 'camp1',
          },
          error: null,
        }),
      }),
    });
    const selectCampaign = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { segment_id: 'seg-1', segment_version: 2 },
          error: null,
        }),
      }),
    });
    const selectSegment = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { icp_profile_id: 'icp-1', icp_hypothesis_id: 'hyp-1' },
          error: null,
        }),
      }),
    });
    const selectInsert = vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: {}, error: null }),
    });
    const insert = vi.fn().mockReturnValue({ select: selectInsert });

    const from = (table: string) => {
    if (table === 'email_events') return { select: selectEvents, insert };
      if (table === 'email_outbound') return { select: selectOutbound };
      if (table === 'drafts') return { select: selectDraft };
      if (table === 'campaigns') return { select: selectCampaign };
      if (table === 'segments') return { select: selectSegment };
      return { select: vi.fn(), insert: vi.fn() };
    };

    const client = { from } as any;
    const result = await ingestEmailEvent(
      client,
      { provider: 'stub', provider_event_id: 'evt-1', event_type: 'delivered', outbound_id: 'out1' },
      {}
    );
    expect(result.inserted).toBe(1);
    const insertedPayload = insert.mock.calls[0][0] as any;
    expect(insertedPayload.pattern_id).toBe('p1');
    expect(insertedPayload.icp_profile_id).toBe('icp-1');
    expect(insertedPayload.segment_version).toBe(2);
    expect(insertedPayload.employee_id).toBe('emp1');
  });
});
