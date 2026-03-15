import { describe, it, expect } from 'vitest';
import { dispatch } from '../src/web/server';

describe('POST /api/filters/preview endpoint', () => {
  it('should return 501 if getFilterPreview not configured', async () => {
    const deps = {
      listCampaigns: async () => [],
      listDrafts: async () => [],
      generateDrafts: async () => ({ generated: 0, dryRun: true }),
      sendSmartlead: async () => ({ sent: 0, failed: 0, skipped: 0, fetched: 0 }),
      listEvents: async () => [],
      listReplyPatterns: async () => [],
    };

    const response = await dispatch(deps, {
      method: 'POST',
      pathname: '/api/filters/preview',
      body: { filterDefinition: [] },
    });

    expect(response.status).toBe(501);
    expect(response.body).toEqual({ error: 'Filter preview not configured' });
  });

  it('should return 400 if filterDefinition is missing', async () => {
    const deps = {
      listCampaigns: async () => [],
      listDrafts: async () => [],
      generateDrafts: async () => ({ generated: 0, dryRun: true }),
      sendSmartlead: async () => ({ sent: 0, failed: 0, skipped: 0, fetched: 0 }),
      listEvents: async () => [],
      listReplyPatterns: async () => [],
      getFilterPreview: async () => ({ companyCount: 0, employeeCount: 0, totalCount: 0 }),
    };

    const response = await dispatch(deps, {
      method: 'POST',
      pathname: '/api/filters/preview',
      body: {},
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'filterDefinition is required' });
  });

  it('should return preview counts when filterDefinition is valid', async () => {
    const deps = {
      listCampaigns: async () => [],
      listDrafts: async () => [],
      generateDrafts: async () => ({ generated: 0, dryRun: true }),
      sendSmartlead: async () => ({ sent: 0, failed: 0, skipped: 0, fetched: 0 }),
      listEvents: async () => [],
      listReplyPatterns: async () => [],
      getFilterPreview: async (_filterDefinition: unknown) => {
        void _filterDefinition;
        // Mock implementation returns sample counts
        return { companyCount: 5, employeeCount: 12, totalCount: 17 };
      },
    };

    const filterDefinition = [
      { field: 'employees.role', operator: 'eq', value: 'CTO' },
    ];

    const response = await dispatch(deps, {
      method: 'POST',
      pathname: '/api/filters/preview',
      body: { filterDefinition },
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      companyCount: 5,
      employeeCount: 12,
      totalCount: 17,
    });
  });

  it('should return 400 if filter validation fails', async () => {
    const deps = {
      listCampaigns: async () => [],
      listDrafts: async () => [],
      generateDrafts: async () => ({ generated: 0, dryRun: true }),
      sendSmartlead: async () => ({ sent: 0, failed: 0, skipped: 0, fetched: 0 }),
      listEvents: async () => [],
      listReplyPatterns: async () => [],
      getFilterPreview: async () => {
        throw new Error('Invalid filter field: invalid.field');
      },
    };

    const response = await dispatch(deps, {
      method: 'POST',
      pathname: '/api/filters/preview',
      body: { filterDefinition: [{ field: 'invalid.field', operator: 'eq', value: 'test' }] },
    });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect((response.body as any).error).toContain('Invalid filter field');
  });

  it('should handle empty filter definition', async () => {
    const deps = {
      listCampaigns: async () => [],
      listDrafts: async () => [],
      generateDrafts: async () => ({ generated: 0, dryRun: true }),
      sendSmartlead: async () => ({ sent: 0, failed: 0, skipped: 0, fetched: 0 }),
      listEvents: async () => [],
      listReplyPatterns: async () => [],
      getFilterPreview: async (_filterDefinition: unknown) => {
        void _filterDefinition;
        // Empty filters should return all counts
        return { companyCount: 100, employeeCount: 500, totalCount: 500 };
      },
    };

    const response = await dispatch(deps, {
      method: 'POST',
      pathname: '/api/filters/preview',
      body: { filterDefinition: [] },
    });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      companyCount: 100,
      employeeCount: 500,
      totalCount: 500,
    });
  });
});
