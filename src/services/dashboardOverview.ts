import type { SupabaseClient } from '@supabase/supabase-js';

type DashboardCampaignRow = {
  id: string;
  name: string | null;
  status: string | null;
  updated_at?: string | null;
};

type DashboardDraftRow = {
  id: string;
  campaign_id: string | null;
  status: string | null;
  email_type?: string | null;
  updated_at?: string | null;
};

type DashboardEventRow = {
  id: string;
  event_type: string | null;
  reply_label?: string | null;
  handled_at?: string | null;
  occurred_at?: string | null;
  draft_id?: string | null;
};

type DashboardCompanyRow = {
  id: string;
  company_name: string | null;
  company_research: unknown;
  updated_at?: string | null;
};

export interface DashboardOverview {
  campaigns: {
    total: number;
    active: number;
    byStatus: Array<{ status: string; count: number }>;
  };
  pending: {
    draftsOnReview: number;
    inboxReplies: number;
    staleEnrichment: number;
    missingEnrichment: number;
  };
  recentActivity: Array<{
    kind: 'campaign' | 'draft' | 'reply';
    id: string;
    timestamp: string | null;
    title: string;
    subtitle: string | null;
    campaignId?: string | null;
  }>;
}

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function deriveEnrichmentStatus(store: unknown, fallbackUpdatedAt: string | null | undefined, maxAgeDays = 90) {
  if (!store) {
    return 'missing' as const;
  }

  const typedStore = store as { lastUpdatedAt?: unknown };
  const lastUpdatedAt =
    typeof typedStore.lastUpdatedAt === 'string' && typedStore.lastUpdatedAt.trim().length > 0
      ? typedStore.lastUpdatedAt
      : fallbackUpdatedAt ?? null;
  const updatedAtDate = parseIsoDate(lastUpdatedAt);
  if (!updatedAtDate) {
    return 'stale' as const;
  }

  const ageMs = Date.now() - updatedAtDate.getTime();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  return ageMs > maxAgeMs ? ('stale' as const) : ('fresh' as const);
}

function sortRecent<T extends { timestamp: string | null }>(rows: T[]): T[] {
  return rows.sort((left, right) => {
    const leftTs = parseIsoDate(left.timestamp)?.getTime() ?? 0;
    const rightTs = parseIsoDate(right.timestamp)?.getTime() ?? 0;
    return rightTs - leftTs;
  });
}

export async function getDashboardOverview(client: SupabaseClient): Promise<DashboardOverview> {
  const [campaignsRes, draftsRes, companiesRes] = await Promise.all([
    client.from('campaigns').select('id,name,status,updated_at'),
    client.from('drafts').select('id,campaign_id,status,email_type,updated_at').order('updated_at', { ascending: false }).limit(20),
    client.from('companies').select('id,company_name,company_research,updated_at'),
  ]);

  if (campaignsRes.error) throw campaignsRes.error;
  if (draftsRes.error) throw draftsRes.error;
  if (companiesRes.error) throw companiesRes.error;

  // email_events query may fail if handled_at column is missing (migration not applied) — degrade gracefully
  let events: DashboardEventRow[] = [];
  try {
    const eventsRes = await client
      .from('email_events')
      .select('id,event_type,reply_label,handled_at,occurred_at,draft_id')
      .order('occurred_at', { ascending: false })
      .limit(20);
    if (!eventsRes.error) {
      events = (eventsRes.data ?? []) as DashboardEventRow[];
    }
  } catch {
    // graceful degradation — dashboard works without events
  }

  const campaigns = (campaignsRes.data ?? []) as DashboardCampaignRow[];
  const drafts = (draftsRes.data ?? []) as DashboardDraftRow[];
  const companies = (companiesRes.data ?? []) as DashboardCompanyRow[];

  const campaignStatusCounts = new Map<string, number>();
  for (const campaign of campaigns) {
    const status = campaign.status ?? 'unknown';
    campaignStatusCounts.set(status, (campaignStatusCounts.get(status) ?? 0) + 1);
  }

  let staleEnrichment = 0;
  let missingEnrichment = 0;
  for (const company of companies) {
    const status = deriveEnrichmentStatus(company.company_research, company.updated_at ?? null);
    if (status === 'stale') staleEnrichment += 1;
    if (status === 'missing') missingEnrichment += 1;
  }

  const campaignNameById = new Map(campaigns.map((campaign) => [campaign.id, campaign.name ?? campaign.id]));
  const draftActivity = drafts.map((draft) => ({
    kind: 'draft' as const,
    id: draft.id,
    timestamp: draft.updated_at ?? null,
    title: `Draft ${draft.status ?? 'unknown'}`,
    subtitle: draft.email_type ? `${draft.email_type} email` : null,
    campaignId: draft.campaign_id ?? null,
  }));
  const campaignActivity = campaigns.map((campaign) => ({
    kind: 'campaign' as const,
    id: campaign.id,
    timestamp: campaign.updated_at ?? null,
    title: campaign.name ?? campaign.id,
    subtitle: campaign.status ? `status: ${campaign.status}` : null,
    campaignId: campaign.id,
  }));
  const replyActivity = events
    .filter((event) => event.reply_label || event.event_type)
    .map((event) => ({
      kind: 'reply' as const,
      id: event.id,
      timestamp: event.occurred_at ?? null,
      title: `Reply ${event.reply_label ?? event.event_type ?? 'event'}`,
      subtitle: event.draft_id ? `draft ${event.draft_id}` : null,
      campaignId: null,
    }));

  return {
    campaigns: {
      total: campaigns.length,
      active: campaigns.filter((campaign) => (campaign.status ?? 'draft') !== 'complete').length,
      byStatus: Array.from(campaignStatusCounts.entries())
        .map(([status, count]) => ({ status, count }))
        .sort((left, right) => right.count - left.count || left.status.localeCompare(right.status)),
    },
    pending: {
      draftsOnReview: drafts.filter((draft) => draft.status === 'generated').length,
      inboxReplies: events.filter((event) => Boolean(event.reply_label) && !event.handled_at).length,
      staleEnrichment,
      missingEnrichment,
    },
    recentActivity: sortRecent([...replyActivity, ...draftActivity, ...campaignActivity]).slice(0, 10).map((item) => ({
      ...item,
      subtitle:
        item.kind === 'draft' && item.campaignId
          ? `${item.subtitle ?? 'draft'} · ${campaignNameById.get(item.campaignId) ?? item.campaignId}`
          : item.subtitle,
    })),
  };
}
