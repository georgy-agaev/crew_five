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

    const client = {
      from: (table: string) => {
        if (table === 'email_events') {
          return { select: selectDedup, insert };
        }
        throw new Error(`unexpected table ${table}`);
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
});
