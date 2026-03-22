import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';

import { CampaignRotationPreviewDrawer } from './CampaignRotationPreviewDrawer';

const mockResult = {
  sourceCampaign: {
    campaignId: 'camp-1',
    campaignName: 'Q1 Push',
    offerId: 'off-1',
    offerTitle: 'VoiceXpert Bundle',
    icpHypothesisId: 'hyp-1',
    icpHypothesisLabel: 'Negotiation Rooms',
    icpProfileId: 'prof-1',
    icpProfileName: 'Enterprise',
  },
  summary: {
    sourceContactCount: 50,
    candidateCount: 2,
    eligibleCandidateContactCount: 20,
    blockedCandidateContactCount: 10,
  },
  candidates: [
    {
      icpHypothesisId: 'hyp-2',
      hypothesisLabel: 'Headsets',
      messagingAngle: 'comfort angle',
      offerId: 'off-2',
      offerTitle: 'Headset Pro',
      projectName: 'Q2',
      eligibleContactCount: 15,
      blockedContactCount: 5,
      blockedBreakdown: { cooldown_active: 3, already_received_candidate_offer: 2, reply_received_stop: 0, suppressed_contact: 0, no_sendable_email: 0 },
    },
    {
      icpHypothesisId: 'hyp-3',
      hypothesisLabel: 'Webcams',
      messagingAngle: null,
      offerId: null,
      offerTitle: null,
      projectName: null,
      eligibleContactCount: 5,
      blockedContactCount: 5,
      blockedBreakdown: { no_sendable_email: 5, cooldown_active: 0, already_received_candidate_offer: 0, reply_received_stop: 0, suppressed_contact: 0 },
    },
  ],
};

vi.mock('../apiClient', () => ({
  fetchRotationPreview: vi.fn(),
}));

import { fetchRotationPreview } from '../apiClient';
const mockFetch = vi.mocked(fetchRotationPreview);

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanup(); });

describe('CampaignRotationPreviewDrawer', () => {
  it('does not render when closed', () => {
    render(<CampaignRotationPreviewDrawer open={false} campaignId="camp-1" onClose={() => {}} />);
    expect(screen.queryByText('Rotation preview')).toBeNull();
  });

  it('shows preview data', async () => {
    mockFetch.mockResolvedValue(mockResult);
    render(<CampaignRotationPreviewDrawer open={true} campaignId="camp-1" onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Q1 Push')).toBeTruthy();
    });
    expect(screen.getByText('VoiceXpert Bundle')).toBeTruthy();
    expect(screen.getByText('Negotiation Rooms')).toBeTruthy();
    expect(screen.getByText('2 rotation candidates')).toBeTruthy();
    expect(
      screen.getByText(/Alternative hypothesis\/offer combinations from the same ICP/)
    ).toBeTruthy();
  });

  it('shows candidates with offer/hypothesis separate', async () => {
    mockFetch.mockResolvedValue(mockResult);
    render(<CampaignRotationPreviewDrawer open={true} campaignId="camp-1" onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Headset Pro')).toBeTruthy();
    });
    expect(screen.getByText('Headsets')).toBeTruthy();
    expect(screen.getByText(/comfort angle/)).toBeTruthy();
    expect(screen.getByText('15 eligible')).toBeTruthy();
  });

  it('shows blocked breakdown', async () => {
    mockFetch.mockResolvedValue(mockResult);
    render(<CampaignRotationPreviewDrawer open={true} campaignId="camp-1" onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('3 Cooldown active')).toBeTruthy();
    });
    expect(screen.getByText('5 No email')).toBeTruthy();
  });

  it('shows error', async () => {
    mockFetch.mockRejectedValue(new Error('Not found'));
    render(<CampaignRotationPreviewDrawer open={true} campaignId="camp-1" onClose={() => {}} />);

    await waitFor(() => {
      expect(screen.getByText('Not found')).toBeTruthy();
    });
  });

  it('renders in Russian', async () => {
    mockFetch.mockResolvedValue(mockResult);
    render(<CampaignRotationPreviewDrawer open={true} campaignId="camp-1" onClose={() => {}} language="ru" />);

    await waitFor(() => {
      expect(screen.getByText('Предпросмотр ротации')).toBeTruthy();
    });
  });

  it('shows zero-eligible hint when nothing can rotate now', async () => {
    mockFetch.mockResolvedValue({
      ...mockResult,
      summary: {
        sourceContactCount: 14,
        candidateCount: 2,
        eligibleCandidateContactCount: 0,
        blockedCandidateContactCount: 14,
      },
    });

    render(<CampaignRotationPreviewDrawer open={true} campaignId="camp-1" onClose={() => {}} />);

    await waitFor(() => {
      expect(
        screen.getByText('No contacts are currently eligible for rotation from this source wave.')
      ).toBeTruthy();
    });
  });
});
