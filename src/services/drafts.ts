import type { SupabaseClient } from '@supabase/supabase-js';

import type { AiClient, EmailDraftRequest } from './aiClient';

interface GenerateDraftsOptions {
  campaignId: string;
  dryRun?: boolean;
  failFast?: boolean;
  limit?: number;
}

interface SegmentMemberRow {
  contact_id: string;
  company_id: string;
  snapshot: {
    request?: EmailDraftRequest;
  };
}

export async function generateDrafts(
  client: SupabaseClient,
  aiClient: AiClient,
  options: GenerateDraftsOptions
) {
  const campaignRes = await client.from('campaigns').select('*').eq('id', options.campaignId).single();
  if (campaignRes.error || !campaignRes.data) {
    throw campaignRes.error ?? new Error('Campaign not found');
  }

  const campaign = campaignRes.data;

  const membersRes = await client
    .from('segment_members')
    .select('contact_id, company_id, snapshot')
    .match({ segment_id: campaign.segment_id, segment_version: campaign.segment_version })
    .limit(options.limit ?? 100);

  if (membersRes.error || !membersRes.data) {
    throw membersRes.error ?? new Error('No segment members found');
  }

  const draftsPayload = [] as any[];
  const summary = { generated: 0, skipped: 0, failed: 0, dryRun: Boolean(options.dryRun) };

  for (const member of membersRes.data as SegmentMemberRow[]) {
    if (!member.snapshot?.request) {
      continue;
    }

    if (options.dryRun) {
      summary.skipped += 1;
      continue;
    }

    const response = await aiClient.generateDraft(member.snapshot.request);

    draftsPayload.push({
      campaign_id: options.campaignId,
      contact_id: member.contact_id,
      company_id: member.company_id,
      email_type: response.metadata.email_type,
      language: response.metadata.language,
      pattern_mode: response.metadata.pattern_mode,
      subject: response.subject,
      body: response.body,
      metadata: response.metadata,
      status: 'generated',
    });
    summary.generated += 1;
  }

  if (draftsPayload.length === 0) {
    return summary;
  }

  const insertRes = await client.from('drafts').insert(draftsPayload).select();

  if (insertRes.error) {
    if (options.failFast) {
      throw insertRes.error;
    }
    summary.failed += draftsPayload.length;
    return summary;
  }

  return summary;
}
