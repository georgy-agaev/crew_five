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
    {
      kind: 'reply',
      id: 'evt-1',
      timestamp: '2026-03-18T12:00:00Z',
      title: 'Reply positive',
      subtitle: 'draft draft-1',
      campaignId: null,
    },
    {
      kind: 'outbound',
      id: 'out-1',
      timestamp: '2026-03-18T11:00:00Z',
      title: 'Intro sent',
      subtitle: 'Fresh Co · Alex Sender · sales@alpha.test',
      campaignId: 'camp-1',
    },
    {
      kind: 'draft',
      id: 'draft-1',
      timestamp: '2026-03-18T10:00:00Z',
      title: 'Draft generated',
      subtitle: 'intro email · Alpha',
      campaignId: 'camp-1',
    },
  ],
};

describe('HomeWorkspacePage', () => {
  it('renders campaign overview', async () => {
    vi.spyOn(apiClient, 'fetchDashboardOverview').mockResolvedValue(mockOverview);

    render(<HomeWorkspacePage />);

    // Title line: "Campaigns: 5 total, 3 active"
    expect(await screen.findByText(/Campaigns: 5 total, 3 active/)).toBeTruthy();
  });

  it('renders status breakdown', async () => {
    vi.spyOn(apiClient, 'fetchDashboardOverview').mockResolvedValue(mockOverview);

    render(<HomeWorkspacePage />);

    expect(await screen.findByText('2 sending')).toBeTruthy();
    expect(screen.getByText('1 draft')).toBeTruthy();
    expect(screen.getByText('1 review')).toBeTruthy();
    expect(screen.getByText('1 complete')).toBeTruthy();
  });

  it('renders pending action counters', async () => {
    vi.spyOn(apiClient, 'fetchDashboardOverview').mockResolvedValue(mockOverview);

    render(<HomeWorkspacePage />);

    expect(await screen.findByText('7')).toBeTruthy();
    expect(screen.getByText('Drafts on review')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('Unhandled replies')).toBeTruthy();
    expect(screen.getByText('11')).toBeTruthy();
    expect(screen.getByText('Stale enrichment')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('Missing enrichment')).toBeTruthy();
  });

  it('renders recent activity feed', async () => {
    vi.spyOn(apiClient, 'fetchDashboardOverview').mockResolvedValue(mockOverview);

    render(<HomeWorkspacePage />);

    expect(await screen.findByText('Reply positive')).toBeTruthy();
    expect(screen.getByText('Intro sent')).toBeTruthy();
    expect(screen.getByText('Fresh Co · Alex Sender · sales@alpha.test')).toBeTruthy();
    expect(screen.getByText('Draft generated')).toBeTruthy();
    expect(screen.getByText('draft draft-1')).toBeTruthy();
    expect(screen.getByText('intro email · Alpha')).toBeTruthy();
  });

  it('renders quick navigation links', async () => {
    vi.spyOn(apiClient, 'fetchDashboardOverview').mockResolvedValue(mockOverview);

    render(<HomeWorkspacePage />);

    await screen.findByText('Go to');
    expect(screen.getByText('Builder')).toBeTruthy();
    expect(screen.getByText('Inbox')).toBeTruthy();
    expect(screen.getByText('Contacts')).toBeTruthy();
    expect(screen.getByText('Mailboxes')).toBeTruthy();
  });

  it('shows loading skeleton', () => {
    vi.spyOn(apiClient, 'fetchDashboardOverview').mockReturnValue(new Promise(() => {}));

    render(<HomeWorkspacePage />);

    expect(screen.getByText('Home')).toBeTruthy();
    expect(screen.queryByText('Campaigns')).toBeNull();
  });

  it('shows error state', async () => {
    vi.spyOn(apiClient, 'fetchDashboardOverview').mockRejectedValue(new Error('Backend down'));

    render(<HomeWorkspacePage />);

    expect(await screen.findByText('Backend down')).toBeTruthy();
  });

  it('handles zero/empty state', async () => {
    vi.spyOn(apiClient, 'fetchDashboardOverview').mockResolvedValue({
      campaigns: { total: 0, active: 0, byStatus: [] },
      pending: { draftsOnReview: 0, inboxReplies: 0, staleEnrichment: 0, missingEnrichment: 0 },
      recentActivity: [],
    });

    render(<HomeWorkspacePage />);

    expect(await screen.findByText(/Campaigns: 0 total, 0 active/)).toBeTruthy();
    expect(screen.getByText('No recent activity.')).toBeTruthy();
  });
});
