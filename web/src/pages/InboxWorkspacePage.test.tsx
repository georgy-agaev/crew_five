import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as apiClient from '../apiClient';
import { InboxWorkspacePage } from './InboxWorkspacePage';

afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

const mockReplies = [
  {
    id: 'evt-1',
    campaign_id: 'camp-1',
    campaign_name: 'Q1 Push',
    reply_label: 'positive',
    event_type: 'replied',
    occurred_at: '2026-03-15T13:30:00Z',
    reply_text: 'Sounds interesting, let us set up a call.',
    subject: 'Mock intro',
    contact_name: 'Bianca Mock',
    company_name: 'Mock Co',
    contact_position: 'CTO',
    handled: false,
    handled_at: null,
    handled_by: null,
  },
  {
    id: 'evt-2',
    campaign_id: 'camp-2',
    campaign_name: 'Q2 Push',
    reply_label: 'negative',
    event_type: 'replied',
    occurred_at: '2026-03-14T12:00:00Z',
    reply_text: 'Not interested.',
    subject: 'Another intro',
    contact_name: 'Alex Mock',
    company_name: 'Other Co',
    handled: true,
    handled_at: '2026-03-15T10:00:00Z',
    handled_by: 'operator',
  },
  {
    id: 'evt-3',
    campaign_id: null,
    campaign_name: null,
    reply_label: null,
    event_type: 'bounced',
    occurred_at: '2026-03-14T11:00:00Z',
    reply_text: 'Mailbox full',
    subject: 'Bounce',
    contact_name: 'Charlie Bounce',
    company_name: null,
    handled: false,
    handled_at: null,
    handled_by: null,
  },
] satisfies apiClient.InboxReply[];

const inboxView = {
  replies: mockReplies,
  total: mockReplies.length,
} satisfies apiClient.InboxRepliesView;

function mockFetch() {
  return vi.spyOn(apiClient, 'fetchInboxReplies').mockResolvedValue(inboxView);
}

describe('InboxWorkspacePage', () => {
  // Default filters: linkage=linked, handled=unhandled → only evt-1 visible

  it('fetches linked unhandled replies by default', async () => {
    const spy = mockFetch();
    render(<InboxWorkspacePage />);
    await screen.findAllByText('Bianca Mock');
    // Default filters: linkage=linked, handled=false
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ linkage: 'linked', handled: false }));
  });

  it('shows reply detail panel', async () => {
    mockFetch();
    render(<InboxWorkspacePage />);
    expect((await screen.findAllByText('Sounds interesting, let us set up a call.')).length).toBeGreaterThan(0);
  });

  it('shows summary counts for scoped replies', async () => {
    mockFetch();
    render(<InboxWorkspacePage />);
    await screen.findAllByText('Bianca Mock');
    // Scoped = linked + unhandled = evt-1 only → all:1, positive:1
    expect(screen.getByText(/positive: 1/)).toBeTruthy();
  });

  it('filters by label via server category param', async () => {
    const fetchSpy = mockFetch();
    render(<InboxWorkspacePage />);
    await screen.findAllByText('Bianca Mock');

    fireEvent.click(screen.getByRole('button', { name: 'negative' }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(expect.objectContaining({ category: 'negative' }));
    });
  });

  it('shows handled replies when handled filter changed', async () => {
    mockFetch();
    render(<InboxWorkspacePage />);
    await screen.findAllByText('Bianca Mock');

    fireEvent.click(screen.getByRole('button', { name: 'handled' }));
    await waitFor(() => {
      // evt-2 is linked + handled
      expect(screen.getAllByText('Alex Mock').length).toBeGreaterThan(0);
    });
  });

  it('shows unlinked replies when linkage changed', async () => {
    mockFetch();
    render(<InboxWorkspacePage />);
    await screen.findAllByText('Bianca Mock');

    fireEvent.click(screen.getByRole('button', { name: 'all mail' }));
    const allButtons = screen.getAllByRole('button', { name: 'all' });
    fireEvent.click(allButtons[allButtons.length - 1]); // last "all" is handled filter
    await waitFor(() => {
      expect(screen.getAllByText('Charlie Bounce').length).toBeGreaterThan(0);
    });
  });

  it('filters by search query', async () => {
    mockFetch();
    render(<InboxWorkspacePage />);
    await screen.findAllByText('Bianca Mock');

    const search = screen.getByPlaceholderText(/search/i);
    fireEvent.change(search, { target: { value: 'nonexistent' } });
    await waitFor(() => {
      expect(screen.queryByText('Bianca Mock')).toBeNull();
    });
  });

  it('shows empty state', async () => {
    vi.spyOn(apiClient, 'fetchInboxReplies').mockResolvedValue({ replies: [], total: 0 });
    render(<InboxWorkspacePage />);
    expect(await screen.findByText(/No replies/)).toBeTruthy();
  });

  it('shows loading skeleton', async () => {
    vi.spyOn(apiClient, 'fetchInboxReplies').mockReturnValue(new Promise(() => {}));
    render(<InboxWorkspacePage />);
    expect(screen.getByText('Inbox V2')).toBeTruthy();
  });

  it('loads data once on mount', async () => {
    const spy = mockFetch();
    render(<InboxWorkspacePage />);
    await screen.findAllByText('Bianca Mock');
    expect(spy).toHaveBeenCalledTimes(1);
    // Default: linkage=linked, handled=false, no category
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ limit: 50, linkage: 'linked', handled: false }));
  });

  it('marks reply as handled', async () => {
    vi.spyOn(apiClient, 'fetchInboxReplies').mockResolvedValue({
      replies: [mockReplies[0]],
      total: 1,
    });
    const markSpy = vi.spyOn(apiClient, 'markInboxReplyHandled').mockResolvedValue({
      id: 'evt-1', handled: true, handled_at: '2026-03-15T14:00:00Z', handled_by: 'operator',
    });
    render(<InboxWorkspacePage />);
    await screen.findAllByText('Bianca Mock');
    fireEvent.click(screen.getByRole('button', { name: /mark handled/i }));
    await waitFor(() => { expect(markSpy).toHaveBeenCalled(); });
  });

  it('shows poll success message', async () => {
    mockFetch();
    vi.spyOn(apiClient, 'triggerInboxPoll').mockResolvedValue({
      source: 'outreacher-process-replies',
      requestedAt: '2026-03-17T10:00:00Z',
      upstreamStatus: 200,
      accepted: true,
    });
    render(<InboxWorkspacePage />);
    await screen.findAllByText('Bianca Mock');
    fireEvent.click(screen.getByRole('button', { name: /poll now/i }));
    expect(await screen.findByText(/Polling requested/)).toBeTruthy();
  });
});
