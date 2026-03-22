import type { SupabaseClient } from '@supabase/supabase-js';

interface BaseAnalyticsRow {
  event_type: string;
  outcome_classification?: string | null;
}

interface IcpAnalyticsRow extends BaseAnalyticsRow {
  icp_profile_id: string | null;
  icp_hypothesis_id: string | null;
  occurred_at?: string;
}

interface SegmentRoleAnalyticsRow extends BaseAnalyticsRow {
  segment_id: string | null;
  segment_version: number | null;
  role: string | null;
  occurred_at?: string;
}

interface PatternAnalyticsRow extends BaseAnalyticsRow {
  draft_pattern: string | null;
  user_edited: boolean | null;
  occurred_at?: string;
}

interface EventOfferingAnalyticsRow extends BaseAnalyticsRow {
  draft_id: string | null;
  outbound_id: string | null;
  occurred_at?: string;
}

interface EventOfferAnalyticsRow extends BaseAnalyticsRow {
  draft_id: string | null;
  outbound_id: string | null;
  occurred_at?: string;
}

interface OutboundAnalyticsContextRow {
  id: string;
  draft_id: string | null;
  campaign_id: string | null;
  sender_identity: string | null;
  recipient_email_source: string | null;
  recipient_email_kind: string | null;
}

interface CampaignAnalyticsContextRow {
  id: string;
  offer_id: string | null;
  icp_hypothesis_id: string | null;
}

interface HypothesisAnalyticsContextRow {
  id: string;
  hypothesis_label: string | null;
  offer_id?: string | null;
}

interface OfferAnalyticsContextRow {
  id: string;
  title: string | null;
  project_name: string | null;
}

interface DraftRejectionAnalyticsRow {
  campaign_id: string | null;
  email_type: string | null;
  draft_pattern?: string | null;
  status: string | null;
  updated_at?: string;
  metadata?: Record<string, unknown> | null;
}

interface FunnelDraftRow {
  id: string;
  email_type: string | null;
  status: string | null;
  metadata?: Record<string, unknown> | null;
}

interface FunnelOutboundRow {
  id: string;
  draft_id: string | null;
  status: string | null;
}

interface FunnelEventRow {
  outbound_id: string | null;
  event_type: string | null;
}

export interface AnalyticsOptions {
  since?: string;
}

export interface AnalyticsResult {
  delivered: number;
  opened: number;
  replied: number;
  positive_replies: number;
}

export interface DraftRejectionAnalyticsBreakdown {
  total_rejected: number;
  by_reason: Array<{ review_reason_code: string; count: number }>;
  by_pattern: Array<{ draft_pattern: string | null; count: number }>;
  by_pattern_and_reason: Array<{ draft_pattern: string | null; review_reason_code: string; count: number }>;
  by_campaign: Array<{ campaign_id: string | null; count: number }>;
  by_email_type: Array<{ email_type: string | null; count: number }>;
  by_icp_profile: Array<{ icp_profile_id: string | null; count: number }>;
  by_icp_hypothesis: Array<{ icp_hypothesis_id: string | null; count: number }>;
}

function accumulateMetrics<T extends BaseAnalyticsRow>(
  rows: T[]
): AnalyticsResult {
  return rows.reduce<AnalyticsResult>(
    (acc, row) => {
      if (row.event_type === 'delivered') acc.delivered += 1;
      if (row.event_type === 'opened') acc.opened += 1;
      if (row.event_type === 'replied') {
        acc.replied += 1;
        if (
          row.outcome_classification === 'meeting' ||
          row.outcome_classification === 'soft_interest'
        ) {
          acc.positive_replies += 1;
        }
      }
      return acc;
    },
    { delivered: 0, opened: 0, replied: 0, positive_replies: 0 }
  );
}

