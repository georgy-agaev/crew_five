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
            select: vi.fn((fields?: string) => {
              if (typeof fields === 'string' && fields === 'id,campaign_id,email_type,updated_at') {
                return {
                  eq: vi.fn(() => ({
                    order: vi.fn(() => ({
                      limit: vi.fn(async () => ({
                        data: [
                          {
                            id: 'draft-3',
                            campaign_id: 'camp-1',
                            email_type: 'intro',
                            updated_at: '2026-03-18T10:45:00Z',
                          },
                        ],
                        error: null,
                      })),
                    })),
                  })),
                };
              }
              return {
                order: vi.fn(() => ({
                  limit: vi.fn(async () => ({
                    data: [
                      { id: 'draft-1', campaign_id: 'camp-1', status: 'generated', email_type: 'intro', updated_at: '2026-03-18T09:30:00Z' },
                      { id: 'draft-2', campaign_id: 'camp-2', status: 'approved', email_type: 'bump', updated_at: '2026-03-18T07:30:00Z' },
                      { id: 'draft-3', campaign_id: 'camp-1', status: 'sent', email_type: 'intro', updated_at: '2026-03-18T10:45:00Z' },
                    ],
                    error: null,
                  })),
                })),
              };
            }),
          };
        }

        if (table === 'email_outbound') {
          return {
            select: vi.fn(() => ({
              in: vi.fn(() => ({
                eq: vi.fn(async () => ({
                  data: [
                    {
                      id: 'out-older',
                      campaign_id: 'camp-1',
                      draft_id: 'draft-3',
                      contact_id: 'emp-1',
                      company_id: 'co-1',
                      sender_identity: 'sales@alpha.test',
                      status: 'sent',
                      sent_at: '2026-03-18T10:40:00Z',
                    },
                    {
                      id: 'out-1',
                      campaign_id: 'camp-1',
                      draft_id: 'draft-3',
                      contact_id: 'emp-1',
                      company_id: 'co-1',
                      sender_identity: 'sales@alpha.test',
                      status: 'sent',
                      sent_at: '2026-03-18T10:45:00Z',
                    },
                  ],
                  error: null,
                })),
              })),
            })),
          };
        }

        if (table === 'employees') {
          return {
            select: vi.fn(() => ({
              in: vi.fn(async () => ({
                data: [
                  {
                    id: 'emp-1',
                    full_name: 'Alex Sender',
                  },
                ],
                error: null,
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
                    {
                      id: 'evt-1',
                      event_type: 'replied',
                      reply_label: 'positive',
                      occurred_at: '2026-03-18T11:00:00Z',
                      draft_id: 'draft-1',
                      handled_at: null,
                      campaign_id: 'camp-1',
                    },
                    {
                      id: 'evt-unlinked',
                      event_type: 'replied',
                      reply_label: 'negative',
                      occurred_at: '2026-03-18T11:15:00Z',
                      draft_id: null,
                      handled_at: null,
                      campaign_id: null,
                    },
                    {
                      id: 'evt-2',
                      event_type: 'opened',
                      reply_label: null,
                      occurred_at: '2026-03-18T06:00:00Z',
                      draft_id: 'draft-2',
                      handled_at: null,
                      campaign_id: 'camp-2',
                    },
                  ],
                  error: null,
                })),
              })),
            })),
          };
        }

        if (table === 'companies') {
          return {
            select: vi.fn((fields?: string) => {
              if (typeof fields === 'string' && fields.includes('company_research')) {
                return Promise.resolve({
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
                });
              }
              return {
                in: vi.fn(async () => ({
                  data: [
                    {
                      id: 'co-1',
                      company_name: 'Fresh Co',
                    },
                  ],
                  error: null,
                })),
              };
            }),
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
          kind: 'reply',
          id: 'evt-1',
          title: 'Reply positive',
          campaignId: 'camp-1',
        }),
      ])
    );
    expect(result.recentActivity).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'reply',
          id: 'evt-unlinked',
        }),
      ])
    );
    expect(result.recentActivity).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'outbound',
          id: 'out-1',
          timestamp: '2026-03-18T10:45:00Z',
          title: 'Intro sent',
          subtitle: 'Fresh Co · Alex Sender · sales@alpha.test',
          campaignId: 'camp-1',
        }),
      ])
    );
    expect(result.recentActivity).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'draft',
          id: 'draft-1',
          subtitle: 'intro email · Alpha',
        }),
      ])
    );
    expect(result.recentActivity).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'draft',
          id: 'draft-3',
        }),
      ])
    );
  });

  it('counts campaign-linked unhandled bounced events in pending inbox replies', async () => {
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'campaigns') {
          return {
            select: vi.fn(async () => ({
              data: [{ id: 'camp-1', name: 'Alpha', status: 'sending', updated_at: '2026-03-18T10:00:00Z' }],
              error: null,
            })),
          };
        }

        if (table === 'drafts') {
          return {
            select: vi.fn((fields?: string) => {
              if (typeof fields === 'string' && fields === 'id,campaign_id,email_type,updated_at') {
                return {
                  eq: vi.fn(() => ({
                    order: vi.fn(() => ({
                      limit: vi.fn(async () => ({ data: [], error: null })),
                    })),
                  })),
                };
              }
              return {
                order: vi.fn(() => ({
                  limit: vi.fn(async () => ({ data: [], error: null })),
                })),
              };
            }),
          };
        }

        if (table === 'companies') {
          return {
            select: vi.fn(async () => ({ data: [], error: null })),
          };
        }

        if (table === 'email_events') {
          return {
            select: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(async () => ({
                  data: [
                    {
                      id: 'evt-bounce-linked',
                      event_type: 'bounced',
                      reply_label: null,
                      occurred_at: '2026-03-18T11:00:00Z',
                      draft_id: null,
                      handled_at: null,
                      campaign_id: 'camp-1',
                    },
                    {
                      id: 'evt-bounce-unlinked',
                      event_type: 'bounced',
                      reply_label: null,
                      occurred_at: '2026-03-18T10:00:00Z',
                      draft_id: null,
                      handled_at: null,
                      campaign_id: null,
                    },
                    {
                      id: 'evt-bounce-handled',
                      event_type: 'bounced',
                      reply_label: null,
                      occurred_at: '2026-03-18T09:00:00Z',
                      draft_id: null,
                      handled_at: '2026-03-18T09:30:00Z',
                      campaign_id: 'camp-1',
                    },
                  ],
                  error: null,
                })),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    } as any;

    const result = await getDashboardOverview(client);

    expect(result.pending.inboxReplies).toBe(1);
    expect(result.recentActivity).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'reply',
          id: 'evt-bounce-linked',
          title: 'Reply bounced',
          campaignId: 'camp-1',
        }),
      ])
    );
    expect(result.recentActivity).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'evt-bounce-unlinked' }),
        expect.objectContaining({ id: 'evt-bounce-handled' }),
      ])
    );
  });
});
