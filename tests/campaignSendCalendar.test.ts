import { describe, expect, it, vi } from 'vitest';

vi.mock('date-holidays', () => {
  return {
    default: class MockHolidays {
      private countryCode: string;

      constructor(countryCode: string) {
        this.countryCode = countryCode;
      }

      getHolidays(year: number) {
        if (this.countryCode === 'RU' && year === 2026) {
          return [
            { date: '2026-01-01 00:00:00', name: 'New Year', type: 'public' },
            { date: '2026-03-04 00:00:00', name: 'RU Holiday', type: 'public' },
          ];
        }
        return [];
      }

      isHoliday(date: Date) {
        const isoDate = date.toISOString().slice(0, 10);
        if (this.countryCode === 'RU' && isoDate === '2026-01-01') {
          return [{ date: isoDate, name: 'New Year', type: 'public' }];
        }
        return [];
      }
    },
  };
});

import {
  countCampaignBusinessDaysBetween,
  evaluateCampaignSendCalendar,
} from '../src/services/campaignSendCalendar.js';

describe('campaign send calendar', () => {
  it('allows sending inside a weekday local window', () => {
    const result = evaluateCampaignSendCalendar(
      {
        sendTimezone: 'Europe/Moscow',
        sendWindowStartHour: 9,
        sendWindowEndHour: 17,
        sendWeekdaysOnly: true,
        sendDayCountMode: 'elapsed_days',
        sendCalendarCountryCode: null,
        sendCalendarSubdivisionCode: null,
      },
      new Date('2026-03-23T07:00:00Z')
    );

    expect(result.allowed).toBe(true);
    expect(result.reason).toBeNull();
  });

  it('blocks sending before local start hour', () => {
    const result = evaluateCampaignSendCalendar(
      {
        sendTimezone: 'Europe/Moscow',
        sendWindowStartHour: 9,
        sendWindowEndHour: 17,
        sendWeekdaysOnly: true,
        sendDayCountMode: 'elapsed_days',
        sendCalendarCountryCode: null,
        sendCalendarSubdivisionCode: null,
      },
      new Date('2026-03-23T05:00:00Z')
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('outside_send_window');
  });

  it('blocks sending after local end hour', () => {
    const result = evaluateCampaignSendCalendar(
      {
        sendTimezone: 'Europe/Moscow',
        sendWindowStartHour: 9,
        sendWindowEndHour: 17,
        sendWeekdaysOnly: true,
        sendDayCountMode: 'elapsed_days',
        sendCalendarCountryCode: null,
        sendCalendarSubdivisionCode: null,
      },
      new Date('2026-03-23T14:30:00Z')
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('outside_send_window');
  });

  it('blocks sending on weekends when weekdays-only is enabled', () => {
    const result = evaluateCampaignSendCalendar(
      {
        sendTimezone: 'Europe/Moscow',
        sendWindowStartHour: 9,
        sendWindowEndHour: 17,
        sendWeekdaysOnly: true,
        sendDayCountMode: 'elapsed_days',
        sendCalendarCountryCode: null,
        sendCalendarSubdivisionCode: null,
      },
      new Date('2026-03-21T09:00:00Z')
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('non_workday');
  });

  it('uses campaign-local timezone instead of server-local time', () => {
    const result = evaluateCampaignSendCalendar(
      {
        sendTimezone: 'America/New_York',
        sendWindowStartHour: 9,
        sendWindowEndHour: 17,
        sendWeekdaysOnly: true,
        sendDayCountMode: 'elapsed_days',
        sendCalendarCountryCode: null,
        sendCalendarSubdivisionCode: null,
      },
      new Date('2026-03-23T13:00:00Z')
    );

    expect(result.allowed).toBe(true);
    expect(result.campaignLocalTime).toContain('09:00:00');
  });

  it('blocks business-day campaign sends on public holidays', () => {
    const result = evaluateCampaignSendCalendar(
      {
        sendTimezone: 'Europe/Moscow',
        sendWindowStartHour: 9,
        sendWindowEndHour: 17,
        sendWeekdaysOnly: true,
        sendDayCountMode: 'business_days_campaign',
        sendCalendarCountryCode: 'RU',
        sendCalendarSubdivisionCode: null,
      },
      new Date('2026-01-01T10:00:00Z')
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('non_workday');
  });

  it('does not block the whole campaign on recipient mode at campaign-level calendar evaluation', () => {
    const result = evaluateCampaignSendCalendar(
      {
        sendTimezone: 'Europe/Moscow',
        sendWindowStartHour: 9,
        sendWindowEndHour: 17,
        sendWeekdaysOnly: true,
        sendDayCountMode: 'business_days_recipient',
        sendCalendarCountryCode: 'DE',
        sendCalendarSubdivisionCode: null,
      },
      new Date('2026-01-01T10:00:00Z')
    );

    expect(result.allowed).toBe(true);
    expect(result.reason).toBeNull();
  });

  it('counts recipient-mode business days using campaign fallback when no override is provided', () => {
    const result = countCampaignBusinessDaysBetween(
      {
        sendTimezone: 'Europe/Moscow',
        sendWindowStartHour: 9,
        sendWindowEndHour: 17,
        sendWeekdaysOnly: true,
        sendDayCountMode: 'business_days_recipient',
        sendCalendarCountryCode: 'DE',
        sendCalendarSubdivisionCode: null,
      },
      new Date('2026-03-01T10:00:00Z'),
      new Date('2026-03-06T10:00:00Z')
    );

    expect(result).toBe(5);
  });
});
