import type { CampaignEvent, CampaignOutbound, DraftRow } from '../apiClient';

export function findOutboundForDraft(draft: DraftRow | null, outbounds: CampaignOutbound[]) {
  if (!draft) return null;
  return outbounds.find((outbound) => outbound.draft_id === draft.id) ?? null;
}

export function findEventForOutbound(outbound: CampaignOutbound | null, events: CampaignEvent[]) {
  if (!outbound) return null;
  return events.find((event) => event.outbound_id === outbound.id) ?? null;
}

export function findDraftForOutbound(outbound: CampaignOutbound | null, drafts: DraftRow[]) {
  if (!outbound || !outbound.draft_id) return null;
  return drafts.find((draft) => draft.id === outbound.draft_id) ?? null;
}

export function findOutboundForEvent(event: CampaignEvent | null, outbounds: CampaignOutbound[]) {
  if (!event) return null;
  return outbounds.find((outbound) => outbound.id === event.outbound_id) ?? null;
}

export function findDraftForEvent(event: CampaignEvent | null, drafts: DraftRow[]) {
  if (!event || !event.draft_id) return null;
  return drafts.find((draft) => draft.id === event.draft_id) ?? null;
}
