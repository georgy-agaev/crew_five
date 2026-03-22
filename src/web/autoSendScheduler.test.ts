import { describe, expect, it, vi } from 'vitest';

import {
  startAutoSendScheduler,
  startAutoSendSchedulerFromEnv,
} from './autoSendScheduler.js';

describe('autoSendScheduler', () => {
  it('starts from env in live mode', async () => {
    vi.useFakeTimers();
    const runCampaignAutoSendSweep = vi.fn(async () => ({
      summary: {
        checkedCount: 1,
        triggeredCount: 1,
        introTriggeredCount: 1,
        bumpTriggeredCount: 0,
        mixedTriggeredCount: 0,
        skippedCount: 0,
        errorCount: 0,
      },
      campaigns: [],
    }));
    const logger = { log: vi.fn(), error: vi.fn() };
    const previousEnabled = process.env.AUTO_SEND_ENABLED;
    const previousInterval = process.env.AUTO_SEND_INTERVAL_MINUTES;
    const previousBatchLimit = process.env.AUTO_SEND_BATCH_LIMIT;
    process.env.AUTO_SEND_ENABLED = 'true';
    process.env.AUTO_SEND_INTERVAL_MINUTES = '7';
    process.env.AUTO_SEND_BATCH_LIMIT = '25';

    try {
      const scheduler = startAutoSendSchedulerFromEnv(
        { runCampaignAutoSendSweep } as any,
        { mode: 'live', logger }
      );

      expect(scheduler?.intervalMs).toBe(7 * 60 * 1000);
      expect(scheduler?.batchLimit).toBe(25);

      await vi.advanceTimersByTimeAsync(7 * 60 * 1000);
      expect(runCampaignAutoSendSweep).toHaveBeenCalledWith({ batchLimit: 25 });
      scheduler?.stop();
    } finally {
      vi.useRealTimers();
      process.env.AUTO_SEND_ENABLED = previousEnabled;
      process.env.AUTO_SEND_INTERVAL_MINUTES = previousInterval;
      process.env.AUTO_SEND_BATCH_LIMIT = previousBatchLimit;
    }
  });

  it('does not overlap sweep runs', async () => {
    vi.useFakeTimers();
    let resolveRun: (() => void) | null = null;
    const runCampaignAutoSendSweep = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveRun = () =>
            resolve({
              summary: {
                checkedCount: 1,
                triggeredCount: 0,
                introTriggeredCount: 0,
                bumpTriggeredCount: 0,
                mixedTriggeredCount: 0,
                skippedCount: 1,
                errorCount: 0,
              },
              campaigns: [],
            });
        })
    );

    try {
      const scheduler = startAutoSendScheduler(
        { runCampaignAutoSendSweep } as any,
        { intervalMs: 1000, batchLimit: 10, logger: { log: vi.fn(), error: vi.fn() } }
      );

      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(1000);
      expect(runCampaignAutoSendSweep).toHaveBeenCalledTimes(1);

      if (!resolveRun) {
        throw new Error('Expected auto-send sweep to be pending');
      }
      const finishRun = resolveRun as () => void;
      finishRun();
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(1000);
      expect(runCampaignAutoSendSweep).toHaveBeenCalledTimes(2);

      scheduler?.stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it('logs failures cleanly and continues the loop', async () => {
    vi.useFakeTimers();
    const runCampaignAutoSendSweep = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({
        summary: {
          checkedCount: 1,
          triggeredCount: 1,
          introTriggeredCount: 1,
          bumpTriggeredCount: 0,
          mixedTriggeredCount: 0,
          skippedCount: 0,
          errorCount: 0,
        },
        campaigns: [],
      });
    const logger = { log: vi.fn(), error: vi.fn() };

    try {
      const scheduler = startAutoSendScheduler(
        { runCampaignAutoSendSweep } as any,
        { intervalMs: 1000, batchLimit: 10, logger }
      );

      await vi.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
      expect(logger.error).toHaveBeenCalledWith('[web adapter] auto-send sweep failed: boom');

      await vi.advanceTimersByTimeAsync(1000);
      expect(runCampaignAutoSendSweep).toHaveBeenCalledTimes(2);
      scheduler?.stop();
    } finally {
      vi.useRealTimers();
    }
  });
});
