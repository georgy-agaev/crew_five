import type { SupabaseClient } from '@supabase/supabase-js';

export type CampaignSendPolicyMode =
  | 'elapsed_days'
  | 'business_days_campaign'
  | 'business_days_recipient';

export interface CampaignSendPolicyInput {
  sendTimezone?: string;
  sendWindowStartHour?: number;
  sendWindowEndHour?: number;
  sendWeekdaysOnly?: boolean;
  sendDayCountMode?: CampaignSendPolicyMode;
  sendCalendarCountryCode?: string | null;
  sendCalendarSubdivisionCode?: string | null;
}

export interface CampaignSendPolicy {
  sendTimezone: string;
  sendWindowStartHour: number;
  sendWindowEndHour: number;
  sendWeekdaysOnly: boolean;
  sendDayCountMode: CampaignSendPolicyMode;
  sendCalendarCountryCode: string | null;
  sendCalendarSubdivisionCode: string | null;
}

export interface CampaignSendPolicyView extends CampaignSendPolicy {
  campaignId: string;
  campaignName: string;
  campaignStatus: string | null;
  updatedAt: string | null;
  metadata: Record<string, unknown> | null;
}

type CampaignSendPolicyRow = {
  id: string;
  name: string;
  status: string | null;
  send_timezone: string | null;
  send_window_start_hour: number | null;
  send_window_end_hour: number | null;
  send_weekdays_only: boolean | null;
  metadata: Record<string, unknown> | null;
  updated_at: string | null;
};

export const DEFAULT_CAMPAIGN_SEND_POLICY: CampaignSendPolicy = {
  sendTimezone: 'Europe/Moscow',
  sendWindowStartHour: 9,
  sendWindowEndHour: 17,
  sendWeekdaysOnly: true,
  sendDayCountMode: 'elapsed_days',
  sendCalendarCountryCode: null,
  sendCalendarSubdivisionCode: null,
};

function createValidationError(message: string) {
  const error = new Error(message) as Error & { code: string; statusCode: number };
  error.code = 'INVALID_SEND_POLICY';
  error.statusCode = 400;
  return error;
}

function isValidIanaTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function assertIntegerHour(value: unknown, field: string, min: number, max: number) {
  if (!Number.isInteger(value) || typeof value !== 'number' || value < min || value > max) {
    throw createValidationError(`${field} must be an integer between ${min} and ${max}`);
  }
}

function normalizeCampaignCountryCode(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw createValidationError('sendCalendarCountryCode must be a string when provided');
  }
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) {
    throw createValidationError('sendCalendarCountryCode must be a valid ISO 3166-1 alpha-2 code');
  }
  return normalized;
}

function normalizeCampaignSubdivisionCode(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== 'string') {
    throw createValidationError('sendCalendarSubdivisionCode must be a string when provided');
  }
  const normalized = value.trim();
  if (!normalized) {
    throw createValidationError('sendCalendarSubdivisionCode cannot be empty');
  }
  return normalized;
}

function readSendPolicyMetadata(metadata: Record<string, unknown> | null | undefined): Partial<CampaignSendPolicyInput> {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }

  const sendPolicy = metadata.send_policy;
  if (!sendPolicy || typeof sendPolicy !== 'object' || Array.isArray(sendPolicy)) {
    return {};
  }

  const policy = sendPolicy as Record<string, unknown>;
  return {
    sendDayCountMode:
      policy.send_day_count_mode === 'business_days_campaign'
        ? 'business_days_campaign'
        : policy.send_day_count_mode === 'business_days_recipient'
          ? 'business_days_recipient'
        : policy.send_day_count_mode === 'elapsed_days'
          ? 'elapsed_days'
          : undefined,
    sendCalendarCountryCode:
      typeof policy.send_calendar_country_code === 'string'
        ? policy.send_calendar_country_code
        : null,
    sendCalendarSubdivisionCode:
      typeof policy.send_calendar_subdivision_code === 'string'
        ? policy.send_calendar_subdivision_code
        : null,
  };
}

