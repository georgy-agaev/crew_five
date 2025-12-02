import type { SupabaseClient } from '@supabase/supabase-js';
import type { SmartleadMcpClient, SmartleadSequenceInput } from '../integrations/smartleadMcp';

export interface SmartleadSequencesSyncOptions {
  campaignId: string;
  dryRun?: boolean;
  variantLabel?: string;
  step?: number;
}

export async function smartleadSequencesSyncCommand(
  client: SmartleadMcpClient,
  supabase: SupabaseClient,
  options: SmartleadSequencesSyncOptions
) {
  const { data, error } = await supabase
    .from('drafts')
    .select('campaign_id, subject, body, status')
    .eq('campaign_id', options.campaignId)
    .eq('status', 'generated')
    .limit(1);

  if (error) {
    throw error;
  }

  const drafts =
    (data as Array<{ campaign_id: string; subject: string | null; body: string | null; status: string }>) ?? [];

  if (drafts.length === 0) {
    throw new Error('No drafts found for campaign');
  }

  const draft = drafts[0];
  const sequence: SmartleadSequenceInput = {
    seq_number: options.step ?? 1,
    delay_in_days: 0,
    subject: draft.subject ?? '',
    email_body: draft.body ?? '',
    variant_label: options.variantLabel ?? 'A',
  };

  const payload = {
    campaignId: options.campaignId,
    sequences: [sequence],
  };

  if (options.dryRun) {
    return payload;
  }

  await client.saveCampaignSequences?.(payload);

  return payload;
}

