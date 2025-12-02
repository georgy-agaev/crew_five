import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/drafts', () => ({
  generateDrafts: vi.fn().mockResolvedValue([{ id: 'draft-1' }]),
}));

vi.mock('../src/services/coach', () => ({
  generateDraftsForSegmentWithIcp: vi.fn().mockResolvedValue({ generated: 2 }),
}));

vi.mock('../src/services/campaigns', () => ({
  getCampaignSpineContext: vi.fn().mockResolvedValue({
    id: 'camp-1',
    segment_id: 'seg-1',
    segment_version: 1,
  }),
}));

vi.mock('../src/services/segmentSnapshotWorkflow', () => ({
  ensureFinalSegmentSnapshot: vi.fn().mockResolvedValue({ version: 1, count: 10 }),
}));

const { generateDrafts } = await import('../src/services/drafts');
const { generateDraftsForSegmentWithIcp } = await import('../src/services/coach');
const { getCampaignSpineContext } = await import('../src/services/campaigns');
const { ensureFinalSegmentSnapshot } = await import('../src/services/segmentSnapshotWorkflow');

import { draftGenerateHandler } from '../src/commands/draftGenerate';

afterEach(() => {
  vi.clearAllMocks();
});

describe('draftGenerateHandler', () => {
  it('calls generateDrafts after ensuring finalized snapshot', async () => {
    const client = {} as any;
    const aiClient: any = { generateDraft: vi.fn() };

    const result = await draftGenerateHandler(client, aiClient, { campaignId: 'camp-1' });

    expect(getCampaignSpineContext).toHaveBeenCalledWith(client, 'camp-1');
    expect(ensureFinalSegmentSnapshot).toHaveBeenCalledWith(client, 'seg-1', {
      expectedVersion: 1,
      forceVersion: undefined,
    });
    expect(generateDrafts).toHaveBeenCalledWith(client, aiClient, {
      campaignId: 'camp-1',
      provider: 'openai',
      model: 'gpt-4o-mini',
    });
    expect(result).toEqual([{ id: 'draft-1' }]);
  });

  it('routes to ICP-aware coach flow when ICP flags provided', async () => {
    const client = {} as any;
    const aiClient: any = { generateDraft: vi.fn() };

    const result = await draftGenerateHandler(client, aiClient, {
      campaignId: 'camp-2',
      icpProfileId: 'icp-1',
      icpHypothesisId: 'hyp-1',
      limit: 25,
      variant: 'B',
      dryRun: true,
    } as any);

    expect(getCampaignSpineContext).toHaveBeenCalledWith(client, 'camp-2');
    expect(ensureFinalSegmentSnapshot).toHaveBeenCalledWith(client, 'seg-1', {
      expectedVersion: 1,
      forceVersion: undefined,
    });
    expect(generateDrafts).not.toHaveBeenCalled();
    expect(generateDraftsForSegmentWithIcp).toHaveBeenCalledWith(client, aiClient, {
      campaignId: 'camp-2',
      segmentId: 'seg-1',
      icpProfileId: 'icp-1',
      icpHypothesisId: 'hyp-1',
      limit: 25,
      variant: 'B',
      dryRun: true,
      provider: 'openai',
      model: 'gpt-4o-mini',
    });
    expect(result).toEqual({ generated: 2 });
  });

  it('rejects when segment version mismatches without force', async () => {
    vi.mocked(getCampaignSpineContext).mockResolvedValueOnce({
      id: 'camp-3',
      segment_id: 'seg-1',
      segment_version: 1,
    } as any);
    vi.mocked(ensureFinalSegmentSnapshot).mockRejectedValueOnce(new Error('Segment version mismatch'));

    const client = {} as any;
    const aiClient: any = { generateDraft: vi.fn() };

    await expect(
      draftGenerateHandler(client, aiClient, { campaignId: 'camp-3', icpProfileId: 'icp-1' } as any)
    ).rejects.toThrow(/mismatch/);
  });
});
