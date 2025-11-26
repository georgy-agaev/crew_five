import { describe, expect, it } from 'vitest';

import { filterDraftsByStatus, type DraftRow } from './DraftsPage';

const sampleDrafts: DraftRow[] = [
  { id: 'd1', status: 'approved' },
  { id: 'd2', status: 'pending' },
  { id: 'd3', status: 'rejected' },
];

describe('DraftsPage helpers', () => {
  it('returns all drafts when status is empty', () => {
    expect(filterDraftsByStatus(sampleDrafts, '')).toEqual(sampleDrafts);
  });

  it('filters drafts by status', () => {
    const approved = filterDraftsByStatus(sampleDrafts, 'approved');
    expect(approved).toHaveLength(1);
    expect(approved[0].id).toBe('d1');
  });
});
