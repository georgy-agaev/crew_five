import { describe, expect, it } from 'vitest';

import { evaluateCampaignSendCalendar } from '../src/services/campaignSendCalendar.js';

describe('campaign send calendar', () => {
  it('allows sending inside a weekday local window', () => {
    const result = evaluateCampaignSendCalendar(
      {
        sendTimezone: 'Europe/Moscow',
        sendWindowStartHour: 9,
        sendWindowEndHour: 17,
        sendWeekdaysOnly: true,
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
      },
      new Date('2026-03-23T13:00:00Z')
    );

    expect(result.allowed).toBe(true);
    expect(result.campaignLocalTime).toContain('09:00:00');
  });
});
