import { describe, expect, it, vi } from 'vitest';

import { listExecutionExposureByContact } from '../src/services/executionExposure';

describe('executionExposure', () => {
  it('aggregates sent outbounds into ICP/hypothesis/offer exposure history with outcome flags', async () => {
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'email_outbound') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'out-1',
                    campaign_id: 'camp-1',
                    contact_id: 'contact-1',
                    sent_at: '2026-03-20T10:00:00Z',
                    status: 'sent',
                    metadata: {
                      icp_profile_id: 'icp-1',
                      icp_hypothesis_id: 'hyp-1',
                      offering_domain: 'voicexpert.ru',
                      offering_hash: 'hash-1',
                      offering_summary: 'Negotiation rooms for audit-heavy teams',
                    },
                  },
                  {
                    id: 'out-2',
                    campaign_id: 'camp-1',
                    contact_id: 'contact-1',
                    sent_at: '2026-03-21T12:00:00Z',
                    status: 'sent',
                    metadata: {
                      icp_profile_id: 'icp-1',
                      icp_hypothesis_id: 'hyp-1',
                      offering_domain: 'voicexpert.ru',
                      offering_hash: 'hash-1',
                      offering_summary: 'Negotiation rooms for audit-heavy teams',
                    },
                  },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === 'campaigns') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'camp-1',
                    offer_id: 'offer-1',
                  },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === 'offers') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 'offer-1',
                    title: 'Negotiation room audit',
                    project_name: 'VoiceXpert',
                  },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === 'email_events') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  {
                    outbound_id: 'out-1',
                    event_type: 'replied',
                  },
                  {
                    outbound_id: 'out-2',
                    event_type: 'bounced',
                  },
                ],
                error: null,
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    const result = await listExecutionExposureByContact(client, ['contact-1']);

    expect(result.get('contact-1')).toEqual([
      {
        contact_id: 'contact-1',
        campaign_id: 'camp-1',
        icp_profile_id: 'icp-1',
        icp_hypothesis_id: 'hyp-1',
        offer_id: 'offer-1',
        offer_title: 'Negotiation room audit',
        project_name: 'VoiceXpert',
        offering_domain: 'voicexpert.ru',
        offering_hash: 'hash-1',
        offering_summary: 'Negotiation rooms for audit-heavy teams',
        first_sent_at: '2026-03-20T10:00:00Z',
        last_sent_at: '2026-03-21T12:00:00Z',
        sent_count: 2,
        replied: true,
        bounced: true,
        unsubscribed: false,
      },
    ]);
  });

  it('chunks large contact lookups', async () => {
    const outboundIn = vi
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            id: 'out-1',
            campaign_id: 'camp-1',
            contact_id: 'contact-1',
            sent_at: '2026-03-20T10:00:00Z',
            status: 'sent',
            metadata: null,
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            id: 'out-2',
            campaign_id: 'camp-2',
            contact_id: 'contact-101',
            sent_at: '2026-03-21T10:00:00Z',
            status: 'sent',
            metadata: null,
          },
        ],
        error: null,
      });

    const client = {
      from: vi.fn((table: string) => {
        if (table === 'email_outbound') {
          return {
            select: vi.fn().mockReturnValue({ in: outboundIn }),
          };
        }
        if (table === 'campaigns') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  { id: 'camp-1', offer_id: null, icp_hypothesis_id: null },
                  { id: 'camp-2', offer_id: null, icp_hypothesis_id: null },
                ],
                error: null,
              }),
            }),
          };
        }
        if (table === 'email_events') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    const contactIds = Array.from({ length: 101 }, (_, index) => `contact-${index + 1}`);
    const result = await listExecutionExposureByContact(client, contactIds);

    expect(outboundIn).toHaveBeenCalledTimes(2);
    expect(outboundIn.mock.calls[0]?.[1]).toHaveLength(100);
    expect(outboundIn.mock.calls[1]?.[1]).toHaveLength(1);
    expect(result.get('contact-1')?.[0]?.campaign_id).toBe('camp-1');
    expect(result.get('contact-101')?.[0]?.campaign_id).toBe('camp-2');
  });
});
