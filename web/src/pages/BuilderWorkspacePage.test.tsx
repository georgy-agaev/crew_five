import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as apiClient from '../apiClient';
import { BuilderWorkspacePage } from './BuilderWorkspacePage';

afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

function mockCampaigns() {
  vi.spyOn(apiClient, 'fetchCampaigns').mockResolvedValue([
    { id: 'c1', name: 'Campaign One', status: 'draft' },
    { id: 'c2', name: 'Campaign Two', status: 'ready' },
  ] satisfies apiClient.Campaign[]);
}

function mockTransitions(status = 'draft', allowed = ['ready', 'review']) {
  return vi.spyOn(apiClient, 'fetchCampaignStatusTransitions').mockResolvedValue({
    campaignId: 'c1',
    currentStatus: status,
    allowedTransitions: allowed,
  } satisfies apiClient.CampaignStatusTransitionsView);
}

function mockFollowup() {
  return vi.spyOn(apiClient, 'fetchCampaignFollowupCandidates').mockResolvedValue({
    candidates: [
      { contact_id: 'ct-1', eligible: false, reply_received: true, bounce: false, unsubscribed: false, bump_sent: false },
      { contact_id: 'ct-2', eligible: true, reply_received: false, bounce: false, unsubscribed: false, bump_sent: false },
    ],
    summary: { total: 2, eligible: 1, ineligible: 1 },
  } satisfies apiClient.CampaignFollowupCandidatesView);
}

function mockDrafts() {
  vi.spyOn(apiClient, 'fetchDrafts').mockResolvedValue([]);
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('BuilderWorkspacePage', () => {
  it('loads campaigns as cards and shows status transitions', async () => {
    mockCampaigns();
    mockTransitions();
    mockFollowup();
    mockDrafts();
    const updateSpy = vi
      .spyOn(apiClient, 'updateCampaignStatus')
      .mockResolvedValue({ id: 'c1', name: 'Campaign One', status: 'ready' } satisfies apiClient.Campaign);

    render(<BuilderWorkspacePage />);

    // Campaign One appears in both list card and detail header
    const campaignOnes = await screen.findAllByText('Campaign One');
    expect(campaignOnes.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Campaign Two')).toBeTruthy();

    // Wait for transitions to load
    const moveBtn = await screen.findByRole('button', { name: 'Move to ready' });
    fireEvent.click(moveBtn);
    expect(await screen.findByText('Confirm')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('c1', 'ready');
    });
  });

  it('shows confirmation dialog with cancel', async () => {
    mockCampaigns();
    mockTransitions();
    mockFollowup();
    mockDrafts();

    render(<BuilderWorkspacePage />);

    await screen.findAllByText('Campaign One');
    const moveBtn = await screen.findByRole('button', { name: 'Move to ready' });
    fireEvent.click(moveBtn);
    expect(await screen.findByText('Confirm')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(screen.queryByText('Confirm')).toBeNull();
    });
  });

  it('shows loading skeleton while fetching', async () => {
    vi.spyOn(apiClient, 'fetchCampaigns').mockReturnValue(new Promise(() => {}));

    render(<BuilderWorkspacePage />);

    expect(screen.getByText('Campaign Builder V2')).toBeTruthy();
    expect(screen.queryByText('Campaign One')).toBeNull();
  });

  it('shows empty state when no campaigns', async () => {
    vi.spyOn(apiClient, 'fetchCampaigns').mockResolvedValue([]);

    render(<BuilderWorkspacePage />);

    expect(await screen.findByText(/No campaigns found/)).toBeTruthy();
  });

  it('shows followup breakdown with blocked reasons', async () => {
    mockCampaigns();
    mockTransitions();
    mockFollowup();
    mockDrafts();

    render(<BuilderWorkspacePage />);

    expect(await screen.findByText('1 eligible')).toBeTruthy();
    expect(screen.getByText('1 blocked')).toBeTruthy();
    expect(screen.getByText('Reply received')).toBeTruthy();
  });

  it('ignores stale transition responses after switching campaigns', async () => {
    mockCampaigns();
    mockDrafts();
    vi.spyOn(apiClient, 'fetchSegments').mockResolvedValue([]);
    vi.spyOn(apiClient, 'fetchIcpProfiles').mockResolvedValue([]);
    vi.spyOn(apiClient, 'fetchIcpHypotheses').mockResolvedValue([]);

    const c1Transitions = deferred<apiClient.CampaignStatusTransitionsView>();
    const c2Transitions = deferred<apiClient.CampaignStatusTransitionsView>();
    vi.spyOn(apiClient, 'fetchCampaignStatusTransitions').mockImplementation((campaignId: string) => {
      if (campaignId === 'c1') return c1Transitions.promise;
      return c2Transitions.promise;
    });
    vi.spyOn(apiClient, 'fetchCampaignFollowupCandidates').mockResolvedValue({
      candidates: [],
      summary: { total: 0, eligible: 0, ineligible: 0 },
    } satisfies apiClient.CampaignFollowupCandidatesView);

    render(<BuilderWorkspacePage />);

    await screen.findAllByText('Campaign One');
    fireEvent.click(screen.getByText('Campaign Two'));

    c2Transitions.resolve({
      campaignId: 'c2',
      currentStatus: 'ready',
      allowedTransitions: ['complete'],
    });
    await screen.findByRole('button', { name: 'Move to complete' });

    c1Transitions.resolve({
      campaignId: 'c1',
      currentStatus: 'draft',
      allowedTransitions: ['ready'],
    });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Move to ready' })).toBeNull();
    });
  });
});
