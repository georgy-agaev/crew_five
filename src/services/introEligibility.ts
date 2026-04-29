export type IntroEligibilityBlockReason =
  | 'no_sendable_email'
  | 'bounced'
  | 'unsubscribed'
  | 'already_used'
  | 'intro_exists'
  | 'bump_exists';

export interface IntroEligibilityInput {
  recipientEmail: string | null;
  sendable: boolean;
  bounced: boolean;
  unsubscribed: boolean;
  alreadyUsed: boolean;
  activeIntroExists: boolean;
  activeBumpExists: boolean;
}

export interface IntroEligibilityResult {
  eligible: boolean;
  blockReasons: IntroEligibilityBlockReason[];
}

function appendReason(reasons: IntroEligibilityBlockReason[], reason: IntroEligibilityBlockReason) {
  if (!reasons.includes(reason)) {
    reasons.push(reason);
  }
}

export function evaluateNewIntroEligibility(input: IntroEligibilityInput): IntroEligibilityResult {
  const blockReasons: IntroEligibilityBlockReason[] = [];

  if (!input.recipientEmail || !input.sendable) appendReason(blockReasons, 'no_sendable_email');
  if (input.bounced) appendReason(blockReasons, 'bounced');
  if (input.unsubscribed) appendReason(blockReasons, 'unsubscribed');
  if (input.alreadyUsed) appendReason(blockReasons, 'already_used');
  if (input.activeIntroExists) appendReason(blockReasons, 'intro_exists');
  if (input.activeBumpExists) appendReason(blockReasons, 'bump_exists');

  return {
    eligible: blockReasons.length === 0,
    blockReasons,
  };
}
