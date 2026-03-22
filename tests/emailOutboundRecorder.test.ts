import { describe, expect, it, vi } from 'vitest';

import { recordEmailOutbound } from '../src/services/emailOutboundRecorder';

describe('emailOutboundRecorder', () => {
  it('records a sent outbound row and marks the draft sent', async () => {
    const draftSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'draft-1',
        campaign_id: 'camp-1',
        contact_id: 'contact-1',
        company_id: 'company-1',
        pattern_mode: 'direct',
        metadata: {
          source: 'outreacher',
          offering_domain: 'voicexpert.ru',
          offering_hash: 'sha256:offer-1',
          offering_summary: {
            product_name: 'VoiceExpert',
            one_liner: 'AI call analysis',
          },
        },
        contact: {
          id: 'contact-1',
          work_email: '',
          generic_email: 'info@example.com',
        },
      },
      error: null,
    });
    const draftEq = vi.fn().mockReturnValue({ single: draftSingle });
    const draftSelect = vi.fn().mockReturnValue({ eq: draftEq });

    const outboundSingle = vi.fn().mockResolvedValue({
      data: { id: 'out-1', status: 'sent' },
      error: null,
    });
    const outboundSelect = vi.fn().mockReturnValue({ single: outboundSingle });
    const outboundInsert = vi.fn().mockReturnValue({ select: outboundSelect });
    const outboundLimit = vi.fn().mockResolvedValue({ data: [], error: null });
    const outboundEqMessage = vi.fn().mockReturnValue({ limit: outboundLimit });
    const outboundEqProvider = vi.fn().mockReturnValue({ eq: outboundEqMessage });
    const outboundSelectExisting = vi.fn().mockReturnValue({ eq: outboundEqProvider });

    const updatedDraftSingle = vi.fn().mockResolvedValue({
      data: { id: 'draft-1', status: 'sent' },
      error: null,
    });
    const updatedDraftSelect = vi.fn().mockReturnValue({ single: updatedDraftSingle });
    const updatedDraftEq = vi.fn().mockReturnValue({ select: updatedDraftSelect });
    const draftUpdate = vi.fn().mockReturnValue({ eq: updatedDraftEq });

    const client = {
      from: (table: string) => {
        if (table === 'email_outbound') {
          return {
            select: outboundSelectExisting,
            insert: outboundInsert,
          };
        }
        if (table === 'drafts') {
          return {
            select: draftSelect,
            update: draftUpdate,
          };
        }
        throw new Error(`Unexpected table ${table}`);
      },
    } as any;

    const result = await recordEmailOutbound(client, {
      draftId: 'draft-1',
      provider: 'imap_mcp',
      providerMessageId: '<msg-1@example.com>',
      senderIdentity: 'sales-1@example.com',
      status: 'sent',
      metadata: { mailbox_account_id: 'mailbox-1' },
    });

    expect(outboundInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        draft_id: 'draft-1',
        provider: 'imap_mcp',
        provider_message_id: '<msg-1@example.com>',
        sender_identity: 'sales-1@example.com',
        status: 'sent',
        metadata: expect.objectContaining({
          source: 'outreacher',
          offering_domain: 'voicexpert.ru',
          offering_hash: 'sha256:offer-1',
          offering_summary: {
            product_name: 'VoiceExpert',
            one_liner: 'AI call analysis',
          },
          mailbox_account_id: 'mailbox-1',
          recipient_email: 'info@example.com',
          recipient_email_source: 'generic',
          recipient_email_kind: 'generic',
        }),
      })
    );
    expect(draftUpdate).toHaveBeenCalledWith({ status: 'sent' });
    expect(result.deduped).toBe(false);
    expect(result.outbound.id).toBe('out-1');
  });

  it('dedupes when provider and provider_message_id already exist', async () => {
    const outboundLimit = vi.fn().mockResolvedValue({
      data: [{ id: 'out-1', provider: 'imap_mcp', provider_message_id: '<msg-1@example.com>' }],
      error: null,
    });
    const outboundEqMessage = vi.fn().mockReturnValue({ limit: outboundLimit });
    const outboundEqProvider = vi.fn().mockReturnValue({ eq: outboundEqMessage });
    const outboundSelectExisting = vi.fn().mockReturnValue({ eq: outboundEqProvider });

    const client = {
      from: (table: string) => {
        if (table === 'email_outbound') {
          return {
            select: outboundSelectExisting,
          };
        }
        throw new Error(`Unexpected table ${table}`);
      },
    } as any;

    const result = await recordEmailOutbound(client, {
      draftId: 'draft-1',
      provider: 'imap_mcp',
      providerMessageId: '<msg-1@example.com>',
      status: 'sent',
    });

    expect(result).toEqual({
      deduped: true,
      outbound: { id: 'out-1', provider: 'imap_mcp', provider_message_id: '<msg-1@example.com>' },
    });
  });
});
