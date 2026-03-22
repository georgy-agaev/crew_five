import { describe, expect, it } from 'vitest';

import {
  deriveEmployeesFromCampaignCompany,
  getDraftReviewActions,
  mergeUpdatedDraftRow,
} from './CampaignOperatorDesk';

describe('CampaignOperatorDesk helpers', () => {
  it('preserves joined draft context when content updates return a sparse row', () => {
    const merged = mergeUpdatedDraftRow(
      {
        id: 'draft-1',
        status: 'generated',
        subject: 'Old subject',
        body: 'Old body',
        contact_id: 'contact-1',
        contact_name: 'Alice Doe',
        contact_position: 'CEO',
        company_id: 'company-1',
        company_name: 'Example Co',
        recipient_email: 'alice@example.com',
        recipient_email_source: 'work',
        recipient_email_kind: 'corporate',
        sendable: true,
      },
      {
        id: 'draft-1',
        status: 'generated',
        subject: 'New subject',
        body: 'New body',
        contact_id: 'contact-1',
        contact_name: null,
        contact_position: null,
        company_id: 'company-1',
        company_name: null,
        recipient_email: null,
        recipient_email_source: null,
        recipient_email_kind: null,
        sendable: undefined,
      }
    );

    expect(merged.subject).toBe('New subject');
    expect(merged.body).toBe('New body');
    expect(merged.contact_name).toBe('Alice Doe');
    expect(merged.contact_position).toBe('CEO');
    expect(merged.company_name).toBe('Example Co');
    expect(merged.recipient_email).toBe('alice@example.com');
    expect(merged.recipient_email_source).toBe('work');
    expect(merged.recipient_email_kind).toBe('corporate');
    expect(merged.sendable).toBe(true);
  });

  it('exposes only the opposite review action for approved and rejected drafts', () => {
    expect(getDraftReviewActions('generated')).toEqual({
      canApprove: true,
      canReject: true,
      locked: false,
    });
    expect(getDraftReviewActions('approved')).toEqual({
      canApprove: false,
      canReject: true,
      locked: false,
    });
    expect(getDraftReviewActions('rejected')).toEqual({
      canApprove: true,
      canReject: false,
      locked: false,
    });
    expect(getDraftReviewActions('sent')).toEqual({
      canApprove: false,
      canReject: false,
      locked: true,
    });
  });

  it('derives employee list from canonical campaign detail instead of drafts', () => {
    const employees = deriveEmployeesFromCampaignCompany({
      company_id: 'company-1',
      company_name: 'Example Co',
      contact_count: 1,
      enrichment: {
        status: 'fresh',
        last_updated_at: null,
        provider_hint: null,
      },
      employees: [
        {
          contact_id: 'contact-1',
          full_name: 'Alice Doe',
          position: 'CEO',
          work_email: 'alice@example.com',
          generic_email: null,
          draft_counts: {
            total: 1,
            intro: 1,
            bump: 0,
            generated: 0,
            approved: 1,
            rejected: 0,
            sent: 0,
          },
          outbound_count: 0,
          sent_count: 0,
          replied: false,
          reply_count: 0,
        },
      ],
    } as any);

    expect(employees).toEqual([
      expect.objectContaining({
        contact_id: 'contact-1',
        full_name: 'Alice Doe',
        work_email: 'alice@example.com',
        generic_email: null,
        recipient_email: 'alice@example.com',
        sendable: true,
        draft_coverage: { intro: true, bump: false },
        outbound_count: 0,
        sent_count: 0,
        replied: false,
        reply_count: 0,
      }),
    ]);
  });
});
