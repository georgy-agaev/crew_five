import type { AdapterDeps, DispatchRequest, DispatchResponse } from '../types.js';

function readRecords(body: unknown) {
  const records = (body as { records?: unknown } | null)?.records;
  return Array.isArray(records) ? records : null;
}

function readCompanyIds(body: unknown) {
  const companyIds = (body as { companyIds?: unknown } | null)?.companyIds;
  return Array.isArray(companyIds) ? companyIds.map((entry) => String(entry)) : null;
}

export async function handleImportRoutes(
  deps: AdapterDeps,
  req: DispatchRequest
): Promise<DispatchResponse | null> {
  if (req.method === 'POST' && req.pathname === '/api/company-import/preview') {
    if (!deps.previewCompanyImport) {
      return { status: 501, body: { error: 'Company import preview not configured' } };
    }
    const records = readRecords(req.body);
    if (!records) {
      return { status: 400, body: { error: 'records must be an array' } };
    }
    try {
      return { status: 200, body: await deps.previewCompanyImport(records) };
    } catch (err: unknown) {
      const raw = err as any;
      const message = raw?.message ?? (err instanceof Error ? err.message : 'Company import preview failed');
      return { status: 500, body: { error: message, code: raw?.code, details: raw?.details, hint: raw?.hint } };
    }
  }

  if (req.method === 'POST' && req.pathname === '/api/company-import/apply') {
    if (!deps.applyCompanyImport) {
      return { status: 501, body: { error: 'Company import apply not configured' } };
    }
    const records = readRecords(req.body);
    if (!records) {
      return { status: 400, body: { error: 'records must be an array' } };
    }
    try {
      return { status: 200, body: await deps.applyCompanyImport(records) };
    } catch (err: unknown) {
      const raw = err as any;
      const message = raw?.message ?? (err instanceof Error ? err.message : 'Company import apply failed');
      return { status: 500, body: { error: message, code: raw?.code, details: raw?.details, hint: raw?.hint } };
    }
  }

  if (req.method === 'POST' && req.pathname === '/api/company-import/process') {
    if (!deps.startCompanyImportProcess) {
      return { status: 501, body: { error: 'Company import processing not configured' } };
    }
    const companyIds = readCompanyIds(req.body);
    if (!companyIds || companyIds.length === 0) {
      return { status: 400, body: { error: 'companyIds must be a non-empty array' } };
    }
    const mode = (req.body as { mode?: unknown } | null)?.mode;
    const source = (req.body as { source?: unknown } | null)?.source;
    try {
      return {
        status: 202,
        body: await deps.startCompanyImportProcess({
          companyIds,
          mode: mode === 'light' ? 'light' : 'full',
          source: typeof source === 'string' ? source : null,
        }),
      };
    } catch (err: unknown) {
      const raw = err as any;
      const message = raw?.message ?? (err instanceof Error ? err.message : 'Company import processing failed');
      return { status: 400, body: { error: message } };
    }
  }

  if (req.method === 'GET' && req.pathname.startsWith('/api/company-import/process/')) {
    if (!deps.getCompanyImportProcessStatus) {
      return { status: 501, body: { error: 'Company import process status not configured' } };
    }
    const jobId = req.pathname.slice('/api/company-import/process/'.length).replace(/\/$/, '');
    if (!jobId) {
      return { status: 400, body: { error: 'jobId is required' } };
    }
    const statusView = await deps.getCompanyImportProcessStatus(jobId);
    if (!statusView) {
      return { status: 404, body: { error: 'Company import process job not found' } };
    }
    return { status: 200, body: statusView };
  }

  return null;
}
