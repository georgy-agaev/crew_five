import { describe, expect, it, vi } from 'vitest';

import { loadDrafts, saveDrafts, updateDraftStatus } from '../src/services/draftStore';

describe('draftStore', () => {
  it('saveDrafts normalizes camelCase payloads before insert', async () => {
    const select = vi.fn().mockResolvedValue({
      data: [{ id: 'draft-1', campaign_id: 'camp-1' }],
      error: null,
    });
    const insert = vi.fn().mockReturnValue({ select });
    const client = {
      from: vi.fn().mockReturnValue({ insert }),
    } as any;

    const rows = await saveDrafts(client, {
      campaignId: 'camp-1',
      contactId: 'contact-1',
      companyId: 'company-1',
      subject: 'Hello',
      body: 'World',
    });

    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        campaign_id: 'camp-1',
        contact_id: 'contact-1',
        company_id: 'company-1',
        email_type: 'intro',
        language: 'en',
      }),
    ]);
    expect(rows[0].id).toBe('draft-1');
  });

  it('loadDrafts applies status filter and limit', async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [{ id: 'draft-1', status: 'approved' }],
      error: null,
    });
    const statusEq = vi.fn().mockReturnValue({ limit });
    const campaignEq = vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({ eq: statusEq }),
    });
    const select = vi.fn().mockReturnValue({ eq: campaignEq });
    const client = {
      from: vi.fn().mockReturnValue({ select }),
    } as any;

    const rows = await loadDrafts(client, {
      campaignId: 'camp-1',
      status: 'approved',
      limit: 3,
    });

    expect(campaignEq).toHaveBeenCalledWith('campaign_id', 'camp-1');
    expect(statusEq).toHaveBeenCalledWith('status', 'approved');
    expect(rows[0].status).toBe('approved');
  });

  it('loadDrafts can include recipient context for send orchestration', async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'draft-1',
          status: 'approved',
          contact: {
            id: 'contact-1',
            full_name: 'Alice Doe',
            work_email: '',
            generic_email: 'info@example.com',
          },
          company: {
            id: 'company-1',
            company_name: 'Example Co',
          },
        },
      ],
      error: null,
    });
    const order = vi.fn().mockReturnValue({ limit });
    const statusEq = vi.fn().mockReturnValue({ limit });
    const campaignEq = vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({ eq: statusEq, limit }),
    });
    const select = vi.fn().mockReturnValue({ eq: campaignEq });
    const client = {
      from: vi.fn().mockReturnValue({ select }),
    } as any;

    const rows = await loadDrafts(client, {
      campaignId: 'camp-1',
      status: 'approved',
      limit: 3,
      includeRecipientContext: true,
    });

    expect(select).toHaveBeenCalledWith(
      expect.stringContaining('contact:employees(id,full_name,position,work_email,generic_email,company_name)')
    );
    expect(rows[0].recipient_email).toBe('info@example.com');
    expect(rows[0].recipient_email_source).toBe('generic');
    expect(rows[0].sendable).toBe(true);
  });

  it('updateDraftStatus merges metadata with the existing row', async () => {
    const currentSingle = vi.fn().mockResolvedValue({
      data: { metadata: { source: 'agent' } },
      error: null,
    });
    const currentEq = vi.fn().mockReturnValue({ single: currentSingle });
    const currentSelect = vi.fn().mockReturnValue({ eq: currentEq });

    const updatedSingle = vi.fn().mockResolvedValue({
      data: { id: 'draft-1', status: 'approved', metadata: { source: 'agent', note: 'approved' } },
      error: null,
    });
    const updatedSelect = vi.fn().mockReturnValue({ single: updatedSingle });
    const updatedEq = vi.fn().mockReturnValue({ select: updatedSelect });
    const update = vi.fn().mockReturnValue({ eq: updatedEq });

    const client = {
      from: vi.fn().mockReturnValue({
        select: currentSelect,
        update,
      }),
    } as any;

    const row = await updateDraftStatus(client, {
      draftId: 'draft-1',
      status: 'approved',
      reviewer: 'qa-user',
      metadata: { note: 'approved' },
    });

    expect(update).toHaveBeenCalledWith({
      status: 'approved',
      reviewer: 'qa-user',
      metadata: { source: 'agent', note: 'approved' },
    });
    expect(row.status).toBe('approved');
  });
});
