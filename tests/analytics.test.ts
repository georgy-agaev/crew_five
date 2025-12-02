import { describe, expect, it, vi } from 'vitest';

import {
  getAnalyticsByIcpAndHypothesis,
  getAnalyticsByPatternAndUserEdit,
  getAnalyticsBySegmentAndRole,
} from '../src/services/analytics';
import { createProgram } from '../src/cli';

describe('analytics service', () => {
  it('analytics_icp_hypothesis_groups_metrics_by_ids_correctly', async () => {
    const rows = [
      {
        icp_profile_id: 'icp-1',
        icp_hypothesis_id: 'hypo-1',
        event_type: 'delivered',
        outcome_classification: null,
        occurred_at: '2025-01-01T00:00:00Z',
      },
      {
        icp_profile_id: 'icp-1',
        icp_hypothesis_id: 'hypo-1',
        event_type: 'opened',
        outcome_classification: null,
        occurred_at: '2025-01-01T01:00:00Z',
      },
      {
        icp_profile_id: 'icp-1',
        icp_hypothesis_id: 'hypo-1',
        event_type: 'replied',
        outcome_classification: 'meeting',
        occurred_at: '2025-01-01T02:00:00Z',
      },
    ];

    const select = vi.fn().mockReturnValue(Promise.resolve({ data: rows, error: null }));
    const from = vi.fn().mockReturnValue({ select, gte: vi.fn().mockReturnValue({ select }) });
    const client = { from } as any;

    const result = await getAnalyticsByIcpAndHypothesis(client, {});

    expect(from).toHaveBeenCalledWith('analytics_events_flat');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(
      expect.objectContaining({
        icp_profile_id: 'icp-1',
        icp_hypothesis_id: 'hypo-1',
        delivered: 1,
        opened: 1,
        replied: 1,
        positive_replies: 1,
      })
    );
  });

  it('analytics_segment_role_breakdown_includes_segment_version_and_role', async () => {
    const rows = [
      {
        segment_id: 'seg-1',
        segment_version: 2,
        role: 'CTO',
        event_type: 'opened',
        outcome_classification: null,
      },
    ];
    const select = vi.fn().mockReturnValue(Promise.resolve({ data: rows, error: null }));
    const from = vi.fn().mockReturnValue({ select, gte: vi.fn().mockReturnValue({ select }) });
    const client = { from } as any;

    const result = await getAnalyticsBySegmentAndRole(client, {});

    expect(from).toHaveBeenCalledWith('analytics_events_flat');
    expect(result).toEqual([
      {
        segment_id: 'seg-1',
        segment_version: 2,
        role: 'CTO',
        delivered: 0,
        opened: 1,
        replied: 0,
        positive_replies: 0,
      },
    ]);
  });

  it('analytics_pattern_user_edit_splits_ai_only_vs_edited', async () => {
    const rows = [
      {
        draft_pattern: 'intro_v1:standard:A',
        user_edited: false,
        event_type: 'replied',
        outcome_classification: 'soft_interest',
      },
      {
        draft_pattern: 'intro_v1:standard:A',
        user_edited: true,
        event_type: 'replied',
        outcome_classification: 'meeting',
      },
    ];
    const select = vi.fn().mockReturnValue(Promise.resolve({ data: rows, error: null }));
    const from = vi.fn().mockReturnValue({ select, gte: vi.fn().mockReturnValue({ select }) });
    const client = { from } as any;

    const result = await getAnalyticsByPatternAndUserEdit(client, {});

    expect(from).toHaveBeenCalledWith('analytics_events_flat');
    expect(result).toEqual([
      {
        draft_pattern: 'intro_v1:standard:A',
        user_edited: false,
        delivered: 0,
        opened: 0,
        replied: 1,
        positive_replies: 1,
      },
      {
        draft_pattern: 'intro_v1:standard:A',
        user_edited: true,
        delivered: 0,
        opened: 0,
        replied: 1,
        positive_replies: 1,
      },
    ]);
  });
});

describe('analytics CLI', () => {
  it('analytics_summary_command_prints_key_metrics_for_recent_range', async () => {
    const rows = [
      {
        icp_profile_id: 'icp-1',
        icp_hypothesis_id: 'hypo-1',
        event_type: 'delivered',
        outcome_classification: null,
        occurred_at: '2025-01-01T00:00:00Z',
      },
    ];

    const select = vi.fn().mockReturnValue(Promise.resolve({ data: rows, error: null }));
    const gte = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ select, gte });
    const supabaseClient = { from } as any;

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      smartleadClient: {} as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'analytics:summary',
      '--group-by',
      'icp',
      '--since',
      '2025-01-01T00:00:00Z',
    ]);

    expect(logSpy).toHaveBeenCalled();
    const printed = (logSpy.mock.calls[0] as any[])[0] as string;
    expect(printed).toMatch(/icp_profile_id/);

    logSpy.mockRestore();
  });

  it('analytics_queries_handle_no_data_without_throwing', async () => {
    const select = vi.fn().mockReturnValue(Promise.resolve({ data: null, error: null }));
    const gte = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ select, gte });
    const supabaseClient = { from } as any;

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      smartleadClient: {} as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync(['node', 'gtm', 'analytics:summary', '--group-by', 'icp']);

    expect(logSpy).toHaveBeenCalled();
    const printed = (logSpy.mock.calls[0] as any[])[0] as string;
    expect(printed).toMatch(/results/);

    logSpy.mockRestore();
  });

  it('analytics_summary_formats_pattern_group', async () => {
    const rows = [
      {
        draft_pattern: 'intro_v1:standard:A',
        user_edited: false,
        event_type: 'delivered',
        outcome_classification: null,
      },
    ];
    const select = vi.fn().mockReturnValue(Promise.resolve({ data: rows, error: null }));
    const gte = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ select, gte });
    const supabaseClient = { from } as any;

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      smartleadClient: {} as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync(['node', 'gtm', 'analytics:summary', '--group-by', 'pattern']);

    const payload = JSON.parse((logSpy.mock.calls[0] as any[])[0] as string);
    expect(payload.groupBy).toBe('pattern');
    expect(payload.results[0]).toHaveProperty('draft_pattern');

    logSpy.mockRestore();
  });
});
