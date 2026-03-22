import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/segments', () => ({
  getSegmentById: vi.fn(),
  fetchContactsForSegment: vi.fn(),
  setSegmentVersion: vi.fn(),
}));

vi.mock('../src/services/segmentSnapshot', () => ({
  createSegmentSnapshot: vi.fn(),
}));

const { getSegmentById, fetchContactsForSegment } = await import('../src/services/segments');
const { createSegmentSnapshot } = await import('../src/services/segmentSnapshot');
const { ensureSegmentSnapshot } = await import('../src/services/segmentSnapshotWorkflow');

describe('ensureSegmentSnapshot with legacy filter fields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes legacy employee_count field before fetching contacts', async () => {
    vi.mocked(getSegmentById).mockResolvedValue({
      id: 'segment-legacy',
      version: 1,
      filter_definition: [{ field: 'employee_count', operator: 'gte', value: 30 }],
    } as any);
    vi.mocked(fetchContactsForSegment).mockResolvedValue([{ id: 'contact-1', company_id: 'company-1' }] as any);
    vi.mocked(createSegmentSnapshot).mockResolvedValue({
      inserted: 1,
      segmentId: 'segment-legacy',
      segmentVersion: 1,
    } as any);

    const result = await ensureSegmentSnapshot({} as any, {
      segmentId: 'segment-legacy',
      mode: 'refresh',
      allowEmpty: true,
    });

    expect(fetchContactsForSegment).toHaveBeenCalledWith(
      {} as any,
      [{ field: 'companies.employee_count', op: 'gte', value: 30 }]
    );
    expect(result).toEqual({
      version: 1,
      count: 1,
      filtersHash: expect.any(String),
    });
  });
});
