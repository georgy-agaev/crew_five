import { describe, expect, it, vi } from 'vitest';

import {
  getAnalyticsByRejectionReason,
  getDraftRejectionAnalyticsBreakdown,
} from './analytics.js';

describe('rejection analytics', () => {
  it('builds grouped rejection breakdowns from draft metadata', async () => {
    const client = {
      from: vi.fn((table: string) => {
        expect(table).toBe('drafts');
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              gte: vi.fn(async () => ({
                data: [
                  {
                    campaign_id: 'camp-1',
                    email_type: 'intro',
                    draft_pattern: null,
                    status: 'rejected',
                    metadata: {
                      review_reason_code: 'marketing_tone',
                      draft_pattern: 'problem-led',
                      icp_profile_id: 'icp-1',
                      icp_hypothesis_id: 'hyp-1',
                    },
                    updated_at: '2026-03-18T12:00:00Z',
                  },
                  {
                    campaign_id: 'camp-1',
                    email_type: 'bump',
                    draft_pattern: null,
                    status: 'rejected',
                    metadata: {
                      review_reason_code: 'too_generic',
                      draft_pattern: 'problem-led',
                      icp_profile_id: 'icp-1',
                      icp_hypothesis_id: 'hyp-1',
                    },
                    updated_at: '2026-03-18T12:05:00Z',
                  },
                  {
                    campaign_id: 'camp-2',
                    email_type: 'intro',
                    draft_pattern: null,
                    status: 'rejected',
                    metadata: {
                      review_reason_code: 'marketing_tone',
                      draft_pattern: 'pain-point',
                      icp_profile_id: 'icp-2',
                    },
                    updated_at: '2026-03-18T12:10:00Z',
                  },
                  {
                    campaign_id: 'camp-3',
                    email_type: 'intro',
                    draft_pattern: null,
                    status: 'rejected',
                    metadata: null,
                    updated_at: '2026-03-18T12:15:00Z',
                  },
                ],
                error: null,
              })),
            })),
          })),
        };
      }),
    } as any;

    const result = await getDraftRejectionAnalyticsBreakdown(client, {
      since: '2026-03-18T00:00:00Z',
    });

    expect(result.total_rejected).toBe(4);
    expect(result.by_reason).toEqual([
      { review_reason_code: 'marketing_tone', count: 2 },
      { review_reason_code: 'too_generic', count: 1 },
    ]);
    expect(result.by_pattern).toEqual([
      { draft_pattern: 'problem-led', count: 2 },
      { draft_pattern: 'pain-point', count: 1 },
    ]);
    expect(result.by_pattern_and_reason).toEqual([
      { draft_pattern: 'pain-point', review_reason_code: 'marketing_tone', count: 1 },
      { draft_pattern: 'problem-led', review_reason_code: 'marketing_tone', count: 1 },
      { draft_pattern: 'problem-led', review_reason_code: 'too_generic', count: 1 },
    ]);
    expect(result.by_campaign).toEqual([
      { campaign_id: 'camp-1', count: 2 },
      { campaign_id: 'camp-2', count: 1 },
    ]);
    expect(result.by_email_type).toEqual([
      { email_type: 'intro', count: 2 },
      { email_type: 'bump', count: 1 },
    ]);
    expect(result.by_icp_profile).toEqual([
      { icp_profile_id: 'icp-1', count: 2 },
      { icp_profile_id: 'icp-2', count: 1 },
    ]);
    expect(result.by_icp_hypothesis).toEqual([
      { icp_hypothesis_id: 'hyp-1', count: 2 },
      { icp_hypothesis_id: null, count: 1 },
    ]);
  });

  it('keeps analytics:summary rejection_reason output stable', async () => {
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            gte: vi.fn(async () => ({
              data: [
                {
                  campaign_id: 'camp-1',
                  email_type: 'intro',
                  draft_pattern: null,
                  status: 'rejected',
                  metadata: { review_reason_code: 'marketing_tone' },
                  updated_at: '2026-03-18T12:00:00Z',
                },
              ],
              error: null,
            })),
          })),
        })),
      })),
    } as any;

    await expect(getAnalyticsByRejectionReason(client, { since: '2026-03-18T00:00:00Z' })).resolves.toEqual([
      { review_reason_code: 'marketing_tone', count: 1 },
    ]);
  });
});
