import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as apiClient from '../apiClient';
import { MailboxesWorkspacePage } from './MailboxesWorkspacePage';

afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

const mockMailboxes: apiClient.MailboxRow[] = [
  {
    mailboxAccountId: 'mbox-1',
    senderIdentity: 'sales@acme.ai',
    user: 'sales',
    domain: 'acme.ai',
    provider: 'imap_mcp',
    campaignCount: 2,
    outboundCount: 15,
    lastSentAt: '2026-03-18T09:00:00Z',
  },
];

const mockCampaigns: apiClient.Campaign[] = [
  { id: 'camp-1', name: 'Q1 Push', status: 'sending' },
];

const mockAssignment: apiClient.CampaignMailboxAssignment = {
  campaignId: 'camp-1',
  assignments: [
    {
      id: 'a1',
      mailboxAccountId: 'mbox-1',
      senderIdentity: 'sales@acme.ai',
      user: 'sales',
      domain: 'acme.ai',
      provider: 'imap_mcp',
      source: 'outreacher',
      assignedAt: '2026-03-18T20:00:00Z',
      metadata: null,
    },
  ],
  summary: {
    assignmentCount: 1,
    mailboxAccountCount: 1,
    senderIdentityCount: 1,
    domainCount: 1,
    domains: ['acme.ai'],
  },
};

const mockObserved: apiClient.CampaignMailboxSummary = {
  campaignId: 'camp-1',
  mailboxes: [mockMailboxes[0]],
  consistency: {
    consistent: true,
    mailboxAccountCount: 1,
    senderIdentityCount: 1,
    recommendedMailboxAccountId: 'mbox-1',
    recommendedSenderIdentity: 'sales@acme.ai',
  },
};

function setup(opts?: { assignment?: apiClient.CampaignMailboxAssignment | null; observed?: apiClient.CampaignMailboxSummary | null }) {
  vi.spyOn(apiClient, 'fetchMailboxes').mockResolvedValue(mockMailboxes);
  vi.spyOn(apiClient, 'fetchCampaigns').mockResolvedValue(mockCampaigns);
  vi.spyOn(apiClient, 'fetchCampaignMailboxAssignment').mockResolvedValue(opts?.assignment ?? mockAssignment);
  vi.spyOn(apiClient, 'fetchCampaignMailboxSummary').mockResolvedValue(opts?.observed ?? mockObserved);
}

