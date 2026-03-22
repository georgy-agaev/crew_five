import { describe, expect, it, vi } from 'vitest';

import { campaignStatusHandler } from './campaignStatus.js';

describe('campaignStatusHandler', () => {
  it('blocks transition to sending when no mailbox assignment exists', async () => {
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'campaigns') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({
                  data: { status: 'generating' },
                  error: null,
                })),
              })),
            })),
          };
        }
        if (table === 'campaign_mailbox_assignments') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(async () => ({
                  data: [],
                  error: null,
                })),
              })),
            })),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    await expect(
      campaignStatusHandler(client, {
        campaignId: 'camp-1',
        status: 'sending',
      })
    ).rejects.toMatchObject({
      code: 'MAILBOX_ASSIGNMENT_REQUIRED',
      statusCode: 409,
    });
  });
});
