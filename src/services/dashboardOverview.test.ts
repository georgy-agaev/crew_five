import { describe, expect, it, vi } from 'vitest';

import { getDashboardOverview } from './dashboardOverview.js';

describe('dashboard overview', () => {
  it('builds campaign counters, pending actions, and recent activity', async () => {
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'campaigns') {
          return {
            select: vi.fn(async () => ({
              data: [
                { id: 'camp-1', name: 'Alpha', status: 'review', updated_at: '2026-03-18T10:00:00Z' },
                { id: 'camp-2', name: 'Beta', status: 'complete', updated_at: '2026-03-18T08:00:00Z' },
              ],
              error: null,
            })),
          };
        }

        if (table === 'drafts') {
          return {
            select: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(async () => ({
                  data: [
                    { id: 'draft-1', campaign_id: 'camp-1', status: 'generated', email_type: 'intro', updated_at: '2026-03-18T09:30:00Z' },
                    { id: 'draft-2', campaign_id: 'camp-2', status: 'approved', email_type: 'bump', updated_at: '2026-03-18T07:30:00Z' },
                  ],
                  error: null,
                })),
              })),
            })),
          };
        }

        if (table === 'email_events') {
          return {
            select: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(async () => ({
                  data: [
                    { id: 'evt-1', event_type: 'replied', reply_label: 'positive', occurred_at: '2026-03-18T11:00:00Z', draft_id: 'draft-1' },
                    { id: 'evt-2', event_type: 'opened', reply_label: null, occurred_at: '2026-03-18T06:00:00Z', draft_id: 'draft-2' },
                  ],
                  error: null,
                })),
              })),
            })),
          };
        }

        if (table === 'companies') {
          return {
            select: vi.fn(async () => ({
              data: [
                {
                  id: 'co-1',
                  company_name: 'Fresh Co',
                  company_research: { lastUpdatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString() },
                  updated_at: '2026-03-18T09:00:00Z',
                },
                {
                  id: 'co-2',
                  company_name: 'Stale Co',
                  company_research: { lastUpdatedAt: '2025-01-01T09:00:00Z' },
                  updated_at: '2026-03-18T09:00:00Z',
                },
                {
                  id: 'co-3',
                  company_name: 'Missing Co',
                  company_research: null,
                  updated_at: '2026-03-18T09:00:00Z',
                },
              ],
              error: null,
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    } as any;

    const result = await getDashboardOverview(client);

    expect(result.campaigns).toEqual({
      total: 2,
      active: 1,
      byStatus: [
        { status: 'complete', count: 1 },
        { status: 'review', count: 1 },
      ],
    });
    expect(result.pending).toEqual({
      draftsOnReview: 1,
      inboxReplies: 1,
      staleEnrichment: 1,
      missingEnrichment: 1,
    });
    expect(result.recentActivity[0]).toMatchObject({
      kind: 'reply',
      id: 'evt-1',
      title: 'Reply positive',
    });
    expect(result.recentActivity).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'draft',
          id: 'draft-1',
          subtitle: 'intro email · Alpha',
        }),
      ])
    );
  });
});
