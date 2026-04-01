import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_CAMPAIGN_SEND_POLICY,
  getCampaignSendPolicy,
  resolveCampaignSendPolicy,
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
        metadata: {
          send_policy: {
            send_day_count_mode: 'business_days_campaign',
            send_calendar_country_code: 'RU',
            send_calendar_subdivision_code: 'MOW',
          },
        },
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
      sendDayCountMode: 'business_days_campaign',
      sendCalendarCountryCode: 'RU',
      sendCalendarSubdivisionCode: 'MOW',
      updatedAt: '2026-03-21T12:00:00Z',
      metadata: {
        send_policy: {
          send_day_count_mode: 'business_days_campaign',
          send_calendar_country_code: 'RU',
          send_calendar_subdivision_code: 'MOW',
        },
      },
    });
  });

  it('resolves business-day policy defaults with backward-compatible elapsed-days mode', () => {
    expect(resolveCampaignSendPolicy()).toEqual({
      sendTimezone: 'Europe/Moscow',
      sendWindowStartHour: 9,
      sendWindowEndHour: 17,
      sendWeekdaysOnly: true,
      sendDayCountMode: 'elapsed_days',
      sendCalendarCountryCode: null,
      sendCalendarSubdivisionCode: null,
    });
  });

  it('requires a country code when business-day campaign mode is enabled', () => {
    try {
      resolveCampaignSendPolicy({
        sendDayCountMode: 'business_days_campaign',
      });
      throw new Error('expected validation error');
    } catch (error) {
      expect(error).toMatchObject({
        code: 'INVALID_SEND_POLICY',
        statusCode: 400,
      });
    }
  });

  it('accepts recipient business-day mode with fallback country', () => {
    expect(
      resolveCampaignSendPolicy({
        sendDayCountMode: 'business_days_recipient',
        sendCalendarCountryCode: 'DE',
      })
    ).toEqual({
      sendTimezone: 'Europe/Moscow',
      sendWindowStartHour: 9,
      sendWindowEndHour: 17,
      sendWeekdaysOnly: true,
      sendDayCountMode: 'business_days_recipient',
      sendCalendarCountryCode: 'DE',
      sendCalendarSubdivisionCode: null,
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
          metadata: {
            send_policy: {
              send_day_count_mode: 'elapsed_days',
            },
          },
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
          metadata: {
            send_policy: {
              send_day_count_mode: 'business_days_campaign',
              send_calendar_country_code: 'US',
              send_calendar_subdivision_code: 'NY',
            },
          },
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
      sendDayCountMode: 'business_days_campaign',
      sendCalendarCountryCode: 'US',
      sendCalendarSubdivisionCode: 'NY',
    });

    expect(update).toHaveBeenCalledWith({
      send_timezone: 'America/New_York',
      send_window_start_hour: 8,
      send_window_end_hour: 16,
      send_weekdays_only: false,
      metadata: {
        send_policy: {
          send_day_count_mode: 'business_days_campaign',
          send_calendar_country_code: 'US',
          send_calendar_subdivision_code: 'NY',
        },
      },
    });
    expect(result.sendTimezone).toBe('America/New_York');
    expect(result.sendWeekdaysOnly).toBe(false);
    expect(result.sendDayCountMode).toBe('business_days_campaign');
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
      sendDayCountMode: 'elapsed_days',
      sendCalendarCountryCode: null,
      sendCalendarSubdivisionCode: null,
    });
  });
});
