import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as apiClient from '../apiClient';
import { EnrichmentWorkspacePage } from './EnrichmentWorkspacePage';

afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

const mockSegments = [
  { id: 'seg-1', name: 'AI Segment' },
  { id: 'seg-2', name: 'Fintech Segment' },
];

describe('EnrichmentWorkspacePage', () => {
  it('renders segment list with checkboxes', async () => {
    vi.spyOn(apiClient, 'fetchSegments').mockResolvedValue(mockSegments);

    render(<EnrichmentWorkspacePage />);

    expect(await screen.findByText('AI Segment')).toBeTruthy();
    expect(screen.getByText('Fintech Segment')).toBeTruthy();
    expect(screen.getByText('0 / 2')).toBeTruthy();
  });

  it('disables submit when nothing selected', async () => {
    vi.spyOn(apiClient, 'fetchSegments').mockResolvedValue(mockSegments);

    render(<EnrichmentWorkspacePage />);
    await screen.findByText('AI Segment');

    const submitBtn = screen.getByLabelText('Run batch enrichment');
    expect(submitBtn).toHaveProperty('disabled', true);
  });

  it('submits selected segments to batch endpoint', async () => {
    vi.spyOn(apiClient, 'fetchSegments').mockResolvedValue(mockSegments);
    const batchSpy = vi.spyOn(apiClient, 'batchEnrichSegments').mockResolvedValue({
      results: [
        { segmentId: 'seg-1', status: 'completed', jobId: 'job-1', summary: { processed: 3, dryRun: false } },
      ],
    });

    render(<EnrichmentWorkspacePage />);
    await screen.findByText('AI Segment');

    // Select first segment
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]); // first segment checkbox

    fireEvent.click(screen.getByLabelText('Run batch enrichment'));

    await waitFor(() => {
      expect(batchSpy).toHaveBeenCalledWith(expect.objectContaining({
        segmentIds: ['seg-1'],
      }));
    });
  });

  it('shows completed results', async () => {
    vi.spyOn(apiClient, 'fetchSegments').mockResolvedValue(mockSegments);
    vi.spyOn(apiClient, 'batchEnrichSegments').mockResolvedValue({
      results: [
        { segmentId: 'seg-1', status: 'completed', jobId: 'job-1', summary: { processed: 5, dryRun: false } },
        { segmentId: 'seg-2', status: 'queued', jobId: 'job-2' },
      ],
    });

    render(<EnrichmentWorkspacePage />);
    await screen.findByText('AI Segment');

    // Select all
    fireEvent.click(screen.getByLabelText('Select all segments'));
    fireEvent.click(screen.getByLabelText('Run batch enrichment'));

    expect(await screen.findByText('completed')).toBeTruthy();
    expect(screen.getByText('queued')).toBeTruthy();
    expect(screen.getByText('5 processed')).toBeTruthy();
  });

  it('shows mixed success/error results', async () => {
    vi.spyOn(apiClient, 'fetchSegments').mockResolvedValue(mockSegments);
    vi.spyOn(apiClient, 'batchEnrichSegments').mockResolvedValue({
      results: [
        { segmentId: 'seg-1', status: 'completed', jobId: 'job-1', summary: { processed: 3 } },
        { segmentId: 'seg-2', status: 'error', error: 'No finalized snapshot' },
      ],
    });

    render(<EnrichmentWorkspacePage />);
    await screen.findByText('AI Segment');

    fireEvent.click(screen.getByLabelText('Select all segments'));
    fireEvent.click(screen.getByLabelText('Run batch enrichment'));

    expect(await screen.findByText('completed')).toBeTruthy();
    expect(screen.getByText('error')).toBeTruthy();
    expect(screen.getByText('No finalized snapshot')).toBeTruthy();
  });

  it('shows error on total failure', async () => {
    vi.spyOn(apiClient, 'fetchSegments').mockResolvedValue(mockSegments);
    vi.spyOn(apiClient, 'batchEnrichSegments').mockRejectedValue(new Error('All segments failed'));

    render(<EnrichmentWorkspacePage />);
    await screen.findByText('AI Segment');

    fireEvent.click(screen.getByLabelText('Select all segments'));
    fireEvent.click(screen.getByLabelText('Run batch enrichment'));

    expect(await screen.findByText('All segments failed')).toBeTruthy();
  });

  it('shows placeholder when no results yet', async () => {
    vi.spyOn(apiClient, 'fetchSegments').mockResolvedValue(mockSegments);

    render(<EnrichmentWorkspacePage />);
    await screen.findByText('AI Segment');

    expect(screen.getByText('Select segments and run enrichment to see results')).toBeTruthy();
  });

  it('shows empty state when no segments exist', async () => {
    vi.spyOn(apiClient, 'fetchSegments').mockResolvedValue([]);

    render(<EnrichmentWorkspacePage />);

    expect(await screen.findByText('No segments found.')).toBeTruthy();
  });

  // ---- Persistence validation ----

  it('prunes stale persisted checked ids after segment load', async () => {
    localStorage.setItem('c5:enrichment:checked', JSON.stringify(['seg-1', 'stale-id', 'seg-2']));
    vi.spyOn(apiClient, 'fetchSegments').mockResolvedValue(mockSegments);
    const batchSpy = vi.spyOn(apiClient, 'batchEnrichSegments').mockResolvedValue({
      results: [
        { segmentId: 'seg-1', status: 'completed', summary: { processed: 1 } },
        { segmentId: 'seg-2', status: 'completed', summary: { processed: 1 } },
      ],
    });

    render(<EnrichmentWorkspacePage />);
    await screen.findByText('AI Segment');

    // Should show 2/2, not 3 (stale-id pruned)
    expect(screen.getByText('2 / 2')).toBeTruthy();

    // Submit should only send valid ids
    fireEvent.click(screen.getByLabelText('Run batch enrichment'));

    await waitFor(() => {
      expect(batchSpy).toHaveBeenCalledWith(expect.objectContaining({
        segmentIds: expect.not.arrayContaining(['stale-id']),
      }));
    });
  });
});
