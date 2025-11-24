import type { SupabaseClient } from '@supabase/supabase-js';
import type { SmartleadMcpClient } from '../integrations/smartleadMcp';

interface SendOptions {
  dryRun?: boolean;
  batchSize?: number;
}

interface DraftRow {
  id: string;
  campaign_id: string;
  contact_id: string;
  company_id: string;
  subject: string | null;
  body: string | null;
  metadata: Record<string, unknown> | null;
}

export async function smartleadSendCommand(
  mcp: SmartleadMcpClient,
  supabase: SupabaseClient,
  options: SendOptions
) {
  const batchSize = options.batchSize ?? 50;
  const summary = {
    sent: 0,
    skipped: 0,
    failed: 0,
    timestamp: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('drafts')
    .select('*')
    .eq('status', 'generated')
    .limit(batchSize);

  if (error) {
    throw error;
  }

  const drafts = (data as DraftRow[]) ?? [];
  const outboundRecords: Array<Record<string, unknown>> = [];

  for (const draft of drafts) {
    if (options.dryRun) {
      summary.skipped += 1;
      continue;
    }
    try {
      const res = await mcp.sendEmail?.({
        to: draft.contact_id,
        subject: draft.subject ?? '',
        body: draft.body ?? '',
        campaignId: draft.campaign_id,
      });
      if (!res?.provider_message_id) {
        summary.failed += 1;
        continue;
      }
      outboundRecords.push({
        campaign_id: draft.campaign_id,
        draft_id: draft.id,
        contact_id: draft.contact_id,
        company_id: draft.company_id,
        provider: 'smartlead',
        provider_message_id: res.provider_message_id,
        idempotency_key: `${draft.id}:${res.provider_message_id}`,
        status: 'sent',
        sent_at: new Date().toISOString(),
      });
      summary.sent += 1;
    } catch (err) {
      summary.failed += 1;
      // keep loop; do not throw to allow batch to continue
    }
  }

  if (!options.dryRun && outboundRecords.length > 0) {
    const { error: insertErr } = await supabase.from('email_outbound').insert(outboundRecords);
    if (insertErr) {
      throw insertErr;
    }
    await supabase
      .from('drafts')
      .update({ status: 'sent' })
      .in(
        'id',
        outboundRecords.map((r) => r.draft_id as string)
      );
  }

  return summary;
}
