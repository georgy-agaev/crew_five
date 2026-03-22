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
] satisfies apiClient.InboxReply[];

const inboxView = {
  replies: mockReplies,
  total: mockReplies.length,
} satisfies apiClient.InboxRepliesView;

describe('InboxWorkspacePage', () => {
  it('renders replies with label badges and detail panel', async () => {
    vi.spyOn(apiClient, 'fetchInboxReplies').mockResolvedValue(inboxView);

    render(<InboxWorkspacePage />);

    // Bianca Mock appears in list and detail, so use findAllByText
    const biancaEls = await screen.findAllByText('Bianca Mock');
    expect(biancaEls.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Campaign: Q1 Push')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Alex Mock/i }));
    expect(screen.getByText('Campaign: Q2 Push')).toBeTruthy();
  });

  it('filters by reply label', async () => {
    const fetchSpy = vi.spyOn(apiClient, 'fetchInboxReplies').mockResolvedValue(inboxView);

    render(<InboxWorkspacePage />);
    await screen.findAllByText('Bianca Mock');

    fireEvent.click(screen.getByRole('button', { name: 'positive' }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ replyLabel: 'positive' })
      );
    });
  });

  it('shows empty state when no replies', async () => {
    vi.spyOn(apiClient, 'fetchInboxReplies').mockResolvedValue({
      replies: [],
      total: 0,
    } satisfies apiClient.InboxRepliesView);

    render(<InboxWorkspacePage />);

    expect(await screen.findByText(/No replies yet/)).toBeTruthy();
  });

  it('shows loading skeleton', async () => {
    vi.spyOn(apiClient, 'fetchInboxReplies').mockReturnValue(new Promise(() => {}));

    render(<InboxWorkspacePage />);

    expect(screen.getByText('Inbox V2')).toBeTruthy();
    expect(screen.queryByText('Bianca Mock')).toBeNull();
  });

  it('filters replies by local search query', async () => {
    vi.spyOn(apiClient, 'fetchInboxReplies').mockResolvedValue(inboxView);

    render(<InboxWorkspacePage />);
    await screen.findAllByText('Bianca Mock');

    fireEvent.change(screen.getByLabelText('Search replies'), {
      target: { value: 'other co' },
    });

    expect(screen.queryByRole('button', { name: /Bianca Mock/i })).toBeNull();
    expect(screen.getByRole('button', { name: /Alex Mock/i })).toBeTruthy();
  });

  it('shows loaded reply summary counts', async () => {
    vi.spyOn(apiClient, 'fetchInboxReplies').mockResolvedValue(inboxView);

    render(<InboxWorkspacePage />);
    await screen.findAllByText('Bianca Mock');

    expect(screen.getByLabelText('Loaded all replies').textContent).toContain('2');
    expect(screen.getByLabelText('Loaded positive replies').textContent).toContain('1');
    expect(screen.getByLabelText('Loaded negative replies').textContent).toContain('1');
  });

  it('shows filtered empty state when local filters hide all replies', async () => {
    vi.spyOn(apiClient, 'fetchInboxReplies').mockResolvedValue(inboxView);

    render(<InboxWorkspacePage />);
    await screen.findAllByText('Bianca Mock');

    fireEvent.change(screen.getByLabelText('Search replies'), {
      target: { value: 'no-match' },
    });

    expect(screen.getByText('No replies match the current filters.')).toBeTruthy();
  });

  it('shows success message after poll now', async () => {
    vi.spyOn(apiClient, 'fetchInboxReplies').mockResolvedValue(inboxView);
    const pollSpy = vi.spyOn(apiClient, 'triggerInboxPoll').mockResolvedValue({
      source: 'outreacher-process-replies',
      requestedAt: '2026-03-17T10:00:00Z',
      upstreamStatus: 200,
      accepted: true,
    });

    render(<InboxWorkspacePage />);
    await screen.findAllByText('Bianca Mock');

    fireEvent.click(screen.getByRole('button', { name: 'Poll now' }));

    await waitFor(() => {
      expect(pollSpy).toHaveBeenCalledTimes(1);
    });
    expect(await screen.findByText(/Polling requested/)).toBeTruthy();
  });

  it('shows unavailable message when poll returns 501', async () => {
    vi.spyOn(apiClient, 'fetchInboxReplies').mockResolvedValue(inboxView);
    const err = new Error('Inbox poll trigger not configured');
    (err as any).apiError = { statusCode: 501 };
    vi.spyOn(apiClient, 'triggerInboxPoll').mockRejectedValue(err);

    render(<InboxWorkspacePage />);
    await screen.findAllByText('Bianca Mock');

    fireEvent.click(screen.getByRole('button', { name: 'Poll now' }));

    expect(await screen.findByText(/not configured/)).toBeTruthy();
  });

  it('shows error message on poll failure', async () => {
    vi.spyOn(apiClient, 'fetchInboxReplies').mockResolvedValue(inboxView);
    vi.spyOn(apiClient, 'triggerInboxPoll').mockRejectedValue(new Error('Network down'));

    render(<InboxWorkspacePage />);
    await screen.findAllByText('Bianca Mock');

    fireEvent.click(screen.getByRole('button', { name: 'Poll now' }));

    expect(await screen.findByText('Network down')).toBeTruthy();
  });

  // ---- Handled state ----

  it('sends handled filter to backend', async () => {
    const fetchSpy = vi.spyOn(apiClient, 'fetchInboxReplies').mockResolvedValue(inboxView);

    render(<InboxWorkspacePage />);
    await screen.findAllByText('Bianca Mock');

    // Default is 'unhandled'
    expect(fetchSpy).toHaveBeenCalledWith(expect.objectContaining({ handled: false }));

    // Switch to 'handled'
    fireEvent.click(screen.getByRole('button', { name: 'handled' }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(expect.objectContaining({ handled: true }));
    });
  });

  it('marks reply as handled', async () => {
    vi.spyOn(apiClient, 'fetchInboxReplies').mockResolvedValue({
      replies: [mockReplies[0]], // unhandled
      total: 1,
    });
    const handleSpy = vi.spyOn(apiClient, 'markInboxReplyHandled').mockResolvedValue({
      id: 'evt-1', handled: true, handled_at: '2026-03-18T22:00:00Z', handled_by: 'operator',
    });

    render(<InboxWorkspacePage />);
    await screen.findAllByText('Bianca Mock');

    fireEvent.click(screen.getByLabelText('Mark handled'));

    await waitFor(() => {
      expect(handleSpy).toHaveBeenCalledWith('evt-1', 'operator');
    });
  });

  it('marks reply as unhandled', async () => {
    vi.spyOn(apiClient, 'fetchInboxReplies').mockResolvedValue({
      replies: [mockReplies[1]], // handled
      total: 1,
    });
    const unhandleSpy = vi.spyOn(apiClient, 'markInboxReplyUnhandled').mockResolvedValue({
      id: 'evt-2', handled: false, handled_at: null, handled_by: null,
    });

    render(<InboxWorkspacePage />);
    await screen.findAllByText('Alex Mock');

    fireEvent.click(screen.getByLabelText('Mark unhandled'));

    await waitFor(() => {
      expect(unhandleSpy).toHaveBeenCalledWith('evt-2');
    });
  });
});
