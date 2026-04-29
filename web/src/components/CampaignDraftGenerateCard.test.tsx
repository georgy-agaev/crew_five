import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, beforeEach } from 'vitest';

import { CampaignDraftGenerateCard } from './CampaignDraftGenerateCard';

vi.mock('../apiClient', () => ({
  startDraftGenerationJob: vi.fn(),
  fetchDraftGenerationJobStatus: vi.fn(),
  fetchActiveDraftGenerationJob: vi.fn(),
}));

import {
  fetchActiveDraftGenerationJob,
  fetchDraftGenerationJobStatus,
  startDraftGenerationJob,
} from '../apiClient';

const mockStart = vi.mocked(startDraftGenerationJob);
const mockFetchStatus = vi.mocked(fetchDraftGenerationJobStatus);
const mockFetchActive = vi.mocked(fetchActiveDraftGenerationJob);

const completedStatus = (overrides: Partial<Awaited<ReturnType<typeof fetchDraftGenerationJobStatus>>> = {}) => ({
  jobId: 'job-draft-1',
  status: 'completed' as const,
  campaignId: 'camp-1',
  dryRun: true,
  generated: 5,
  skipped: 2,
  failed: 0,
  requestedContactCount: 7,
  totalRecipients: 7,
  lastEvent: 'completed',
  skippedByReason: {},
  skippedDetails: [],
  errors: [],
  result: {},
  createdAt: '2026-04-28T10:00:00Z',
  updatedAt: '2026-04-28T10:00:01Z',
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchActive.mockResolvedValue(null);
  mockStart.mockResolvedValue({ jobId: 'job-draft-1', status: 'running', campaignId: 'camp-1', dryRun: true });
  mockFetchStatus.mockResolvedValue(completedStatus());
});
afterEach(() => { cleanup(); });

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
    render(<CampaignDraftGenerateCard campaignId="camp-1" />);

    fireEvent.click(screen.getByText('Check'));

    await waitFor(() => {
      expect(mockStart).toHaveBeenCalledWith('camp-1', { dryRun: true, limit: 20, draftsModel: 'opus' });
    });
    expect(screen.getByText('5 generated')).toBeTruthy();
  });

  it('confirm passes dryRun=false and limit', async () => {
    render(<CampaignDraftGenerateCard campaignId="camp-1" />);

    // Preview first
    fireEvent.click(screen.getByText('Check'));
    await waitFor(() => { expect(screen.getByText('Generate')).toBeTruthy(); });

    // Confirm
    mockStart.mockResolvedValue({ jobId: 'job-draft-2', status: 'running', campaignId: 'camp-1', dryRun: false });
    mockFetchStatus.mockResolvedValue(completedStatus({ jobId: 'job-draft-2', dryRun: false }));
    fireEvent.click(screen.getByText('Generate'));

    await waitFor(() => {
      expect(mockStart).toHaveBeenLastCalledWith('camp-1', { dryRun: false, limit: 20, draftsModel: 'opus' });
    });
  });

  it('generates for selected companies with opus by default', async () => {
    render(
      <CampaignDraftGenerateCard
        campaignId="camp-1"
        selectedCompanyIds={['11111111-1111-4111-8111-111111111111']}
      />
    );

    fireEvent.click(screen.getByText('Generate for selected'));

    await waitFor(() => {
      expect(mockStart).toHaveBeenCalledWith('camp-1', {
        dryRun: false,
        limit: 0,
        companyIds: ['11111111-1111-4111-8111-111111111111'],
        draftsModel: 'opus',
      });
    });
  });

  it('passes custom limit value', async () => {
    render(<CampaignDraftGenerateCard campaignId="camp-1" />);

    const input = screen.getByDisplayValue('20');
    fireEvent.change(input, { target: { value: '50' } });
    fireEvent.click(screen.getByText('Check'));

    await waitFor(() => {
      expect(mockStart).toHaveBeenCalledWith('camp-1', { dryRun: true, limit: 50, draftsModel: 'opus' });
    });
  });

  it('passes limit=0 for all eligible', async () => {
    render(<CampaignDraftGenerateCard campaignId="camp-1" />);

    const input = screen.getByDisplayValue('20');
    fireEvent.change(input, { target: { value: '0' } });
    expect(screen.getByText('0 = all eligible')).toBeTruthy();

    fireEvent.click(screen.getByText('Check'));

    await waitFor(() => {
      expect(mockStart).toHaveBeenCalledWith('camp-1', { dryRun: true, limit: 0, draftsModel: 'opus' });
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
    mockStart.mockRejectedValue(new Error('Outreach bridge not configured'));
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

  it('shows running job progress and current progress event', async () => {
    mockFetchStatus.mockResolvedValue(completedStatus({
      status: 'running',
      dryRun: false,
      generated: 1,
      skipped: 3,
      failed: 1,
      requestedContactCount: 10,
      totalRecipients: 10,
      lastEvent: 'recipient_started',
      result: {
        progress_events: [
          {
            event: 'recipient_started',
            full_name: 'Jane Doe',
            position: 'Head of Sales',
          },
        ],
      },
    }));

    render(<CampaignDraftGenerateCard campaignId="camp-1" />);

    fireEvent.click(screen.getByText('Check'));

    await waitFor(() => {
      expect(screen.getByText('5 / 10')).toBeTruthy();
    });
    expect(screen.getByText('Now: Recipient: Jane Doe · Head of Sales')).toBeTruthy();
  });
});
