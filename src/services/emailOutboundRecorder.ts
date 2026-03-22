import type { SupabaseClient } from '@supabase/supabase-js';

import { resolveRecipientEmail, type RecipientEmailKind, type RecipientEmailSource } from './recipientResolver';

export type EmailOutboundStatus = 'sent' | 'failed';

export interface EmailOutboundRecordInput {
  draftId?: string;
  draft_id?: string;
  provider: string;
  providerMessageId?: string | null;
  provider_message_id?: string | null;
  senderIdentity?: string | null;
  sender_identity?: string | null;
  recipientEmail?: string | null;
  recipient_email?: string | null;
  recipientEmailSource?: RecipientEmailSource;
  recipient_email_source?: RecipientEmailSource;
  recipientEmailKind?: RecipientEmailKind;
  recipient_email_kind?: RecipientEmailKind;
  status?: EmailOutboundStatus;
  sentAt?: string | null;
  sent_at?: string | null;
  error?: string | null;
  metadata?: Record<string, unknown> | null;
}

function pickFirst<T>(...values: Array<T | undefined>) {
  for (const value of values) {
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

export async function recordEmailOutbound(client: SupabaseClient, input: EmailOutboundRecordInput) {
  const draftId = pickFirst(input.draftId, input.draft_id);
  if (!draftId) {
    throw new Error('record payload is missing draftId');
  }
  if (!input.provider) {
    throw new Error('record payload is missing provider');
  }

  const providerMessageId = pickFirst(input.providerMessageId, input.provider_message_id) ?? null;
  if (providerMessageId) {
    const { data: existing, error: existingError } = await client
      .from('email_outbound')
      .select('*')
      .eq('provider', input.provider)
      .eq('provider_message_id', providerMessageId)
      .limit(1);

    if (existingError) {
      throw existingError;
    }

    if (Array.isArray(existing) && existing.length > 0) {
      return { deduped: true, outbound: existing[0] };
    }
  }

  const { data: draft, error: draftError } = await client
    .from('drafts')
    .select(
      [
        'id',
        'campaign_id',
        'contact_id',
        'company_id',
        'pattern_mode',
        'metadata',
        'contact:employees(id,work_email,work_email_status,generic_email,generic_email_status)',
      ].join(',')
    )
    .eq('id', draftId)
    .single();

  if (draftError || !draft) {
    throw draftError ?? new Error('Draft not found');
  }

  const resolvedRecipient = resolveRecipientEmail({
    work_email: (draft as any).contact?.work_email,
    work_email_status: (draft as any).contact?.work_email_status,
    generic_email: (draft as any).contact?.generic_email,
    generic_email_status: (draft as any).contact?.generic_email_status,
  });
  const recipientEmail = pickFirst(input.recipientEmail, input.recipient_email) ?? resolvedRecipient.recipientEmail;
  const recipientEmailSource =
    pickFirst(input.recipientEmailSource, input.recipient_email_source) ?? resolvedRecipient.recipientEmailSource;
  const recipientEmailKind =
    pickFirst(input.recipientEmailKind, input.recipient_email_kind) ?? resolvedRecipient.recipientEmailKind;
  const status = input.status ?? 'sent';

  if (!recipientEmail && status === 'sent') {
    throw new Error('cannot record successful outbound without a resolved recipient email');
  }

  const senderIdentity = pickFirst(input.senderIdentity, input.sender_identity) ?? null;
  const sentAt = pickFirst(input.sentAt, input.sent_at) ?? null;
  const outboundMetadata = {
    ...(((draft as any).metadata as Record<string, unknown> | null) ?? {}),
    ...(input.metadata ?? {}),
    recipient_email: recipientEmail,
    recipient_email_source: recipientEmailSource,
    recipient_email_kind: recipientEmailKind,
  };

  const outboundRow = {
    campaign_id: (draft as any).campaign_id,
    draft_id: (draft as any).id,
    contact_id: (draft as any).contact_id,
    company_id: (draft as any).company_id,
    provider: input.provider,
    provider_message_id: providerMessageId,
    sender_identity: senderIdentity,
    pattern_mode: (draft as any).pattern_mode ?? null,
    status,
    sent_at: sentAt,
    error: input.error ?? null,
    metadata: outboundMetadata,
  };

  const { data: inserted, error: insertError } = await client
    .from('email_outbound')
    .insert(outboundRow)
    .select('*')
    .single();

  if (insertError || !inserted) {
    throw insertError ?? new Error('Failed to record outbound row');
  }

  if (status === 'sent') {
    const { data: updatedDraft, error: updateError } = await client
      .from('drafts')
      .update({ status: 'sent' })
      .eq('id', draftId)
      .select('*')
      .single();

    if (updateError || !updatedDraft) {
      throw updateError ?? new Error('Failed to update draft status');
    }

    return { deduped: false, outbound: inserted, draft: updatedDraft };
  }

  return { deduped: false, outbound: inserted };
}
