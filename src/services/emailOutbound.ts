import type { SupabaseClient } from '@supabase/supabase-js';

interface SendOptions {
  throttlePerMinute?: number;
  provider?: string;
  senderIdentity?: string;
  retryOnce?: boolean;
  logJson?: boolean;
  dryRun?: boolean;
  failOnError?: boolean;
  batchId?: string;
  logger?: (payload: Record<string, unknown>) => void;
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
  const throttle = options.throttlePerMinute ?? 50;
  const batchId = options.batchId ?? `batch-${Date.now()}`;
  const summary = { batchId, sent: 0, failed: 0, skipped: 0, timestamp: new Date().toISOString() };

  const { data: drafts, error } = await client
    .from('drafts')
    .select('*')
    .eq('status', 'generated')
    .limit(throttle);

  if (error) {
    throw error;
  }

  const outboundRecords = [];

  const draftList = (drafts as DraftRow[]) ?? [];
  for (let i = 0; i < draftList.length; i++) {
    if (i >= throttle) {
      summary.skipped += 1;
      continue;
    }
    const draft = draftList[i];
    // Optimistically mark as sending to avoid duplicate send if retried.
    const { error: updateError } = await client.from('drafts').update({ status: 'sending' }).eq('id', draft.id);
    if (updateError) {
      summary.failed += 1;
      continue;
    }

    const sendPayload = {
      to: draft.contact_id,
      subject: draft.subject ?? '',
      body: draft.body ?? '',
      metadata: draft.metadata ?? {},
      provider: options.provider ?? 'smtp',
      senderIdentity: options.senderIdentity,
    };

    const attemptSend = async () => smtpClient.send(sendPayload);

    try {
      if (options.dryRun) {
        summary.skipped += 1;
        await client.from('drafts').update({ status: 'generated' }).eq('id', draft.id);
        continue;
      }

      let result = await attemptSend();
      if (options.retryOnce && !result?.providerId) {
        result = await attemptSend();
      }

      const outboundRecord = {
        campaign_id: draft.campaign_id,
        draft_id: draft.id,
        contact_id: draft.contact_id,
        company_id: draft.company_id,
        provider: options.provider ?? 'smtp',
        provider_message_id: result.providerId,
        status: 'sent',
        sent_at: new Date().toISOString(),
        metadata: { sendPayload },
      };
      outboundRecords.push(outboundRecord);
      if (options.logger) {
        options.logger({ level: 'info', batchId, draftId: draft.id, status: 'sent' });
      }
      summary.sent += 1;
    } catch (sendError) {
      if (options.retryOnce) {
        try {
          const retryResult = await attemptSend();
          const retryRecord = {
            campaign_id: draft.campaign_id,
            draft_id: draft.id,
            contact_id: draft.contact_id,
            company_id: draft.company_id,
            provider: options.provider ?? 'smtp',
            provider_message_id: retryResult.providerId,
            status: 'sent',
            sent_at: new Date().toISOString(),
            metadata: { sendPayload, retry: true },
          };
          outboundRecords.push(retryRecord);
          if (options.logger) {
            options.logger({ level: 'info', batchId, draftId: draft.id, status: 'sent', retry: true });
          }
          summary.sent += 1;
          continue;
        } catch (retryError) {
          summary.failed += 1;
          await client.from('drafts').update({ status: 'generated' }).eq('id', draft.id);
          if (options.logJson) {
            console.log(
              JSON.stringify({
                level: 'error',
                draftId: draft.id,
                error: (retryError as any)?.message ?? 'send failed',
                batchId,
              })
            );
          }
          if (options.logger) {
            options.logger({
              level: 'error',
              batchId,
              draftId: draft.id,
              error: (retryError as any)?.message ?? 'send failed',
              retry: true,
            });
          }
          continue;
        }
      }

      summary.failed += 1;
      await client.from('drafts').update({ status: 'generated' }).eq('id', draft.id);
      if (options.logJson) {
        console.log(
          JSON.stringify({
            level: 'error',
            draftId: draft.id,
            error: (sendError as any)?.message ?? 'send failed',
            batchId,
          })
        );
      }
      if (options.logger) {
        options.logger({
          level: 'error',
          batchId,
          draftId: draft.id,
          error: (sendError as any)?.message ?? 'send failed',
        });
      }
    }
  }

  if (outboundRecords.length > 0) {
    const { error: insertError } = await client.from('email_outbound').insert(outboundRecords);
    if (insertError) {
      throw insertError;
    }

    await client
      .from('drafts')
      .update({ status: 'sent' })
      .in(
        'id',
        outboundRecords.map((r) => r.draft_id)
      );
  }

  if (options.logJson) {
    console.log(JSON.stringify({ level: 'info', summary }));
  }
  if (options.logger) {
    options.logger({ level: 'info', summary });
  }

  if (options.failOnError && summary.failed > 0) {
    const err = new Error('Send batch failed');
    (err as any).summary = summary;
    throw err;
  }

  return summary;
}
