import type { CampaignFollowupCandidate } from './campaignFollowupCandidates.js';
import { getCampaignLocalDateKey } from './campaignSendCalendar.js';

export type BumpDraftLifecycleState =
  | 'generated_pending_review'
  | 'approved_waiting_next_day'
  | 'approved_sendable';

export type BumpDraftBlockReason =
  | 'pending_review'
  | 'approved_today'
  | 'reply_received'
  | 'bounced'
  | 'unsubscribed'
  | 'already_sent'
  | 'missing_approval_timestamp'
  | 'canonical_ineligible';

export interface BumpDraftState {
  bump_lifecycle_state: BumpDraftLifecycleState | null;
  bump_can_send_now: boolean;
  bump_send_block_reasons: BumpDraftBlockReason[];
  bump_approved_at: string | null;
}

export function getBumpApprovedAt(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const approvedAt = metadata.approved_at;
  if (typeof approvedAt === 'string' && approvedAt.trim().length > 0) {
    return approvedAt;
  }

  const reviewedAt = metadata.reviewed_at;
  if (typeof reviewedAt === 'string' && reviewedAt.trim().length > 0) {
    return reviewedAt;
  }

  return null;
}

export function hasBumpApprovalCooldownPassed(
  approvedAt: string | null,
  sendTimezone: string,
  now: Date
): boolean {
  if (!approvedAt) {
    return true;
  }

  const approvedDate = new Date(approvedAt);
  if (Number.isNaN(approvedDate.getTime())) {
    return false;
  }

  return getCampaignLocalDateKey(now, sendTimezone) > getCampaignLocalDateKey(approvedDate, sendTimezone);
}

export function evaluateBumpDraftState(input: {
  emailType: string | null | undefined;
  status: string | null | undefined;
  metadata?: Record<string, unknown> | null;
  followupCandidate?: CampaignFollowupCandidate | null;
  sendTimezone: string;
  now: Date;
}): BumpDraftState {
  if (input.emailType !== 'bump') {
    return {
      bump_lifecycle_state: null,
      bump_can_send_now: false,
      bump_send_block_reasons: [],
      bump_approved_at: null,
    };
  }

  if (input.status === 'generated') {
    return {
      bump_lifecycle_state: 'generated_pending_review',
      bump_can_send_now: false,
      bump_send_block_reasons: ['pending_review'],
      bump_approved_at: null,
    };
  }

  if (input.status !== 'approved') {
    return {
      bump_lifecycle_state: null,
      bump_can_send_now: false,
      bump_send_block_reasons: [],
      bump_approved_at: getBumpApprovedAt(input.metadata),
    };
  }

  const approvedAt = getBumpApprovedAt(input.metadata);
  const cooldownPassed = hasBumpApprovalCooldownPassed(approvedAt, input.sendTimezone, input.now);
  const blockReasons: BumpDraftBlockReason[] = [];

  if (approvedAt && !cooldownPassed) {
    blockReasons.push('approved_today');
  }

  const candidate = input.followupCandidate ?? null;
  if (candidate) {
    if (candidate.reply_received) {
      blockReasons.push('reply_received');
    }
    if (candidate.bounce) {
      blockReasons.push('bounced');
    }
    if (candidate.unsubscribed) {
      blockReasons.push('unsubscribed');
    }
    if (candidate.bump_sent) {
      blockReasons.push('already_sent');
    }
    if (
      !candidate.reply_received &&
      !candidate.bounce &&
      !candidate.unsubscribed &&
      !candidate.bump_sent &&
      !candidate.eligible
    ) {
      blockReasons.push('canonical_ineligible');
    }
  }

  const bumpCanSendNow =
    (approvedAt ? cooldownPassed : true) && Boolean(candidate?.eligible);

  return {
    bump_lifecycle_state:
      approvedAt && !cooldownPassed
        ? 'approved_waiting_next_day'
        : bumpCanSendNow
          ? 'approved_sendable'
          : null,
    bump_can_send_now: bumpCanSendNow,
    bump_send_block_reasons: blockReasons,
    bump_approved_at: approvedAt,
  };
}
