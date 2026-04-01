import { useCallback, useEffect, useRef, useState } from 'react';
import { usePersistedState } from '../hooks/usePersistedState';

import {
  applyCompanyImport,
  fetchCompanyImportProcessStatus,
  previewCompanyImport,
  startCompanyImportProcess,
  type CompanyImportPreviewItem,
  type CompanyImportProcessStatusResponse,
  type CompanyImportRecord,
  type CompanyImportResult,
} from '../apiClient';
import { parseXlsxFile, normalizeToCanonical } from '../lib/xlsxImportParser';
import { getWorkspaceColors } from '../theme';
import './CampaignOperatorDesk.css';

// ============================================================
// Helpers
// ============================================================

function odCssVars(isDark: boolean): React.CSSProperties {
  const c = getWorkspaceColors(isDark);
  return {
    '--od-bg': c.bg, '--od-card': c.card, '--od-card-hover': c.cardHover,
    '--od-text': c.text, '--od-text-muted': c.textMuted, '--od-border': c.border,
    '--od-orange': c.orange, '--od-orange-light': c.orangeLight,
    '--od-sidebar': c.sidebar, '--od-success': c.success,
    '--od-warning': c.warning, '--od-error': c.error,
  } as React.CSSProperties;
}

type Phase = 'idle' | 'parsing' | 'previewing' | 'preview-ready' | 'applying' | 'done';
type ProcessingPhase = 'idle' | 'starting' | 'polling' | 'completed' | 'failed';

const POLL_INTERVAL_MS = 3000;

const ACTION_BADGE_TITLES: Record<string, string> = {
  create: 'New company will be created',
  update: 'Existing company will be updated',
  skip: 'Company will be skipped (e.g. validation issue)',
};

function ActionBadge({ action }: { action: string }) {
  const cls =
    action === 'create' ? 'od-enrich-badge--fresh'
    : action === 'update' ? 'od-enrich-badge--stale'
    : 'od-enrich-badge--missing';
  return <span className={`od-enrich-badge ${cls}`} title={ACTION_BADGE_TITLES[action]}>{action}</span>;
}

// ============================================================
// Main component
// ============================================================

