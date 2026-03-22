import { describe, expect, it, vi } from 'vitest';

import {
  getCampaignAutoSendSettings,
  updateCampaignAutoSendSettings,
} from '../src/services/campaignAutoSendSettings.js';

describe('campaign auto-send settings', () => {
  it('reads canonical auto-send flags from campaign row', async () => {
    const single = vi.fn(async () => ({
      data: {
        id: 'camp-1',
        name: 'Auto Send Campaign',
        status: 'sending',
        auto_send_intro: true,
        auto_send_bump: false,
        bump_min_days_since_intro: 5,
        updated_at: '2026-03-21T09:30:00Z',
      },
      error: null,
    }));
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single,
          })),
        })),
      })),
    } as any;

    const result = await getCampaignAutoSendSettings(client, 'camp-1');

    expect(result).toEqual({
      campaignId: 'camp-1',
      campaignName: 'Auto Send Campaign',
      campaignStatus: 'sending',
      autoSendIntro: true,
      autoSendBump: false,
      bumpMinDaysSinceIntro: 5,
      updatedAt: '2026-03-21T09:30:00Z',
    });
  });

  it('updates canonical auto-send flags with validation', async () => {
    const single = vi.fn(async () => ({
      data: {
        id: 'camp-1',
        name: 'Auto Send Campaign',
        status: 'review',
        auto_send_intro: true,
        auto_send_bump: true,
        bump_min_days_since_intro: 4,
        updated_at: '2026-03-21T10:00:00Z',
      },
      error: null,
    }));
    const update = vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single,
        })),
      })),
    }));
    const client = {
      from: vi.fn(() => ({
        update,
      })),
    } as any;

    const result = await updateCampaignAutoSendSettings(client, {
      campaignId: 'camp-1',
      autoSendIntro: true,
      autoSendBump: true,
      bumpMinDaysSinceIntro: 4,
    });

    expect(update).toHaveBeenCalledWith({
      auto_send_intro: true,
      auto_send_bump: true,
      bump_min_days_since_intro: 4,
    });
    expect(result.autoSendBump).toBe(true);
    expect(result.bumpMinDaysSinceIntro).toBe(4);
  });

  it('rejects invalid bump delay values', async () => {
    const client = { from: vi.fn() } as any;

    await expect(
      updateCampaignAutoSendSettings(client, {
        campaignId: 'camp-1',
        bumpMinDaysSinceIntro: 0,
      })
    ).rejects.toMatchObject({
      code: 'INVALID_AUTO_SEND_SETTINGS',
      statusCode: 400,
    });
  });
});
