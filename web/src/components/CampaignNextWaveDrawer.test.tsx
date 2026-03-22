import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';

import { CampaignNextWaveDrawer } from './CampaignNextWaveDrawer';

const mockPreview = {
  sourceCampaign: { id: 'camp-1', name: 'Q1 Push' },
  defaults: {
    targetSegmentId: 'seg-1',
    targetSegmentVersion: 1,
    offerId: null,
    icpHypothesisId: null,
    sendPolicy: { sendTimezone: 'Europe/Moscow', sendWindowStartHour: 9, sendWindowEndHour: 17, sendWeekdaysOnly: true },
    senderPlanSummary: { assignmentCount: 2, mailboxAccountCount: 2, senderIdentityCount: 2, domainCount: 1, domains: ['test.com'] },
  },
  summary: { candidateContactCount: 50, eligibleContactCount: 30, blockedContactCount: 20 },
  blockedBreakdown: { suppressed_contact: 5, already_contacted_recently: 10, no_sendable_email: 3, already_in_target_wave: 2, already_used_in_source_wave: 0 },
  items: [],
};

const mockCreateResult = {
  ...mockPreview,
  campaign: { id: 'camp-new', name: 'Q1 Push — Wave 2', status: 'draft' },
  senderPlan: { assignments: [], summary: mockPreview.defaults.senderPlanSummary },
  sendPolicy: mockPreview.defaults.sendPolicy,
};

vi.mock('../apiClient', () => ({
  fetchNextWavePreview: vi.fn(),
  createNextWave: vi.fn(),
}));

import { fetchNextWavePreview, createNextWave } from '../apiClient';
const mockFetchPreview = vi.mocked(fetchNextWavePreview);
const mockCreate = vi.mocked(createNextWave);

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanup(); });

describe('CampaignNextWaveDrawer', () => {
  it('does not render when closed', () => {
    render(<CampaignNextWaveDrawer open={false} campaignId="camp-1" onClose={() => {}} />);
    expect(screen.queryByText('Create next wave')).toBeNull();
  });

  it('shows preview after loading', async () => {
    mockFetchPreview.mockResolvedValue(mockPreview);
    render(<CampaignNextWaveDrawer open={true} campaignId="camp-1" campaignName="Q1 Push" onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Q1 Push')).toBeTruthy();
    });
    expect(screen.getByText('50 candidates')).toBeTruthy();
    expect(screen.getByText('30 eligible')).toBeTruthy();
    expect(screen.getByText('20 blocked')).toBeTruthy();
    expect(
      screen.getByText(/Contacts from the same saved segment baseline plus carried-over manual additions/)
    ).toBeTruthy();
    expect(screen.getByText('Create wave')).toBeTruthy();
  });

  it('shows blocked breakdown chips', async () => {
    mockFetchPreview.mockResolvedValue(mockPreview);
    render(<CampaignNextWaveDrawer open={true} campaignId="camp-1" onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('5 Suppressed')).toBeTruthy();
    });
    expect(screen.getByText('10 Contacted recently')).toBeTruthy();
  });

  it('creates wave and shows success', async () => {
    mockFetchPreview.mockResolvedValue(mockPreview);
    mockCreate.mockResolvedValue(mockCreateResult);
    const onCreated = vi.fn();

    render(<CampaignNextWaveDrawer open={true} campaignId="camp-1" campaignName="Q1 Push" onClose={() => {}} onCreated={onCreated} />);

    await waitFor(() => {
      expect(screen.getByText('Create wave')).toBeTruthy();
    });

    fireEvent.click(screen.getByText('Create wave'));

    await waitFor(() => {
      expect(screen.getByText('Wave created')).toBeTruthy();
    });
    expect(onCreated).toHaveBeenCalled();
  });

  it('shows error on preview failure', async () => {
    mockFetchPreview.mockRejectedValue(new Error('Campaign not found'));
    render(<CampaignNextWaveDrawer open={true} campaignId="camp-1" onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Campaign not found')).toBeTruthy();
    });
  });

  it('renders in Russian', async () => {
    mockFetchPreview.mockResolvedValue(mockPreview);
    render(<CampaignNextWaveDrawer open={true} campaignId="camp-1" onClose={() => {}} language="ru" />);

    await waitFor(() => {
      expect(screen.getByText('Создать следующую волну')).toBeTruthy();
    });
  });

  it('shows zero-eligible hint when nothing can enter the new wave', async () => {
    mockFetchPreview.mockResolvedValue({
      ...mockPreview,
      summary: { candidateContactCount: 14, eligibleContactCount: 0, blockedContactCount: 14 },
    });

    render(<CampaignNextWaveDrawer open={true} campaignId="camp-1" onClose={() => {}} />);

    await waitFor(() => {
      expect(
        screen.getByText('This source wave has no remaining eligible contacts in the current baseline.')
      ).toBeTruthy();
    });
  });
});
