import { describe, expect, it } from 'vitest';

import { deriveQueries } from './IcpDiscoveryPage';

describe('IcpDiscoveryPage helpers', () => {
  it('builds Exa-friendly queries', () => {
    const queries = deriveQueries({
      industry: 'AI infra',
      size: '50-500',
      geo: 'US',
      persona: 'RevOps',
      pains: 'signal-to-noise,manual triage',
      hypothesis: 'High inbound noise',
    });
    expect(queries[0]).toContain('AI infra');
    expect(queries[0]).toContain('signal-to-noise');
    expect(queries[1]).toContain('expansion');
    expect(queries[2]).toContain('hiring');
  });
});
