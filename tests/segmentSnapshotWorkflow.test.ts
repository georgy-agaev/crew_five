import { describe, expect, it, vi } from 'vitest';

import { ensureSegmentSnapshot, snapshotExists } from '../src/services/segmentSnapshotWorkflow';

vi.mock('../src/services/segments', () => ({
  getSegmentById: vi.fn().mockResolvedValue({
    id: 'segment-1',
    version: 1,
    filter_definition: [{ field: 'employees.role', operator: 'eq', value: 'CTO' }],
  }),
  fetchContactsForSegment: vi.fn().mockResolvedValue([
    { id: 'contact-1', company_id: 'company-1' },
  ]),
  setSegmentVersion: vi.fn().mockResolvedValue(2),
}));

vi.mock('../src/filters', () => ({
  parseSegmentFilters: vi.fn().mockReturnValue([{ field: 'employees.role', op: 'eq', value: 'CTO' }]),
}));

vi.mock('../src/services/segmentSnapshot', () => ({
  createSegmentSnapshot: vi.fn().mockImplementation((_client, segment, contacts) =>
    Promise.resolve({ inserted: contacts.length, segmentId: segment.id, segmentVersion: segment.version })
  ),
}));

const { fetchContactsForSegment, getSegmentById, setSegmentVersion } = await import('../src/services/segments');
const { parseSegmentFilters } = await import('../src/filters');
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

describe('ensureSegmentSnapshot guardrails', () => {
  it('rejects zero-contact snapshots unless allowEmpty is true', async () => {
    vi.mocked(fetchContactsForSegment).mockResolvedValueOnce([]);
    const match = vi.fn().mockResolvedValue({ data: null, error: null, count: 0 });
    const select = vi.fn().mockReturnValue({ match });
    const client = {
      from: vi.fn().mockReturnValue({ select }),
    } as any;

    await expect(
      ensureSegmentSnapshot(client, {
        segmentId: 'segment-1',
        mode: 'refresh',
      })
    ).rejects.toThrow(/No contacts matched/);

    vi.mocked(fetchContactsForSegment).mockResolvedValueOnce([]);

    await expect(
      ensureSegmentSnapshot(client, {
        segmentId: 'segment-1',
        mode: 'refresh',
        allowEmpty: true,
      })
    ).resolves.toEqual({ version: 1, count: 0 });
  });

  it('enforces max contacts guardrail', async () => {
    vi.mocked(fetchContactsForSegment).mockResolvedValueOnce(
      Array.from({ length: 3 }, (_, i) => ({ id: `c-${i}`, company_id: `co-${i}` }))
    );
    const match = vi.fn().mockResolvedValue({ data: null, error: null, count: 0 });
    const select = vi.fn().mockReturnValue({ match });
    const client = {
      from: vi.fn().mockReturnValue({ select }),
    } as any;

    await expect(
      ensureSegmentSnapshot(client, {
        segmentId: 'segment-1',
        mode: 'refresh',
        maxContacts: 2,
        allowEmpty: true,
      })
    ).rejects.toThrow(/exceeds max/);
  });

  it('bumps version before refresh when bumpVersion is set', async () => {
    const match = vi.fn().mockResolvedValue({ data: null, error: null, count: 0 });
    const select = vi.fn().mockReturnValue({ match });
    const client = {
      from: vi.fn().mockReturnValue({ select }),
    } as any;

    await ensureSegmentSnapshot(client, {
      segmentId: 'segment-1',
      mode: 'refresh',
      bumpVersion: true,
      allowEmpty: true,
    });

    expect(setSegmentVersion).toHaveBeenCalledWith(client, 'segment-1', 2);
    expect(createSegmentSnapshot).toHaveBeenCalled();
  });
});
