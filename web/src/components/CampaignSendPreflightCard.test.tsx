import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';

import { CampaignSendPreflightCard } from './CampaignSendPreflightCard';

const mockPreflight = {
  campaign: { id: 'camp-1', name: 'Q1 Push', status: 'ready' },
  readyToSend: false,
  blockers: [
    { code: 'no_sender_assignment', message: 'Assign at least one sender before sending' },
    { code: 'draft_not_approved', message: 'Approve or reject all generated drafts before sending' },
  ],
  summary: {
    mailboxAssignmentCount: 0,
    draftCount: 14,
    approvedDraftCount: 8,
    generatedDraftCount: 6,
    rejectedDraftCount: 0,
    sentDraftCount: 0,
    sendableApprovedDraftCount: 5,
    sendableApprovedIntroDraftCount: 5,
    sendableApprovedBumpDraftCount: 0,
    approvedMissingRecipientEmailCount: 3,
    approvedSuppressedContactCount: 0,
  },
  issues: [
    {
      code: 'missing_recipient_email',
      message: 'Approved draft is missing a sendable recipient email',
      draftId: 'draft-1',
      draftStatus: 'approved',
      emailType: 'intro',
      subject: 'Hello Acme',
      contactId: 'contact-1',
      contactName: 'Anna Founder',
      contactPosition: 'CEO',
      workEmail: null,
      workEmailStatus: null,
      genericEmail: 'info@example.com',
      genericEmailStatus: 'bounced',
    },
    {
      code: 'generated_not_reviewed',
      message: 'Generated draft must be approved or rejected before sending',
      draftId: 'draft-2',
      draftStatus: 'generated',
      emailType: 'intro',
      subject: 'Draft to review',
      contactId: 'contact-2',
      contactName: 'Ben Reviewer',
      contactPosition: 'COO',
      workEmail: 'ben@example.com',
      workEmailStatus: 'valid',
      genericEmail: null,
      genericEmailStatus: null,
    },
  ],
  senderPlan: { assignmentCount: 0, domains: [] },
};

const mockReady = {
  ...mockPreflight,
  readyToSend: true,
  blockers: [],
  summary: {
    ...mockPreflight.summary,
    generatedDraftCount: 0,
    approvedMissingRecipientEmailCount: 0,
  },
  issues: [],
  senderPlan: { assignmentCount: 2, domains: ['example.com', 'acme.io'] },
};

vi.mock('../apiClient', () => ({
  fetchCampaignSendPreflight: vi.fn(),
  triggerCampaignSendExecution: vi.fn(),
}));

