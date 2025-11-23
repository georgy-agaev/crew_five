import type { SupabaseClient } from '@supabase/supabase-js';

interface SendOptions {
  throttlePerMinute?: number;
  provider?: string;
  senderIdentity?: string;
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

export async function sendQueuedDrafts(
  client: SupabaseClient,
  smtpClient: { send: (payload: any) => Promise<{ providerId: string }> },
  options: SendOptions = {}
) {
  const { data: drafts, error } = await client
    .from('drafts')
    .select('*')
    .eq('status', 'generated')
    .limit(options.throttlePerMinute ?? 50);

  if (error) {
    throw error;
  }

  const outboundRecords = [];

  for (const draft of drafts as DraftRow[]) {
    const sendPayload = {
      to: draft.contact_id,
      subject: draft.subject ?? '',
      body: draft.body ?? '',
      metadata: draft.metadata ?? {},
      provider: options.provider ?? 'smtp',
      senderIdentity: options.senderIdentity,
    };

    const result = await smtpClient.send(sendPayload);

    outboundRecords.push({
      campaign_id: draft.campaign_id,
      draft_id: draft.id,
      contact_id: draft.contact_id,
      company_id: draft.company_id,
      provider: options.provider ?? 'smtp',
      provider_message_id: result.providerId,
      status: 'sent',
      sent_at: new Date().toISOString(),
      metadata: { sendPayload },
    });
  }

  if (outboundRecords.length > 0) {
    const { error: insertError } = await client.from('email_outbound').insert(outboundRecords);
    if (insertError) {
      throw insertError;
    }

    await client.from('drafts').update({ status: 'sent' }).in(
      'id',
      outboundRecords.map((r) => r.draft_id)
    );
  }

  return outboundRecords;
}