export function buildCampaignSendPolicyMetadata(
  metadata: Record<string, unknown> | null | undefined,
  policy: CampaignSendPolicy
): Record<string, unknown> {
  const existing = metadata && typeof metadata === 'object' && !Array.isArray(metadata) ? metadata : {};
  return {
    ...existing,
    send_policy: {
      send_day_count_mode: policy.sendDayCountMode,
      send_calendar_country_code: policy.sendCalendarCountryCode,
      send_calendar_subdivision_code: policy.sendCalendarSubdivisionCode,
    },
  };
}

export function resolveCampaignSendPolicy(
  input: CampaignSendPolicyInput = {}
): CampaignSendPolicy {
  const mode = input.sendDayCountMode ?? DEFAULT_CAMPAIGN_SEND_POLICY.sendDayCountMode;
  const sendCalendarCountryCode = normalizeCampaignCountryCode(input.sendCalendarCountryCode);
  const sendCalendarSubdivisionCode = normalizeCampaignSubdivisionCode(input.sendCalendarSubdivisionCode);
  const resolved: CampaignSendPolicy = {
    sendTimezone: input.sendTimezone ?? DEFAULT_CAMPAIGN_SEND_POLICY.sendTimezone,
    sendWindowStartHour:
      input.sendWindowStartHour ?? DEFAULT_CAMPAIGN_SEND_POLICY.sendWindowStartHour,
    sendWindowEndHour: input.sendWindowEndHour ?? DEFAULT_CAMPAIGN_SEND_POLICY.sendWindowEndHour,
    sendWeekdaysOnly:
      input.sendWeekdaysOnly ?? DEFAULT_CAMPAIGN_SEND_POLICY.sendWeekdaysOnly,
    sendDayCountMode: mode,
    sendCalendarCountryCode,
    sendCalendarSubdivisionCode,
  };

  if (!resolved.sendTimezone || !isValidIanaTimezone(resolved.sendTimezone)) {
    throw createValidationError('sendTimezone must be a valid IANA timezone');
  }
  assertIntegerHour(resolved.sendWindowStartHour, 'sendWindowStartHour', 0, 23);
  assertIntegerHour(resolved.sendWindowEndHour, 'sendWindowEndHour', 1, 24);
  if (resolved.sendWindowEndHour <= resolved.sendWindowStartHour) {
    throw createValidationError('sendWindowEndHour must be greater than sendWindowStartHour');
  }
  if (typeof resolved.sendWeekdaysOnly !== 'boolean') {
    throw createValidationError('sendWeekdaysOnly must be a boolean');
  }
  if (
    (resolved.sendDayCountMode === 'business_days_campaign' ||
      resolved.sendDayCountMode === 'business_days_recipient') &&
    !resolved.sendCalendarCountryCode
  ) {
    throw createValidationError(
      'sendCalendarCountryCode is required when sendDayCountMode uses business-day mode'
    );
  }

  return resolved;
}

function mapRowToView(row: CampaignSendPolicyRow): CampaignSendPolicyView {
  const metadataPolicy = readSendPolicyMetadata(row.metadata);
  const policy = resolveCampaignSendPolicy({
    sendTimezone: row.send_timezone ?? undefined,
    sendWindowStartHour: row.send_window_start_hour ?? undefined,
    sendWindowEndHour: row.send_window_end_hour ?? undefined,
    sendWeekdaysOnly: row.send_weekdays_only ?? undefined,
    sendDayCountMode: metadataPolicy.sendDayCountMode,
    sendCalendarCountryCode: metadataPolicy.sendCalendarCountryCode,
    sendCalendarSubdivisionCode: metadataPolicy.sendCalendarSubdivisionCode,
  });

  return {
    campaignId: row.id,
    campaignName: row.name,
    campaignStatus: row.status,
    updatedAt: row.updated_at ?? null,
    metadata: row.metadata ?? null,
    ...policy,
  };
}

