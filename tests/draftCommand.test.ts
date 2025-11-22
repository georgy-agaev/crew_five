import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/drafts', () => ({
  generateDrafts: vi.fn().mockResolvedValue([{ id: 'draft-1' }]),
}));

const { generateDrafts } = await import('../src/services/drafts');

import { draftGenerateHandler } from '../src/commands/draftGenerate';

describe('draftGenerateHandler', () => {
  it('calls generateDrafts with campaign id', async () => {
    const client = {} as any;
    const aiClient: any = { generateDraft: vi.fn() };

    const result = await draftGenerateHandler(client, aiClient, { campaignId: 'camp-1' });

    expect(generateDrafts).toHaveBeenCalledWith(client, aiClient, { campaignId: 'camp-1' });
    expect(result).toEqual([{ id: 'draft-1' }]);
  });
});
