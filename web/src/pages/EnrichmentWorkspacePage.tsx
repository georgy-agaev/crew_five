import { useCallback, useEffect, useRef, useState } from 'react';

import {
  batchEnrichSegments,
  fetchSegments,
  type BatchEnrichSegmentResult,
} from '../apiClient';
import { getWorkspaceColors } from '../theme';
import { usePersistedState } from '../hooks/usePersistedState';
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

const ADAPTERS = ['firecrawl', 'exa', 'parallel', 'anysite', 'mock'] as const;

const RESULT_BADGE_TITLES: Record<string, string> = {
  completed: 'Enrichment completed successfully',
  queued: 'Enrichment job queued for processing',
  error: 'Enrichment failed for this segment',
};

function ResultBadge({ status }: { status: string }) {
  const cls =
    status === 'completed' ? 'od-enrich-badge--fresh'
    : status === 'queued' ? 'od-enrich-badge--stale'
    : 'od-enrich-badge--missing';
  return <span className={`od-enrich-badge ${cls}`} title={RESULT_BADGE_TITLES[status]}>{status}</span>;
}

// ============================================================
// Main component
// ============================================================

export function EnrichmentWorkspacePage({ isDark = false }: { isDark?: boolean }) {
  const [segments, setSegments] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ---- Selection ----
  const [checkedIdsArr, setCheckedIdsArr] = usePersistedState<string[]>('c5:enrichment:checked', []);
  const checkedIds = new Set(checkedIdsArr);
  const setCheckedIds = (val: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    if (typeof val === 'function') {
      setCheckedIdsArr((prev) => [...val(new Set(prev))]);
    } else {
      setCheckedIdsArr([...val]);
    }
  };

  // ---- Options ----
  const [adapter, setAdapter] = usePersistedState('c5:enrichment:adapter', 'firecrawl');
  const [runNow, setRunNow] = usePersistedState('c5:enrichment:run-now', true);
  const [dryRun, setDryRun] = usePersistedState('c5:enrichment:dry-run', false);
  const [limit, setLimit] = usePersistedState('c5:enrichment:limit', 25);

  // ---- Execution state ----
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<BatchEnrichSegmentResult[] | null>(null);

  // ---- Resizable columns ----
  const [leftWidth, setLeftWidth] = usePersistedState('c5:enrichment:left-width', 380);
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

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchSegments()
      .then((rows: any[]) => {
        if (cancelled) return;
        const mapped = rows.map((r: any) => ({ id: r.id, name: r.name ?? r.id }));
        setSegments(mapped);
        // Prune stale persisted checked ids
        const validIds = new Set(mapped.map((s) => s.id));
        setCheckedIds((prev) => {
          const pruned = new Set([...prev].filter((id) => validIds.has(id)));
          return pruned.size === prev.size ? prev : pruned;
        });
      })
      .catch((err) => { if (!cancelled) setError(err?.message ?? 'Failed to load segments'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const toggleChecked = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (checkedIds.size === segments.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(segments.map((s) => s.id)));
    }
  };

  const handleSubmit = useCallback(async () => {
    const ids = [...checkedIds];
    if (ids.length === 0) return;
    setSubmitting(true);
    setError(null);
    setResults(null);
    try {
      const response = await batchEnrichSegments({
        segmentIds: ids,
        adapter,
        runNow,
        dryRun,
        limit,
      });
      setResults(response.results);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Batch enrichment failed');
    } finally {
      setSubmitting(false);
    }
  }, [checkedIds, adapter, runNow, dryRun, limit]);

  const segmentNameById = new Map(segments.map((s) => [s.id, s.name]));

  return (
    <div className="operator-desk" style={odCssVars(isDark)}>
      <div style={{ padding: '10px 16px 0', flexShrink: 0 }}>
        <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Batch Enrichment</h1>
        <p style={{ fontSize: 12, color: 'var(--od-text-muted)', margin: '4px 0 0' }}>
          Select segments and run enrichment across them in one action.
        </p>
      </div>

      {error && <div className="od-error-banner" role="alert">{error}</div>}

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Column 1: Segment selection + options */}
        <div className="operator-desk__column" style={{ width: leftWidth, flexShrink: 0 }}>
          <div className="od-col-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={segments.length > 0 && checkedIds.size === segments.length}
                onChange={toggleAll}
                aria-label="Select all segments"
                title="Select or deselect all segments"
                style={{ width: 'auto', margin: 0, cursor: 'pointer' }}
              />
              <h2 className="od-col-title">Segments</h2>
            </div>
            <span className="od-count-chip">{checkedIds.size} / {segments.length}</span>
          </div>

          <div className="od-col-body">
            {loading && (
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[1, 2, 3].map((i) => (
                  <span key={i} className="od-skeleton" style={{ height: 14, width: '60%', display: 'block' }} />
                ))}
              </div>
            )}
            {!loading && segments.length === 0 && (
              <div className="od-empty" style={{ minHeight: 100 }}>
                <div className="od-empty__line" />
                <span className="od-empty__text">No segments found.</span>
              </div>
            )}
            {!loading && segments.map((seg) => (
              <div
                key={seg.id}
                className={`od-campaign-item${checkedIds.has(seg.id) ? ' od-campaign-item--pinned' : ''}`}
                onClick={() => toggleChecked(seg.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <input
                  type="checkbox"
                  checked={checkedIds.has(seg.id)}
                  onChange={() => toggleChecked(seg.id)}
                  onClick={(e) => e.stopPropagation()}
                  style={{ width: 'auto', margin: 0, cursor: 'pointer', flexShrink: 0 }}
                />
                <span className="od-campaign-item__name">{seg.name}</span>
              </div>
            ))}
          </div>

          {/* Options + submit */}
          <div className="od-context-block" style={{ borderTop: '1px solid var(--od-border)' }}>
            <h3 className="od-context-block__title">Options</h3>

            <div className="od-context-row">
              <span className="od-context-row__label">Adapter</span>
              <select
                className="od-search__input"
                aria-label="Adapter"
                title="Enrichment provider to use for data collection"
                value={adapter}
                onChange={(e) => setAdapter(e.target.value)}
                style={{ width: 'auto', padding: '4px 8px', fontSize: 12 }}
              >
                {ADAPTERS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            <div className="od-context-row">
              <span className="od-context-row__label">Limit per segment</span>
              <input
                type="number"
                aria-label="Limit"
                title="Maximum number of contacts to enrich per segment"
                className="od-search__input"
                value={limit}
                min={1}
                max={500}
                onChange={(e) => setLimit(Number(e.target.value) || 25)}
                style={{ width: 70, padding: '4px 8px', fontSize: 12, textAlign: 'right' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
                <input type="checkbox" checked={runNow} onChange={(e) => setRunNow(e.target.checked)} title="Execute enrichment immediately instead of queuing" style={{ width: 'auto', margin: 0 }} />
                Run now
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>
                <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} title="Preview enrichment without persisting results" style={{ width: 'auto', margin: 0 }} />
                Dry run
              </label>
            </div>

            <button
              type="button"
              className="od-btn od-btn--approve"
              disabled={checkedIds.size === 0 || submitting}
              onClick={handleSubmit}
              aria-label="Run batch enrichment"
              title="Start batch enrichment for selected segments"
              style={{ marginTop: 10, width: '100%' }}
            >
              {submitting
                ? 'Enriching...'
                : `Enrich ${checkedIds.size} segment${checkedIds.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>

        {/* Drag handle */}
        <div className="od-resize-handle" onMouseDown={handleResizeStart} />

        {/* Column 2: Results */}
        <div className="operator-desk__column" style={{ background: 'var(--od-bg)', flex: 1 }}>
          <div className="od-col-header">
            <h2 className="od-col-title">Results</h2>
            {results && <span className="od-count-chip">{results.length}</span>}
          </div>

          <div className="od-col-body">
            {!results && !submitting && (
              <div className="od-placeholder">
                <div className="od-placeholder__dash" />
                <span className="od-placeholder__text">Select segments and run enrichment to see results</span>
              </div>
            )}

            {submitting && (
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span className="od-skeleton" style={{ height: 14, width: '50%', display: 'block' }} />
                <span className="od-skeleton" style={{ height: 14, width: '70%', display: 'block' }} />
              </div>
            )}

            {results && results.map((r) => (
              <div
                key={r.segmentId}
                className="od-company-item"
                style={{ cursor: 'default' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="od-company-item__name">
                    {segmentNameById.get(r.segmentId) ?? r.segmentId}
                  </span>
                  <ResultBadge status={r.status} />
                </div>
                <div className="od-company-item__foot">
                  {r.jobId && (
                    <span className="od-count-chip" title="Job ID" style={{ fontSize: 9 }}>
                      {r.jobId}
                    </span>
                  )}
                  {r.summary?.processed != null && (
                    <span className="od-count-chip">{r.summary.processed} processed</span>
                  )}
                  {r.summary?.dryRun && (
                    <span className="od-count-chip" style={{ color: 'var(--od-warning)' }}>dry run</span>
                  )}
                </div>
                {r.status === 'error' && r.error && (
                  <div style={{ marginTop: 4, fontSize: 11, color: 'var(--od-error)' }}>
                    {r.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EnrichmentWorkspacePage;
