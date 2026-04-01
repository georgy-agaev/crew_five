import type { SupabaseClient } from '@supabase/supabase-js';

import { deriveContactSuppressionState } from './contactSuppression.js';
import {
  countCampaignBusinessDaysBetween,
  type CampaignBusinessCalendarOverride,
} from './campaignSendCalendar.js';
import { getCampaignSendPolicy } from './campaignSendPolicy.js';

const DEFAULT_MIN_DAYS_SINCE_INTRO = 3;

interface DraftRow {
  id: string;
  contact_id: string | null;
  company_id: string | null;
  email_type: string | null;
  status: string | null;
}

interface OutboundRow {
  id: string;
  campaign_id: string;
  contact_id: string | null;
  company_id: string | null;
  draft_id: string | null;
  status: string | null;
  sent_at: string | null;
  sender_identity: string | null;
}

interface EventRow {
  outbound_id: string | null;
  event_type: string | null;
  occurred_at: string | null;
  payload: unknown;
}

interface CompanyRow {
  id: string;
  country_code: string | null;
}

export interface CampaignFollowupCandidate {
  contact_id: string;
  company_id: string | null;
  company_country_code: string | null;
  intro_sent: boolean;
  intro_sent_at: string | null;
  intro_sender_identity: string | null;
  reply_received: boolean;
  bounce: boolean;
  unsubscribed: boolean;
  bump_draft_exists: boolean;
  bump_draft_approved: boolean;
  bump_sent: boolean;
  eligible: boolean;
  days_since_intro: number | null;
  business_days_since_intro: number | null;
  auto_reply: string | null;
}

function getCompanyCalendarOverride(
  companyId: string | null,
  companyCountriesById: Map<string, string | null>
): CampaignBusinessCalendarOverride | null {
  if (!companyId) {
    return null;
  }
  const countryCode = companyCountriesById.get(companyId) ?? null;
  if (!countryCode) {
    return null;
  }
  return { countryCode };
}

export interface CampaignFollowupCandidatesOptions {
  now?: Date;
  minDaysSinceIntro?: number;
}

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getDaysSinceIntro(sentAt: string | null, now: Date): number | null {
  const sentDate = parseIsoDate(sentAt);
  if (!sentDate) {
    return null;
  }
  const diffMs = now.getTime() - sentDate.getTime();
  return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
}

function pickLatestSentOutbound(rows: OutboundRow[]): OutboundRow | null {
  return [...rows]
    .filter((row) => row.status === 'sent')
    .sort((left, right) => {
      const leftDate = parseIsoDate(left.sent_at)?.getTime() ?? 0;
      const rightDate = parseIsoDate(right.sent_at)?.getTime() ?? 0;
      return rightDate - leftDate;
    })[0] ?? null;
}

function extractAutoReply(events: EventRow[]): string | null {
  for (const event of events) {
    if (event.event_type !== 'replied' || !event.payload || typeof event.payload !== 'object') {
      continue;
    }
    const payload = event.payload as Record<string, unknown>;
    if (payload.auto_reply === true) {
      if (typeof payload.auto_reply_reason === 'string' && payload.auto_reply_reason.trim().length > 0) {
        return payload.auto_reply_reason;
      }
      if (typeof payload.classification === 'string' && payload.classification.trim().length > 0) {
        return payload.classification;
      }
      return 'auto_reply';
    }
  }
  return null;
}

