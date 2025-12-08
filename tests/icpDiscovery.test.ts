import { describe, expect, it, vi } from 'vitest';

import { type ExaClient } from '../src/integrations/exa';
import {
  ingestIcpDiscoveryCandidatesFromExa,
  listIcpDiscoveryCandidates,
  runIcpDiscoveryWithExa,
  promoteIcpDiscoveryCandidatesToSegment,
} from '../src/services/icpDiscovery';

describe('icpDiscovery service', () => {
  it('icp_discovery_run_creates_webset_and_run_row', async () => {
    const insertJobsSingle = vi.fn().mockResolvedValue({
      data: { id: 'job-icp-1' },
      error: null,
    });
    const insertJobs = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: insertJobsSingle }),
    });

    const insertRunsSingle = vi.fn().mockResolvedValue({
      data: { id: 'run-1', metadata: {} },
      error: null,
    });
    const insertRuns = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: insertRunsSingle }),
    });

    const updateRunsSingle = vi.fn().mockResolvedValue({
      data: { id: 'run-1', metadata: { provider_run_id: 'ws-1' } },
      error: null,
    });
    const updateRuns = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: updateRunsSingle }),
      }),
    });

    const updateJobsSingle = vi.fn().mockResolvedValue({
      data: { id: 'job-icp-1', status: 'running', result: { run_id: 'run-1' } },
      error: null,
    });
    const updateJobs = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single: updateJobsSingle }),
      }),
    });

    const from = vi.fn((table: string) => {
      if (table === 'jobs') {
        return { insert: insertJobs, update: updateJobs };
      }
      if (table === 'icp_discovery_runs') {
        return { insert: insertRuns, update: updateRuns };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const supabase = { from } as any;
    const exa: ExaClient = {
      createWebset: vi.fn().mockResolvedValue({ id: 'ws-1' }),
      getWebsetItems: vi.fn(),
    } as any;

    const result = await runIcpDiscoveryWithExa(supabase, exa, {
      icpProfileId: 'icp-1',
      icpHypothesisId: 'hypo-1',
      limit: 25,
    });

    expect(insertJobs).toHaveBeenCalled();
    expect(insertRuns).toHaveBeenCalled();
    expect(updateRuns).toHaveBeenCalled();
    expect(updateJobs).toHaveBeenCalled();
    expect(result.jobId).toBe('job-icp-1');
    expect(result.runId).toBe('run-1');
    expect(result.status).toBe('running');
    expect(result.provider).toBe('exa');
  });

	  it('icp_discovery_persists_candidates_with_run_tags', async () => {
	    const selectRunSingle = vi.fn().mockResolvedValue({
	      data: { id: 'run-1', metadata: { provider_run_id: 'ws-1' } },
	      error: null,
	    });
	    const insertCandidatesRaw = vi.fn().mockReturnValue({
	      select: vi.fn().mockResolvedValue({ data: [{ id: 'cand-1' }, { id: 'cand-2' }], error: null }),
	    });

    const from = vi.fn((table: string) => {
      if (table === 'icp_discovery_runs') {
        return { select: () => ({ eq: () => ({ single: selectRunSingle }) }) };
      }
      if (table === 'icp_discovery_candidates') {
        return { insert: insertCandidatesRaw };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const supabase = { from } as any;
    const exa: ExaClient = {
      createWebset: vi.fn(),
      getWebsetItems: vi.fn().mockResolvedValue({
        items: [
          { url: 'https://example.com/1', title: 'Example One' },
          { url: 'https://example.com/2', title: 'Example Two' },
        ],
      }),
    } as any;

    const count = await ingestIcpDiscoveryCandidatesFromExa(supabase, exa, {
      runId: 'run-1',
      limit: 2,
    });

    expect(count).toBe(2);
    expect(insertCandidatesRaw).toHaveBeenCalledTimes(1);
    const payload = insertCandidatesRaw.mock.calls[0]?.[0] as any[];
    expect(payload).toHaveLength(2);
    expect(payload[0].run_id).toBe('run-1');
    expect(payload[0].url).toContain('example.com/1');
  });

	  it('icp_discovery_list_candidates_returns_dtos', async () => {
	    const from = vi.fn((table: string) => {
	      if (table === 'icp_discovery_candidates') {
	        return {
	          select: () => ({
	            eq: (_column: string, value: string) =>
	              Promise.resolve({
	                data: [
	                  {
	                    id: 'cand-1',
	                    run_id: value,
	                    candidate_name: 'Example One',
	                    domain: 'example.com',
	                    url: 'https://example.com/1',
	                    country: 'US',
	                    size_hint: '50-200',
	                    confidence: 0.9,
	                  },
	                ],
	                error: null,
	              }),
	          }),
	        } as any;
	      }
	      throw new Error(`Unexpected table ${table}`);
	    });

    const supabase = { from } as any;
    const dtos = await listIcpDiscoveryCandidates(supabase, { runId: 'run-1' });

    expect(dtos).toHaveLength(1);
    expect(dtos[0].id).toBe('cand-1');
    expect(dtos[0].domain).toBe('example.com');
    expect(dtos[0].confidence).toBe(0.9);
  });

  it('icp_discovery_promote_creates_companies_and_segment_members', async () => {
    const selectRun = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'run-1', icp_profile_id: 'icp-1', icp_hypothesis_id: 'hypo-1' },
          error: null,
        }),
      }),
    });
    const selectCandidates = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({
        data: [
          { id: 'cand-1', domain: 'example.com', candidate_name: 'Example One', url: 'https://example.com' },
        ],
        error: null,
      }),
    });
    const insertCompanies = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'co-1', domain: 'example.com' },
          error: null,
        }),
      }),
    });
    const insertSegmentMembers = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn((table: string) => {
      if (table === 'icp_discovery_runs') return { select: selectRun };
      if (table === 'icp_discovery_candidates') return { select: selectCandidates };
      if (table === 'companies')
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
          insert: insertCompanies,
        };
      if (table === 'segment_members')
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
          insert: insertSegmentMembers,
        };
      throw new Error(`Unexpected table ${table}`);
    });
    const supabase = { from } as any;

    const result = await promoteIcpDiscoveryCandidatesToSegment(supabase, {
      runId: 'run-1',
      candidateIds: ['cand-1'],
      segmentId: 'seg-1',
    });

    expect(result.promotedCount).toBe(1);
    expect(insertCompanies).toHaveBeenCalled();
    expect(insertSegmentMembers).toHaveBeenCalled();
  });

  it('icp_discovery_promote_is_idempotent_for_same_candidate_segment', async () => {
    const selectRun = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'run-1', icp_profile_id: 'icp-1', icp_hypothesis_id: 'hypo-1' },
          error: null,
        }),
      }),
    });
    const selectCandidates = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({
        data: [
          { id: 'cand-1', domain: 'example.com', candidate_name: 'Example One', url: 'https://example.com' },
        ],
        error: null,
      }),
    });
    let seenOnce = false;
    const selectSegmentMembers = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockImplementation(async () => {
            if (seenOnce) {
              return {
                data: [{ id: 'sm-1' }],
                error: null,
              };
            }
            seenOnce = true;
            return { data: null, error: null };
          }),
        }),
      }),
    });
    const insertCompanies = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'co-1', domain: 'example.com' },
          error: null,
        }),
      }),
    });
    const insertSegmentMembers = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn((table: string) => {
      if (table === 'icp_discovery_runs') return { select: selectRun };
      if (table === 'icp_discovery_candidates') return { select: selectCandidates };
      if (table === 'companies')
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
          insert: insertCompanies,
        };
      if (table === 'segment_members')
        return {
          select: selectSegmentMembers,
          insert: insertSegmentMembers,
        };
      throw new Error(`Unexpected table ${table}`);
    });
    const supabase = { from } as any;

    const first = await promoteIcpDiscoveryCandidatesToSegment(supabase, {
      runId: 'run-1',
      candidateIds: ['cand-1'],
      segmentId: 'seg-1',
    });
    const second = await promoteIcpDiscoveryCandidatesToSegment(supabase, {
      runId: 'run-1',
      candidateIds: ['cand-1'],
      segmentId: 'seg-1',
    });

    expect(first.promotedCount).toBe(1);
    expect(second.promotedCount).toBe(0);
    expect(insertSegmentMembers).toHaveBeenCalledTimes(1);
  });
});
