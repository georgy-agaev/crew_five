import { describe, expect, it } from 'vitest';

import { DRAFT_PROMPT_STEP, formatEnrichmentStatus, isSnapshotFinalized, shouldBlockDrafts } from './WorkflowZeroPage';

describe('WorkflowZeroPage helpers', () => {
  it('workflow0_requires_finalized_snapshot_before_drafts', () => {
    expect(shouldBlockDrafts('', null)).toBe(true);
    expect(shouldBlockDrafts('s1', 0)).toBe(true);
    expect(shouldBlockDrafts('s1', 1)).toBe(false);
    expect(isSnapshotFinalized(1)).toBe(true);
    expect(isSnapshotFinalized(0)).toBe(false);
  });

  it('workflow0_shows_enrichment_status_badge', () => {
    expect(formatEnrichmentStatus(null, null)).toBe('Not started');
    expect(formatEnrichmentStatus('queued', null)).toBe('queued');
    expect(formatEnrichmentStatus('completed', 'job1')).toBe('completed (#job1)');
  });

  it('workflow_zero_prompt_selector_defaults_to_draft_step', () => {
    expect(DRAFT_PROMPT_STEP).toBe('draft');
  });
});
