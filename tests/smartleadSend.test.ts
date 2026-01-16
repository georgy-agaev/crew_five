import { describe, expect, it, vi } from 'vitest';

import { smartleadSendCommand } from '../src/commands/smartleadSend';

describe('smartleadSendCommand', () => {
  it('prepares_leads_and_sequences_and_links_campaign', async () => {
    const addLeadsToCampaign = vi.fn().mockResolvedValue({ message: 'ok', leadIds: { 'lead1@example.com': 'l1' } });
    const saveCampaignSequences = vi.fn().mockResolvedValue({ ok: true });
    const client = { addLeadsToCampaign, saveCampaignSequences } as any;

    const supabase = {
      from: (table: string) => {
        if (table === 'campaigns') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: { id: 'camp-1', segment_id: 'seg-1', metadata: {} },
                  error: null,
                }),
              }),
            }),
            update: () => ({
              eq: async () => ({ error: null }),
            }),
          };
        }
        if (table === 'segment_members') {
          return {
            select: () => ({
              eq: () => ({
                limit: async () => ({
                  data: [{ contact_id: 'e1' }, { contact_id: 'e2' }],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'employees') {
          return {
            select: () => ({
              in: async () => ({
                data: [
                  { id: 'e1', full_name: 'Alice A', work_email: 'lead1@example.com', company_name: 'Acme' },
                  { id: 'e2', full_name: 'Bob B', work_email: null, company_name: 'Acme' },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === 'drafts') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  limit: async () => ({
                    data: [{ subject: 'Hi', body: 'Hello' }],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      },
    } as any;

    const summary = await smartleadSendCommand(client, supabase, {
      dryRun: false,
      batchSize: 10,
      campaignId: 'camp-1',
      smartleadCampaignId: 'sl-123',
    } as any);

    expect(addLeadsToCampaign).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: 'sl-123',
        leads: expect.arrayContaining([expect.objectContaining({ email: 'lead1@example.com' })]),
      })
    );
    expect(saveCampaignSequences).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: 'sl-123',
        sequences: expect.any(Array),
      })
    );
    expect(summary).toEqual(
      expect.objectContaining({
        dryRun: false,
        campaignId: 'camp-1',
        smartleadCampaignId: 'sl-123',
        leadsPrepared: 1,
        sequencesSynced: 1,
      })
    );
  });

  it('respects_dry_run_and_does_not_call_smartlead', async () => {
    const addLeadsToCampaign = vi.fn();
    const saveCampaignSequences = vi.fn();
    const client = { addLeadsToCampaign, saveCampaignSequences } as any;

    const supabase = {
      from: (table: string) => {
        if (table === 'campaigns') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: { id: 'camp-1', segment_id: 'seg-1', metadata: {} },
                  error: null,
                }),
              }),
            }),
            update: () => ({
              eq: async () => ({ error: null }),
            }),
          };
        }
        if (table === 'segment_members') {
          return {
            select: () => ({
              eq: () => ({
                limit: async () => ({
                  data: [{ contact_id: 'e1' }],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'employees') {
          return {
            select: () => ({
              in: async () => ({
                data: [{ id: 'e1', full_name: 'Alice A', work_email: 'lead1@example.com', company_name: 'Acme' }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'drafts') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  limit: async () => ({
                    data: [{ subject: 'Hi', body: 'Hello' }],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      },
    } as any;

    const summary = await smartleadSendCommand(client, supabase, {
      dryRun: true,
      batchSize: 10,
      campaignId: 'camp-1',
      smartleadCampaignId: 'sl-123',
    } as any);

    expect(addLeadsToCampaign).not.toHaveBeenCalled();
    expect(saveCampaignSequences).not.toHaveBeenCalled();
    expect(summary.dryRun).toBe(true);
    expect(summary.leadsPrepared).toBe(1);
  });
});
