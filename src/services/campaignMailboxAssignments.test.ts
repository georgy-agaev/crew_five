import { describe, expect, it, vi } from 'vitest';

import {
  assertCampaignHasMailboxAssignment,
  getCampaignMailboxAssignment,
  replaceCampaignMailboxAssignment,
} from './campaignMailboxAssignments.js';

describe('campaign mailbox assignments', () => {
  it('builds assignment summary for a planned sender set', async () => {
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(async () => ({
              data: [
                {
                  id: 'a-1',
                  campaign_id: 'camp-1',
                  mailbox_account_id: 'mbox-1',
                  sender_identity: 'sales@voicexpert.ru',
                  provider: 'imap_mcp',
                  source: 'outreacher',
                  assigned_at: '2026-03-18T20:00:00Z',
                  metadata: null,
                },
                {
                  id: 'a-2',
                  campaign_id: 'camp-1',
                  mailbox_account_id: 'mbox-2',
                  sender_identity: 'team@skomplekt.com',
                  provider: 'imap_mcp',
                  source: 'outreacher',
                  assigned_at: '2026-03-18T20:01:00Z',
                  metadata: null,
                },
              ],
              error: null,
            })),
          })),
        })),
      })),
    } as any;

    const result = await getCampaignMailboxAssignment(client, 'camp-1');

    expect(result.summary).toEqual({
      assignmentCount: 2,
      mailboxAccountCount: 2,
      senderIdentityCount: 2,
      domainCount: 2,
      domains: ['skomplekt.com', 'voicexpert.ru'],
    });
    expect(result.assignments[0]?.senderIdentity).toBe('sales@voicexpert.ru');
  });

  it('replaces a campaign sender set with deduped normalized assignments', async () => {
    const deleteEq = vi.fn(async () => ({ error: null }));
    const insert = vi.fn(async () => ({ error: null }));
    const order = vi.fn(async () => ({
      data: [
        {
          id: 'a-1',
          campaign_id: 'camp-1',
          mailbox_account_id: 'mbox-1',
          sender_identity: 'sales@voicexpert.ru',
          provider: 'imap_mcp',
          source: 'outreacher',
          assigned_at: '2026-03-18T20:00:00Z',
          metadata: null,
        },
      ],
      error: null,
    }));
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'campaign_mailbox_assignments') {
          return {
            delete: vi.fn(() => ({
              eq: deleteEq,
            })),
            insert,
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order,
              })),
            })),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    const result = await replaceCampaignMailboxAssignment(client, {
      campaignId: 'camp-1',
      source: 'outreacher',
      assignments: [
        { mailboxAccountId: 'mbox-1', senderIdentity: ' Sales@Acme.AI ' },
        { mailboxAccountId: 'mbox-1', senderIdentity: 'sales@acme.ai' },
      ],
    });

    expect(deleteEq).toHaveBeenCalledWith('campaign_id', 'camp-1');
    expect(insert).toHaveBeenCalledWith([
      {
        campaign_id: 'camp-1',
        mailbox_account_id: 'mbox-1',
        sender_identity: 'sales@acme.ai',
        provider: 'imap_mcp',
        source: 'outreacher',
        metadata: null,
      },
    ]);
    expect(result.summary.assignmentCount).toBe(1);
  });

  it('blocks sending when no planned sender set exists', async () => {
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(async () => ({
              data: [],
              error: null,
            })),
          })),
        })),
      })),
    } as any;

    await expect(assertCampaignHasMailboxAssignment(client, 'camp-1')).rejects.toMatchObject({
      code: 'MAILBOX_ASSIGNMENT_REQUIRED',
      statusCode: 409,
    });
  });
});
