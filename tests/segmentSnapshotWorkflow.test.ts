/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, expect, it, vi } from 'vitest';

import {
  ensureFinalSegmentSnapshot,
  ensureSegmentSnapshot,
  snapshotExists,
} from '../src/services/segmentSnapshotWorkflow';

vi.mock('../src/services/segments', () => ({
  getSegmentById: vi.fn().mockResolvedValue({
    id: 'segment-1',
    version: 1,
    filter_definition: [{ field: 'employees.role', operator: 'eq', value: 'CTO' }],
  }),
  fetchContactsForSegment: vi.fn().mockResolvedValue([
    { id: 'contact-1', company_id: 'company-1' },
  ]),
  setSegmentVersion: vi.fn().mockImplementation((_client, _id, version) => Promise.resolve(version)),
}));

vi.mock('../src/filters', async () => {
  const actual = await vi.importActual<typeof import('../src/filters')>('../src/filters');
  return {
    ...actual,
    parseSegmentFilters: vi.fn().mockReturnValue([{ field: 'employees.role', op: 'eq', value: 'CTO' }]),
    hashFilters: vi.fn().mockReturnValue('hash-123'),
  };
});

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
  it('rejects reuse when filters hash mismatches', async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [{ snapshot: { filters_hash: 'old-hash' } }],
      count: 1,
      error: null,
    });
    const match = vi.fn().mockReturnValue({ limit });
    const select = vi.fn().mockReturnValue({ match });
    const client = {
      from: vi.fn().mockReturnValue({ select }),
    } as any;

    await expect(
      ensureSegmentSnapshot(client, {
        segmentId: 'segment-1',
        mode: 'reuse',
      })
    ).rejects.toThrow(/hash mismatch/);
  });

  it('returns filters hash when refreshing', async () => {
    const match = vi.fn().mockResolvedValue({ data: null, error: null, count: 0 });
    const select = vi.fn().mockReturnValue({ match });
    const client = {
      from: vi.fn().mockReturnValue({ select }),
    } as any;

    const result = await ensureSegmentSnapshot(client, {
      segmentId: 'segment-1',
      mode: 'refresh',
      allowEmpty: true,
    });

    expect(result.filtersHash).toBeDefined();
    expect(typeof result.filtersHash).toBe('string');
  });

  it('fails when provided version mismatches unless forceVersion is set', async () => {
    const match = vi.fn().mockResolvedValue({ data: null, error: null, count: 0 });
    const select = vi.fn().mockReturnValue({ match });
    const client = {
      from: vi.fn().mockReturnValue({ select }),
    } as any;

    await expect(
      ensureSegmentSnapshot(client, {
        segmentId: 'segment-1',
        mode: 'reuse',
        segmentVersion: 99,
      })
    ).rejects.toThrow(/segment version mismatch/);

    vi.mocked(fetchContactsForSegment).mockResolvedValueOnce([]);
    await expect(
      ensureSegmentSnapshot(client, {
        segmentId: 'segment-1',
        mode: 'refresh',
        segmentVersion: 99,
        forceVersion: true,
        allowEmpty: true,
      })
    ).resolves.toEqual(expect.objectContaining({ version: 99, filtersHash: 'hash-123' }));
  });

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
    ).resolves.toEqual(expect.objectContaining({ version: 1, count: 0 }));
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

describe('ensureFinalSegmentSnapshot', () => {
  it('throws when segment version is not finalized', async () => {
    vi.mocked(getSegmentById).mockResolvedValueOnce({
      id: 'segment-1',
      version: 0,
      filter_definition: {},
    } as any);
    const client = { from: vi.fn() } as any;

    await expect(ensureFinalSegmentSnapshot(client, 'segment-1')).rejects.toThrow(/not finalized/);
  });

  it('throws when no snapshot exists for finalized segment', async () => {
    vi.mocked(getSegmentById).mockResolvedValueOnce({
      id: 'segment-1',
      version: 1,
      filter_definition: {},
    } as any);
    const match = vi.fn().mockResolvedValue({ data: null, count: 0, error: null });
    const select = vi.fn().mockReturnValue({ match });
    const client = { from: vi.fn().mockReturnValue({ select }) } as any;

    await expect(ensureFinalSegmentSnapshot(client, 'segment-1')).rejects.toThrow(/No finalized snapshot/);
  });

  it('returns version and count when snapshot exists', async () => {
    vi.mocked(getSegmentById).mockResolvedValueOnce({
      id: 'segment-1',
      version: 2,
      filter_definition: {},
    } as any);
    const match = vi.fn().mockResolvedValue({ data: null, count: 5, error: null });
    const select = vi.fn().mockReturnValue({ match });
    const client = { from: vi.fn().mockReturnValue({ select }) } as any;

    const result = await ensureFinalSegmentSnapshot(client, 'segment-1');
    expect(result.version).toBe(2);
    expect(result.count).toBe(5);
  });

  it('throws when expectedVersion differs and forceVersion is false', async () => {
    vi.mocked(getSegmentById).mockResolvedValueOnce({
      id: 'segment-1',
      version: 3,
      filter_definition: {},
    } as any);
    const match = vi.fn().mockResolvedValue({ data: null, count: 5, error: null });
    const select = vi.fn().mockReturnValue({ match });
    const client = { from: vi.fn().mockReturnValue({ select }) } as any;

    await expect(
      ensureFinalSegmentSnapshot(client, 'segment-1', { expectedVersion: 1, forceVersion: false })
    ).rejects.toThrow(/mismatch/);
  });
});
