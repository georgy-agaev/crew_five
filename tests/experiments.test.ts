import { describe, expect, it, vi } from 'vitest';

import { applyVariantToDraft, assignVariant } from '../src/services/experiments';
import { registerPromptVersion } from '../src/services/promptRegistry';
import { getPromptPatternPerformance, getSimJobSummaryForAnalytics, suggestPromptPatternAdjustments } from '../src/services/analytics';

describe('experiments', () => {
  it('assigns_deterministically', () => {
    expect(assignVariant('subject1')).toBe(assignVariant('subject1'));
  });

  it('propagates_variant_label', () => {
    const draft = { metadata: { foo: 'bar' } };
    const result = applyVariantToDraft(draft, 'A');
    expect(result.metadata?.variant).toBe('A');
    expect(result.metadata?.foo).toBe('bar');
  });

  it('prompt_registry_register_stores_prompt_metadata_and_version', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'prompt-1',
        coach_prompt_id: 'intro_v1',
        description: 'Intro prompt',
        version: 'v1',
        rollout_status: 'active',
        created_at: '',
        updated_at: '',
      },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });
    const client = { from } as any;

    const row = await registerPromptVersion(client, {
      coachPromptId: 'intro_v1',
      description: 'Intro prompt',
      version: 'v1',
      rolloutStatus: 'active',
    });

    expect(from).toHaveBeenCalledWith('prompt_registry');
    expect(insert).toHaveBeenCalled();
    expect(row.coach_prompt_id).toBe('intro_v1');
  });

  it('analytics_prompt_pattern_performance_ranks_combinations_by_outcome', async () => {
    const patternRows = [
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

    const select = vi.fn().mockReturnValue(Promise.resolve({ data: patternRows, error: null }));
    const gte = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ select, gte });
    const client = { from } as any;

    const results = await getPromptPatternPerformance(client, {});

    expect(from).toHaveBeenCalledWith('analytics_events_flat');
    expect(results).toHaveLength(1);
    expect(results[0]).toEqual(
      expect.objectContaining({
        draft_pattern: 'intro_v1:standard:A',
        replied: 2,
        positive_replies: 2,
      })
    );
  });

  it('analytics_sim_job_summary_counts_jobs_by_mode_and_status', async () => {
    const eq = vi.fn().mockReturnValue(
      Promise.resolve({
        data: [
          { status: 'not_implemented' },
          { status: 'not_implemented' },
          { status: 'failed' },
        ],
        error: null,
      })
    );
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const client = { from } as any;

    const summary = await getSimJobSummaryForAnalytics(client);

    expect(from).toHaveBeenCalledWith('jobs');
    expect(summary).toEqual(
      expect.arrayContaining([
        { status: 'not_implemented', count: 2 },
        { status: 'failed', count: 1 },
      ])
    );
  });

  it('analytics_optimize_suggests_retire_for_underperforming_patterns', async () => {
    const patternRows = [
      {
        draft_pattern: 'intro_v1:standard:A',
        user_edited: false,
        event_type: 'delivered',
        outcome_classification: null,
      },
      {
        draft_pattern: 'intro_v1:standard:A',
        user_edited: false,
        event_type: 'opened',
        outcome_classification: null,
      },
    ];

    const select = vi.fn().mockReturnValue(Promise.resolve({ data: patternRows, error: null }));
    const gte = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ select, gte });
    const client = { from } as any;

    const suggestions = await suggestPromptPatternAdjustments(client, {});

    expect(from).toHaveBeenCalledWith('analytics_events_flat');
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toEqual(
      expect.objectContaining({
        draft_pattern: 'intro_v1:standard:A',
        recommendation: 'retire',
      })
    );
  });
});
