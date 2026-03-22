import type { CampaignSendPolicy } from './campaignSendPolicy.js';

export type CampaignSendCalendarReason =
  | 'outside_send_window'
  | 'non_workday';

export interface CampaignSendCalendarResult {
  allowed: boolean;
  campaignLocalTime: string;
  reason: CampaignSendCalendarReason | null;
}

function formatCampaignLocalTime(now: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  return formatter.format(now).replace(' ', 'T');
}

function getLocalWeekday(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
  }).format(now);
}

function getLocalHour(now: Date, timeZone: string): number {
  const hourText = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    hourCycle: 'h23',
  }).format(now);

  return Number(hourText);
}

export function evaluateCampaignSendCalendar(
  policy: CampaignSendPolicy,
  now: Date
): CampaignSendCalendarResult {
  const campaignLocalTime = formatCampaignLocalTime(now, policy.sendTimezone);
  const weekday = getLocalWeekday(now, policy.sendTimezone);
  const localHour = getLocalHour(now, policy.sendTimezone);

  if (policy.sendWeekdaysOnly && (weekday === 'Sat' || weekday === 'Sun')) {
    return {
      allowed: false,
      campaignLocalTime,
      reason: 'non_workday',
    };
  }

  if (
    localHour < policy.sendWindowStartHour ||
    localHour >= policy.sendWindowEndHour
  ) {
    return {
      allowed: false,
      campaignLocalTime,
      reason: 'outside_send_window',
    };
  }

  return {
    allowed: true,
    campaignLocalTime,
    reason: null,
  };
}
