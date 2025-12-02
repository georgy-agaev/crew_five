import { describe, expect, it, vi } from 'vitest';

import { createJob, updateJobStatus } from '../src/services/jobs';

describe('jobs service', () => {
  it('jobs_create_inserts_row_with_expected_type_and_payload', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'job-1',
        type: 'sim',
        status: 'created',
        segment_id: 'seg-1',
        segment_version: 1,
        payload: { foo: 'bar' },
        result: null,
        created_at: '2025-11-30T00:00:00Z',
        updated_at: '2025-11-30T00:00:00Z',
      },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });
    const client = { from } as any;

    const job = await createJob(client, {
      type: 'sim',
      status: 'created',
      segmentId: 'seg-1',
      segmentVersion: 1,
      payload: { foo: 'bar' },
    });

    expect(from).toHaveBeenCalledWith('jobs');
    expect(insert).toHaveBeenCalledWith({
      type: 'sim',
      status: 'created',
      segment_id: 'seg-1',
      segment_version: 1,
      payload: { foo: 'bar' },
    });
    expect(job.id).toBe('job-1');
    expect(job.type).toBe('sim');
  });

  it('jobs_update_status_updates_status_and_result_json', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'job-1',
        type: 'sim',
        status: 'completed',
        segment_id: 'seg-1',
        segment_version: 1,
        payload: { foo: 'bar' },
        result: { ok: true },
        created_at: '2025-11-30T00:00:00Z',
        updated_at: '2025-11-30T00:00:00Z',
      },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });
    const client = { from } as any;

    const updated = await updateJobStatus(client, 'job-1', 'completed', { ok: true });

    expect(from).toHaveBeenCalledWith('jobs');
    expect(update).toHaveBeenCalledWith({
      status: 'completed',
      result: { ok: true },
    });
    expect(eq).toHaveBeenCalledWith('id', 'job-1');
    expect(updated.status).toBe('completed');
    expect(updated.result).toEqual({ ok: true });
  });
});
