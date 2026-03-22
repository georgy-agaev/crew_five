import type { SupabaseClient } from '@supabase/supabase-js';

export interface CampaignSendPolicyInput {
  sendTimezone?: string;
  sendWindowStartHour?: number;
  sendWindowEndHour?: number;
  sendWeekdaysOnly?: boolean;
}

export interface CampaignSendPolicy {
  sendTimezone: string;
  sendWindowStartHour: number;
  sendWindowEndHour: number;
  sendWeekdaysOnly: boolean;
}

export interface CampaignSendPolicyView extends CampaignSendPolicy {
  campaignId: string;
  campaignName: string;
  campaignStatus: string | null;
  updatedAt: string | null;
}

type CampaignSendPolicyRow = {
  id: string;
  name: string;
  status: string | null;
  send_timezone: string | null;
  send_window_start_hour: number | null;
  send_window_end_hour: number | null;
  send_weekdays_only: boolean | null;
  updated_at: string | null;
};

export const DEFAULT_CAMPAIGN_SEND_POLICY: CampaignSendPolicy = {
  sendTimezone: 'Europe/Moscow',
  sendWindowStartHour: 9,
  sendWindowEndHour: 17,
  sendWeekdaysOnly: true,
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

export function resolveCampaignSendPolicy(
  input: CampaignSendPolicyInput = {}
): CampaignSendPolicy {
  const resolved: CampaignSendPolicy = {
    sendTimezone: input.sendTimezone ?? DEFAULT_CAMPAIGN_SEND_POLICY.sendTimezone,
    sendWindowStartHour:
      input.sendWindowStartHour ?? DEFAULT_CAMPAIGN_SEND_POLICY.sendWindowStartHour,
    sendWindowEndHour: input.sendWindowEndHour ?? DEFAULT_CAMPAIGN_SEND_POLICY.sendWindowEndHour,
    sendWeekdaysOnly:
      input.sendWeekdaysOnly ?? DEFAULT_CAMPAIGN_SEND_POLICY.sendWeekdaysOnly,
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

  return resolved;
}

function mapRowToView(row: CampaignSendPolicyRow): CampaignSendPolicyView {
  const policy = resolveCampaignSendPolicy({
    sendTimezone: row.send_timezone ?? undefined,
    sendWindowStartHour: row.send_window_start_hour ?? undefined,
    sendWindowEndHour: row.send_window_end_hour ?? undefined,
    sendWeekdaysOnly: row.send_weekdays_only ?? undefined,
  });

  return {
    campaignId: row.id,
    campaignName: row.name,
    campaignStatus: row.status,
    updatedAt: row.updated_at ?? null,
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
      'id,name,status,send_timezone,send_window_start_hour,send_window_end_hour,send_weekdays_only,updated_at'
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
    input.sendWeekdaysOnly !== undefined;

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
  });

  const { data, error } = await client
    .from('campaigns')
    .update({
      send_timezone: resolved.sendTimezone,
      send_window_start_hour: resolved.sendWindowStartHour,
      send_window_end_hour: resolved.sendWindowEndHour,
      send_weekdays_only: resolved.sendWeekdaysOnly,
    })
    .eq('id', input.campaignId)
    .select(
      'id,name,status,send_timezone,send_window_start_hour,send_window_end_hour,send_weekdays_only,updated_at'
    )
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to update campaign send policy');
  }

  return mapRowToView(data as CampaignSendPolicyRow);
}