export async function getCampaignSendPolicy(
  client: SupabaseClient,
  campaignId: string
): Promise<CampaignSendPolicyView> {
  const { data, error } = await client
    .from('campaigns')
    .select(
      'id,name,status,send_timezone,send_window_start_hour,send_window_end_hour,send_weekdays_only,metadata,updated_at'
    )
    .eq('id', campaignId)
    .single();

  if (error || !data) {
    throw error ?? new Error('Campaign not found');
  }

  return mapRowToView(data as CampaignSendPolicyRow);
}

export async function updateCampaignSendPolicy(
  client: SupabaseClient,
  input: { campaignId: string } & CampaignSendPolicyInput
): Promise<CampaignSendPolicyView> {
  const hasAnyField =
    input.sendTimezone !== undefined ||
    input.sendWindowStartHour !== undefined ||
    input.sendWindowEndHour !== undefined ||
    input.sendWeekdaysOnly !== undefined ||
    input.sendDayCountMode !== undefined ||
    input.sendCalendarCountryCode !== undefined ||
    input.sendCalendarSubdivisionCode !== undefined;

  if (!hasAnyField) {
    throw createValidationError('At least one send policy field must be provided');
  }

  if (input.sendTimezone !== undefined) {
    resolveCampaignSendPolicy({ sendTimezone: input.sendTimezone });
  }
  if (input.sendWindowStartHour !== undefined) {
    resolveCampaignSendPolicy({
      sendWindowStartHour: input.sendWindowStartHour,
      sendWindowEndHour: input.sendWindowEndHour ?? DEFAULT_CAMPAIGN_SEND_POLICY.sendWindowEndHour,
    });
  }
  if (input.sendWindowEndHour !== undefined) {
    resolveCampaignSendPolicy({
      sendWindowStartHour: input.sendWindowStartHour ?? DEFAULT_CAMPAIGN_SEND_POLICY.sendWindowStartHour,
      sendWindowEndHour: input.sendWindowEndHour,
    });
  }
  if (input.sendWeekdaysOnly !== undefined && typeof input.sendWeekdaysOnly !== 'boolean') {
    throw createValidationError('sendWeekdaysOnly must be a boolean');
  }

  const current = await getCampaignSendPolicy(client, input.campaignId);
  const resolved = resolveCampaignSendPolicy({
    sendTimezone: input.sendTimezone ?? current.sendTimezone,
    sendWindowStartHour: input.sendWindowStartHour ?? current.sendWindowStartHour,
    sendWindowEndHour: input.sendWindowEndHour ?? current.sendWindowEndHour,
    sendWeekdaysOnly: input.sendWeekdaysOnly ?? current.sendWeekdaysOnly,
    sendDayCountMode: input.sendDayCountMode ?? current.sendDayCountMode,
    sendCalendarCountryCode:
      input.sendCalendarCountryCode !== undefined
        ? input.sendCalendarCountryCode
        : current.sendCalendarCountryCode,
    sendCalendarSubdivisionCode:
      input.sendCalendarSubdivisionCode !== undefined
        ? input.sendCalendarSubdivisionCode
        : current.sendCalendarSubdivisionCode,
  });

  const { data, error } = await client
    .from('campaigns')
    .update({
      send_timezone: resolved.sendTimezone,
      send_window_start_hour: resolved.sendWindowStartHour,
      send_window_end_hour: resolved.sendWindowEndHour,
      send_weekdays_only: resolved.sendWeekdaysOnly,
      metadata: buildCampaignSendPolicyMetadata(current.metadata, resolved),
    })
    .eq('id', input.campaignId)
    .select(
      'id,name,status,send_timezone,send_window_start_hour,send_window_end_hour,send_weekdays_only,metadata,updated_at'
    )
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to update campaign send policy');
  }

  return mapRowToView(data as CampaignSendPolicyRow);
}
