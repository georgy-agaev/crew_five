import { describe, expect, it } from 'vitest';

import { scoreSim, simStatusLabel } from './SimPage';

describe('SimPage helpers', () => {
  it('sim_page_calls_stub_and_shows_job_id', () => {
    expect(simStatusLabel(null, null)).toBe('Not started');
    expect(simStatusLabel('coming_soon', 'job1')).toBe('coming_soon (#job1)');
    expect(scoreSim({ email: 'short', valueProp: 'reduce noise', mode: 'full_sim' })).toBeGreaterThan(0.6);
  });
});
