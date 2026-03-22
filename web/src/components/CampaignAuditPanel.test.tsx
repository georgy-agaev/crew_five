import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CampaignAuditPanel, getCampaignAuditIssueBuckets } from './CampaignAuditPanel';

describe('CampaignAuditPanel', () => {
  const audit = {
    campaign: {
      id: 'camp-1',
      name: 'Q1 Push',
      status: 'review',
      segment_id: 'seg-1',
      segment_version: 1,
    },
    summary: {
      company_count: 3,
      snapshot_contact_count: 7,
      contacts_with_any_draft: 5,
      contacts_with_intro_draft: 5,
      contacts_with_bump_draft: 2,
      contacts_with_sent_outbound: 3,
      contacts_with_events: 1,
      draft_count: 9,
      generated_draft_count: 1,
      approved_draft_count: 5,
      rejected_draft_count: 2,
      sent_draft_count: 1,
      sendable_draft_count: 8,
      unsendable_draft_count: 1,
      outbound_count: 3,
      outbound_sent_count: 3,
      outbound_failed_count: 0,
      outbound_missing_recipient_email_count: 0,
      event_count: 1,
      replied_event_count: 1,
      bounced_event_count: 0,
      unsubscribed_event_count: 0,
      snapshot_contacts_without_draft_count: 2,
      drafts_missing_recipient_email_count: 1,
      duplicate_draft_pair_count: 1,
      draft_company_mismatch_count: 0,
      sent_drafts_without_outbound_count: 0,
      outbounds_without_draft_count: 0,
    },
    issues: {
      snapshot_contacts_without_draft: [{ contact_id: 'contact-7', contact_name: 'Alice' }],
      drafts_missing_recipient_email: [{ draft_id: 'draft-9', contact_name: 'Bob' }],
      duplicate_drafts: [{ contact_id: 'contact-2', draft_ids: ['d1', 'd2'] }],
      draft_company_mismatches: [],
      sent_drafts_without_outbound: [],
      outbounds_without_draft: [],
      outbounds_missing_recipient_email: [],
    },
  } as const;

  it('builds ordered issue buckets', () => {
    expect(getCampaignAuditIssueBuckets(audit as any)).toEqual([
      { key: 'snapshot_contacts_without_draft', label: 'Missing drafts', count: 1 },
      { key: 'drafts_missing_recipient_email', label: 'Drafts missing recipient', count: 1 },
      { key: 'duplicate_drafts', label: 'Duplicate drafts', count: 1 },
      { key: 'draft_company_mismatches', label: 'Draft/company mismatch', count: 0 },
      { key: 'sent_drafts_without_outbound', label: 'Sent drafts without outbound', count: 0 },
      { key: 'outbounds_without_draft', label: 'Outbounds without draft', count: 0 },
      { key: 'outbounds_missing_recipient_email', label: 'Outbounds missing recipient', count: 0 },
    ]);
  });

  it('renders summary and active issue bucket rows', () => {
    render(<CampaignAuditPanel audit={audit as any} />);

    expect(screen.getByText('Audit coverage')).toBeTruthy();
    expect(screen.getByText('3 companies')).toBeTruthy();
    expect(screen.getByText('7 snapshot contacts')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Missing drafts: 1/i })).toBeTruthy();
    expect(screen.getByText('Alice')).toBeTruthy();
  });
});
