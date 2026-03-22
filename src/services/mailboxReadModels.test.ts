import { describe, expect, it, vi } from 'vitest';

import {
  getCampaignMailboxSummary,
  listMailboxes,
} from './mailboxReadModels.js';

describe('mailbox read models', () => {
  it('builds mailbox inventory from imap_mcp outbound history', async () => {
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(async () => ({
              data: [
                {
                  campaign_id: 'camp-1',
                  provider: 'imap_mcp',
                  sender_identity: 'sales@acme.ai',
                  sent_at: '2026-03-18T09:00:00Z',
                  created_at: '2026-03-18T09:00:00Z',
                  metadata: { mailbox_account_id: 'mbox-1' },
                },
                {
                  campaign_id: 'camp-2',
                  provider: 'imap_mcp',
                  sender_identity: 'sales@acme.ai',
                  sent_at: '2026-03-17T09:00:00Z',
                  created_at: '2026-03-17T09:00:00Z',
                  metadata: { mailbox_account_id: 'mbox-1' },
                },
              ],
              error: null,
            })),
          })),
        })),
      })),
    } as any;

    const result = await listMailboxes(client);

    expect(result).toEqual([
      {
        mailboxAccountId: 'mbox-1',
        senderIdentity: 'sales@acme.ai',
        user: 'sales',
        domain: 'acme.ai',
        provider: 'imap_mcp',
        campaignCount: 2,
        outboundCount: 2,
        lastSentAt: '2026-03-18T09:00:00Z',
      },
    ]);
  });

  it('builds campaign mailbox consistency summary', async () => {
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn((field: string) => {
            if (field === 'provider') {
              return {
                order: vi.fn(async () => ({
                  data: [
                    {
                      campaign_id: 'camp-1',
                      provider: 'imap_mcp',
                      sender_identity: 'sales@acme.ai',
                      sent_at: '2026-03-18T09:00:00Z',
                      created_at: '2026-03-18T09:00:00Z',
                      metadata: { mailbox_account_id: 'mbox-1' },
                    },
                    {
                      campaign_id: 'camp-1',
                      provider: 'imap_mcp',
                      sender_identity: 'sales@acme.ai',
                      sent_at: '2026-03-17T09:00:00Z',
                      created_at: '2026-03-17T09:00:00Z',
                      metadata: { mailbox_account_id: 'mbox-1' },
                    },
                  ],
                  error: null,
                })),
              };
            }
            return {
              eq: vi.fn(() => ({
                order: vi.fn(async () => ({ data: [], error: null })),
              })),
            };
          }),
        })),
      })),
    } as any;

    const result = await getCampaignMailboxSummary(client, 'camp-1');

    expect(result).toEqual({
      campaignId: 'camp-1',
      mailboxes: [
        {
          mailboxAccountId: 'mbox-1',
          senderIdentity: 'sales@acme.ai',
          user: 'sales',
          domain: 'acme.ai',
          provider: 'imap_mcp',
          campaignCount: 1,
          outboundCount: 2,
          lastSentAt: '2026-03-18T09:00:00Z',
        },
      ],
      consistency: {
        consistent: true,
        mailboxAccountCount: 1,
        senderIdentityCount: 1,
        recommendedMailboxAccountId: 'mbox-1',
        recommendedSenderIdentity: 'sales@acme.ai',
      },
    });
  });
});
