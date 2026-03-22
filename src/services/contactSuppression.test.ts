import { describe, expect, it } from 'vitest';

import { deriveContactSuppressionState } from './contactSuppression.js';

describe('contactSuppression', () => {
  it('derives canonical suppression state from bounced, unsubscribed, and complaint events', () => {
    const result = deriveContactSuppressionState([
      { event_type: 'replied' },
      { event_type: 'bounced' },
      { event_type: 'complaint' },
    ]);

    expect(result).toEqual({
      replyReceived: true,
      bounced: true,
      unsubscribed: true,
      complaint: true,
      suppressed: true,
    });
  });
});
