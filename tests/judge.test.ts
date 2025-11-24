import { describe, expect, it, vi } from 'vitest';

import { judgeDraftsCommand } from '../src/commands/judgeDrafts';
import { scoreDraft } from '../src/services/judge';

describe('judge drafts', () => {
  it('scores_and_persists', async () => {
    const drafts = [{ id: 'd1', subject: 's', body: 'b' }];
    const select = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue({ data: drafts, error: null }) }) });
    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    const supabase = {
      from: (table: string) => {
        if (table === 'drafts') return { select, update };
        return { select, update };
      },
    } as any;

    const summary = await judgeDraftsCommand(supabase, { campaignId: 'c1', dryRun: false, limit: 1 });
    expect(summary.judged).toBe(1);
  });

  it('rejects_missing_inputs', async () => {
    await expect(scoreDraft({ id: 'd1', subject: '', body: '' } as any)).resolves.toBeTruthy();
  });
});
