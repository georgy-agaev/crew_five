import { cleanup, fireEvent, render, screen, waitFor, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as apiClient from '../apiClient';
import * as parser from '../lib/xlsxImportParser';
import { ImportWorkspacePage } from './ImportWorkspacePage';

afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); });

const mockPreview: apiClient.CompanyImportResult = {
  mode: 'dry-run',
  summary: {
    total_count: 2,
    created_count: 1,
    updated_count: 1,
    skipped_count: 0,
    employee_created_count: 2,
    employee_updated_count: 0,
  },
  items: [
    { company_name: 'Acme AI', tin: '1234567890', action: 'create', match_field: null, office_qualification: 'Less', warnings: [] },
    { company_name: 'Beta Corp', tin: '9876543210', action: 'update', match_field: 'tin', office_qualification: 'More', warnings: ['Missing website'] },
  ],
};

const mockApply: apiClient.CompanyImportResult = {
  mode: 'apply',
  summary: {
    total_count: 2,
    created_count: 1,
    updated_count: 1,
    skipped_count: 0,
    employee_created_count: 1,
    employee_updated_count: 0,
  },
  items: mockPreview.items,
  applied: [
    { index: 0, company_id: 'uuid-1', action: 'create' },
    { index: 1, company_id: 'uuid-2', action: 'update' },
  ],
};

const mockApplyEmpty: apiClient.CompanyImportResult = {
  mode: 'apply',
  summary: {
    total_count: 1,
    created_count: 0,
    updated_count: 0,
    skipped_count: 1,
    employee_created_count: 0,
    employee_updated_count: 0,
  },
  items: [{ company_name: 'Skip Co', tin: '000', action: 'skip', match_field: null, office_qualification: null, warnings: [] }],
  applied: [],
};

const mockRecords: apiClient.CompanyImportRecord[] = [
  { company_name: 'Acme AI', tin: '1234567890' },
  { company_name: 'Beta Corp', tin: '9876543210' },
];

function mockFileUpload() {
  vi.spyOn(parser, 'parseXlsxFile').mockReturnValue([
    [
      { company_name: 'Acme AI', tin: '1234567890' },
      { company_name: 'Beta Corp', tin: '9876543210' },
    ],
  ]);
  vi.spyOn(parser, 'normalizeToCanonical').mockReturnValue(mockRecords);
}

