import { describe, expect, it } from 'vitest';

import { modeSummary } from './CampaignsPage';

describe('CampaignsPage helpers', () => {
  it('formats mode summary', () => {
    expect(modeSummary('strict', 'express')).toBe('strict / express');
    expect(modeSummary('graceful', 'coach')).toBe('graceful / coach');
  });
});
