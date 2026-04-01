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

type DashboardOutboundRow = {
  id: string;
  campaign_id: string | null;
  draft_id?: string | null;
  contact_id?: string | null;
  company_id?: string | null;
  sender_identity?: string | null;
  status?: string | null;
  sent_at?: string | null;
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
    kind: 'campaign' | 'draft' | 'reply' | 'outbound';
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

function formatOutboundTitle(emailType: string | null | undefined): string {
  if (emailType === 'intro') {
    return 'Intro sent';
  }
  if (emailType === 'bump') {
    return 'Bump sent';
  }
  return 'Email sent';
}

function formatOutboundSubtitle(parts: Array<string | null | undefined>): string | null {
  const filtered = parts.map((part) => (typeof part === 'string' ? part.trim() : '')).filter(Boolean);
  return filtered.length > 0 ? filtered.join(' · ') : null;
}

export async function getDashboardOverview(client: SupabaseClient): Promise<DashboardOverview> {
  const [campaignsRes, draftsRes, sentDraftsRes, companiesRes] = await Promise.all([
    client.from('campaigns').select('id,name,status,updated_at'),
    client.from('drafts').select('id,campaign_id,status,email_type,updated_at').order('updated_at', { ascending: false }).limit(20),
    client
      .from('drafts')
      .select('id,campaign_id,email_type,updated_at')
      .eq('status', 'sent')
      .order('updated_at', { ascending: false })
      .limit(20),
    client.from('companies').select('id,company_name,company_research,updated_at'),
  ]);

  if (campaignsRes.error) throw campaignsRes.error;
  if (draftsRes.error) throw draftsRes.error;
  if (sentDraftsRes.error) throw sentDraftsRes.error;
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
  const sentDrafts = (sentDraftsRes.data ?? []) as DashboardDraftRow[];
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
  const outboundDraftIds = Array.from(
    new Set(sentDrafts.map((row) => String(row.id ?? '')).filter(Boolean))
  );

  const sentDraftsById = new Map<string, { id: string; campaign_id: string | null; email_type: string | null; updated_at: string | null }>(
    sentDrafts.map((draft) => [
      String(draft.id),
      {
        id: String(draft.id),
        campaign_id: draft.campaign_id ?? null,
        email_type: typeof draft.email_type === 'string' ? draft.email_type : null,
        updated_at: typeof draft.updated_at === 'string' ? draft.updated_at : null,
      },
    ])
  );

  let outbounds: DashboardOutboundRow[] = [];
  if (outboundDraftIds.length > 0) {
    const { data: outboundRows, error: outboundError } = await client
      .from('email_outbound')
      .select('id,campaign_id,draft_id,contact_id,company_id,sender_identity,status,sent_at')
      .in('draft_id', outboundDraftIds)
      .eq('status', 'sent');

    if (outboundError) {
      throw outboundError;
    }

    const sentRows = (outboundRows ?? []) as DashboardOutboundRow[];
    const latestSentByDraft = new Map<string, DashboardOutboundRow>();
    for (const row of sentRows) {
      const draftId = typeof row.draft_id === 'string' ? row.draft_id : null;
      if (!draftId) {
        continue;
      }
      const existing = latestSentByDraft.get(draftId);
      const rowTs = parseIsoDate(row.sent_at)?.getTime() ?? 0;
      const existingTs = parseIsoDate(existing?.sent_at)?.getTime() ?? 0;
      if (!existing || rowTs >= existingTs) {
        latestSentByDraft.set(draftId, row);
      }
    }

    outbounds = Array.from(latestSentByDraft.values());
  }

  const outboundContactIds = Array.from(
    new Set(outbounds.map((row) => String(row.contact_id ?? '')).filter(Boolean))
  );
  const outboundCompanyIds = Array.from(
    new Set(outbounds.map((row) => String(row.company_id ?? '')).filter(Boolean))
  );

  const contactsById = new Map<string, { id: string; full_name: string | null }>();
  if (outboundContactIds.length > 0) {
    const { data: outboundContactRows, error: outboundContactError } = await client
      .from('employees')
      .select('id,full_name')
      .in('id', outboundContactIds);

    if (outboundContactError) {
      throw outboundContactError;
    }

    for (const row of (outboundContactRows ?? []) as Array<Record<string, unknown>>) {
      contactsById.set(String(row.id), {
        id: String(row.id),
        full_name: typeof row.full_name === 'string' ? row.full_name : null,
      });
    }
  }

  const companyNameById = new Map<string, string | null>(
    companies.map((company) => [company.id, company.company_name ?? null])
  );
  if (outboundCompanyIds.length > 0) {
    const missingCompanyIds = outboundCompanyIds.filter((companyId) => !companyNameById.has(companyId));
    if (missingCompanyIds.length > 0) {
      const { data: outboundCompanyRows, error: outboundCompanyError } = await client
        .from('companies')
        .select('id,company_name')
        .in('id', missingCompanyIds);

      if (outboundCompanyError) {
        throw outboundCompanyError;
      }

      for (const row of (outboundCompanyRows ?? []) as Array<Record<string, unknown>>) {
        companyNameById.set(
          String(row.id),
          typeof row.company_name === 'string' ? row.company_name : null
        );
      }
    }
  }

  const draftActivity = drafts
    .filter((draft) => draft.status !== 'sent')
    .map((draft) => ({
    kind: 'draft' as const,
    id: draft.id,
    timestamp: draft.updated_at ?? null,
    title: `Draft ${draft.status ?? 'unknown'}`,
    subtitle: draft.email_type ? `${draft.email_type} email` : null,
    campaignId: draft.campaign_id ?? null,
    }));
  const outboundActivity = outbounds.map((outbound) => {
    const draft =
      typeof outbound.draft_id === 'string' ? sentDraftsById.get(outbound.draft_id) ?? null : null;
    const contact =
      typeof outbound.contact_id === 'string'
        ? contactsById.get(outbound.contact_id) ?? null
        : null;
    const companyName =
      typeof outbound.company_id === 'string'
        ? companyNameById.get(outbound.company_id) ?? null
        : null;

    return {
      kind: 'outbound' as const,
      id: outbound.id,
      timestamp: outbound.sent_at ?? draft?.updated_at ?? null,
      title: formatOutboundTitle(draft?.email_type),
      subtitle: formatOutboundSubtitle([
        companyName,
        contact?.full_name ?? null,
        outbound.sender_identity ?? null,
      ]),
      campaignId: outbound.campaign_id ?? draft?.campaign_id ?? null,
    };
  });
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
    recentActivity: sortRecent([...replyActivity, ...outboundActivity, ...draftActivity, ...campaignActivity]).slice(0, 10).map((item) => ({
      ...item,
      subtitle:
        item.kind === 'draft' && item.campaignId
          ? `${item.subtitle ?? 'draft'} · ${campaignNameById.get(item.campaignId) ?? item.campaignId}`
          : item.subtitle,
    })),
  };
}
