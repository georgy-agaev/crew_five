import { describe, expect, it, vi } from 'vitest';

import { enrichCommand } from '../src/commands/enrich';
import { getEnrichmentAdapter } from '../src/services/enrichment/registry';

describe('enrichment', () => {
  it('dispatches to adapter and processes members', async () => {
    const members = [{ contact_id: 'lead@example.com', company_id: 'co1' }];
    const select = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue({ data: members, error: null }) }) });
    const from = (table: string) => {
      if (table === 'segment_members') return { select };
      return { select };
    };
    const supabase = { from } as any;

    const adapter = getEnrichmentAdapter('mock');
    const spy = vi.spyOn(adapter, 'fetchEmployeeInsights');

    const summary = await enrichCommand(supabase, { segmentId: 'seg-1', adapter: 'mock', dryRun: false });
    expect(spy).toHaveBeenCalled();
    expect(summary.processed).toBe(1);
  });

  it('respects dry-run', async () => {
    const members = [{ contact_id: 'lead@example.com', company_id: 'co1' }];
    const select = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue({ data: members, error: null }) }) });
    const supabase = { from: () => ({ select }) } as any;
    const adapter = getEnrichmentAdapter('mock');
    const spy = vi.spyOn(adapter, 'fetchEmployeeInsights');

    const summary = await enrichCommand(supabase, { segmentId: 'seg-1', adapter: 'mock', dryRun: true });
    expect(spy).not.toHaveBeenCalled();
    expect(summary.skipped).toBe(1);
  });
});