describe('MailboxesWorkspacePage', () => {
  it('renders mailbox inventory', async () => {
    setup();
    render(<MailboxesWorkspacePage />);

    await screen.findAllByText('sales@acme.ai');
    expect(screen.getByText('15 sent')).toBeTruthy();
  });

  it('shows empty state when no mailboxes', async () => {
    vi.spyOn(apiClient, 'fetchMailboxes').mockResolvedValue([]);
    vi.spyOn(apiClient, 'fetchCampaigns').mockResolvedValue([]);
    render(<MailboxesWorkspacePage />);

    expect(await screen.findByText(/No mailboxes/)).toBeTruthy();
  });

  it('shows planned assignment when campaign selected', async () => {
    setup();
    render(<MailboxesWorkspacePage />);
    await screen.findAllByText('sales@acme.ai');

    fireEvent.change(screen.getByLabelText('Select campaign'), { target: { value: 'camp-1' } });

    expect(await screen.findByText('Planned sender set')).toBeTruthy();
    expect(screen.getByText('aligned')).toBeTruthy();
    expect(screen.getByText('via outreacher')).toBeTruthy();
  });

  it('shows no-plan warning when no assignments', async () => {
    setup({
      assignment: { campaignId: 'camp-1', assignments: [], summary: { assignmentCount: 0, mailboxAccountCount: 0, senderIdentityCount: 0, domainCount: 0, domains: [] } },
      observed: { campaignId: 'camp-1', mailboxes: [], consistency: { consistent: true, mailboxAccountCount: 0, senderIdentityCount: 0, recommendedMailboxAccountId: null, recommendedSenderIdentity: null } },
    });
    render(<MailboxesWorkspacePage />);
    await screen.findAllByText('sales@acme.ai');

    fireEvent.change(screen.getByLabelText('Select campaign'), { target: { value: 'camp-1' } });

    expect(await screen.findByText(/no plan/)).toBeTruthy();
    expect(screen.getByText(/Assign at least one sender/)).toBeTruthy();
  });

  it('shows planned-not-sent when plan exists but no observed', async () => {
    setup({
      observed: { campaignId: 'camp-1', mailboxes: [], consistency: { consistent: true, mailboxAccountCount: 0, senderIdentityCount: 0, recommendedMailboxAccountId: null, recommendedSenderIdentity: null } },
    });
    render(<MailboxesWorkspacePage />);
    await screen.findAllByText('sales@acme.ai');

    fireEvent.change(screen.getByLabelText('Select campaign'), { target: { value: 'camp-1' } });

    expect(await screen.findByText(/planned, not sent yet/)).toBeTruthy();
  });

  it('shows observed usage section', async () => {
    setup();
    render(<MailboxesWorkspacePage />);
    await screen.findAllByText('sales@acme.ai');

    fireEvent.change(screen.getByLabelText('Select campaign'), { target: { value: 'camp-1' } });

    expect(await screen.findByText('Observed usage (outbound ledger)')).toBeTruthy();
  });

  it('saves planned assignment via PUT', async () => {
    setup();
    const updateSpy = vi.spyOn(apiClient, 'updateCampaignMailboxAssignment').mockResolvedValue(mockAssignment);

    render(<MailboxesWorkspacePage />);
    await screen.findAllByText('sales@acme.ai');
    fireEvent.change(screen.getByLabelText('Select campaign'), { target: { value: 'camp-1' } });
    await screen.findByText('Planned sender set');

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.click(screen.getByLabelText('Save assignment'));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('camp-1', expect.objectContaining({
        source: 'web-ui',
      }));
    });
  });

  it('shows placeholder before campaign selected', async () => {
    setup();
    render(<MailboxesWorkspacePage />);
    await screen.findAllByText('sales@acme.ai');

    expect(screen.getByText('Select a campaign to manage sender plan')).toBeTruthy();
  });

  // ---- Alignment ----

  it('shows mismatch when planned has more senders than observed', async () => {
    const twoSenderAssignment: apiClient.CampaignMailboxAssignment = {
      ...mockAssignment,
      assignments: [
        ...mockAssignment.assignments,
        { id: 'a2', mailboxAccountId: 'mbox-2', senderIdentity: 'outreach@acme.ai', user: 'outreach', domain: 'acme.ai', provider: 'imap_mcp', source: 'outreacher', assignedAt: '2026-03-18T21:00:00Z', metadata: null },
      ],
      summary: { ...mockAssignment.summary, assignmentCount: 2, senderIdentityCount: 2 },
    };
    // Observed only has 1 of the 2 planned senders
    setup({ assignment: twoSenderAssignment });
    render(<MailboxesWorkspacePage />);
    await screen.findAllByText('sales@acme.ai');

    fireEvent.change(screen.getByLabelText('Select campaign'), { target: { value: 'camp-1' } });

    expect(await screen.findByText(/mismatch/)).toBeTruthy();
  });

  // ---- Persistence ----

  it('auto-loads detail for persisted valid campaign', async () => {
    localStorage.setItem('c5:mailboxes:campaign', JSON.stringify('camp-1'));
    setup();
    render(<MailboxesWorkspacePage />);
    await screen.findAllByText('sales@acme.ai');

    expect(await screen.findByText('aligned')).toBeTruthy();
  });

  it('clears persisted invalid campaign', async () => {
    localStorage.setItem('c5:mailboxes:campaign', JSON.stringify('nonexistent'));
    setup();
    render(<MailboxesWorkspacePage />);
    await screen.findAllByText('sales@acme.ai');

    expect(screen.getByText('Select a campaign to manage sender plan')).toBeTruthy();
  });
});
