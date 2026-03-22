import { describe, expect, it, vi } from 'vitest';

import { listCampaignAudience } from '../src/services/campaignAudience';

describe('listCampaignAudience', () => {
  it('unions segment snapshot rows and manual additions, deduping by contact_id', async () => {
    const campaignSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'camp-1',
        name: 'Wave 1',
        status: 'draft',
        segment_id: 'seg-1',
        segment_version: 2,
      },
      error: null,
    });
    const campaignEq = vi.fn().mockReturnValue({ single: campaignSingle });
    const campaignSelect = vi.fn().mockReturnValue({ eq: campaignEq });

    const membersMatch = vi.fn().mockResolvedValue({
      data: [
        {
          company_id: 'company-1',
          contact_id: 'contact-1',
          snapshot: { contact: { full_name: 'Alice' }, company: { company_name: 'Acme' } },
        },
      ],
      error: null,
    });
    const membersSelect = vi.fn().mockReturnValue({ match: membersMatch });

    const additionsEq = vi.fn().mockResolvedValue({
      data: [
        {
          campaign_id: 'camp-1',
          company_id: 'company-1',
          contact_id: 'contact-1',
          source: 'manual_attach',
          snapshot: { contact: { full_name: 'Alice (newer)' }, company: { company_name: 'Acme' } },
          attached_at: '2026-03-21T12:00:00Z',
        },
        {
          campaign_id: 'camp-1',
          company_id: 'company-2',
          contact_id: 'contact-2',
          source: 'manual_attach',
          snapshot: { contact: { full_name: 'Bob' }, company: { company_name: 'Beta' } },
          attached_at: '2026-03-21T12:01:00Z',
        },
      ],
      error: null,
    });
    const additionsSelect = vi.fn().mockReturnValue({ eq: additionsEq });
    const exclusionsEq = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const exclusionsSelect = vi.fn().mockReturnValue({ eq: exclusionsEq });

    const client = {
      from: vi.fn((table: string) => {
        if (table === 'campaigns') return { select: campaignSelect };
        if (table === 'segment_members') return { select: membersSelect };
        if (table === 'campaign_member_additions') return { select: additionsSelect };
        if (table === 'campaign_member_exclusions') return { select: exclusionsSelect };
        throw new Error(`Unexpected table ${table}`);
      }),
    } as any;

    const result = await listCampaignAudience(client, 'camp-1');

    expect(result.campaign.id).toBe('camp-1');
    expect(result.rows).toEqual([
      expect.objectContaining({
        contact_id: 'contact-1',
        company_id: 'company-1',
        source: 'segment_snapshot',
      }),
      expect.objectContaining({
        contact_id: 'contact-2',
        company_id: 'company-2',
        source: 'manual_attach',
      }),
    ]);
  });

  it('excludes contacts explicitly blocked for the target campaign', async () => {
    const campaignSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'camp-2',
        name: 'Wave 2',
        status: 'draft',
        segment_id: 'seg-2',
        segment_version: 4,
      },
      error: null,
    });
    const campaignEq = vi.fn().mockReturnValue({ single: campaignSingle });
    const campaignSelect = vi.fn().mockReturnValue({ eq: campaignEq });

    const membersMatch = vi.fn().mockResolvedValue({
      data: [
        {
          company_id: 'company-1',
          contact_id: 'contact-1',
          snapshot: { contact: { full_name: 'Alice' } },
        },
        {
          company_id: 'company-2',
          contact_id: 'contact-2',
          snapshot: { contact: { full_name: 'Bob' } },
        },
      ],
      error: null,
    });
    const membersSelect = vi.fn().mockReturnValue({ match: membersMatch });

    const additionsEq = vi.fn().mockResolvedValue({
      data: [
        {
          campaign_id: 'camp-2',
          company_id: 'company-3',
          contact_id: 'contact-3',
          source: 'manual_attach',
          snapshot: { contact: { full_name: 'Carol' } },
          attached_at: '2026-03-21T13:00:00Z',
        },
      ],
      error: null,
    });
    const additionsSelect = vi.fn().mockReturnValue({ eq: additionsEq });

    const exclusionsEq = vi.fn().mockResolvedValue({
      data: [
        {
          campaign_id: 'camp-2',
          contact_id: 'contact-2',
        },
        {
          campaign_id: 'camp-2',
          contact_id: 'contact-3',
        },
      ],
      error: null,
    });
    const exclusionsSelect = vi.fn().mockReturnValue({ eq: exclusionsEq });

    const client = {
      from: vi.fn((table: string) => {
        if (table === 'campaigns') return { select: campaignSelect };
        if (table === 'segment_members') return { select: membersSelect };
        if (table === 'campaign_member_additions') return { select: additionsSelect };
        if (table === 'campaign_member_exclusions') return { select: exclusionsSelect };
        throw new Error(`Unexpected table ${table}`);
      }),
    } as any;

    const result = await listCampaignAudience(client, 'camp-2');

    expect(result.rows).toEqual([
      expect.objectContaining({
        contact_id: 'contact-1',
        company_id: 'company-1',
        source: 'segment_snapshot',
      }),
    ]);
  });
});
