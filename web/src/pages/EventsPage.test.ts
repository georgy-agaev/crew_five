import { describe, expect, it } from 'vitest';

import { formatGroupKey } from './EventsPage';

describe('EventsPage analytics helpers', () => {
  it('analytics_page_renders_grouped_tables_and_prompt_registry', () => {
    expect(formatGroupKey('icp', { icp_profile_id: 'p1', icp_hypothesis_id: 'h1' })).toBe('p1 / h1');
    expect(formatGroupKey('segment', { segment_id: 's1', segment_version: 1, role: 'ceo' })).toBe('s1@v1 (ceo)');
    expect(formatGroupKey('pattern', { draft_pattern: 'p', user_edited: true })).toBe('p [edited=true]');
  });
});
