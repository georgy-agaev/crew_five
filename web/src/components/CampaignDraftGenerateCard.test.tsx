import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';

import { CampaignDraftGenerateCard } from './CampaignDraftGenerateCard';

vi.mock('../apiClient', () => ({
  triggerDraftGenerate: vi.fn(),
}));

import { triggerDraftGenerate } from '../apiClient';
const mockTrigger = vi.mocked(triggerDraftGenerate);

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanup(); });

const mockResult = { generated: 5, skipped: 2, failed: 0, dryRun: true };

describe('CampaignDraftGenerateCard', () => {
  it('shows placeholder when no campaignId', () => {
    render(<CampaignDraftGenerateCard />);
    expect(screen.getByText('Select a campaign')).toBeTruthy();
  });

  it('renders batch input with default 20', () => {
    render(<CampaignDraftGenerateCard campaignId="camp-1" />);
    expect(screen.getByDisplayValue('20')).toBeTruthy();
    expect(screen.getByText('20 = default')).toBeTruthy();
  });

  it('preview passes dryRun=true and limit', async () => {
    mockTrigger.mockResolvedValue(mockResult as any);
    render(<CampaignDraftGenerateCard campaignId="camp-1" />);

    fireEvent.click(screen.getByText('Check'));

    await waitFor(() => {
      expect(mockTrigger).toHaveBeenCalledWith('camp-1', { dryRun: true, limit: 20 });
    });
    expect(screen.getByText('5 generated')).toBeTruthy();
  });

  it('confirm passes dryRun=false and limit', async () => {
    mockTrigger.mockResolvedValue(mockResult as any);
    render(<CampaignDraftGenerateCard campaignId="camp-1" />);

    // Preview first
    fireEvent.click(screen.getByText('Check'));
    await waitFor(() => { expect(screen.getByText('Generate')).toBeTruthy(); });

    // Confirm
    mockTrigger.mockResolvedValue({ ...mockResult, dryRun: false } as any);
    fireEvent.click(screen.getByText('Generate'));

    await waitFor(() => {
      expect(mockTrigger).toHaveBeenLastCalledWith('camp-1', { dryRun: false, limit: 20 });
    });
  });

  it('passes custom limit value', async () => {
    mockTrigger.mockResolvedValue(mockResult as any);
    render(<CampaignDraftGenerateCard campaignId="camp-1" />);

    const input = screen.getByDisplayValue('20');
    fireEvent.change(input, { target: { value: '50' } });
    fireEvent.click(screen.getByText('Check'));

    await waitFor(() => {
      expect(mockTrigger).toHaveBeenCalledWith('camp-1', { dryRun: true, limit: 50 });
    });
  });

  it('passes limit=0 for all eligible', async () => {
    mockTrigger.mockResolvedValue(mockResult as any);
    render(<CampaignDraftGenerateCard campaignId="camp-1" />);

    const input = screen.getByDisplayValue('20');
    fireEvent.change(input, { target: { value: '0' } });
    expect(screen.getByText('0 = all eligible')).toBeTruthy();

    fireEvent.click(screen.getByText('Check'));

    await waitFor(() => {
      expect(mockTrigger).toHaveBeenCalledWith('camp-1', { dryRun: true, limit: 0 });
    });
  });

  it('falls back to 20 for invalid input', () => {
    render(<CampaignDraftGenerateCard campaignId="camp-1" />);
    const input = screen.getByDisplayValue('20');

    fireEvent.change(input, { target: { value: '-5' } });
    fireEvent.blur(input);

    expect(screen.getByDisplayValue('20')).toBeTruthy();
  });

  it('shows error on failure', async () => {
    mockTrigger.mockRejectedValue(new Error('Outreach bridge not configured'));
    render(<CampaignDraftGenerateCard campaignId="camp-1" />);

    fireEvent.click(screen.getByText('Check'));

    await waitFor(() => {
      expect(screen.getByText('Outreach bridge not configured')).toBeTruthy();
    });
  });

  it('renders in Russian', () => {
    render(<CampaignDraftGenerateCard campaignId="camp-1" language="ru" />);
    expect(screen.getByText('Генерация писем')).toBeTruthy();
    expect(screen.getByText('Проверить')).toBeTruthy();
  });
});
