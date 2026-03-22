import type { SupabaseClient } from '@supabase/supabase-js';

export interface CampaignAudienceCampaign {
  id: string;
  name: string;
  status: string;
  segment_id: string;
  segment_version: number;
  offer_id?: string | null;
  icp_hypothesis_id?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CampaignAudienceRow {
  campaign_id: string;
  company_id: string | null;
  contact_id: string | null;
  source: 'segment_snapshot' | 'manual_attach';
  snapshot: unknown;
  attached_at?: string | null;
}

async function getAudienceCampaign(
  client: SupabaseClient,
  campaignId: string
): Promise<CampaignAudienceCampaign> {
  const { data, error } = await client
    .from('campaigns')
    .select('id,name,status,segment_id,segment_version,offer_id,icp_hypothesis_id,metadata,created_at,updated_at')
    .eq('id', campaignId)
    .single();

  if (error || !data) {
    throw error ?? new Error('Campaign not found');
  }

  if (typeof data.segment_version !== 'number') {
    throw new Error('Campaign missing segment_version');
  }

  return data as CampaignAudienceCampaign;
}

export async function listCampaignAudience(
  client: SupabaseClient,
  campaignId: string,
  options: { limit?: number; includeSnapshot?: boolean } = {}
): Promise<{ campaign: CampaignAudienceCampaign; rows: CampaignAudienceRow[] }> {
  const campaign = await getAudienceCampaign(client, campaignId);
  const selectCols = options.includeSnapshot !== false
    ? 'company_id,contact_id,snapshot'
    : 'company_id,contact_id';

  let baseQuery: any = client
    .from('segment_members')
    .select(selectCols)
    .match({
      segment_id: campaign.segment_id,
      segment_version: campaign.segment_version,
    });
  if (typeof options.limit === 'number' && typeof baseQuery?.limit === 'function') {
    baseQuery = baseQuery.limit(options.limit);
  }
  const { data: baseRows, error: baseError } = await baseQuery;

  if (baseError) {
    throw baseError;
  }

  const additionSelectCols = options.includeSnapshot !== false
    ? 'campaign_id,company_id,contact_id,source,snapshot,attached_at'
    : 'campaign_id,company_id,contact_id,source,attached_at';

  const { data: additionRows, error: additionError } = await (client
    .from('campaign_member_additions')
    .select(additionSelectCols) as any)
    .eq('campaign_id', campaignId);

  if (additionError) {
    throw additionError;
  }

  const { data: exclusionRows, error: exclusionError } = await client
    .from('campaign_member_exclusions')
    .select('contact_id')
    .eq('campaign_id', campaignId);

  if (exclusionError) {
    throw exclusionError;
  }

  const excludedContactIds = new Set(
    ((exclusionRows ?? []) as Array<Record<string, unknown>>)
      .map((row) => (typeof row.contact_id === 'string' ? row.contact_id : null))
      .filter((value): value is string => Boolean(value))
  );

  const rows: CampaignAudienceRow[] = [];
  const contactIds = new Set<string>();

  for (const row of (baseRows ?? []) as Array<Record<string, unknown>>) {
    const contactId = typeof row.contact_id === 'string' ? row.contact_id : null;
    rows.push({
      campaign_id: campaignId,
      company_id: typeof row.company_id === 'string' ? row.company_id : null,
      contact_id: contactId,
      source: 'segment_snapshot',
      snapshot: row.snapshot ?? null,
      attached_at: null,
    });
    if (contactId) {
      contactIds.add(contactId);
    }
  }

  for (const row of (additionRows ?? []) as Array<Record<string, unknown>>) {
    const contactId = typeof row.contact_id === 'string' ? row.contact_id : null;
    if (contactId && contactIds.has(contactId)) {
      continue;
    }
    rows.push({
      campaign_id: campaignId,
      company_id: typeof row.company_id === 'string' ? row.company_id : null,
      contact_id: contactId,
      source: 'manual_attach',
      snapshot: row.snapshot ?? null,
      attached_at: typeof row.attached_at === 'string' ? row.attached_at : null,
    });
    if (contactId) {
      contactIds.add(contactId);
    }
  }

  return {
    campaign,
    rows: rows.filter((row) => !row.contact_id || !excludedContactIds.has(row.contact_id)),
  };
}
