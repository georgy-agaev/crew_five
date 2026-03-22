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
    approvedMissingRecipientEmailCount: 3,
  },
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
  senderPlan: { assignmentCount: 2, domains: ['example.com', 'acme.io'] },
};

vi.mock('../apiClient', () => ({
  fetchCampaignSendPreflight: vi.fn(),
}));

import { fetchCampaignSendPreflight } from '../apiClient';
const mockFetch = vi.mocked(fetchCampaignSendPreflight);

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

  it('shows ready state', async () => {
    mockFetch.mockResolvedValue(mockReady);
    render(<CampaignSendPreflightCard campaignId="camp-1" />);

    await waitFor(() => {
      expect(screen.getByText('Ready to send')).toBeTruthy();
    });
    expect(screen.getByText('example.com, acme.io')).toBeTruthy();
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

  it('renders in Russian', async () => {
    mockFetch.mockResolvedValue(mockPreflight);
    render(<CampaignSendPreflightCard campaignId="camp-1" language="ru" />);

    await waitFor(() => {
      expect(screen.getByText('Заблокировано')).toBeTruthy();
    });
    expect(screen.getByText('Проверка отправки')).toBeTruthy();
  });
});
