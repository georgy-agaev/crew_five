import { describe, expect, it } from 'vitest';

import { scoreSim } from './SimPage';

describe('SimPage helpers', () => {
  it('boosts alignment when value prop mentions noise reduction', () => {
    const score = scoreSim({
      email: 'short',
      valueProp: 'reduce noise and triage replies',
      mode: 'full_sim',
    });
    expect(score).toBeGreaterThan(0.7);
  });

  it('applies length penalty', () => {
    const longEmail = 'a'.repeat(950);
    const score = scoreSim({ email: longEmail, valueProp: 'base', mode: 'offer_roast' });
    expect(score).toBeLessThan(0.5);
  });
});
