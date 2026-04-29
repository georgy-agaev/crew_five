import { describe, expect, it } from 'vitest';

import { evaluateNewIntroEligibility } from '../src/services/introEligibility';

const base = {
  recipientEmail: 'ceo@example.ru',
  sendable: true,
  bounced: false,
  unsubscribed: false,
  alreadyUsed: false,
  activeIntroExists: false,
  activeBumpExists: false,
};

describe('introEligibility', () => {
  it('allows a materialized sendable recipient email', () => {
    expect(evaluateNewIntroEligibility(base)).toEqual({
      eligible: true,
      blockReasons: [],
    });
  });

  it('does not distinguish work and assigned generic recipients at eligibility level', () => {
    expect(evaluateNewIntroEligibility({
      ...base,
      recipientEmail: 'info@example.ru',
      sendable: true,
    })).toEqual({
      eligible: true,
      blockReasons: [],
    });
  });

  it('blocks contacts without materialized sendable recipient email', () => {
    expect(evaluateNewIntroEligibility({
      ...base,
      recipientEmail: null,
      sendable: false,
    })).toEqual({
      eligible: false,
      blockReasons: ['no_sendable_email'],
    });
  });

  it('deduplicates email blockers and preserves campaign-state blockers', () => {
    expect(evaluateNewIntroEligibility({
      ...base,
      recipientEmail: null,
      sendable: false,
      bounced: true,
      activeIntroExists: true,
      activeBumpExists: true,
    })).toEqual({
      eligible: false,
      blockReasons: ['no_sendable_email', 'bounced', 'intro_exists', 'bump_exists'],
    });
  });
});
