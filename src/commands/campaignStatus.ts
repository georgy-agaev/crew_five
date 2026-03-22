import type { SupabaseClient } from '@supabase/supabase-js';

import { assertCampaignStatusTransition, type CampaignStatus } from '../status';
import { assertCampaignHasMailboxAssignment } from '../services/campaignMailboxAssignments.js';

export async function campaignStatusHandler(
  client: SupabaseClient,
  options: { campaignId: string; status: CampaignStatus; dryRun?: boolean }
) {
  const { data: row, error } = await client.from('campaigns').select('status').eq('id', options.campaignId).single();
  if (error || !row) {
    throw error ?? new Error('Campaign not found');
  }

  const current = row.status as CampaignStatus;
  assertCampaignStatusTransition(current, options.status);

  if (options.status === 'sending') {
    await assertCampaignHasMailboxAssignment(client, options.campaignId);
  }

  if (options.dryRun) {
    return { id: options.campaignId, status: current, nextStatus: options.status, dryRun: true };
  }

  const { data: updated, error: updateError } = await client
    .from('campaigns')
    .update({ status: options.status })
    .eq('id', options.campaignId)
    .select()
    .single();

  if (updateError || !updated) {
    throw updateError ?? new Error('Failed to update status');
  }

  return updated;
}
