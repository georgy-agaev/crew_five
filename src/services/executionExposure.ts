import type { SupabaseClient } from '@supabase/supabase-js';

interface OutboundExposureRow {
  id: string;
  campaign_id: string | null;
  contact_id: string | null;
  sent_at: string | null;
  status: string | null;
  metadata: Record<string, unknown> | null;
}

interface CampaignExposureContextRow {
  id: string;
  offer_id: string | null;
  icp_hypothesis_id: string | null;
}

interface OfferContextRow {
  id: string;
  title: string | null;
  project_name: string | null;
}

interface HypothesisContextRow {
  id: string;
  icp_id: string | null;
}

interface EventExposureRow {
  outbound_id: string | null;
  event_type: string | null;
}

export interface ExecutionExposure {
  contact_id: string;
  campaign_id: string;
  icp_profile_id: string | null;
  icp_hypothesis_id: string | null;
  offer_id: string | null;
  offer_title: string | null;
  project_name: string | null;
  offering_domain: string | null;
  offering_hash: string | null;
  offering_summary: string | null;
  first_sent_at: string;
  last_sent_at: string;
  sent_count: number;
  replied: boolean;
  bounced: boolean;
  unsubscribed: boolean;
}

export interface ExecutionExposureSummary {
  total_exposures: number;
  last_icp_hypothesis_id: string | null;
  last_offer_id: string | null;
  last_offer_title: string | null;
  last_sent_at: string | null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function compareIsoAsc(left: string, right: string) {
  return left.localeCompare(right);
}

function compareIsoDesc(left: string, right: string) {
  return right.localeCompare(left);
}

function chunkValues<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

const CONTACT_QUERY_CHUNK_SIZE = 100;

function buildExposureSummary(exposures: ExecutionExposure[]): ExecutionExposureSummary {
  const latest = [...exposures]
    .sort((left, right) => compareIsoDesc(left.last_sent_at, right.last_sent_at))[0] ?? null;

  return {
    total_exposures: exposures.length,
    last_icp_hypothesis_id: latest?.icp_hypothesis_id ?? null,
    last_offer_id: latest?.offer_id ?? null,
    last_offer_title: latest?.offer_title ?? null,
    last_sent_at: latest?.last_sent_at ?? null,
  };
}

async function loadExposureRows(
  client: SupabaseClient,
  query: PromiseLike<{ data: unknown[] | null; error: unknown }>
) {
  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const outbounds = (data ?? []) as OutboundExposureRow[];
  const campaignIds = Array.from(
    new Set(outbounds.map((row) => asString(row.campaign_id)).filter((value): value is string => Boolean(value)))
  );
  const outboundIds = outbounds.map((row) => row.id).filter((value): value is string => typeof value === 'string');

  const campaignsById = new Map<string, CampaignExposureContextRow>();
  if (campaignIds.length > 0) {
    const { data: campaignRows, error: campaignError } = await client
      .from('campaigns')
      .select('id,offer_id,icp_hypothesis_id')
      .in('id', campaignIds);
    if (campaignError) {
      throw campaignError;
    }
    for (const row of (campaignRows ?? []) as CampaignExposureContextRow[]) {
      campaignsById.set(row.id, row);
    }
  }

  const hypothesisIds = Array.from(
    new Set(
      Array.from(campaignsById.values())
        .map((row) => asString(row.icp_hypothesis_id))
        .filter((value): value is string => Boolean(value))
    )
  );
  const hypothesesById = new Map<string, HypothesisContextRow>();
  if (hypothesisIds.length > 0) {
    const { data: hypothesisRows, error: hypothesisError } = await client
      .from('icp_hypotheses')
      .select('id,icp_id')
      .in('id', hypothesisIds);
    if (hypothesisError) {
      throw hypothesisError;
    }
    for (const row of (hypothesisRows ?? []) as HypothesisContextRow[]) {
      hypothesesById.set(row.id, row);
    }
  }

  const offerIds = Array.from(
    new Set(
      Array.from(campaignsById.values())
        .map((row) => asString(row.offer_id))
        .filter((value): value is string => Boolean(value))
    )
  );
  const offersById = new Map<string, OfferContextRow>();
  if (offerIds.length > 0) {
    const { data: offerRows, error: offerError } = await client
      .from('offers')
      .select('id,title,project_name')
      .in('id', offerIds);
    if (offerError) {
      throw offerError;
    }
    for (const row of (offerRows ?? []) as OfferContextRow[]) {
      offersById.set(row.id, row);
    }
  }

  const eventsByOutboundId = new Map<string, EventExposureRow[]>();
  if (outboundIds.length > 0) {
    const { data: eventRows, error: eventError } = await client
      .from('email_events')
      .select('outbound_id,event_type')
      .in('outbound_id', outboundIds);
    if (eventError) {
      throw eventError;
    }
    for (const row of (eventRows ?? []) as EventExposureRow[]) {
      if (!row.outbound_id) {
        continue;
      }
      const existing = eventsByOutboundId.get(row.outbound_id) ?? [];
      existing.push(row);
      eventsByOutboundId.set(row.outbound_id, existing);
    }
  }

  return {
    outbounds,
    campaignsById,
    hypothesesById,
    offersById,
    eventsByOutboundId,
  };
}

function aggregateExecutionExposure(rows: Awaited<ReturnType<typeof loadExposureRows>>): Map<string, ExecutionExposure[]> {
  const aggregates = new Map<string, ExecutionExposure>();

  for (const outbound of rows.outbounds) {
    const contactId = asString(outbound.contact_id);
    const campaignId = asString(outbound.campaign_id);
    if (!contactId || !campaignId || !outbound.sent_at) {
      continue;
    }

    const campaign = rows.campaignsById.get(campaignId);
    const metadata = outbound.metadata ?? {};
    const icpHypothesisId = asString(metadata.icp_hypothesis_id) ?? asString(campaign?.icp_hypothesis_id);
    const hypothesis = icpHypothesisId ? rows.hypothesesById.get(icpHypothesisId) : null;
    const icpProfileId = asString(metadata.icp_profile_id) ?? asString(hypothesis?.icp_id);
    const offerId = asString(campaign?.offer_id);
    const offer = offerId ? rows.offersById.get(offerId) : null;

    const key = `${contactId}::${campaignId}`;
    const existing = aggregates.get(key);
    if (!existing) {
      aggregates.set(key, {
        contact_id: contactId,
        campaign_id: campaignId,
        icp_profile_id: icpProfileId,
        icp_hypothesis_id: icpHypothesisId,
        offer_id: offerId,
        offer_title: asString(offer?.title),
        project_name: asString(offer?.project_name),
        offering_domain: asString(metadata.offering_domain),
        offering_hash: asString(metadata.offering_hash),
        offering_summary: asString(metadata.offering_summary),
        first_sent_at: outbound.sent_at,
        last_sent_at: outbound.sent_at,
        sent_count: 1,
        replied: false,
        bounced: false,
        unsubscribed: false,
      });
    } else {
      existing.icp_profile_id = existing.icp_profile_id ?? icpProfileId;
      existing.icp_hypothesis_id = existing.icp_hypothesis_id ?? icpHypothesisId;
      existing.offer_id = existing.offer_id ?? offerId;
      existing.offer_title = existing.offer_title ?? asString(offer?.title);
      existing.project_name = existing.project_name ?? asString(offer?.project_name);
      existing.offering_domain = existing.offering_domain ?? asString(metadata.offering_domain);
      existing.offering_hash = existing.offering_hash ?? asString(metadata.offering_hash);
      existing.offering_summary = existing.offering_summary ?? asString(metadata.offering_summary);
      existing.first_sent_at =
        compareIsoAsc(outbound.sent_at, existing.first_sent_at) < 0 ? outbound.sent_at : existing.first_sent_at;
      existing.last_sent_at =
        compareIsoAsc(outbound.sent_at, existing.last_sent_at) > 0 ? outbound.sent_at : existing.last_sent_at;
      existing.sent_count += 1;
    }

    const aggregate = aggregates.get(key)!;
    for (const event of rows.eventsByOutboundId.get(outbound.id) ?? []) {
      const type = asString(event.event_type);
      if (!type) {
        continue;
      }
      if (type === 'reply' || type === 'replied') {
        aggregate.replied = true;
      }
      if (type === 'bounce' || type === 'bounced') {
        aggregate.bounced = true;
      }
      if (type === 'unsubscribe' || type === 'unsubscribed' || type === 'complaint') {
        aggregate.unsubscribed = true;
      }
    }
  }

  const exposuresByContact = new Map<string, ExecutionExposure[]>();
  for (const exposure of aggregates.values()) {
    const existing = exposuresByContact.get(exposure.contact_id) ?? [];
    existing.push(exposure);
    exposuresByContact.set(exposure.contact_id, existing);
  }

  for (const [contactId, exposures] of exposuresByContact.entries()) {
    exposuresByContact.set(
      contactId,
      [...exposures].sort((left, right) => compareIsoDesc(left.last_sent_at, right.last_sent_at))
    );
  }

  return exposuresByContact;
}

export async function listExecutionExposureByContact(
  client: SupabaseClient,
  contactIds: string[]
): Promise<Map<string, ExecutionExposure[]>> {
  if (contactIds.length === 0) {
    return new Map();
  }

  const result = new Map<string, ExecutionExposure[]>();
  const uniqueContactIds = Array.from(new Set(contactIds));

  for (const contactIdsChunk of chunkValues(uniqueContactIds, CONTACT_QUERY_CHUNK_SIZE)) {
    const rows = await loadExposureRows(
      client,
      client
        .from('email_outbound')
        .select('id,campaign_id,contact_id,sent_at,status,metadata')
        .in('contact_id', contactIdsChunk)
    );

    for (const [contactId, exposures] of aggregateExecutionExposure(rows).entries()) {
      result.set(contactId, exposures);
    }
  }

  return result;
}

export async function listExecutionExposureForCampaign(
  client: SupabaseClient,
  campaignId: string
): Promise<Map<string, ExecutionExposure[]>> {
  const rows = await loadExposureRows(
    client,
    client
      .from('email_outbound')
      .select('id,campaign_id,contact_id,sent_at,status,metadata')
      .eq('campaign_id', campaignId)
  );

  return aggregateExecutionExposure(rows);
}

export { buildExposureSummary };