async function loadEventExecutionContext(
  client: SupabaseClient,
  options: AnalyticsOptions
) {
  let eventsQuery: any = client
    .from('email_events')
    .select('draft_id,outbound_id,event_type,outcome_classification,occurred_at');
  if (options.since && typeof eventsQuery.gte === 'function') {
    eventsQuery = eventsQuery.gte('occurred_at', options.since);
  }

  const { data: eventData, error: eventError } = (await eventsQuery) as {
    data: EventOfferAnalyticsRow[] | null;
    error: Error | null;
  };
  if (eventError) throw eventError;

  const events = eventData ?? [];
  const outboundIds = Array.from(
    new Set(events.map((row) => row.outbound_id).filter((value): value is string => typeof value === 'string'))
  );

  const outboundsById = new Map<string, OutboundAnalyticsContextRow>();
  if (outboundIds.length > 0) {
    const { data: outboundData, error: outboundError } = await client
      .from('email_outbound')
      .select('id,draft_id,campaign_id,sender_identity,recipient_email_source,recipient_email_kind')
      .in('id', outboundIds);
    if (outboundError) throw outboundError;
    for (const row of (outboundData ?? []) as OutboundAnalyticsContextRow[]) {
      outboundsById.set(String(row.id), row);
    }
  }

  const campaignIds = Array.from(
    new Set(
      Array.from(outboundsById.values())
        .map((row) => row.campaign_id)
        .filter((value): value is string => typeof value === 'string')
    )
  );

  const campaignsById = new Map<string, CampaignAnalyticsContextRow>();
  if (campaignIds.length > 0) {
    const { data: campaignData, error: campaignError } = await client
      .from('campaigns')
      .select('id,offer_id,icp_hypothesis_id')
      .in('id', campaignIds);
    if (campaignError) throw campaignError;
    for (const row of (campaignData ?? []) as CampaignAnalyticsContextRow[]) {
      campaignsById.set(String(row.id), row);
    }
  }

  const hypothesisIds = Array.from(
    new Set(
      Array.from(campaignsById.values())
        .map((row) => row.icp_hypothesis_id)
        .filter((value): value is string => typeof value === 'string')
    )
  );
  const hypothesesById = new Map<string, HypothesisAnalyticsContextRow>();
  if (hypothesisIds.length > 0) {
    const { data: hypothesisData, error: hypothesisError } = await client
      .from('icp_hypotheses')
      .select('id,hypothesis_label,offer_id')
      .in('id', hypothesisIds);
    if (hypothesisError) throw hypothesisError;
    for (const row of (hypothesisData ?? []) as HypothesisAnalyticsContextRow[]) {
      hypothesesById.set(String(row.id), row);
    }
  }

  const offerIds = Array.from(
    new Set(
      [
        ...Array.from(campaignsById.values()).map((row) => row.offer_id),
        ...Array.from(hypothesesById.values()).map((row) => row.offer_id ?? null),
      ].filter((value): value is string => typeof value === 'string')
    )
  );
  const offersById = new Map<string, OfferAnalyticsContextRow>();
  if (offerIds.length > 0) {
    const { data: offerData, error: offerError } = await client
      .from('offers')
      .select('id,title,project_name')
      .in('id', offerIds);
    if (offerError) throw offerError;
    for (const row of (offerData ?? []) as OfferAnalyticsContextRow[]) {
      offersById.set(String(row.id), row);
    }
  }

  return {
    events,
    outboundsById,
    campaignsById,
    hypothesesById,
    offersById,
  };
}

export async function getAnalyticsByIcpAndHypothesis(
  client: SupabaseClient,
  options: AnalyticsOptions
) {
  let query: any = client.from('analytics_events_flat').select(
    'icp_profile_id, icp_hypothesis_id, event_type, outcome_classification, occurred_at'
  );
  if (options.since) {
    if (typeof query.gte === 'function') {
      query = query.gte('occurred_at', options.since);
    }
  }

  const { data, error } = (await query) as {
    data: IcpAnalyticsRow[] | null;
    error: Error | null;
  };
  if (error) throw error;

  const rows = data ?? [];
  const groups = new Map<string, { key: { icp_profile_id: string | null; icp_hypothesis_id: string | null }; rows: IcpAnalyticsRow[] }>();

  for (const row of rows) {
    const key = `${row.icp_profile_id ?? 'null'}|${row.icp_hypothesis_id ?? 'null'}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key: {
          icp_profile_id: row.icp_profile_id ?? null,
          icp_hypothesis_id: row.icp_hypothesis_id ?? null,
        },
        rows: [],
      });
    }
    groups.get(key)!.rows.push(row);
  }

  const results = [];
  for (const { key, rows: groupRows } of groups.values()) {
    results.push({
      ...key,
      ...accumulateMetrics(groupRows),
    });
  }

  return results;
}

export async function getAnalyticsBySegmentAndRole(
  client: SupabaseClient,
  options: AnalyticsOptions
) {
  let query: any = client.from('analytics_events_flat').select(
    'segment_id, segment_version, role, event_type, outcome_classification, occurred_at'
  );
  if (options.since) {
    if (typeof query.gte === 'function') {
      query = query.gte('occurred_at', options.since);
    }
  }

  const { data, error } = (await query) as {
    data: SegmentRoleAnalyticsRow[] | null;
    error: Error | null;
  };
  if (error) throw error;

  const rows = data ?? [];
  const groups = new Map<string, { key: { segment_id: string | null; segment_version: number | null; role: string | null }; rows: SegmentRoleAnalyticsRow[] }>();

  for (const row of rows) {
    const key = `${row.segment_id ?? 'null'}|${row.segment_version ?? 'null'}|${row.role ?? 'null'}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key: {
          segment_id: row.segment_id ?? null,
          segment_version: row.segment_version ?? null,
          role: row.role ?? null,
        },
        rows: [],
      });
    }
    groups.get(key)!.rows.push(row);
  }

  const results = [];
  for (const { key, rows: groupRows } of groups.values()) {
    results.push({
      ...key,
      ...accumulateMetrics(groupRows),
    });
  }

  return results;
}

