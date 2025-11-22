import { describe, expect, it, vi } from 'vitest';

import { snapshotExists, ensureSegmentSnapshot } from '../src/services/segmentSnapshotWorkflow';

vi.mock('../src/services/segments', () => ({
  getSegmentById: vi.fn().mockResolvedValue({
    id: 'segment-1',
    version: 1,
    filter_definition: [{ field: 'employees.role', operator: 'eq', value: 'CTO' }],
  }),
  parseSegmentFilters: vi.fn().mockReturnValue([
    { field: 'employees.role', operator: 'eq', value: 'CTO' },
  ]),
  fetchContactsForSegment: vi.fn().mockResolvedValue([
    { id: 'contact-1', company_id: 'company-1' },
  ]),
  setSegmentVersion: vi.fn().mockResolvedValue(2),
}));

vi.mock('../src/services/segmentSnapshot', () => ({
  createSegmentSnapshot: vi.fn().mockResolvedValue({ inserted: 1, segmentId: 'segment-1', segmentVersion: 1 }),
}));

const { fetchContactsForSegment, parseSegmentFilters, getSegmentById, setSegmentVersion } = await import(
  '../src/services/segments'
);
const { createSegmentSnapshot } = await import('../src/services/segmentSnapshot');

describe('snapshotExists', () => {
  it('returns true when count > 0', async () => {
    const match = vi.fn().mockResolvedValue({ data: null, error: null, count: 3 });
    const select = vi.fn().mockReturnValue({ match });
    const client = {
      from: vi.fn().mockReturnValue({ select }),
    } as any;

    const result = await snapshotExists(client, 'segment-1', 1);
    expect(client.from).toHaveBeenCalledWith('segment_members');
    expect(select).toHaveBeenCalled();
    expect(result.exists).toBe(true);
    expect(result.count).toBe(3);
  });
});

describe('ensureSegmentSnapshot', () => {
  it('reuses existing snapshot when mode is reuse', async () => {
    const match = vi.fn().mockResolvedValue({ data: null, error: null, count: 5 });
    const select = vi.fn().mockReturnValue({ match });
    const client = {
      from: vi.fn().mockReturnValue({ select }),
    } as any;

    const result = await ensureSegmentSnapshot(client, {
      segmentId: 'segment-1',
      mode: 'reuse',
    });

    expect(getSegmentById).toHaveBeenCalled();
    expect(result.count).toBe(5);
    expect(createSegmentSnapshot).not.toHaveBeenCalled();
  });

  it('refreshes snapshot when mode is refresh', async () => {
    const match = vi.fn().mockResolvedValue({ data: null, error: null, count: 0 });
    const select = vi.fn().mockReturnValue({ match });
    const client = {
      from: vi.fn().mockReturnValue({ select }),
    } as any;

    const result = await ensureSegmentSnapshot(client, {
      segmentId: 'segment-1',
      mode: 'refresh',
    });

    expect(parseSegmentFilters).toHaveBeenCalled();
    expect(fetchContactsForSegment).toHaveBeenCalled();
    expect(createSegmentSnapshot).toHaveBeenCalled();
    expect(result.count).toBe(1);
  });

  it('bumps version when requested', async () => {
    const match = vi.fn().mockResolvedValue({ data: null, error: null, count: 0 });
    const select = vi.fn().mockReturnValue({ match });
    const client = {
      from: vi.fn().mockReturnValue({ select }),
    } as any;

    await ensureSegmentSnapshot(client, {
      segmentId: 'segment-1',
      mode: 'refresh',
      bumpVersion: true,
    });

    expect(setSegmentVersion).toHaveBeenCalledWith(client, 'segment-1', 2);
  });
});