import { fetchCampaignSendPreflight, triggerCampaignSendExecution } from '../apiClient';
const mockFetch = vi.mocked(fetchCampaignSendPreflight);
const mockTrigger = vi.mocked(triggerCampaignSendExecution);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('CampaignSendPreflightCard', () => {
  it('shows placeholder when no campaignId', () => {
    render(<CampaignSendPreflightCard />);
    expect(screen.getByText('Select a campaign to inspect send readiness')).toBeTruthy();
  });

  it('shows blockers when campaign is blocked', async () => {
    mockFetch.mockResolvedValue(mockPreflight);
    render(<CampaignSendPreflightCard campaignId="camp-1" />);

    await waitFor(() => {
      expect(screen.getByText('Blocked')).toBeTruthy();
    });
    expect(screen.getByText('Assign at least one sender before sending')).toBeTruthy();
    expect(screen.getByText('Approve or reject all generated drafts before sending')).toBeTruthy();
    expect(screen.getByText('14 drafts')).toBeTruthy();
    expect(screen.getByText('5 sendable')).toBeTruthy();
  });

  it('shows preflight issue filters with concrete draft context', async () => {
    mockFetch.mockResolvedValue(mockPreflight);
    render(<CampaignSendPreflightCard campaignId="camp-1" />);

    await waitFor(() => {
      expect(screen.getByText('Issues')).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: 'All issues 2' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Missing email 1' })).toBeTruthy();
    expect(screen.getByText('Anna Founder')).toBeTruthy();
    expect(screen.getByText('Hello Acme')).toBeTruthy();

    screen.getByRole('button', { name: 'Needs review 1' }).click();

    await waitFor(() => {
      expect(screen.getByText('Ben Reviewer')).toBeTruthy();
      expect(screen.queryByText('Anna Founder')).toBeNull();
    });
  });

  it('shows the source campaign for already-sent intro issues', async () => {
    mockFetch.mockResolvedValue({
      ...mockPreflight,
      blockers: [{ code: 'suppressed_contact', message: 'Some approved drafts target suppressed or already-used contacts' }],
      issues: [
        {
          code: 'intro_already_sent',
          message: 'Approved intro draft targets a contact that already received an intro',
          draftId: 'draft-repeat',
          draftStatus: 'approved',
          emailType: 'intro',
          subject: 'Repeat intro',
          contactId: 'contact-repeat',
          contactName: 'Tanya Contact',
          contactPosition: 'CEO',
          workEmail: null,
          workEmailStatus: null,
          genericEmail: 'info@example.com',
          genericEmailStatus: 'unknown',
          relatedCampaignId: 'camp-source',
          relatedCampaignName: 'Original Campaign',
          relatedSentAt: '2026-03-31T11:18:28.055+00:00',
        },
      ],
    } as any);
    render(<CampaignSendPreflightCard campaignId="camp-1" />);

    await waitFor(() => {
      expect(screen.getByText('Tanya Contact')).toBeTruthy();
    });
    expect(screen.getByText('Sent in Original Campaign · 2026-03-31')).toBeTruthy();
  });

  it('shows ready state', async () => {
    mockFetch.mockResolvedValue(mockReady);
    render(<CampaignSendPreflightCard campaignId="camp-1" />);

    await waitFor(() => {
      expect(screen.getByText('Ready to send')).toBeTruthy();
    });
    expect(screen.getByText('example.com, acme.io')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send now' })).toBeTruthy();
  });

  it('hides sender plan section in compact mode', async () => {
    mockFetch.mockResolvedValue(mockReady);
    render(<CampaignSendPreflightCard campaignId="camp-1" compact />);

    await waitFor(() => {
      expect(screen.getByText('Ready to send')).toBeTruthy();
    });
    expect(screen.queryByText('example.com, acme.io')).toBeNull();
  });

  it('shows error on fetch failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    render(<CampaignSendPreflightCard campaignId="camp-1" />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeTruthy();
    });
  });

  it('triggers manual send and shows summary', async () => {
    mockFetch.mockResolvedValue(mockReady);
    mockTrigger.mockResolvedValue({
      accepted: true,
      source: 'crew_five-send-execution',
      requestedAt: '2026-03-24T09:00:00.000Z',
      campaignId: 'camp-1',
      reason: 'auto_send_mixed',
      sentCount: 3,
      failedCount: 0,
      skippedCount: 1,
    } as any);
    render(<CampaignSendPreflightCard campaignId="camp-1" />);

    await waitFor(() => {
      expect(screen.getByText('Ready to send')).toBeTruthy();
    });

    screen.getByRole('button', { name: 'Send now' }).click();

    await waitFor(() => {
      expect(mockTrigger).toHaveBeenCalledWith('camp-1', {
        reason: 'auto_send_mixed',
        batchLimit: 2,
      });
    });
    expect(screen.getByText('3 sent · 0 failed · 1 skipped')).toBeTruthy();
  });

  it('renders in Russian', async () => {
    mockFetch.mockResolvedValue(mockPreflight);
    render(<CampaignSendPreflightCard campaignId="camp-1" language="ru" />);

    await waitFor(() => {
      expect(screen.getByText('Заблокировано')).toBeTruthy();
    });
    expect(screen.getByText('Проверка отправки')).toBeTruthy();
  });
});
