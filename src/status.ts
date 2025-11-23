export type CampaignStatus =
  | 'draft'
  | 'ready'
  | 'review'
  | 'generating'
  | 'sending'
  | 'paused'
  | 'complete';

const statusTransitions: Record<CampaignStatus, CampaignStatus[]> = {
  draft: ['ready', 'review'],
  ready: ['generating'],
  generating: ['review', 'sending'],
  review: ['ready', 'generating'],
  sending: ['paused', 'complete'],
  paused: ['sending', 'complete'],
  complete: [],
};

export function getAllowedTransitions(): Record<CampaignStatus, CampaignStatus[]> {
  return statusTransitions;
}

export function assertCampaignStatusTransition(current: CampaignStatus, next: CampaignStatus) {
  const allowed = statusTransitions[current] ?? [];
  if (!allowed.includes(next)) {
    const error = new Error(
      `ERR_STATUS_INVALID: Invalid status transition from ${current} to ${next}. Allowed: ${allowed.join(', ') || 'none'}`
    );
    (error as any).code = 'ERR_STATUS_INVALID';
    (error as any).details = { allowedTransitions: allowed };
    throw error;
  }
}

export function isValidTransition(current: CampaignStatus, next: CampaignStatus) {
  const allowed = statusTransitions[current] ?? [];
  return allowed.includes(next);
}