export async function listCampaignFollowupCandidates(
  client: SupabaseClient,
  campaignId: string,
  options: CampaignFollowupCandidatesOptions = {}
): Promise<CampaignFollowupCandidate[]> {
  const now = options.now ?? new Date();
  const minDaysSinceIntro = options.minDaysSinceIntro ?? DEFAULT_MIN_DAYS_SINCE_INTRO;
  const sendPolicy = await getCampaignSendPolicy(client, campaignId);

  const draftsRes = await client
    .from('drafts')
    .select('id,contact_id,company_id,email_type,status')
    .eq('campaign_id', campaignId);
  if (draftsRes.error) {
    throw draftsRes.error;
  }

  const outboundsRes = await client
    .from('email_outbound')
    .select('id,campaign_id,contact_id,company_id,draft_id,status,sent_at,sender_identity')
    .eq('campaign_id', campaignId);
  if (outboundsRes.error) {
    throw outboundsRes.error;
  }

  const outbounds = (outboundsRes.data ?? []) as OutboundRow[];
  const outboundIds = outbounds.map((row) => row.id).filter((value): value is string => typeof value === 'string');

  const events: EventRow[] = [];
  if (outboundIds.length > 0) {
    const eventsRes = await client
      .from('email_events')
      .select('outbound_id,event_type,occurred_at,payload')
      .in('outbound_id', outboundIds);
    if (eventsRes.error) {
      throw eventsRes.error;
    }
    events.push(...((eventsRes.data ?? []) as EventRow[]));
  }

  const drafts = (draftsRes.data ?? []) as DraftRow[];
  const draftById = new Map(drafts.map((row) => [row.id, row]));
  const rowsByContact = new Map<string, { company_id: string | null; drafts: DraftRow[]; outbounds: OutboundRow[] }>();

  for (const draft of drafts) {
    if (!draft.contact_id) {
      continue;
    }
    const existing = rowsByContact.get(draft.contact_id) ?? {
      company_id: draft.company_id ?? null,
      drafts: [],
      outbounds: [],
    };
    existing.company_id = existing.company_id ?? draft.company_id ?? null;
    existing.drafts.push(draft);
    rowsByContact.set(draft.contact_id, existing);
  }

  for (const outbound of outbounds) {
    if (!outbound.contact_id) {
      continue;
    }
    const existing = rowsByContact.get(outbound.contact_id) ?? {
      company_id: outbound.company_id ?? null,
      drafts: [],
      outbounds: [],
    };
    existing.company_id = existing.company_id ?? outbound.company_id ?? null;
    existing.outbounds.push(outbound);
    rowsByContact.set(outbound.contact_id, existing);
  }

  const companyIds = Array.from(
    new Set(
      Array.from(rowsByContact.values())
        .map((entry) => entry.company_id)
        .filter((value): value is string => typeof value === 'string')
    )
  );
  const companyCountriesById = new Map<string, string | null>();
  if (companyIds.length > 0) {
    const companiesRes = await client.from('companies').select('id,country_code').in('id', companyIds);
    if (companiesRes.error) {
      throw companiesRes.error;
    }
    for (const row of (companiesRes.data ?? []) as CompanyRow[]) {
      companyCountriesById.set(row.id, typeof row.country_code === 'string' ? row.country_code : null);
    }
  }

  const result: CampaignFollowupCandidate[] = [];

  for (const [contactId, contactState] of rowsByContact.entries()) {
    const introOutbounds = contactState.outbounds.filter((row) => {
      const draft = row.draft_id ? draftById.get(row.draft_id) : null;
      return draft?.email_type === 'intro';
    });
    const introOutbound = pickLatestSentOutbound(introOutbounds);
    if (!introOutbound) {
      continue;
    }

    const contactEvents = contactState.outbounds.flatMap((outbound) =>
      events.filter((event) => event.outbound_id === outbound.id)
    );
    const suppression = deriveContactSuppressionState(contactEvents);
    const bumpDraftExists = contactState.drafts.some((row) => row.email_type === 'bump');
    const bumpDraftApproved = contactState.drafts.some(
      (row) => row.email_type === 'bump' && (row.status === 'approved' || row.status === 'sent')
    );
    const bumpSent = contactState.outbounds.some((row) => {
      const draft = row.draft_id ? draftById.get(row.draft_id) : null;
      return draft?.email_type === 'bump' && row.status === 'sent';
    });
    const daysSinceIntro = getDaysSinceIntro(introOutbound.sent_at, now);
    const companyCalendarOverride = getCompanyCalendarOverride(
      contactState.company_id,
      companyCountriesById
    );
    const effectiveBusinessDaysSinceIntro =
      (sendPolicy.sendDayCountMode === 'business_days_campaign' ||
        sendPolicy.sendDayCountMode === 'business_days_recipient') &&
      introOutbound.sent_at
        ? countCampaignBusinessDaysBetween(
            sendPolicy,
            new Date(introOutbound.sent_at),
            now,
            sendPolicy.sendDayCountMode === 'business_days_recipient'
              ? companyCalendarOverride
              : null
          )
        : null;
    const minDaysReached =
      sendPolicy.sendDayCountMode === 'business_days_campaign' ||
      sendPolicy.sendDayCountMode === 'business_days_recipient'
        ? effectiveBusinessDaysSinceIntro !== null && effectiveBusinessDaysSinceIntro >= minDaysSinceIntro
        : daysSinceIntro !== null && daysSinceIntro >= minDaysSinceIntro;

    result.push({
      contact_id: contactId,
      company_id: contactState.company_id,
      company_country_code: contactState.company_id
        ? companyCountriesById.get(contactState.company_id) ?? null
        : null,
      intro_sent: true,
      intro_sent_at: introOutbound.sent_at,
      intro_sender_identity: introOutbound.sender_identity,
      reply_received: suppression.replyReceived,
      bounce: suppression.bounced,
      unsubscribed: suppression.unsubscribed,
      bump_draft_exists: bumpDraftExists,
      bump_draft_approved: bumpDraftApproved,
      bump_sent: bumpSent,
      eligible:
        bumpDraftApproved &&
        !bumpSent &&
        !suppression.replyReceived &&
        !suppression.bounced &&
        !suppression.unsubscribed &&
        minDaysReached,
      days_since_intro: daysSinceIntro,
      business_days_since_intro: effectiveBusinessDaysSinceIntro,
      auto_reply: extractAutoReply(contactEvents),
    });
  }

  return result.sort((left, right) => left.contact_id.localeCompare(right.contact_id));
}