export function ImportWorkspacePage({ isDark = false }: { isDark?: boolean }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [records, setRecords] = useState<CompanyImportRecord[]>([]);
  const [preview, setPreview] = useState<CompanyImportResult | null>(null);
  const [applyResult, setApplyResult] = useState<CompanyImportResult | null>(null);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ---- Processing state ----
  const [processingPhase, setProcessingPhase] = useState<ProcessingPhase>('idle');
  const [processingStatus, setProcessingStatus] = useState<CompanyImportProcessStatusResponse | null>(null);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- Resizable columns ----
  const [leftWidth, setLeftWidth] = usePersistedState('c5:import:left-width', 360);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startW: leftWidth };
    const onMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setLeftWidth(Math.max(260, Math.min(560, dragRef.current.startW + (ev.clientX - dragRef.current.startX))));
    };
    const onMouseUp = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [leftWidth]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPreview(null);
    setApplyResult(null);
    setSelectedIndices(new Set());
    setFileName(file.name);
    setPhase('parsing');

    try {
      const buffer = await file.arrayBuffer();
      const sheets = parseXlsxFile(buffer);
      if (sheets.length === 0 || sheets[0].length === 0) {
        setError('No data found in the uploaded file.');
        setPhase('idle');
        return;
      }
      const batchId = `import-${new Date().toISOString().slice(0, 10)}-${Date.now().toString(36)}`;
      const normalized = normalizeToCanonical(sheets[0], batchId);
      if (normalized.length === 0) {
        setError('No valid company records found. Check column headers match the expected format.');
        setPhase('idle');
        return;
      }
      setRecords(normalized);

      // Auto-preview
      setPhase('previewing');
      const result = await previewCompanyImport(normalized);
      setPreview(result);
      // Auto-select all after preview
      setSelectedIndices(new Set(result.items.map((_, i) => i)));
      setPhase('preview-ready');
    } catch (err: unknown) {
      const apiError = (err as any)?.apiError;
      setError(apiError?.message ?? (err instanceof Error ? err.message : 'Failed to parse or preview file'));
      setPhase('idle');
    }
  }, []);

  const toggleIndex = (idx: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const selectAll = () => {
    if (preview) setSelectedIndices(new Set(preview.items.map((_, i) => i)));
  };

  const clearSelection = () => {
    setSelectedIndices(new Set());
  };

  const handleApply = useCallback(async () => {
    if (selectedIndices.size === 0 || records.length === 0) return;
    // Send only selected records (indices map 1:1 with records array)
    const selectedRecords = [...selectedIndices].sort((a, b) => a - b).map((i) => records[i]).filter(Boolean);
    if (selectedRecords.length === 0) return;

    setPhase('applying');
    setError(null);
    try {
      const result = await applyCompanyImport(selectedRecords);
      setApplyResult(result);
      setPhase('done');
    } catch (err: unknown) {
      const apiError = (err as any)?.apiError;
      setError(apiError?.message ?? (err instanceof Error ? err.message : 'Import apply failed'));
      setPhase('preview-ready');
    }
  }, [records, selectedIndices]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(async (jobId: string) => {
    try {
      const status = await fetchCompanyImportProcessStatus(jobId);
      setProcessingStatus(status);
      if (status.status === 'completed') {
        setProcessingPhase('completed');
        stopPolling();
      } else if (status.status === 'failed') {
        setProcessingPhase('failed');
        stopPolling();
      }
    } catch (err: unknown) {
      setProcessingError(err instanceof Error ? err.message : 'Failed to fetch processing status');
      setProcessingPhase('failed');
      stopPolling();
    }
  }, [stopPolling]);

  const handleStartProcessing = useCallback(async () => {
    if (!applyResult?.applied || applyResult.applied.length === 0) return;
    const companyIds = applyResult.applied.map((a) => a.company_id);

    setProcessingPhase('starting');
    setProcessingError(null);
    setProcessingStatus(null);

    try {
      const result = await startCompanyImportProcess(companyIds, 'full', 'xlsx-import');
      setProcessingPhase('polling');

      // Initial poll
      await pollStatus(result.jobId);

      // Start interval polling
      pollTimerRef.current = setInterval(() => pollStatus(result.jobId), POLL_INTERVAL_MS);
    } catch (err: unknown) {
      setProcessingError(err instanceof Error ? err.message : 'Failed to start processing');
      setProcessingPhase('failed');
    }
  }, [applyResult, pollStatus]);

  // Cleanup polling on unmount
  useEffect(() => stopPolling, [stopPolling]);

  const handleReset = () => {
    stopPolling();
    setPhase('idle');
    setError(null);
    setFileName(null);
    setRecords([]);
    setPreview(null);
    setApplyResult(null);
    setSelectedIndices(new Set());
    setProcessingPhase('idle');
    setProcessingStatus(null);
    setProcessingError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const activeResult = applyResult ?? preview;
  const allSelected = preview != null && selectedIndices.size === preview.items.length;

  return (
    <div className="operator-desk" style={odCssVars(isDark)}>
      <div style={{ padding: '10px 16px 0', flexShrink: 0 }}>
        <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Import</h1>
        <p style={{ fontSize: 12, color: 'var(--od-text-muted)', margin: '4px 0 0' }}>
          Upload a .xlsx file (Kontur.Kompas format). Client-side parsing, backend preview + apply.
        </p>
      </div>

      {error && <div className="od-error-banner" role="alert">{error}</div>}

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Column 1: Upload + options */}
        <div className="operator-desk__column" style={{ width: leftWidth, flexShrink: 0 }}>
          <div className="od-col-header">
            <h2 className="od-col-title">Upload</h2>
          </div>

          <div className="od-context-block">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              aria-label="Upload XLSX"
              title="Upload .xlsx file in Kontur.Kompas format"
              onChange={handleFileSelect}
              disabled={phase === 'parsing' || phase === 'previewing' || phase === 'applying'}
              style={{ fontSize: 12, width: '100%' }}
            />
            {fileName && (
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--od-text-muted)' }}>
                {fileName} — {records.length} company record{records.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>

          {/* Phase indicator */}
          <div className="od-context-block" style={{ borderTop: '1px solid var(--od-border)' }}>
            <h3 className="od-context-block__title">Status</h3>
            <div className="od-context-row">
              <span className="od-context-row__label">Phase</span>
              <span className="od-context-row__value">
                {phase === 'idle' && 'Ready to upload'}
                {phase === 'parsing' && 'Parsing file...'}
                {phase === 'previewing' && 'Running preview...'}
                {phase === 'preview-ready' && 'Preview ready'}
                {phase === 'applying' && 'Applying import...'}
                {phase === 'done' && 'Import complete'}
              </span>
            </div>
          </div>

          {/* Preview summary (always full file) */}
          {activeResult && (
            <div className="od-context-block" style={{ borderTop: '1px solid var(--od-border)' }}>
              <h3 className="od-context-block__title">Summary ({activeResult.mode})</h3>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span className="od-count-chip">{activeResult.summary.total_count} total</span>
                <span className="od-enrich-badge od-enrich-badge--fresh">{activeResult.summary.created_count} create</span>
                <span className="od-enrich-badge od-enrich-badge--stale">{activeResult.summary.updated_count} update</span>
                <span className="od-enrich-badge od-enrich-badge--missing">{activeResult.summary.skipped_count} skip</span>
              </div>
              {(activeResult.summary.employee_created_count > 0 || activeResult.summary.employee_updated_count > 0) && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                  <span className="od-count-chip">{activeResult.summary.employee_created_count} employees created</span>
                  <span className="od-count-chip">{activeResult.summary.employee_updated_count} employees updated</span>
                </div>
              )}
            </div>
          )}

          {/* Selection info + actions */}
          {phase === 'preview-ready' && preview && (
            <div className="od-context-block" style={{ borderTop: '1px solid var(--od-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--od-text)' }}>
                  {selectedIndices.size} / {preview.items.length} selected
                </span>
                <button type="button" className="od-btn od-btn--ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={selectAll} title="Select all preview items">
                  All
                </button>
                <button
                  type="button"
                  className="od-btn od-btn--ghost"
                  style={{ padding: '2px 8px', fontSize: 11 }}
                  title="Select only new companies (action = create). Excludes updates and skips."
                  onClick={() => {
                    const newOnly = new Set<number>();
                    preview.items.forEach((item, idx) => { if (item.action === 'create') newOnly.add(idx); });
                    setSelectedIndices(newOnly);
                  }}
                >
                  New only
                </button>
                <button type="button" className="od-btn od-btn--ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={clearSelection} title="Deselect all preview items">
                  Clear
                </button>
              </div>
              <button
                type="button"
                className="od-btn od-btn--approve"
                disabled={selectedIndices.size === 0}
                onClick={handleApply}
                aria-label="Apply import"
                title="Apply only the selected companies to the database"
                style={{ width: '100%' }}
              >
                Apply selected ({selectedIndices.size} record{selectedIndices.size !== 1 ? 's' : ''})
              </button>
            </div>
          )}

          {phase === 'done' && (
            <div className="od-context-block" style={{ borderTop: '1px solid var(--od-border)' }}>
              {/* Processing CTA */}
              {applyResult?.applied && applyResult.applied.length > 0 && processingPhase === 'idle' && (
                <button
                  type="button"
                  className="od-btn od-btn--approve"
                  onClick={handleStartProcessing}
                  aria-label="Process with Outreacher"
                  title="Run Outreacher processing on the imported companies"
                  style={{ width: '100%', marginBottom: 8 }}
                >
                  Process with Outreacher ({applyResult.applied.length})
                </button>
              )}

              {/* Processing status */}
              {processingPhase !== 'idle' && (
                <ProcessingStatusBlock
                  phase={processingPhase}
                  status={processingStatus}
                  error={processingError}
                />
              )}

              <button type="button" className="od-btn od-btn--ghost" onClick={handleReset} style={{ width: '100%' }} title="Clear current import and start over">
                Reset
              </button>
            </div>
          )}
        </div>

        {/* Drag handle */}
        <div className="od-resize-handle" onMouseDown={handleResizeStart} />

        {/* Column 2: Preview/result items */}
        <div className="operator-desk__column" style={{ background: 'var(--od-bg)', flex: 1, minWidth: 240 }}>
          <div className="od-col-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {phase === 'preview-ready' && preview && (
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => allSelected ? clearSelection() : selectAll()}
                  aria-label="Select all items"
                  title="Select or deselect all preview items"
                  style={{ width: 'auto', margin: 0, cursor: 'pointer' }}
                />
              )}
              <h2 className="od-col-title">
                {applyResult ? 'Import result' : preview ? 'Preview' : 'Records'}
              </h2>
            </div>
            {activeResult && <span className="od-count-chip">{activeResult.items.length}</span>}
          </div>

          <div className="od-col-body">
            {phase === 'idle' && (
              <div className="od-placeholder">
                <div className="od-placeholder__dash" />
                <span className="od-placeholder__text">Upload a .xlsx file to begin</span>
              </div>
            )}

            {(phase === 'parsing' || phase === 'previewing' || phase === 'applying') && (
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span className="od-skeleton" style={{ height: 14, width: '55%', display: 'block' }} />
                <span className="od-skeleton" style={{ height: 14, width: '70%', display: 'block' }} />
                <span className="od-skeleton" style={{ height: 14, width: '40%', display: 'block' }} />
              </div>
            )}

            {activeResult && activeResult.items.map((item, idx) => {
              const isPreviewPhase = phase === 'preview-ready';
              const checked = selectedIndices.has(idx);
              return (
                <div
                  key={`${item.company_name}-${item.tin ?? idx}`}
                  className={`od-company-item${focusedIndex === idx ? ' od-company-item--hovered' : ''}${isPreviewPhase && checked ? ' od-company-item--pinned' : ''}`}
                  style={{ cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 8 }}
                  onClick={() => setFocusedIndex(idx)}
                >
                  {isPreviewPhase && (
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleIndex(idx)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: 'auto', margin: '2px 0 0', cursor: 'pointer', flexShrink: 0 }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="od-company-item__name">{item.company_name}</span>
                      <ActionBadge action={item.action} />
                    </div>
                    <div className="od-company-item__foot">
                      {item.tin && <span className="od-count-chip" title="TIN" style={{ fontSize: 9 }}>{item.tin}</span>}
                      {item.match_field && (
                        <span className="od-count-chip" style={{ fontSize: 9 }}>
                          matched by {item.match_field}
                        </span>
                      )}
                      {item.office_qualification && (
                        <span className="od-count-chip" style={{ fontSize: 9 }}>{item.office_qualification}</span>
                      )}
                    </div>
                    {item.warnings.length > 0 && (
                      <div style={{ marginTop: 4 }}>
                        {item.warnings.map((w, i) => (
                          <div key={i} style={{ fontSize: 11, color: 'var(--od-warning)' }}>{w}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Column 3: Company detail */}
        {focusedIndex != null && records[focusedIndex] && (
          <>
            <div className="od-resize-handle" />
            <div className="operator-desk__column" style={{ background: 'var(--od-bg)', flex: 1, minWidth: 280 }}>
              <div className="od-col-header">
                <h2 className="od-col-title">Company detail</h2>
              </div>
              <div className="od-col-body">
                <CompanyDetailCard record={records[focusedIndex]} previewItem={activeResult?.items[focusedIndex] ?? null} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ProcessingStatusBlock({
  phase,
  status,
  error,
}: {
  phase: ProcessingPhase;
  status: CompanyImportProcessStatusResponse | null;
  error: string | null;
}) {
  const isTerminal = phase === 'completed' || phase === 'failed';
  const total = status?.totalCompanies ?? 0;
  const processed = status?.processedCompanies ?? 0;
  const completed = status?.completedCompanies ?? 0;
  const failed = status?.failedCompanies ?? 0;
  const skipped = status?.skippedCompanies ?? 0;
  const failedResults = (status?.results ?? []).filter((entry) => entry.status === 'error' || Boolean(entry.error));
  const normalizedErrors = (status?.errors ?? []).map((entry, index) => {
    if (typeof entry === 'string') {
      return { key: `raw-${index}`, label: entry };
    }
    const companyId = entry.companyId?.trim();
    return {
      key: companyId ? `company-${companyId}` : `raw-${index}`,
      label: companyId ? `${companyId}: ${entry.error}` : entry.error,
    };
  });

  return (
    <div style={{ marginBottom: 8 }}>
      <h3 className="od-context-block__title">
        {phase === 'starting' && 'Starting processing...'}
        {phase === 'polling' && 'Processing...'}
        {phase === 'completed' && 'Processing completed'}
        {phase === 'failed' && 'Processing failed'}
      </h3>

      {status && (
        <>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            <span className="od-count-chip">{processed} / {total}</span>
            {completed > 0 && <span className="od-enrich-badge od-enrich-badge--fresh">{completed} completed</span>}
            {failed > 0 && <span className="od-enrich-badge od-enrich-badge--missing">{failed} failed</span>}
            {skipped > 0 && <span className="od-count-chip">{skipped} skipped</span>}
          </div>

          {/* Per-company results */}
          {status.results && status.results.length > 0 && isTerminal && (
            <div style={{ marginTop: 6 }}>
              {status.results.map((r) => (
                <div key={r.companyId} style={{ fontSize: 11, color: 'var(--od-text-muted)', padding: '2px 0' }}>
                  {r.company_name ?? r.companyId} — {r.status}
                </div>
              ))}
            </div>
          )}

          {/* Failures / errors */}
          {(failedResults.length > 0 || normalizedErrors.length > 0) && (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--od-error)', marginBottom: 4 }}>
                Recent failures
              </div>
              <div
                style={{
                  maxHeight: 140,
                  overflowY: 'auto',
                  border: '1px solid var(--od-border)',
                  borderRadius: 8,
                  padding: '6px 8px',
                  background: 'var(--od-card)',
                }}
              >
                {failedResults.map((entry) => (
                  <div key={`result-${entry.companyId}`} style={{ fontSize: 11, color: 'var(--od-error)', padding: '2px 0' }}>
                    {entry.company_name ?? entry.companyId}: {entry.error ?? 'Processing failed'}
                  </div>
                ))}
                {normalizedErrors.map((entry) => (
                  <div key={entry.key} style={{ fontSize: 11, color: 'var(--od-error)', padding: '2px 0' }}>
                    {entry.label}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {error && !status && (
        <div style={{ fontSize: 11, color: 'var(--od-error)', marginTop: 4 }}>{error}</div>
      )}

      {!isTerminal && (
        <div style={{ marginTop: 6 }}>
          <span className="od-skeleton" style={{ height: 10, width: '60%', display: 'block' }} />
        </div>
      )}
    </div>
  );
}

function CompanyDetailCard({ record, previewItem }: { record: CompanyImportRecord; previewItem: CompanyImportPreviewItem | null }) {
  const Row = ({ label, value }: { label: string; value: string | number | null | undefined }) => {
    if (value == null || value === '') return null;
    return (
      <div className="od-context-row" style={{ padding: '3px 0' }}>
        <span className="od-context-row__label">{label}</span>
        <span className="od-context-row__value" style={{ maxWidth: 'none' }}>{String(value)}</span>
      </div>
    );
  };

  return (
    <div style={{ padding: '10px 12px' }}>
      {previewItem && (
        <div style={{ marginBottom: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <ActionBadge action={previewItem.action} />
          {previewItem.match_field && <span className="od-count-chip" style={{ fontSize: 9 }}>matched by {previewItem.match_field}</span>}
        </div>
      )}

      <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 8px', color: 'var(--od-text)' }}>
        {record.company_name}
      </h3>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        <Row label="TIN" value={record.tin} />
        <Row label="OGRN" value={record.registration_number} />
        <Row label="Registered" value={record.registration_date} />
        <Row label="Region" value={record.region} />
        <Row label="Status" value={record.status} />
        {record.website && (
          <div className="od-context-row" style={{ padding: '3px 0' }}>
            <span className="od-context-row__label">Website</span>
            <a
              href={record.website.startsWith('http') ? record.website : `https://${record.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="od-company-item__website"
            >
              {record.website}
            </a>
          </div>
        )}
        <Row label="CEO" value={record.ceo_name} />
        <Row label="CEO position" value={record.ceo_position} />
        <Row label="Email" value={record.primary_email} />
        <Row label="Employees" value={record.employee_count} />
        <Row label="Segment" value={record.segment} />
        <Row label="Office" value={record.office_qualification} />
        <Row label="Source" value={record.source} />
        <Row label="Revenue" value={record.revenue} />
        <Row label="Balance" value={record.balance} />
        <Row label="Net profit/loss" value={record.net_profit_loss} />
        <Row label="Description" value={record.company_description} />
      </div>

      {record.employees && record.employees.length > 0 && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--od-border)', paddingTop: 8 }}>
          <h4 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--od-text-muted)', margin: '0 0 6px' }}>
            Employees ({record.employees.length})
          </h4>
          {record.employees.map((emp, i) => (
            <div key={i} style={{ padding: '4px 0', borderBottom: '1px solid var(--od-border)' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--od-text)' }}>{emp.full_name}</span>
              {emp.position && <span style={{ fontSize: 11, color: 'var(--od-text-muted)', marginLeft: 6 }}>{emp.position}</span>}
              <div style={{ fontSize: 11, color: 'var(--od-text-muted)' }}>
                {emp.work_email ?? emp.generic_email ?? 'no email'}
              </div>
            </div>
          ))}
        </div>
      )}

      {previewItem && previewItem.warnings.length > 0 && (
        <div style={{ marginTop: 10, borderTop: '1px solid var(--od-border)', paddingTop: 8 }}>
          <h4 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--od-warning)', margin: '0 0 4px' }}>Warnings</h4>
          {previewItem.warnings.map((w, i) => (
            <div key={i} style={{ fontSize: 11, color: 'var(--od-warning)' }}>{w}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ImportWorkspacePage;
