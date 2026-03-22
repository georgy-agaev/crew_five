import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_CAMPAIGN_SEND_POLICY,
  getCampaignSendPolicy,
  updateCampaignSendPolicy,
} from '../src/services/campaignSendPolicy.js';

describe('campaign send policy', () => {
  it('reads canonical campaign-local send policy', async () => {
    const single = vi.fn(async () => ({
      data: {
        id: 'camp-1',
        name: 'RU Campaign',
        status: 'review',
        send_timezone: 'Europe/Moscow',
        send_window_start_hour: 9,
        send_window_end_hour: 17,
        send_weekdays_only: true,
        updated_at: '2026-03-21T12:00:00Z',
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

    const result = await getCampaignSendPolicy(client, 'camp-1');

    expect(result).toEqual({
      campaignId: 'camp-1',
      campaignName: 'RU Campaign',
      campaignStatus: 'review',
      sendTimezone: 'Europe/Moscow',
      sendWindowStartHour: 9,
      sendWindowEndHour: 17,
      sendWeekdaysOnly: true,
      updatedAt: '2026-03-21T12:00:00Z',
    });
  });

  it('updates campaign-local send policy with validation', async () => {
    const currentSingle = vi
      .fn()
      .mockResolvedValueOnce({
        data: {
          id: 'camp-1',
          name: 'RU Campaign',
          status: 'review',
          send_timezone: 'Europe/Moscow',
          send_window_start_hour: 9,
          send_window_end_hour: 17,
          send_weekdays_only: true,
          updated_at: '2026-03-21T12:00:00Z',
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: 'camp-1',
          name: 'US Campaign',
          status: 'review',
          send_timezone: 'America/New_York',
          send_window_start_hour: 8,
          send_window_end_hour: 16,
          send_weekdays_only: false,
          updated_at: '2026-03-21T13:00:00Z',
        },
        error: null,
      });
    const update = vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single: currentSingle,
        })),
      })),
    }));
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: currentSingle,
          })),
        })),
        update,
      })),
    } as any;

    const result = await updateCampaignSendPolicy(client, {
      campaignId: 'camp-1',
      sendTimezone: 'America/New_York',
      sendWindowStartHour: 8,
      sendWindowEndHour: 16,
      sendWeekdaysOnly: false,
    });

    expect(update).toHaveBeenCalledWith({
      send_timezone: 'America/New_York',
      send_window_start_hour: 8,
      send_window_end_hour: 16,
      send_weekdays_only: false,
    });
    expect(result.sendTimezone).toBe('America/New_York');
    expect(result.sendWeekdaysOnly).toBe(false);
  });

  it('rejects invalid timezone values', async () => {
    const client = { from: vi.fn() } as any;

    await expect(
      updateCampaignSendPolicy(client, {
        campaignId: 'camp-1',
        sendTimezone: 'Mars/Base',
      })
    ).rejects.toMatchObject({
      code: 'INVALID_SEND_POLICY',
      statusCode: 400,
    });
  });

  it('rejects invalid hour ranges', async () => {
    const client = { from: vi.fn() } as any;

    await expect(
      updateCampaignSendPolicy(client, {
        campaignId: 'camp-1',
        sendWindowStartHour: 17,
        sendWindowEndHour: 17,
      })
    ).rejects.toMatchObject({
      code: 'INVALID_SEND_POLICY',
      statusCode: 400,
    });
  });

  it('exposes stable defaults for new campaigns', () => {
    expect(DEFAULT_CAMPAIGN_SEND_POLICY).toEqual({
      sendTimezone: 'Europe/Moscow',
      sendWindowStartHour: 9,
      sendWindowEndHour: 17,
      sendWeekdaysOnly: true,
    });
  });
});
