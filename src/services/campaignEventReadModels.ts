import type { SupabaseClient } from '@supabase/supabase-js';

import { listCampaignOutbounds, type CampaignDetail } from './campaigns.js';

export interface CampaignEventRecord {
  id: string;
  outbound_id: string;
  event_type: string;
  outcome_classification: string | null;
  provider_event_id: string | null;
  occurred_at: string | null;
  created_at: string | null;
  pattern_id: string | null;
  coach_prompt_id: string | null;
  payload: Record<string, unknown> | null;
  draft_id: string | null;
  draft_email_type: string | null;
  draft_status: string | null;
  subject: string | null;
  provider: string | null;
  provider_message_id: string | null;
  sender_identity: string | null;
  sent_at: string | null;
  recipient_email: string | null;
  recipient_email_source: string | null;
  recipient_email_kind: string | null;
  contact_id: string | null;
  contact_name: string | null;
  contact_position: string | null;
  company_id: string | null;
  company_name: string | null;
  company_website: string | null;
}

export interface CampaignEventsView {
  campaign: CampaignDetail;
  events: CampaignEventRecord[];
}

export interface InboxReplyRecord {
  id: string;
  campaign_id: string | null;
  campaign_name: string | null;
  reply_label: string | null;
  handled: boolean;
  handled_at: string | null;
  handled_by: string | null;
  event_type: string;
  occurred_at: string | null;
  outcome_classification: string | null;
  reply_text: string | null;
  draft_id: string | null;
  draft_email_type: string | null;
  draft_status: string | null;
  subject: string | null;
  sender_identity: string | null;
  recipient_email: string | null;
  contact_id: string | null;
  contact_name: string | null;
  contact_position: string | null;
  company_id: string | null;
  company_name: string | null;
}

export interface InboxRepliesView {
  replies: InboxReplyRecord[];
  total: number;
}

function extractReplyText(payload: Record<string, unknown> | null): string | null {
  if (!payload) return null;
  const candidates = [payload.reply_text, payload.text, payload.body];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate;
    }
  }
  return null;
}

