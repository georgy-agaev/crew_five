import { describe, expect, it, vi } from 'vitest';

import { createSimRequest, completeSimAsNotImplemented } from '../src/services/sim';

describe('sim service (Option 2 stub)', () => {
  it('sim_create_request_creates_sim_job_and_returns_stub_result', async () => {
    const insertSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'job-1',
        type: 'sim',
        status: 'created',
        segment_id: 'seg-1',
        segment_version: 1,
        payload: {},
        result: null,
        created_at: '2025-11-30T00:00:00Z',
        updated_at: '2025-11-30T00:00:00Z',
      },
      error: null,
    });
    const insertSelect = vi.fn().mockReturnValue({ single: insertSingle });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });

    const updateSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'job-1',
        type: 'sim',
        status: 'not_implemented',
        segment_id: 'seg-1',
        segment_version: 1,
        payload: {},
        result: { reason: 'SIM not implemented yet' },
        created_at: '2025-11-30T00:00:00Z',
        updated_at: '2025-11-30T00:00:00Z',
      },
      error: null,
    });
    const updateSelect = vi.fn().mockReturnValue({ single: updateSingle });
    const eq = vi.fn().mockReturnValue({ select: updateSelect });
    const update = vi.fn().mockReturnValue({ eq });

    const from = vi.fn((table: string) => {
      if (table === 'jobs') {
        return { insert, update };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    const client = { from } as any;

    const result = await createSimRequest(client, {
      mode: 'light_roast',
      segmentId: 'seg-1',
      segmentVersion: 1,
      draftIds: ['draft-1'],
    });

    expect(insert).toHaveBeenCalled();
    expect(update).toHaveBeenCalled();
    expect(result.jobId).toBe('job-1');
    expect(result.status).toBe('not_implemented');
    expect(result.reason).toMatch(/not implemented/i);
  });

  it('sim_complete_marks_job_not_implemented_with_reason', async () => {
    const updateSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'job-2',
        type: 'sim',
        status: 'not_implemented',
        segment_id: null,
        segment_version: null,
        payload: {},
        result: { reason: 'custom reason' },
        created_at: '2025-11-30T00:00:00Z',
        updated_at: '2025-11-30T00:00:00Z',
      },
      error: null,
    });
    const updateSelect = vi.fn().mockReturnValue({ single: updateSingle });
    const eq = vi.fn().mockReturnValue({ select: updateSelect });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });
    const client = { from } as any;

    const updated = await completeSimAsNotImplemented(client, 'job-2', 'custom reason');

    expect(from).toHaveBeenCalledWith('jobs');
    expect(update).toHaveBeenCalledWith({
      status: 'not_implemented',
      result: { reason: 'custom reason' },
    });
    expect(eq).toHaveBeenCalledWith('id', 'job-2');
    expect(updated.status).toBe('not_implemented');
    expect(updated.result).toEqual({ reason: 'custom reason' });
  });
});