async function simulateFileUpload() {
  const file = new File(['dummy'], 'test.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  file.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(8));
  const input = screen.getByLabelText('Upload XLSX');
  fireEvent.change(input, { target: { files: [file] } });
}

async function uploadAndPreview() {
  mockFileUpload();
  vi.spyOn(apiClient, 'previewCompanyImport').mockResolvedValue(mockPreview);
  render(<ImportWorkspacePage />);
  await simulateFileUpload();
  await screen.findByText('Preview ready');
}

async function uploadPreviewAndApply(applyOverride?: apiClient.CompanyImportResult) {
  await uploadAndPreview();
  vi.spyOn(apiClient, 'applyCompanyImport').mockResolvedValue(applyOverride ?? mockApply);
  fireEvent.click(screen.getByLabelText('Apply import'));
  await screen.findByText('Import complete');
}

describe('ImportWorkspacePage', () => {
  it('renders idle state', () => {
    render(<ImportWorkspacePage />);
    expect(screen.getByText('Import')).toBeTruthy();
    expect(screen.getByText('Upload a .xlsx file to begin')).toBeTruthy();
    expect(screen.getByText('Ready to upload')).toBeTruthy();
  });

  it('parses file and shows preview', async () => {
    mockFileUpload();
    vi.spyOn(apiClient, 'previewCompanyImport').mockResolvedValue(mockPreview);
    render(<ImportWorkspacePage />);
    await simulateFileUpload();

    expect(await screen.findByText('Acme AI')).toBeTruthy();
    expect(screen.getByText('Beta Corp')).toBeTruthy();
    expect(screen.getByText('create')).toBeTruthy();
    expect(screen.getByText('update')).toBeTruthy();
    expect(screen.getByText('Preview ready')).toBeTruthy();
  });

  it('shows preview summary chips', async () => {
    mockFileUpload();
    vi.spyOn(apiClient, 'previewCompanyImport').mockResolvedValue(mockPreview);
    render(<ImportWorkspacePage />);
    await simulateFileUpload();

    expect(await screen.findByText('2 total')).toBeTruthy();
    expect(screen.getByText('1 create')).toBeTruthy();
    expect(screen.getByText('1 update')).toBeTruthy();
    expect(screen.getByText('0 skip')).toBeTruthy();
  });

  it('shows warnings', async () => {
    mockFileUpload();
    vi.spyOn(apiClient, 'previewCompanyImport').mockResolvedValue(mockPreview);
    render(<ImportWorkspacePage />);
    await simulateFileUpload();
    expect(await screen.findByText('Missing website')).toBeTruthy();
  });

  it('blocks apply until preview exists', () => {
    render(<ImportWorkspacePage />);
    expect(screen.queryByLabelText('Apply import')).toBeNull();
  });

  it('auto-selects all items after preview', async () => {
    await uploadAndPreview();
    expect(screen.getByText('2 / 2 selected')).toBeTruthy();
  });

  it('applies only selected records', async () => {
    await uploadAndPreview();
    const applySpy = vi.spyOn(apiClient, 'applyCompanyImport').mockResolvedValue(mockApply);

    // Uncheck first item (Acme AI) — only Beta Corp remains
    const checkboxes = screen.getAllByRole('checkbox');
    // checkboxes: [0] = select-all header, [1] = Acme AI, [2] = Beta Corp
    fireEvent.click(checkboxes[1]);

    fireEvent.click(screen.getByLabelText('Apply import'));

    await waitFor(() => {
      expect(applySpy).toHaveBeenCalledWith([mockRecords[1]]);
    });
  });

  it('applies all when all selected', async () => {
    await uploadAndPreview();
    const applySpy = vi.spyOn(apiClient, 'applyCompanyImport').mockResolvedValue({
      ...mockApply,
      summary: { ...mockApply.summary, total_count: 2 },
      items: mockPreview.items,
    });

    fireEvent.click(screen.getByLabelText('Apply import'));

    await waitFor(() => {
      expect(applySpy).toHaveBeenCalledWith(mockRecords);
    });
    expect(await screen.findByText('Import complete')).toBeTruthy();
  });

  it('disables apply when nothing selected', async () => {
    await uploadAndPreview();

    // Clear selection
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    const applyBtn = screen.getByLabelText('Apply import');
    expect(applyBtn).toHaveProperty('disabled', true);
  });

  it('selects only new (create) items via "New only"', async () => {
    await uploadAndPreview();
    const applySpy = vi.spyOn(apiClient, 'applyCompanyImport').mockResolvedValue(mockApply);

    // mockPreview: Acme AI = create, Beta Corp = update
    fireEvent.click(screen.getByRole('button', { name: 'New only' }));

    // Should select only Acme AI (create), not Beta Corp (update)
    expect(screen.getByText('1 / 2 selected')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('Apply import'));

    await waitFor(() => {
      expect(applySpy).toHaveBeenCalledWith([mockRecords[0]]); // only Acme AI
    });
  });

  it('select all / clear toggles', async () => {
    await uploadAndPreview();

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(screen.getByText('0 / 2 selected')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getByText('2 / 2 selected')).toBeTruthy();
  });

  it('shows error on preview failure', async () => {
    mockFileUpload();
    vi.spyOn(apiClient, 'previewCompanyImport').mockRejectedValue(new Error('Backend down'));
    render(<ImportWorkspacePage />);
    await simulateFileUpload();
    expect(await screen.findByText('Backend down')).toBeTruthy();
  });

  it('shows error on apply failure', async () => {
    await uploadAndPreview();
    vi.spyOn(apiClient, 'applyCompanyImport').mockRejectedValue(new Error('Apply failed'));
    fireEvent.click(screen.getByLabelText('Apply import'));
    expect(await screen.findByText('Apply failed')).toBeTruthy();
  });
});

describe('ImportWorkspacePage — Processing', () => {
  it('shows processing CTA after apply when applied.length > 0', async () => {
    await uploadPreviewAndApply();
    expect(screen.getByRole('button', { name: /Process with Outreacher/i })).toBeTruthy();
  });

  it('does not show processing CTA when applied is empty', async () => {
    await uploadPreviewAndApply(mockApplyEmpty);
    expect(screen.queryByRole('button', { name: /Process with Outreacher/i })).toBeNull();
  });

  it('does not show processing CTA before apply', async () => {
    await uploadAndPreview();
    expect(screen.queryByRole('button', { name: /Process with Outreacher/i })).toBeNull();
  });

  it('sends company ids from applied[] when starting processing', async () => {
    await uploadPreviewAndApply();
    const processSpy = vi.spyOn(apiClient, 'startCompanyImportProcess').mockResolvedValue({
      jobId: 'job-1', status: 'created', mode: 'full', totalCompanies: 2, batchSize: 2, source: 'xlsx-import',
    });
    vi.spyOn(apiClient, 'fetchCompanyImportProcessStatus').mockResolvedValue({
      jobId: 'job-1', status: 'running', mode: 'full', totalCompanies: 2, batchSize: 2, source: 'xlsx-import',
      processedCompanies: 0, completedCompanies: 0, failedCompanies: 0, skippedCompanies: 0, results: [], errors: [],
    });

    fireEvent.click(screen.getByRole('button', { name: /Process with Outreacher/i }));

    await waitFor(() => {
      expect(processSpy).toHaveBeenCalledWith(['uuid-1', 'uuid-2'], 'full', 'xlsx-import');
    });
  });

  it('shows processing status block while running', async () => {
    await uploadPreviewAndApply();
    vi.spyOn(apiClient, 'startCompanyImportProcess').mockResolvedValue({
      jobId: 'job-1', status: 'created', mode: 'full', totalCompanies: 2, batchSize: 2, source: 'xlsx-import',
    });
    vi.spyOn(apiClient, 'fetchCompanyImportProcessStatus').mockResolvedValue({
      jobId: 'job-1', status: 'running', mode: 'full', totalCompanies: 2, batchSize: 2, source: 'xlsx-import',
      processedCompanies: 1, completedCompanies: 1, failedCompanies: 0, skippedCompanies: 0,
      results: [{ companyId: 'uuid-1', status: 'completed', company_name: 'Acme AI' }],
      errors: [],
    });

    fireEvent.click(screen.getByRole('button', { name: /Process with Outreacher/i }));

    expect(await screen.findByText(/Processing/)).toBeTruthy();
    expect(await screen.findByText('1 / 2')).toBeTruthy();
  });

  it('shows completed state with results', async () => {
    await uploadPreviewAndApply();
    vi.spyOn(apiClient, 'startCompanyImportProcess').mockResolvedValue({
      jobId: 'job-1', status: 'created', mode: 'full', totalCompanies: 2, batchSize: 2, source: 'xlsx-import',
    });
    vi.spyOn(apiClient, 'fetchCompanyImportProcessStatus').mockResolvedValue({
      jobId: 'job-1', status: 'completed', mode: 'full', totalCompanies: 2, batchSize: 2, source: 'xlsx-import',
      processedCompanies: 2, completedCompanies: 2, failedCompanies: 0, skippedCompanies: 0,
      results: [
        { companyId: 'uuid-1', status: 'completed', company_name: 'Acme AI' },
        { companyId: 'uuid-2', status: 'completed', company_name: 'Beta Corp' },
      ],
      errors: [],
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Process with Outreacher/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('Processing completed')).toBeTruthy();
      expect(screen.getByText('2 / 2')).toBeTruthy();
    });
  });

  it('shows failed state with error summary', async () => {
    await uploadPreviewAndApply();
    vi.spyOn(apiClient, 'startCompanyImportProcess').mockResolvedValue({
      jobId: 'job-1', status: 'created', mode: 'full', totalCompanies: 2, batchSize: 2, source: 'xlsx-import',
    });
    vi.spyOn(apiClient, 'fetchCompanyImportProcessStatus').mockResolvedValue({
      jobId: 'job-1', status: 'failed', mode: 'full', totalCompanies: 2, batchSize: 2, source: 'xlsx-import',
      processedCompanies: 2, completedCompanies: 1, failedCompanies: 1, skippedCompanies: 0,
      results: [{ companyId: 'uuid-1', status: 'completed', company_name: 'Acme AI' }],
      errors: [{ companyId: 'uuid-2', error: 'Timeout' }],
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Process with Outreacher/i }));
    });

    await waitFor(() => {
      expect(screen.getByText('Processing failed')).toBeTruthy();
      expect(screen.getByText(/Timeout/)).toBeTruthy();
    });
  });

  it('disables processing CTA while processing is in progress', async () => {
    await uploadPreviewAndApply();
    vi.spyOn(apiClient, 'startCompanyImportProcess').mockResolvedValue({
      jobId: 'job-1', status: 'created', mode: 'full', totalCompanies: 2, batchSize: 2, source: 'xlsx-import',
    });
    vi.spyOn(apiClient, 'fetchCompanyImportProcessStatus').mockResolvedValue({
      jobId: 'job-1', status: 'running', mode: 'full', totalCompanies: 2, batchSize: 2, source: 'xlsx-import',
      processedCompanies: 0, completedCompanies: 0, failedCompanies: 0, skippedCompanies: 0, results: [], errors: [],
    });

    fireEvent.click(screen.getByRole('button', { name: /Process with Outreacher/i }));
    await screen.findByText(/Processing/);

    // Button should be gone or disabled
    const btn = screen.queryByRole('button', { name: /Process with Outreacher/i });
    expect(btn === null || btn.hasAttribute('disabled')).toBe(true);
  });
});
