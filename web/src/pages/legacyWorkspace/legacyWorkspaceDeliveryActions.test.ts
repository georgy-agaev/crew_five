import { describe, expect, it, vi } from 'vitest';

import {
  prepareSmartleadCampaignSync,
  runEnrichmentJob,
} from './legacyWorkspaceDeliveryActions';

describe('legacyWorkspaceDeliveryActions', () => {
  it('runs single-provider enrichment with default limit and derives queued status', async () => {
    const enqueueSingle = vi.fn().mockResolvedValue({
      summary: { status: 'queued' },
    });
    const enqueueMulti = vi.fn();

    const result = await runEnrichmentJob(
      {
        segmentId: 'seg_1',
        selectedProviders: ['apollo'],
        defaultProviders: ['mock'],
      },
      {
        enqueueSingle,
        enqueueMulti,
      }
    );

    expect(enqueueSingle).toHaveBeenCalledWith({
      segmentId: 'seg_1',
      adapter: 'apollo',
      limit: 25,
      runNow: true,
    });
    expect(enqueueMulti).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'queued', results: null });
  });

  it('runs multi-provider enrichment and returns completed results', async () => {
    const enqueueSingle = vi.fn();
    const enqueueMulti = vi.fn().mockResolvedValue({
      results: [{ provider: 'apollo', status: 'completed' }],
    });

    const result = await runEnrichmentJob(
      {
        segmentId: 'seg_2',
        selectedProviders: [],
        defaultProviders: ['apollo', 'hunter'],
      },
      {
        enqueueSingle,
        enqueueMulti,
      }
    );

    expect(enqueueMulti).toHaveBeenCalledWith({
      segmentId: 'seg_2',
      providers: ['apollo', 'hunter'],
      limit: 25,
      runNow: true,
    });
    expect(result).toEqual({
      status: 'completed',
      results: [{ provider: 'apollo', status: 'completed' }],
    });
  });

  it('prepares Smartlead sync and formats the summary string', async () => {
    const triggerSmartlead = vi.fn().mockResolvedValue({
      leadsPrepared: 9,
      leadsPushed: 7,
      skippedContactsNoEmail: 2,
      sequencesSynced: 1,
      dryRun: false,
    });

    const summary = await prepareSmartleadCampaignSync(
      {
        campaignId: 'camp_1',
        smartleadCampaignId: 'sl_1',
        batchSize: 50,
        dryRun: false,
      },
      { triggerSmartlead }
    );

    expect(triggerSmartlead).toHaveBeenCalledWith({
      campaignId: 'camp_1',
      smartleadCampaignId: 'sl_1',
      batchSize: 50,
      dryRun: false,
    });
    expect(summary).toBe(
      'Smartlead prepare: fetched=9, sent=7, skipped=2 · sequencesSynced=1 · dryRun=false'
    );
  });
});
