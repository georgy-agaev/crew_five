import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/segmentSnapshotWorkflow', () => ({
  ensureSegmentSnapshot: vi.fn().mockResolvedValue({ version: 1, count: 5 }),
}));

const { ensureSegmentSnapshot } = await import('../src/services/segmentSnapshotWorkflow');

import { segmentSnapshotHandler } from '../src/commands/segmentSnapshot';

describe('segmentSnapshotHandler', () => {
  it('delegates to ensureSegmentSnapshot in refresh mode', async () => {
    const client = { from: vi.fn() } as any;
    const result = await segmentSnapshotHandler(client, { segmentId: 'segment-1' });

    expect(ensureSegmentSnapshot).toHaveBeenCalledWith(client, {
      segmentId: 'segment-1',
      segmentVersion: undefined,
      mode: 'refresh',
      allowEmpty: undefined,
      maxContacts: undefined,
    });
    expect(result.count).toBe(5);
  });
});