export async function getAnalyticsByPatternAndUserEdit(
  client: SupabaseClient,
  options: AnalyticsOptions
) {
  let query: any = client.from('analytics_events_flat').select(
    'draft_pattern, user_edited, event_type, outcome_classification, occurred_at'
  );
  if (options.since) {
    if (typeof query.gte === 'function') {
      query = query.gte('occurred_at', options.since);
    }
  }

  const { data, error } = (await query) as {
    data: PatternAnalyticsRow[] | null;
    error: Error | null;
  };
  if (error) throw error;

  const rows = data ?? [];
  const groups = new Map<string, { key: { draft_pattern: string | null; user_edited: boolean | null }; rows: PatternAnalyticsRow[] }>();

  for (const row of rows) {
    const key = `${row.draft_pattern ?? 'null'}|${row.user_edited ?? 'null'}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key: {
          draft_pattern: row.draft_pattern ?? null,
          user_edited: row.user_edited ?? null,
        },
        rows: [],
      });
    }
    groups.get(key)!.rows.push(row);
  }

  const results = [];
  for (const { key, rows: groupRows } of groups.values()) {
    results.push({
      ...key,
      ...accumulateMetrics(groupRows),
    });
  }

  return results;
}

export async function getPromptPatternPerformance(
  client: SupabaseClient,
  options: AnalyticsOptions
) {
  const patternRows = await getAnalyticsByPatternAndUserEdit(client, options);
  // Collapse user_edited dimension; aggregate per draft_pattern only.
  const groups = new Map<
    string,
    {
      draft_pattern: string | null;
      delivered: number;
      opened: number;
      replied: number;
      positive_replies: number;
    }
  >();

  for (const row of patternRows as any[]) {
    const key = row.draft_pattern ?? 'null';
    if (!groups.has(key)) {
      groups.set(key, {
        draft_pattern: row.draft_pattern ?? null,
        delivered: 0,
        opened: 0,
        replied: 0,
        positive_replies: 0,
      });
    }
    const acc = groups.get(key)!;
    acc.delivered += row.delivered;
    acc.opened += row.opened;
    acc.replied += row.replied;
    acc.positive_replies += row.positive_replies;
  }

  return Array.from(groups.values());
}

export async function getAnalyticsByRejectionReason(
  client: SupabaseClient,
  options: AnalyticsOptions
) {
  const breakdown = await getDraftRejectionAnalyticsBreakdown(client, options);
  return breakdown.by_reason;
}

function incrementCount(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

export async function getDraftRejectionAnalyticsBreakdown(
  client: SupabaseClient,
  options: AnalyticsOptions
): Promise<DraftRejectionAnalyticsBreakdown> {
  let query: any = client
    .from('drafts')
    .select('campaign_id,email_type,draft_pattern,status,metadata,updated_at')
    .eq('status', 'rejected');
  if (options.since && typeof query.gte === 'function') {
    query = query.gte('updated_at', options.since);
  }

  const { data, error } = (await query) as {
    data: DraftRejectionAnalyticsRow[] | null;
    error: Error | null;
  };
  if (error) throw error;

  const byReason = new Map<string, number>();
  const byPattern = new Map<string, number>();
  const byPatternAndReason = new Map<string, number>();
  const byCampaign = new Map<string, number>();
  const byEmailType = new Map<string, number>();
  const byIcpProfile = new Map<string, number>();
  const byIcpHypothesis = new Map<string, number>();
  let totalRejected = 0;

  for (const row of data ?? []) {
    totalRejected += 1;
    const code = row.metadata && typeof row.metadata.review_reason_code === 'string'
      ? row.metadata.review_reason_code
      : null;
    const draftPattern =
      row.metadata && typeof row.metadata.draft_pattern === 'string'
        ? row.metadata.draft_pattern
        : typeof row.draft_pattern === 'string'
          ? row.draft_pattern
          : null;
    const icpProfileId =
      row.metadata && typeof row.metadata.icp_profile_id === 'string'
        ? row.metadata.icp_profile_id
        : null;
    const icpHypothesisId =
      row.metadata && typeof row.metadata.icp_hypothesis_id === 'string'
        ? row.metadata.icp_hypothesis_id
        : null;

    if (!code) {
      continue;
    }
    incrementCount(byReason, code);
    incrementCount(byPattern, draftPattern ?? 'null');
    incrementCount(byPatternAndReason, `${draftPattern ?? 'null'}|${code}`);
    incrementCount(byCampaign, row.campaign_id ?? 'null');
    incrementCount(byEmailType, row.email_type ?? 'null');
    incrementCount(byIcpProfile, icpProfileId ?? 'null');
    incrementCount(byIcpHypothesis, icpHypothesisId ?? 'null');
  }

  return {
    total_rejected: totalRejected,
    by_reason: Array.from(byReason.entries())
      .map(([review_reason_code, count]) => ({ review_reason_code, count }))
      .sort((left, right) => right.count - left.count || left.review_reason_code.localeCompare(right.review_reason_code)),
    by_pattern: Array.from(byPattern.entries())
      .map(([draft_pattern, count]) => ({ draft_pattern: draft_pattern === 'null' ? null : draft_pattern, count }))
      .sort((left, right) => right.count - left.count || String(left.draft_pattern ?? '').localeCompare(String(right.draft_pattern ?? ''))),
    by_pattern_and_reason: Array.from(byPatternAndReason.entries())
      .map(([compoundKey, count]) => {
        const [draftPatternKey, review_reason_code] = compoundKey.split('|');
        return {
          draft_pattern: draftPatternKey === 'null' ? null : draftPatternKey,
          review_reason_code,
          count,
        };
      })
      .sort((left, right) => {
        if (right.count !== left.count) return right.count - left.count;
        const leftKey = `${left.draft_pattern ?? ''}|${left.review_reason_code}`;
        const rightKey = `${right.draft_pattern ?? ''}|${right.review_reason_code}`;
        return leftKey.localeCompare(rightKey);
      }),
    by_campaign: Array.from(byCampaign.entries())
      .map(([campaign_id, count]) => ({ campaign_id: campaign_id === 'null' ? null : campaign_id, count }))
      .sort((left, right) => right.count - left.count || String(left.campaign_id ?? '').localeCompare(String(right.campaign_id ?? ''))),
    by_email_type: Array.from(byEmailType.entries())
      .map(([email_type, count]) => ({ email_type: email_type === 'null' ? null : email_type, count }))
      .sort((left, right) => right.count - left.count || String(left.email_type ?? '').localeCompare(String(right.email_type ?? ''))),
    by_icp_profile: Array.from(byIcpProfile.entries())
      .map(([icp_profile_id, count]) => ({ icp_profile_id: icp_profile_id === 'null' ? null : icp_profile_id, count }))
      .sort((left, right) => right.count - left.count || String(left.icp_profile_id ?? '').localeCompare(String(right.icp_profile_id ?? ''))),
    by_icp_hypothesis: Array.from(byIcpHypothesis.entries())
      .map(([icp_hypothesis_id, count]) => ({ icp_hypothesis_id: icp_hypothesis_id === 'null' ? null : icp_hypothesis_id, count }))
      .sort((left, right) => right.count - left.count || String(left.icp_hypothesis_id ?? '').localeCompare(String(right.icp_hypothesis_id ?? ''))),
  };
}

export async function getAnalyticsByOffering(
  client: SupabaseClient,
  options: AnalyticsOptions
) {
  let eventsQuery: any = client
    .from('email_events')
    .select('draft_id,outbound_id,event_type,outcome_classification,occurred_at');
  if (options.since && typeof eventsQuery.gte === 'function') {
    eventsQuery = eventsQuery.gte('occurred_at', options.since);
  }

  const { data: eventData, error: eventError } = (await eventsQuery) as {
    data: EventOfferingAnalyticsRow[] | null;
    error: Error | null;
  };
  if (eventError) throw eventError;

  const events = eventData ?? [];
  const outboundIds = Array.from(
    new Set(events.map((row) => row.outbound_id).filter((value): value is string => typeof value === 'string'))
  );
  const draftIds = new Set(
    events.map((row) => row.draft_id).filter((value): value is string => typeof value === 'string')
  );
  const outboundDraftById = new Map<string, string | null>();

  if (outboundIds.length > 0) {
    const { data: outboundData, error: outboundError } = await client
      .from('email_outbound')
      .select('id,draft_id')
      .in('id', outboundIds);
    if (outboundError) throw outboundError;
    for (const row of (outboundData ?? []) as Array<{ id: string; draft_id: string | null }>) {
      outboundDraftById.set(String(row.id), row.draft_id ?? null);
      if (row.draft_id) {
        draftIds.add(row.draft_id);
      }
    }
  }

  const draftMetadataById = new Map<string, Record<string, unknown>>();
  if (draftIds.size > 0) {
    const { data: draftData, error: draftError } = await client
      .from('drafts')
      .select('id,metadata')
      .in('id', Array.from(draftIds));
    if (draftError) throw draftError;
    for (const row of (draftData ?? []) as Array<{ id: string; metadata?: Record<string, unknown> | null }>) {
      draftMetadataById.set(String(row.id), (row.metadata as Record<string, unknown> | null) ?? {});
    }
  }

  const grouped = new Map<string, BaseAnalyticsRow[]>();
  for (const event of events) {
    const draftId = event.draft_id ?? (event.outbound_id ? outboundDraftById.get(event.outbound_id) ?? null : null);
    const metadata = draftId ? draftMetadataById.get(draftId) ?? null : null;
    const offeringDomain =
      metadata && typeof metadata.offering_domain === 'string' ? metadata.offering_domain : null;
    if (!offeringDomain) {
      continue;
    }
    const existing = grouped.get(offeringDomain) ?? [];
    existing.push(event);
    grouped.set(offeringDomain, existing);
  }

  return Array.from(grouped.entries())
    .map(([offering_domain, rows]) => ({
      offering_domain,
      ...accumulateMetrics(rows),
    }))
    .sort((left, right) => left.offering_domain.localeCompare(right.offering_domain));
}

export async function getAnalyticsByOffer(
  client: SupabaseClient,
  options: AnalyticsOptions
) {
  const context = await loadEventExecutionContext(client, options);

  const grouped = new Map<string, BaseAnalyticsRow[]>();
  for (const event of context.events) {
    const outbound = event.outbound_id ? context.outboundsById.get(event.outbound_id) ?? null : null;
    const campaign = outbound?.campaign_id ? context.campaignsById.get(outbound.campaign_id) ?? null : null;
    const offerId = campaign?.offer_id ?? null;
    if (!offerId) {
      continue;
    }
    const existing = grouped.get(offerId) ?? [];
    existing.push(event);
    grouped.set(offerId, existing);
  }

  return Array.from(grouped.entries())
    .map(([offer_id, rows]) => ({
      offer_id,
      offer_title: context.offersById.get(offer_id)?.title ?? null,
      project_name: context.offersById.get(offer_id)?.project_name ?? null,
      ...accumulateMetrics(rows),
    }))
    .sort((left, right) => String(left.offer_title ?? left.offer_id).localeCompare(String(right.offer_title ?? right.offer_id)));
}

export async function getAnalyticsByHypothesis(
  client: SupabaseClient,
  options: AnalyticsOptions
) {
  const context = await loadEventExecutionContext(client, options);
  const grouped = new Map<string, BaseAnalyticsRow[]>();

  for (const event of context.events) {
    const outbound = event.outbound_id ? context.outboundsById.get(event.outbound_id) ?? null : null;
    const campaign = outbound?.campaign_id ? context.campaignsById.get(outbound.campaign_id) ?? null : null;
    const hypothesisId = campaign?.icp_hypothesis_id ?? null;
    if (!hypothesisId) continue;
    const existing = grouped.get(hypothesisId) ?? [];
    existing.push(event);
    grouped.set(hypothesisId, existing);
  }

  return Array.from(grouped.entries())
    .map(([icp_hypothesis_id, rows]) => {
      const hypothesis = context.hypothesesById.get(icp_hypothesis_id) ?? null;
      const offerId =
        hypothesis?.offer_id ??
        Array.from(context.campaignsById.values()).find((row) => row.icp_hypothesis_id === icp_hypothesis_id)?.offer_id ??
        null;
      const offer = offerId ? context.offersById.get(offerId) ?? null : null;
      return {
        icp_hypothesis_id,
        hypothesis_label: hypothesis?.hypothesis_label ?? null,
        offer_id: offerId,
        offer_title: offer?.title ?? null,
        project_name: offer?.project_name ?? null,
        ...accumulateMetrics(rows),
      };
    })
    .sort((left, right) =>
      String(left.hypothesis_label ?? left.icp_hypothesis_id).localeCompare(
        String(right.hypothesis_label ?? right.icp_hypothesis_id)
      )
    );
}

export async function getAnalyticsByRecipientType(
  client: SupabaseClient,
  options: AnalyticsOptions
) {
  const context = await loadEventExecutionContext(client, options);
  const grouped = new Map<string, BaseAnalyticsRow[]>();

  for (const event of context.events) {
    const outbound = event.outbound_id ? context.outboundsById.get(event.outbound_id) ?? null : null;
    const recipientType = outbound?.recipient_email_kind ?? outbound?.recipient_email_source ?? null;
    if (!recipientType) continue;
    const existing = grouped.get(recipientType) ?? [];
    existing.push(event);
    grouped.set(recipientType, existing);
  }

  return Array.from(grouped.entries())
    .map(([recipient_email_kind, rows]) => ({
      recipient_email_kind,
      ...accumulateMetrics(rows),
    }))
    .sort((left, right) => left.recipient_email_kind.localeCompare(right.recipient_email_kind));
}

export async function getAnalyticsBySenderIdentity(
  client: SupabaseClient,
  options: AnalyticsOptions
) {
  const context = await loadEventExecutionContext(client, options);
  const grouped = new Map<string, BaseAnalyticsRow[]>();

  for (const event of context.events) {
    const outbound = event.outbound_id ? context.outboundsById.get(event.outbound_id) ?? null : null;
    const senderIdentity = outbound?.sender_identity ?? null;
    if (!senderIdentity) continue;
    const existing = grouped.get(senderIdentity) ?? [];
    existing.push(event);
    grouped.set(senderIdentity, existing);
  }

  return Array.from(grouped.entries())
    .map(([sender_identity, rows]) => ({
      sender_identity,
      ...accumulateMetrics(rows),
    }))
    .sort((left, right) => left.sender_identity.localeCompare(right.sender_identity));
}

export async function getCampaignFunnelAnalytics(client: SupabaseClient, campaignId: string) {
  const { data: draftData, error: draftError } = await client
    .from('drafts')
    .select('id,email_type,status,metadata')
    .eq('campaign_id', campaignId);
  if (draftError) throw draftError;
  const drafts = (draftData ?? []) as FunnelDraftRow[];
  const draftById = new Map(drafts.map((row) => [row.id, row]));

  const { data: outboundData, error: outboundError } = await client
    .from('email_outbound')
    .select('id,draft_id,status')
    .eq('campaign_id', campaignId);
  if (outboundError) throw outboundError;
  const outbounds = (outboundData ?? []) as FunnelOutboundRow[];

  const outboundIds = outbounds.map((row) => row.id).filter((value): value is string => typeof value === 'string');
  const events: FunnelEventRow[] = [];
  if (outboundIds.length > 0) {
    const { data: eventData, error: eventError } = await client
      .from('email_events')
      .select('outbound_id,event_type')
      .in('outbound_id', outboundIds);
    if (eventError) throw eventError;
    events.push(...((eventData ?? []) as FunnelEventRow[]));
  }

  const eventsByOutbound = new Map<string, FunnelEventRow[]>();
  for (const event of events) {
    if (!event.outbound_id) continue;
    const existing = eventsByOutbound.get(event.outbound_id) ?? [];
    existing.push(event);
    eventsByOutbound.set(event.outbound_id, existing);
  }

  const rejectionReasons: Record<string, number> = {};
  for (const draft of drafts) {
    if (draft.status !== 'rejected') {
      continue;
    }
    const code =
      draft.metadata && typeof draft.metadata.review_reason_code === 'string'
        ? draft.metadata.review_reason_code
        : null;
    if (!code) {
      continue;
    }
    rejectionReasons[code] = (rejectionReasons[code] ?? 0) + 1;
  }

  const countOutboundEvents = (emailType: string, eventType: string | string[]) => {
    const allowedEventTypes = Array.isArray(eventType) ? eventType : [eventType];
    return outbounds.filter((outbound) => {
      if (outbound.status !== 'sent' || !outbound.id) {
        return false;
      }
      const draft = outbound.draft_id ? draftById.get(outbound.draft_id) : null;
      if (draft?.email_type !== emailType) {
        return false;
      }
      const outboundEvents = eventsByOutbound.get(outbound.id) ?? [];
      return outboundEvents.some((event) => allowedEventTypes.includes(String(event.event_type ?? '')));
    }).length;
  };

  return {
    campaign_id: campaignId,
    funnel: {
      drafts_generated: drafts.length,
      drafts_approved: drafts.filter((draft) => draft.status === 'approved').length,
      drafts_rejected: drafts.filter((draft) => draft.status === 'rejected').length,
      intro_sent: outbounds.filter((outbound) => {
        const draft = outbound.draft_id ? draftById.get(outbound.draft_id) : null;
        return outbound.status === 'sent' && draft?.email_type === 'intro';
      }).length,
      intro_replied: countOutboundEvents('intro', 'replied'),
      intro_bounced: countOutboundEvents('intro', 'bounced'),
      intro_unsubscribed: countOutboundEvents('intro', ['unsubscribed', 'complaint']),
      bump_generated: drafts.filter((draft) => draft.email_type === 'bump').length,
      bump_approved: drafts.filter((draft) => draft.email_type === 'bump' && draft.status === 'approved').length,
      bump_sent: outbounds.filter((outbound) => {
        const draft = outbound.draft_id ? draftById.get(outbound.draft_id) : null;
        return outbound.status === 'sent' && draft?.email_type === 'bump';
      }).length,
      bump_replied: countOutboundEvents('bump', 'replied'),
    },
    rejection_reasons: rejectionReasons,
  };
}

export async function getSimJobSummaryForAnalytics(
  client: SupabaseClient
): Promise<Array<{ status: string; count: number }>> {
  const { data, error } = await client
    .from('jobs')
    .select('status')
    .eq('type', 'sim');

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as Array<{ status: string }>;
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = row.status ?? 'unknown';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from(counts.entries()).map(([status, count]) => ({ status, count }));
}

export async function suggestPromptPatternAdjustments(
  client: SupabaseClient,
  options: AnalyticsOptions
): Promise<
  Array<{
    draft_pattern: string | null;
    delivered: number;
    replied: number;
    positive_replies: number;
    recommendation: 'scale' | 'keep' | 'retire';
  }>
> {
  const patterns = await getPromptPatternPerformance(client, options);
  const results: Array<{
    draft_pattern: string | null;
    delivered: number;
    replied: number;
    positive_replies: number;
    recommendation: 'scale' | 'keep' | 'retire';
  }> = [];

  for (const row of patterns as any[]) {
    const { draft_pattern, delivered, replied, positive_replies } = row;
    let recommendation: 'scale' | 'keep' | 'retire' = 'keep';

    if (delivered > 0 && replied === 0) {
      recommendation = 'retire';
    } else if (replied > 0) {
      const ratio = positive_replies / replied;
      if (ratio >= 0.6) {
        recommendation = 'scale';
      } else if (ratio <= 0.2) {
        recommendation = 'retire';
      }
    }

    results.push({
      draft_pattern,
      delivered,
      replied,
      positive_replies,
      recommendation,
    });
  }

  return results;
}

export function formatAnalyticsOutput(
  groupBy: string,
  results: unknown[],
  context?: Record<string, unknown>
) {
  return {
    groupBy,
    results: results ?? [],
    ...(context ? { context } : {}),
  };
}
