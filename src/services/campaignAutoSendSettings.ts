import type { SupabaseClient } from '@supabase/supabase-js';

export interface CampaignAutoSendSettingsView {
  campaignId: string;
  campaignName: string;
  campaignStatus: string | null;
  autoSendIntro: boolean;
  autoSendBump: boolean;
  bumpMinDaysSinceIntro: number;
  updatedAt: string | null;
}

export interface UpdateCampaignAutoSendSettingsInput {
  campaignId: string;
  autoSendIntro?: boolean;
  autoSendBump?: boolean;
  bumpMinDaysSinceIntro?: number;
}

type CampaignAutoSendSettingsRow = {
  id: string;
  name: string;
  status: string | null;
  auto_send_intro: boolean | null;
  auto_send_bump: boolean | null;
  bump_min_days_since_intro: number | null;
  updated_at: string | null;
};

function createValidationError(message: string) {
  const error = new Error(message) as Error & { code: string; statusCode: number };
  error.code = 'INVALID_AUTO_SEND_SETTINGS';
  error.statusCode = 400;
  return error;
}

function mapRowToView(row: CampaignAutoSendSettingsRow): CampaignAutoSendSettingsView {
  return {
    campaignId: row.id,
    campaignName: row.name,
    campaignStatus: row.status,
    autoSendIntro: Boolean(row.auto_send_intro),
    autoSendBump: Boolean(row.auto_send_bump),
    bumpMinDaysSinceIntro: row.bump_min_days_since_intro ?? 3,
    updatedAt: row.updated_at ?? null,
  };
}

export async function getCampaignAutoSendSettings(
  client: SupabaseClient,
  campaignId: string
): Promise<CampaignAutoSendSettingsView> {
  const { data, error } = await client
    .from('campaigns')
    .select('id,name,status,auto_send_intro,auto_send_bump,bump_min_days_since_intro,updated_at')
    .eq('id', campaignId)
    .single();

  if (error || !data) {
    throw error ?? new Error('Campaign not found');
  }

  return mapRowToView(data as CampaignAutoSendSettingsRow);
}

export async function updateCampaignAutoSendSettings(
  client: SupabaseClient,
  input: UpdateCampaignAutoSendSettingsInput
): Promise<CampaignAutoSendSettingsView> {
  const patch: Record<string, unknown> = {};

  if (input.autoSendIntro !== undefined) {
    if (typeof input.autoSendIntro !== 'boolean') {
      throw createValidationError('autoSendIntro must be a boolean');
    }
    patch.auto_send_intro = input.autoSendIntro;
  }

  if (input.autoSendBump !== undefined) {
    if (typeof input.autoSendBump !== 'boolean') {
      throw createValidationError('autoSendBump must be a boolean');
    }
    patch.auto_send_bump = input.autoSendBump;
  }

  if (input.bumpMinDaysSinceIntro !== undefined) {
    if (
      !Number.isInteger(input.bumpMinDaysSinceIntro) ||
      input.bumpMinDaysSinceIntro < 1
    ) {
      throw createValidationError('bumpMinDaysSinceIntro must be an integer >= 1');
    }
    patch.bump_min_days_since_intro = input.bumpMinDaysSinceIntro;
  }

  if (Object.keys(patch).length === 0) {
    throw createValidationError('At least one auto-send setting must be provided');
  }

  const { data, error } = await client
    .from('campaigns')
    .update(patch)
    .eq('id', input.campaignId)
    .select('id,name,status,auto_send_intro,auto_send_bump,bump_min_days_since_intro,updated_at')
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to update campaign auto-send settings');
  }

  return mapRowToView(data as CampaignAutoSendSettingsRow);
}
