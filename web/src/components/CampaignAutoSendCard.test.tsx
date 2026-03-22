import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { CampaignAutoSendCard } from './CampaignAutoSendCard';

const mockSettings = {
  campaignId: 'camp-1',
  campaignName: 'Q1 Push',
  campaignStatus: 'ready',
  autoSendIntro: false,
  autoSendBump: false,
  bumpMinDaysSinceIntro: 3,
  updatedAt: '2026-03-20T10:00:00Z',
};

vi.mock('../apiClient', () => ({
  fetchCampaignAutoSendSettings: vi.fn(),
  updateCampaignAutoSendSettings: vi.fn(),
}));

import { fetchCampaignAutoSendSettings, updateCampaignAutoSendSettings } from '../apiClient';
const mockFetch = vi.mocked(fetchCampaignAutoSendSettings);
const mockUpdate = vi.mocked(updateCampaignAutoSendSettings);

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('CampaignAutoSendCard', () => {
  it('shows placeholder when no campaignId', () => {
    render(<CampaignAutoSendCard />);
    expect(screen.getByText('Select a campaign')).toBeTruthy();
  });

  it('shows current settings', async () => {
    mockFetch.mockResolvedValue(mockSettings);
    render(<CampaignAutoSendCard campaignId="camp-1" />);

    await waitFor(() => {
      expect(screen.getByText('Auto-send')).toBeTruthy();
    });
    // Both disabled by default
    const disabledButtons = screen.getAllByText('Disabled');
    expect(disabledButtons.length).toBe(2);
  });

  it('shows save button when toggling intro', async () => {
    mockFetch.mockResolvedValue(mockSettings);
    render(<CampaignAutoSendCard campaignId="camp-1" />);

    await waitFor(() => {
      expect(screen.getByText('Auto-send')).toBeTruthy();
    });

    // Toggle intro
    const disabledButtons = screen.getAllByText('Disabled');
    fireEvent.click(disabledButtons[0]);

    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('saves settings successfully', async () => {
    mockFetch.mockResolvedValue(mockSettings);
    const updatedSettings = { ...mockSettings, autoSendIntro: true };
    mockUpdate.mockResolvedValue(updatedSettings);

    render(<CampaignAutoSendCard campaignId="camp-1" />);

    await waitFor(() => {
      expect(screen.getByText('Auto-send')).toBeTruthy();
    });

    // Toggle intro
    const disabledButtons = screen.getAllByText('Disabled');
    fireEvent.click(disabledButtons[0]);

    // Save
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledWith('camp-1', {
        autoSendIntro: true,
        autoSendBump: false,
        bumpMinDaysSinceIntro: 3,
      });
    });
  });

  it('validates bump delay', async () => {
    mockFetch.mockResolvedValue(mockSettings);
    render(<CampaignAutoSendCard campaignId="camp-1" />);

    await waitFor(() => {
      expect(screen.getByText('Auto-send')).toBeTruthy();
    });

    // Set invalid delay
    const delayInput = screen.getByDisplayValue('3');
    fireEvent.change(delayInput, { target: { value: '0' } });

    // Toggle something to make dirty
    const disabledButtons = screen.getAllByText('Disabled');
    fireEvent.click(disabledButtons[0]);

    fireEvent.click(screen.getByText('Save'));

    expect(screen.getByText('Delay must be at least 1 day')).toBeTruthy();
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('shows error on fetch failure', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    render(<CampaignAutoSendCard campaignId="camp-1" />);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeTruthy();
    });
  });

  it('renders in Russian', async () => {
    mockFetch.mockResolvedValue(mockSettings);
    render(<CampaignAutoSendCard campaignId="camp-1" language="ru" />);

    await waitFor(() => {
      expect(screen.getByText('Автоотправка')).toBeTruthy();
    });
  });
});
