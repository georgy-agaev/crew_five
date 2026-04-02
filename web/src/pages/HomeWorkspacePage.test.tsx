import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as apiClient from '../apiClient';
import { HomeWorkspacePage } from './HomeWorkspacePage';

afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

const mockOverview: apiClient.DashboardOverview = {
  campaigns: {
    total: 5,
    active: 3,
    byStatus: [
      { status: 'draft', count: 1 },
      { status: 'review', count: 1 },
      { status: 'sending', count: 2 },
      { status: 'complete', count: 1 },
    ],
  },
  pending: {
    draftsOnReview: 7,
    inboxReplies: 3,
    staleEnrichment: 11,
    missingEnrichment: 4,
  },
  recentActivity: [
    { kind: 'reply', id: 'evt-1', timestamp: '2026-03-18T12:00:00Z', title: 'Reply positive', subtitle: 'draft draft-1', campaignId: null },
    { kind: 'outbound', id: 'out-1', timestamp: '2026-03-18T11:00:00Z', title: 'Intro sent', subtitle: 'Fresh Co', campaignId: 'camp-1' },
  ],
};

function mockApis() {
  vi.spyOn(apiClient, 'fetchDashboardOverview').mockResolvedValue(mockOverview);
  vi.spyOn(apiClient, 'fetchCampaigns').mockResolvedValue([]);
  vi.spyOn(apiClient, 'fetchCampaignAudit').mockResolvedValue(null as any);
}

describe('HomeWorkspacePage', () => {
  it('renders status badges', async () => {
    mockApis();
    render(<HomeWorkspacePage />);
    expect(await screen.findByText('2 sending')).toBeTruthy();
    expect(screen.getByText('1 draft')).toBeTruthy();
    expect(screen.getByText('5 total')).toBeTruthy();
  });

  it('renders pending action counters', async () => {
    mockApis();
    render(<HomeWorkspacePage />);
    expect(await screen.findByText('7')).toBeTruthy();
    expect(screen.getByText('Drafts on review')).toBeTruthy();
    expect(screen.getByText('Unhandled replies')).toBeTruthy();
  });

  it('renders recent activity', async () => {
    mockApis();
    render(<HomeWorkspacePage />);
    expect(await screen.findByText('Reply positive')).toBeTruthy();
    expect(screen.getByText('Intro sent')).toBeTruthy();
  });

  it('renders quick links', async () => {
    mockApis();
    render(<HomeWorkspacePage />);
    await screen.findByText('Go to');
    expect(screen.getByText('Builder')).toBeTruthy();
    expect(screen.getByText('Inbox')).toBeTruthy();
  });

  it('shows loading skeleton', () => {
    vi.spyOn(apiClient, 'fetchDashboardOverview').mockReturnValue(new Promise(() => {}));
    vi.spyOn(apiClient, 'fetchCampaigns').mockReturnValue(new Promise(() => {}));
    render(<HomeWorkspacePage />);
    expect(screen.getByText('Home')).toBeTruthy();
  });

  it('shows error state', async () => {
    vi.spyOn(apiClient, 'fetchDashboardOverview').mockRejectedValue(new Error('Backend down'));
    vi.spyOn(apiClient, 'fetchCampaigns').mockResolvedValue([]);
    render(<HomeWorkspacePage />);
    expect(await screen.findByText('Backend down')).toBeTruthy();
  });

  it('handles empty state', async () => {
    vi.spyOn(apiClient, 'fetchDashboardOverview').mockResolvedValue({
      campaigns: { total: 0, active: 0, byStatus: [] },
      pending: { draftsOnReview: 0, inboxReplies: 0, staleEnrichment: 0, missingEnrichment: 0 },
      recentActivity: [],
    });
    vi.spyOn(apiClient, 'fetchCampaigns').mockResolvedValue([]);
    render(<HomeWorkspacePage />);
    expect(await screen.findByText('No recent activity.')).toBeTruthy();
  });
});
