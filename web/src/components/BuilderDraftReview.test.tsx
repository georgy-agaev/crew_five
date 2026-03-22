import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as apiClient from '../apiClient';
import { BuilderDraftReview } from './BuilderDraftReview';

afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

const mockDrafts: apiClient.DraftRow[] = [
  {
    id: 'd1',
    status: 'generated',
    email_type: 'intro',
    subject: 'Hello CTO',
    body: 'We help companies scale.',
    contact_name: 'Jane Doe',
    company_name: 'Acme Corp',
    recipient_email: 'jane@acme.com',
    pattern_mode: 'direct',
  },
  {
    id: 'd2',
    status: 'approved',
    email_type: 'bump',
    subject: 'Following up',
    body: 'Just checking in.',
    contact_name: 'John Smith',
    company_name: 'Beta Inc',
    recipient_email: 'john@beta.com',
  },
  {
    id: 'd3',
    status: 'sent',
    email_type: 'intro',
    subject: 'Sent draft',
    body: 'Already sent.',
    contact_name: 'Sent Person',
    company_name: 'Gamma LLC',
  },
];

describe('BuilderDraftReview', () => {
  it('renders draft list and summary counts', async () => {
    vi.spyOn(apiClient, 'fetchDrafts').mockResolvedValue(mockDrafts);

    render(<BuilderDraftReview campaignId="c1" />);

    expect(await screen.findByText('3 total')).toBeTruthy();
    expect(screen.getByText('1 generated')).toBeTruthy();
    expect(screen.getByText(/Drafts \(3\)/)).toBeTruthy();
  });

  it('approves a draft via detail panel', async () => {
    vi.spyOn(apiClient, 'fetchDrafts').mockResolvedValue([mockDrafts[0]]);
    const reviewSpy = vi
      .spyOn(apiClient, 'reviewDraftStatus')
      .mockResolvedValue({ ...mockDrafts[0], status: 'approved' } satisfies apiClient.DraftRow);

    render(<BuilderDraftReview campaignId="c1" />);
    await screen.findByText('1 total');

    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

    await waitFor(() => {
      expect(reviewSpy).toHaveBeenCalledWith('d1', {
        status: 'approved',
        reviewer: 'builder-v2',
      });
    });
  });

  it('batch approves all generated drafts via batch endpoint', async () => {
    vi.spyOn(apiClient, 'fetchDrafts').mockResolvedValue(mockDrafts);
    const batchSpy = vi.spyOn(apiClient, 'batchReviewDrafts').mockResolvedValue({
      updated: [{ ...mockDrafts[0], status: 'approved' }],
      summary: { totalRequested: 1, updatedCount: 1, status: 'approved' },
    });

    render(<BuilderDraftReview campaignId="c1" />);
    await screen.findByText('3 total');

    const batchBtn = screen.getByRole('button', { name: /Approve all generated \(1\)/ });
    fireEvent.click(batchBtn);

    await waitFor(() => {
      expect(batchSpy).toHaveBeenCalledWith({
        draftIds: ['d1'],
        status: 'approved',
        reviewer: 'builder-v2',
      });
    });
  });

  it('batch approves generated drafts even when current filter hides them', async () => {
    vi.spyOn(apiClient, 'fetchDrafts').mockResolvedValue(mockDrafts);
    const batchSpy = vi.spyOn(apiClient, 'batchReviewDrafts').mockResolvedValue({
      updated: [{ ...mockDrafts[0], status: 'approved' }],
      summary: { totalRequested: 1, updatedCount: 1, status: 'approved' },
    });

    render(<BuilderDraftReview campaignId="c1" />);
    await screen.findByText('3 total');

    const approvedTab = screen
      .getAllByRole('button')
      .find((btn) => btn.classList.contains('tab') && btn.textContent === 'approved');
    fireEvent.click(approvedTab!);

    const batchBtn = screen.getByRole('button', { name: /Approve all generated \(1\)/ });
    fireEvent.click(batchBtn);

    await waitFor(() => {
      expect(batchSpy).toHaveBeenCalledWith({
        draftIds: ['d1'],
        status: 'approved',
        reviewer: 'builder-v2',
      });
    });
  });

  it('filters drafts by status tab', async () => {
    vi.spyOn(apiClient, 'fetchDrafts').mockResolvedValue(mockDrafts);

    render(<BuilderDraftReview campaignId="c1" />);
    await screen.findByText('3 total');

    const allTabs = screen.getAllByRole('button');
    const approvedTab = allTabs.find(
      (btn) => btn.classList.contains('tab') && btn.textContent === 'approved'
    );
    fireEvent.click(approvedTab!);

    await waitFor(() => {
      expect(screen.getByText(/Drafts \(1\)/)).toBeTruthy();
    });
  });

  it('edits draft content', async () => {
    vi.spyOn(apiClient, 'fetchDrafts').mockResolvedValue([mockDrafts[0]]);
    const updateSpy = vi
      .spyOn(apiClient, 'updateDraftContent')
      .mockResolvedValue({ ...mockDrafts[0], subject: 'New Subject', body: 'New body' } satisfies apiClient.DraftRow);

    render(<BuilderDraftReview campaignId="c1" />);
    await screen.findByText('1 total');

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    const subjectInput = screen.getByDisplayValue('Hello CTO');
    fireEvent.change(subjectInput, { target: { value: 'New Subject' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(updateSpy).toHaveBeenCalledWith('d1', expect.objectContaining({ subject: 'New Subject' }));
    });
  });

  it('shows empty state when no drafts', async () => {
    vi.spyOn(apiClient, 'fetchDrafts').mockResolvedValue([]);

    render(<BuilderDraftReview campaignId="c1" />);

    expect(await screen.findByText(/No drafts for this campaign/)).toBeTruthy();
  });

  it('shows locked message for sent drafts', async () => {
    vi.spyOn(apiClient, 'fetchDrafts').mockResolvedValue([mockDrafts[2]]);

    render(<BuilderDraftReview campaignId="c1" />);

    await screen.findByText(/Drafts \(1\)/);
    expect(screen.getByText('Sent drafts are locked.')).toBeTruthy();
  });

  // ---- Batch selection tests ----

  it('shows batch action bar when drafts are checked', async () => {
    vi.spyOn(apiClient, 'fetchDrafts').mockResolvedValue([mockDrafts[0], mockDrafts[1]]);

    render(<BuilderDraftReview campaignId="c1" />);
    await screen.findByText('2 total');

    // No batch bar initially
    expect(screen.queryByLabelText('Batch actions')).toBeNull();

    // Check the first draft
    const checkboxes = screen.getAllByRole('checkbox');
    // First is "select all", second and third are draft checkboxes
    fireEvent.click(checkboxes[1]);

    expect(screen.getByLabelText('Batch actions')).toBeTruthy();
    expect(screen.getByText('1 selected')).toBeTruthy();
  });

  it('batch approves selected drafts via batch endpoint', async () => {
    vi.spyOn(apiClient, 'fetchDrafts').mockResolvedValue([mockDrafts[0], mockDrafts[1]]);
    const batchSpy = vi.spyOn(apiClient, 'batchReviewDrafts').mockResolvedValue({
      updated: [
        { ...mockDrafts[0], status: 'approved' },
        { ...mockDrafts[1], status: 'approved' },
      ],
      summary: { totalRequested: 2, updatedCount: 2, status: 'approved' },
    });

    render(<BuilderDraftReview campaignId="c1" />);
    await screen.findByText('2 total');

    // Select all via header checkbox
    const selectAll = screen.getByLabelText('Select all visible');
    fireEvent.click(selectAll);

    fireEvent.click(screen.getByLabelText('Approve selected'));

    await waitFor(() => {
      expect(batchSpy).toHaveBeenCalledWith({
        draftIds: expect.arrayContaining(['d1', 'd2']),
        status: 'approved',
        reviewer: 'builder-v2',
      });
    });

    // Batch bar should disappear after success (selection cleared)
    await waitFor(() => {
      expect(screen.queryByLabelText('Batch actions')).toBeNull();
    });
  });

  it('batch rejects selected drafts via batch endpoint', async () => {
    vi.spyOn(apiClient, 'fetchDrafts').mockResolvedValue([mockDrafts[0]]);
    const batchSpy = vi.spyOn(apiClient, 'batchReviewDrafts').mockResolvedValue({
      updated: [{ ...mockDrafts[0], status: 'rejected' }],
      summary: { totalRequested: 1, updatedCount: 1, status: 'rejected' },
    });

    render(<BuilderDraftReview campaignId="c1" />);
    await screen.findByText('1 total');

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]); // draft checkbox

    fireEvent.click(screen.getByLabelText('Reject selected'));

    await waitFor(() => {
      expect(batchSpy).toHaveBeenCalledWith({
        draftIds: ['d1'],
        status: 'rejected',
        reviewer: 'builder-v2',
      });
    });
  });

  it('does not allow selecting sent drafts', async () => {
    vi.spyOn(apiClient, 'fetchDrafts').mockResolvedValue([mockDrafts[2]]);

    render(<BuilderDraftReview campaignId="c1" />);
    await screen.findByText(/Drafts \(1\)/);

    const checkboxes = screen.getAllByRole('checkbox');
    // Draft checkbox should be disabled for sent
    const draftCheckbox = checkboxes[1];
    expect(draftCheckbox).toHaveProperty('disabled', true);
  });

  it('shows error on batch action failure', async () => {
    vi.spyOn(apiClient, 'fetchDrafts').mockResolvedValue([mockDrafts[0]]);
    vi.spyOn(apiClient, 'batchReviewDrafts').mockRejectedValue(new Error('Batch endpoint unavailable'));

    render(<BuilderDraftReview campaignId="c1" />);
    await screen.findByText('1 total');

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);

    fireEvent.click(screen.getByLabelText('Approve selected'));

    expect(await screen.findByText('Batch endpoint unavailable')).toBeTruthy();
  });
});
