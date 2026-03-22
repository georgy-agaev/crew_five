import { describe, expect, it, vi } from 'vitest';

import {
  createSegmentAndRefresh,
  saveExaSegmentAndRefresh,
} from './legacyWorkspaceSegmentActions';

describe('legacyWorkspaceSegmentActions', () => {
  it('creates a manual segment with fixed en locale and returns refreshed rows', async () => {
    const createSegmentApi = vi.fn().mockResolvedValue(undefined);
    const fetchSegmentsApi = vi.fn().mockResolvedValue([{ id: 'seg_1', name: 'CTOs' }]);

    const rows = await createSegmentAndRefresh(
      {
        name: 'CTOs',
        filterDefinition: [{ field: 'employees.position', operator: 'eq', value: 'CTO' }],
      },
      {
        createSegmentApi,
        fetchSegmentsApi,
      }
    );

    expect(createSegmentApi).toHaveBeenCalledWith({
      name: 'CTOs',
      locale: 'en',
      filterDefinition: [{ field: 'employees.position', operator: 'eq', value: 'CTO' }],
    });
    expect(fetchSegmentsApi).toHaveBeenCalledTimes(1);
    expect(rows).toEqual([{ id: 'seg_1', name: 'CTOs' }]);
  });

  it('saves an EXA segment with language-specific locale and derived description', async () => {
    const saveExaSegmentApi = vi.fn().mockResolvedValue(undefined);
    const fetchSegmentsApi = vi.fn().mockResolvedValue([{ id: 'seg_2', name: 'EXA CTOs' }]);

    const rows = await saveExaSegmentAndRefresh(
      {
        name: 'EXA CTOs',
        companies: [{ company_name: 'Acme' }],
        employees: [{ full_name: 'Jane Doe' }],
        query: 'cto saas europe',
      },
      'fr',
      {
        saveExaSegmentApi,
        fetchSegmentsApi,
      }
    );

    expect(saveExaSegmentApi).toHaveBeenCalledWith({
      name: 'EXA CTOs',
      locale: 'fr',
      companies: [{ company_name: 'Acme' }],
      employees: [{ full_name: 'Jane Doe' }],
      query: 'cto saas europe',
      description: 'EXA Web Search: cto saas europe',
    });
    expect(rows).toEqual([{ id: 'seg_2', name: 'EXA CTOs' }]);
  });
});