export async function listCampaignEvents(client: SupabaseClient, campaignId: string): Promise<CampaignEventsView> {
  const outboundsView = await listCampaignOutbounds(client, campaignId);
  const outboundIds = outboundsView.outbounds.map((outbound) => outbound.id);
  if (outboundIds.length === 0) {
    return { campaign: outboundsView.campaign, events: [] };
  }

  const { data, error } = await client
    .from('email_events')
    .select(
      'id,outbound_id,event_type,outcome_classification,provider_event_id,occurred_at,created_at,payload,pattern_id,coach_prompt_id,draft_id'
    )
    .in('outbound_id', outboundIds)
    .order('occurred_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  const outboundById = new Map(outboundsView.outbounds.map((outbound) => [outbound.id, outbound]));
  const events = ((data ?? []) as Array<Record<string, any>>).map((row) => {
    const outbound = outboundById.get(String(row.outbound_id ?? '')) ?? null;
    const payload = row.payload && typeof row.payload === 'object' ? (row.payload as Record<string, unknown>) : null;

    return {
      id: String(row.id),
      outbound_id: String(row.outbound_id),
      event_type: typeof row.event_type === 'string' ? row.event_type : 'unknown',
      outcome_classification:
        typeof row.outcome_classification === 'string' ? row.outcome_classification : null,
      provider_event_id: typeof row.provider_event_id === 'string' ? row.provider_event_id : null,
      occurred_at: typeof row.occurred_at === 'string' ? row.occurred_at : null,
      created_at: typeof row.created_at === 'string' ? row.created_at : null,
      pattern_id: typeof row.pattern_id === 'string' ? row.pattern_id : null,
      coach_prompt_id: typeof row.coach_prompt_id === 'string' ? row.coach_prompt_id : null,
      payload,
      draft_id: typeof row.draft_id === 'string' ? row.draft_id : outbound?.draft_id ?? null,
      draft_email_type: outbound?.draft_email_type ?? null,
      draft_status: outbound?.draft_status ?? null,
      subject: outbound?.subject ?? null,
      provider: outbound?.provider ?? null,
      provider_message_id: outbound?.provider_message_id ?? null,
      sender_identity: outbound?.sender_identity ?? null,
      sent_at: outbound?.sent_at ?? null,
      recipient_email: outbound?.recipient_email ?? null,
      recipient_email_source: outbound?.recipient_email_source ?? null,
      recipient_email_kind: outbound?.recipient_email_kind ?? null,
      contact_id: outbound?.contact_id ?? null,
      contact_name: outbound?.contact_name ?? null,
      contact_position: outbound?.contact_position ?? null,
      company_id: outbound?.company_id ?? null,
      company_name: outbound?.company_name ?? null,
      company_website: outbound?.company_website ?? null,
    } satisfies CampaignEventRecord;
  });

  return {
    campaign: outboundsView.campaign,
    events,
  };
}

export async function listInboxReplies(
  client: SupabaseClient,
  filters: {
    limit?: number;
    campaignId?: string;
    replyLabel?: string;
    handled?: boolean;
    linkage?: 'all' | 'linked' | 'unlinked';
  } = {}
): Promise<InboxRepliesView> {
  let query = client
    .from('email_events')
    .select(
      'id,outbound_id,event_type,reply_label,handled_at,handled_by,outcome_classification,occurred_at,created_at,payload,draft_id'
    )
    .in('event_type', ['reply', 'replied', 'bounced', 'unsubscribed', 'complaint'])
    .order('occurred_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (filters.replyLabel) {
    query = query.eq('reply_label', filters.replyLabel);
  }
  if (typeof filters.handled === 'boolean') {
    query = filters.handled ? query.not('handled_at', 'is', null) : query.is('handled_at', null);
  }
  if (filters.limit) {
    query = query.limit(filters.limit);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const eventRows = (data ?? []) as Array<Record<string, any>>;
  const outboundIds = Array.from(
    new Set(eventRows.map((row) => String(row.outbound_id ?? '')).filter(Boolean))
  );
  const draftIdsFromEvents = Array.from(
    new Set(eventRows.map((row) => String(row.draft_id ?? '')).filter(Boolean))
  );

  const outboundsById = new Map<
    string,
    {
      id: string;
      campaign_id: string | null;
      draft_id: string | null;
      contact_id: string | null;
      company_id: string | null;
      sender_identity: string | null;
      metadata: Record<string, unknown> | null;
    }
  >();
    if (outboundIds.length > 0) {
    let outboundQuery = client
      .from('email_outbound')
      .select('id,campaign_id,draft_id,contact_id,company_id,sender_identity,metadata')
      .in('id', outboundIds);

    if (filters.campaignId) {
      outboundQuery = outboundQuery.eq('campaign_id', filters.campaignId);
    }
    if (filters.linkage === 'linked') {
      // "Linked" in Inbox UX means linked to a campaign (not merely having an outbound row).
      outboundQuery = outboundQuery.not('campaign_id', 'is', null);
    } else if (filters.linkage === 'unlinked') {
      outboundQuery = outboundQuery.is('campaign_id', null);
    }

    const { data: outboundRows, error: outboundError } = await outboundQuery;
    if (outboundError) {
      throw outboundError;
    }

    for (const outbound of (outboundRows ?? []) as Array<Record<string, any>>) {
      outboundsById.set(String(outbound.id), {
        id: String(outbound.id),
        campaign_id: typeof outbound.campaign_id === 'string' ? outbound.campaign_id : null,
        draft_id: typeof outbound.draft_id === 'string' ? outbound.draft_id : null,
        contact_id: typeof outbound.contact_id === 'string' ? outbound.contact_id : null,
        company_id: typeof outbound.company_id === 'string' ? outbound.company_id : null,
        sender_identity:
          typeof outbound.sender_identity === 'string' ? outbound.sender_identity : null,
        metadata:
          outbound.metadata && typeof outbound.metadata === 'object'
            ? (outbound.metadata as Record<string, unknown>)
            : null,
      });
    }
  }

  const campaignIds = Array.from(
    new Set(Array.from(outboundsById.values()).map((row) => row.campaign_id ?? '').filter(Boolean))
  );
  const draftIds = Array.from(
    new Set([
      ...draftIdsFromEvents,
      ...Array.from(outboundsById.values()).map((row) => row.draft_id ?? '').filter(Boolean),
    ])
  );
  const contactIds = Array.from(
    new Set(Array.from(outboundsById.values()).map((row) => row.contact_id ?? '').filter(Boolean))
  );
  const companyIds = Array.from(
    new Set(Array.from(outboundsById.values()).map((row) => row.company_id ?? '').filter(Boolean))
  );

  const campaignsById = new Map<string, { name: string | null }>();
  if (campaignIds.length > 0) {
    const { data: campaignRows, error: campaignError } = await client
      .from('campaigns')
      .select('id,name')
      .in('id', campaignIds);
    if (campaignError) {
      throw campaignError;
    }
    for (const campaign of (campaignRows ?? []) as Array<Record<string, any>>) {
      campaignsById.set(String(campaign.id), {
        name: typeof campaign.name === 'string' ? campaign.name : null,
      });
    }
  }

  const draftsById = new Map<
    string,
    { id: string; email_type: string | null; status: string | null; subject: string | null }
  >();
  if (draftIds.length > 0) {
    const { data: draftRows, error: draftError } = await client
      .from('drafts')
      .select('id,email_type,status,subject')
      .in('id', draftIds);
    if (draftError) {
      throw draftError;
    }
    for (const draft of (draftRows ?? []) as Array<Record<string, any>>) {
      draftsById.set(String(draft.id), {
        id: String(draft.id),
        email_type: typeof draft.email_type === 'string' ? draft.email_type : null,
        status: typeof draft.status === 'string' ? draft.status : null,
        subject: typeof draft.subject === 'string' ? draft.subject : null,
      });
    }
  }

  const contactsById = new Map<string, { full_name: string | null; position: string | null }>();
  if (contactIds.length > 0) {
    const { data: contactRows, error: contactError } = await client
      .from('employees')
      .select('id,full_name,position')
      .in('id', contactIds);
    if (contactError) {
      throw contactError;
    }
    for (const contact of (contactRows ?? []) as Array<Record<string, any>>) {
      contactsById.set(String(contact.id), {
        full_name: typeof contact.full_name === 'string' ? contact.full_name : null,
        position: typeof contact.position === 'string' ? contact.position : null,
      });
    }
  }

  const companiesById = new Map<string, { company_name: string | null }>();
  if (companyIds.length > 0) {
    const { data: companyRows, error: companyError } = await client
      .from('companies')
      .select('id,company_name')
      .in('id', companyIds);
    if (companyError) {
      throw companyError;
    }
    for (const company of (companyRows ?? []) as Array<Record<string, any>>) {
      companiesById.set(String(company.id), {
        company_name: typeof company.company_name === 'string' ? company.company_name : null,
      });
    }
  }

  const replies = eventRows
    .map((row) => {
      const outbound =
        typeof row.outbound_id === 'string' ? outboundsById.get(row.outbound_id) ?? null : null;
      if (filters.campaignId && outbound?.campaign_id !== filters.campaignId) {
        return null;
      }
      if (filters.linkage === 'linked') {
        // Only include events that can be tied to a campaign-linked outbound.
        if (!outbound) return null;
      } else if (filters.linkage === 'unlinked') {
        // Include events that are not tied to a campaign:
        // - no outbound_id at all, OR
        // - outbound exists but campaign_id is null (e.g. inbox placeholder outbound)
        const hasOutboundId = typeof row.outbound_id === 'string' && row.outbound_id.trim().length > 0;
        if (hasOutboundId && !outbound) return null;
        if (outbound && outbound.campaign_id) return null;
      }
      const draftId =
        typeof row.draft_id === 'string' ? row.draft_id : outbound?.draft_id ?? null;
      const draft = draftId ? draftsById.get(draftId) ?? null : null;
      const contact =
        outbound?.contact_id ? contactsById.get(outbound.contact_id) ?? null : null;
      const company =
        outbound?.company_id ? companiesById.get(outbound.company_id) ?? null : null;
      const payload =
        row.payload && typeof row.payload === 'object' ? (row.payload as Record<string, unknown>) : null;
      const payloadSubject =
        payload && typeof payload.subject === 'string' && payload.subject.trim().length > 0
          ? payload.subject
          : null;
      const payloadFrom =
        payload && typeof payload.from === 'string' && payload.from.trim().length > 0 ? payload.from : null;

      return {
        id: String(row.id),
        campaign_id: outbound?.campaign_id ?? null,
        campaign_name: outbound?.campaign_id
          ? campaignsById.get(outbound.campaign_id)?.name ?? null
          : null,
        reply_label: typeof row.reply_label === 'string' ? row.reply_label : null,
        handled: typeof row.handled_at === 'string' && row.handled_at.trim().length > 0,
        handled_at: typeof row.handled_at === 'string' ? row.handled_at : null,
        handled_by: typeof row.handled_by === 'string' ? row.handled_by : null,
        event_type: typeof row.event_type === 'string' ? row.event_type : 'unknown',
        occurred_at: typeof row.occurred_at === 'string' ? row.occurred_at : null,
        outcome_classification:
          typeof row.outcome_classification === 'string' ? row.outcome_classification : null,
        reply_text: extractReplyText(payload),
        draft_id: draftId,
        draft_email_type: draft?.email_type ?? null,
        draft_status: draft?.status ?? null,
        subject: draft?.subject ?? payloadSubject,
        sender_identity: outbound?.sender_identity ?? null,
        recipient_email:
          typeof outbound?.metadata?.recipient_email === 'string'
            ? String(outbound.metadata.recipient_email)
            : null,
        contact_id: outbound?.contact_id ?? null,
        contact_name: contact?.full_name ?? payloadFrom,
        contact_position: contact?.position ?? null,
        company_id: outbound?.company_id ?? null,
        company_name: company?.company_name ?? null,
      } satisfies InboxReplyRecord;
    })
    .filter((row): row is InboxReplyRecord => row !== null);

  return {
    replies,
    total: replies.length,
  };
}
