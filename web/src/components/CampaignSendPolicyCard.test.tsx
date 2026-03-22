import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { CampaignSendPolicyCard } from './CampaignSendPolicyCard';

const mockPolicy = {
  campaignId: 'camp-1',
  campaignName: 'Q1 Push',
  campaignStatus: 'ready',
  sendTimezone: 'Europe/Moscow',
  sendWindowStartHour: 9,
  sendWindowEndHour: 17,
  sendWeekdaysOnly: true,
  updatedAt: '2026-03-21T12:00:00Z',
};

vi.mock('../apiClient', () => ({
  fetchCampaignSendPolicy: vi.fn(),
  updateCampaignSendPolicy: vi.fn(),
}));

import { fetchCampaignSendPolicy, updateCampaignSendPolicy } from '../apiClient';
const mockFetch = vi.mocked(fetchCampaignSendPolicy);
const mockUpdate = vi.mocked(updateCampaignSendPolicy);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

function waitForLoaded() {
  return waitFor(() => {
    expect(screen.getByDisplayValue('Europe/Moscow')).toBeTruthy();
  });
}

describe('CampaignSendPolicyCard', () => {
  it('shows placeholder when no campaignId', () => {
    render(<CampaignSendPolicyCard />);
    expect(screen.getByText('Select a campaign')).toBeTruthy();
  });

  it('shows current policy', async () => {
    mockFetch.mockResolvedValue(mockPolicy);
    render(<CampaignSendPolicyCard campaignId="camp-1" />);

    await waitForLoaded();
    expect(screen.getByDisplayValue('9')).toBeTruthy();
    expect(screen.getByDisplayValue('17')).toBeTruthy();
  });

  it('shows save button on edit', async () => {
    mockFetch.mockResolvedValue(mockPolicy);
    render(<CampaignSendPolicyCard campaignId="camp-1" />);

    await waitForLoaded();

    fireEvent.change(screen.getByDisplayValue('Europe/Moscow'), { target: { value: 'America/New_York' } });
    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('validates end > start', async () => {
    mockFetch.mockResolvedValue(mockPolicy);
    render(<CampaignSendPolicyCard campaignId="camp-1" />);

    await waitForLoaded();

    fireEvent.change(screen.getByDisplayValue('17'), { target: { value: '8' } });
    fireEvent.click(screen.getByText('Save'));

    expect(screen.getByText('End hour must be greater than start hour')).toBeTruthy();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('validates empty timezone', async () => {
    mockFetch.mockResolvedValue(mockPolicy);
    render(<CampaignSendPolicyCard campaignId="camp-1" />);

    await waitForLoaded();

    fireEvent.change(screen.getByDisplayValue('Europe/Moscow'), { target: { value: '' } });
    fireEvent.click(screen.getByText('Save'));

    expect(screen.getByText('Timezone is required')).toBeTruthy();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('saves successfully', async () => {
    mockFetch.mockResolvedValue(mockPolicy);
    const updatedPolicy = { ...mockPolicy, sendTimezone: 'America/New_York' };
    mockUpdate.mockResolvedValue(updatedPolicy);

    render(<CampaignSendPolicyCard campaignId="camp-1" />);

    await waitForLoaded();

    fireEvent.change(screen.getByDisplayValue('Europe/Moscow'), { target: { value: 'America/New_York' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith('camp-1', {
        sendTimezone: 'America/New_York',
        sendWindowStartHour: 9,
        sendWindowEndHour: 17,
        sendWeekdaysOnly: true,
      });
    });
  });

  it('shows error on fetch failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    render(<CampaignSendPolicyCard campaignId="camp-1" />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeTruthy();
    });
  });

  it('renders in Russian', async () => {
    mockFetch.mockResolvedValue(mockPolicy);
    render(<CampaignSendPolicyCard campaignId="camp-1" language="ru" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Europe/Moscow')).toBeTruthy();
    });
  });
});
