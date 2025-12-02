import { describe, expect, it } from 'vitest';

import { deriveQueries, pickDefaultHypothesis, pickDefaultProfile } from './IcpDiscoveryPage';

describe('IcpDiscoveryPage helpers', () => {
  it('icp_page_creates_and_selects_profile_hypothesis', () => {
    expect(pickDefaultProfile([{ id: 'p1' }])).toBe('p1');
    expect(pickDefaultProfile([])).toBe('');
    expect(pickDefaultHypothesis([{ id: 'h1' }])).toBe('h1');
    expect(pickDefaultHypothesis([])).toBe('');
  });

  it('deriveQueries builds expected search strings', () => {
    const queries = deriveQueries({
      industry: 'AI infra',
      size: '50-500',
      geo: 'US',
      persona: 'RevOps',
      pains: 'noise',
      hypothesis: 'test',
    });
    expect(queries[0]).toContain('AI infra RevOps US');
    expect(queries[0]).toContain('pains:noise');
  });
});
