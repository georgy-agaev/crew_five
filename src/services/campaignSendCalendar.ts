import Holidays from 'date-holidays';

import type { CampaignSendPolicy } from './campaignSendPolicy.js';

export type CampaignSendCalendarReason = 'outside_send_window' | 'non_workday';

export interface CampaignSendCalendarResult {
  allowed: boolean;
  campaignLocalTime: string;
  reason: CampaignSendCalendarReason | null;
}

export interface CampaignBusinessCalendarOverride {
  countryCode: string | null;
  subdivisionCode?: string | null;
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

function getLocalDateKey(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
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

function incrementLocalDateKey(localDateKey: string): string {
  const nextDate = new Date(`${localDateKey}T00:00:00Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + 1);
  return nextDate.toISOString().slice(0, 10);
}

function getHolidaySet(countryCode: string, subdivisionCode: string | null, year: number): Set<string> {
  const holidayDates = new Set<string>();
  try {
    const holidays = subdivisionCode
      ? new Holidays(countryCode, subdivisionCode)
      : new Holidays(countryCode);
    const rows = holidays.getHolidays(year) as Array<{ date?: string }>;
    for (const row of rows) {
      if (typeof row?.date !== 'string') {
        continue;
      }
      holidayDates.add(row.date.slice(0, 10));
    }
  } catch {
    return holidayDates;
  }

  return holidayDates;
}

function isHolidayOnLocalDate(
  localDateKey: string,
  countryCode: string,
  subdivisionCode: string | null
): boolean {
  try {
    const holidays = subdivisionCode
      ? new Holidays(countryCode, subdivisionCode)
      : new Holidays(countryCode);
    const result = holidays.isHoliday(new Date(`${localDateKey}T12:00:00Z`));
    return Array.isArray(result) ? result.length > 0 : Boolean(result);
  } catch {
    const year = Number(localDateKey.slice(0, 4));
    const holidayDates = getHolidaySet(countryCode, subdivisionCode, year);
    return holidayDates.has(localDateKey);
  }
}

function isWeekendLocalDateKey(localDateKey: string): boolean {
  const localDate = new Date(`${localDateKey}T00:00:00Z`);
  const weekday = localDate.getUTCDay();
  return weekday === 0 || weekday === 6;
}

function isCampaignBusinessDayForLocalDateKey(
  policy: CampaignSendPolicy,
  localDateKey: string,
  override: CampaignBusinessCalendarOverride | null = null
): boolean {
  if (policy.sendDayCountMode === 'business_days_campaign') {
    if (!policy.sendCalendarCountryCode) {
      return !isWeekendLocalDateKey(localDateKey);
    }
    return (
      !isWeekendLocalDateKey(localDateKey) &&
      !isHolidayOnLocalDate(localDateKey, policy.sendCalendarCountryCode, policy.sendCalendarSubdivisionCode)
    );
  }

  if (policy.sendDayCountMode === 'business_days_recipient') {
    const effectiveCountryCode = override?.countryCode ?? policy.sendCalendarCountryCode;
    const effectiveSubdivisionCode =
      override?.countryCode && override.countryCode === effectiveCountryCode
        ? override.subdivisionCode ?? null
        : policy.sendCalendarSubdivisionCode;

    if (!effectiveCountryCode) {
      return !isWeekendLocalDateKey(localDateKey);
    }

    return (
      !isWeekendLocalDateKey(localDateKey) &&
      !isHolidayOnLocalDate(localDateKey, effectiveCountryCode, effectiveSubdivisionCode ?? null)
    );
  }

  return policy.sendWeekdaysOnly ? !isWeekendLocalDateKey(localDateKey) : true;
}

export function isCampaignBusinessDay(policy: CampaignSendPolicy, now: Date): boolean {
  return isCampaignBusinessDayForLocalDateKey(policy, getLocalDateKey(now, policy.sendTimezone));
}

export function isBusinessDayForCampaignRecipient(
  policy: CampaignSendPolicy,
  now: Date,
  override: CampaignBusinessCalendarOverride | null = null
): boolean {
  return isCampaignBusinessDayForLocalDateKey(policy, getLocalDateKey(now, policy.sendTimezone), override);
}

export function countCampaignBusinessDaysBetween(
  policy: CampaignSendPolicy,
  introSentAt: Date,
  now: Date,
  override: CampaignBusinessCalendarOverride | null = null
): number {
  const introDateKey = getLocalDateKey(introSentAt, policy.sendTimezone);
  const nowDateKey = getLocalDateKey(now, policy.sendTimezone);

  if (nowDateKey <= introDateKey) {
    return 0;
  }

  let cursor = incrementLocalDateKey(introDateKey);
  let count = 0;

  while (cursor <= nowDateKey) {
    if (isCampaignBusinessDayForLocalDateKey(policy, cursor, override)) {
      count += 1;
    }
    cursor = incrementLocalDateKey(cursor);
  }

  return count;
}

export function evaluateCampaignSendCalendar(
  policy: CampaignSendPolicy,
  now: Date
): CampaignSendCalendarResult {
  const campaignLocalTime = formatCampaignLocalTime(now, policy.sendTimezone);
  const localHour = getLocalHour(now, policy.sendTimezone);

  if (policy.sendDayCountMode !== 'business_days_recipient' && !isCampaignBusinessDay(policy, now)) {
    return {
      allowed: false,
      campaignLocalTime,
      reason: 'non_workday',
    };
  }

  if (localHour < policy.sendWindowStartHour || localHour >= policy.sendWindowEndHour) {
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
