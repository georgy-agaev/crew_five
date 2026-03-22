import { useCallback, useEffect, useRef, useState } from 'react';

import {
  fetchCampaigns,
  fetchCampaignMailboxAssignment,
  fetchCampaignMailboxSummary,
  fetchMailboxes,
  updateCampaignMailboxAssignment,
  type Campaign,
  type CampaignMailboxAssignment,
  type CampaignMailboxSummary,
  type MailboxRow,
} from '../apiClient';
import { getWorkspaceColors } from '../theme';
import { usePersistedState } from '../hooks/usePersistedState';
import './CampaignOperatorDesk.css';

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

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

type AlignmentStatus = 'no-plan' | 'planned-not-sent' | 'aligned' | 'mismatch';

function deriveAlignment(
  assignment: CampaignMailboxAssignment | null,
  observed: CampaignMailboxSummary | null
): AlignmentStatus {
  const hasPlanned = (assignment?.assignments.length ?? 0) > 0;
  const hasObserved = (observed?.mailboxes.length ?? 0) > 0;
  if (!hasPlanned) return 'no-plan';
  if (!hasObserved) return 'planned-not-sent';
  const plannedSet = new Set(assignment!.assignments.map((a) => a.senderIdentity));
  const observedSet = new Set(observed!.mailboxes.map((m) => m.senderIdentity));
  if (plannedSet.size !== observedSet.size) return 'mismatch';
  for (const s of plannedSet) { if (!observedSet.has(s)) return 'mismatch'; }
  return 'aligned';
}

const ALIGNMENT_TITLES: Record<AlignmentStatus, string> = {
  'no-plan': 'No sender identities assigned. Campaign cannot transition to sending.',
  'planned-not-sent': 'Sender identities are planned but no emails have been sent yet.',
  'aligned': 'Planned sender set matches observed outbound usage.',
  'mismatch': 'Observed outbound usage differs from planned sender set.',
};

function AlignmentBadge({ status }: { status: AlignmentStatus }) {
  if (status === 'no-plan') return <span className="od-enrich-badge od-enrich-badge--missing" title={ALIGNMENT_TITLES['no-plan']}>no plan — sending blocked</span>;
  if (status === 'planned-not-sent') return <span className="od-enrich-badge od-enrich-badge--stale" title={ALIGNMENT_TITLES['planned-not-sent']}>planned, not sent yet</span>;
  if (status === 'aligned') return <span className="od-enrich-badge od-enrich-badge--fresh" title={ALIGNMENT_TITLES['aligned']}>aligned</span>;
  return <span className="od-enrich-badge od-enrich-badge--stale" title={ALIGNMENT_TITLES['mismatch']}>mismatch — observed differs from plan</span>;
}

// ============================================================
// Main component
// ============================================================

export function MailboxesWorkspacePage({ isDark = false }: { isDark?: boolean }) {
  const [mailboxes, setMailboxes] = useState<MailboxRow[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedCampaignId, setSelectedCampaignId] = usePersistedState('c5:mailboxes:campaign', '');
  const [assignment, setAssignment] = useState<CampaignMailboxAssignment | null>(null);
  const [observed, setObserved] = useState<CampaignMailboxSummary | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);

  // ---- Edit state ----
  const [editing, setEditing] = useState(false);
  const [editRows, setEditRows] = useState<Array<{ senderIdentity: string; mailboxAccountId: string; provider: string }>>([]);

  // ---- Resizable ----
  const [listWidth, setListWidth] = usePersistedState('c5:mailboxes:list-width', 340);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startW: listWidth };
    const onMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setListWidth(Math.max(240, Math.min(600, dragRef.current.startW + (ev.clientX - dragRef.current.startX))));
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
  }, [listWidth]);

  // ---- Fetch campaign detail (planned + observed) ----
  const fetchDetail = useCallback(async (campaignId: string) => {
    if (!campaignId) { setAssignment(null); setObserved(null); return; }
    setLoadingDetail(true);
    setError(null);
    try {
      const [assignResult, observedResult] = await Promise.all([
        fetchCampaignMailboxAssignment(campaignId).catch(() => null),
        fetchCampaignMailboxSummary(campaignId).catch(() => null),
      ]);
      setAssignment(assignResult);
      setObserved(observedResult);
    } catch {
      setError('Failed to load campaign mailbox data');
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  // ---- Initial load ----
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchMailboxes().catch(() => [] as MailboxRow[]),
      fetchCampaigns().catch(() => [] as Campaign[]),
    ]).then(([mboxRows, campRows]) => {
      if (cancelled) return;
      setMailboxes(mboxRows);
      setCampaigns(campRows);
      // Validate persisted campaign outside setter to avoid side effects in updater
      const restoredId = selectedCampaignId;
      if (restoredId && campRows.some((c) => c.id === restoredId)) {
        fetchDetail(restoredId);
      } else if (restoredId) {
        setSelectedCampaignId('');
        setAssignment(null);
        setObserved(null);
      }
    }).catch((err) => {
      if (!cancelled) setError(err?.message ?? 'Failed to load');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const handleCampaignSelect = useCallback((campaignId: string) => {
    setSelectedCampaignId(campaignId);
    setEditing(false);
    fetchDetail(campaignId);
  }, [fetchDetail]);

  // ---- Edit / save planned assignment ----
  const startEditing = () => {
    setEditRows(
      assignment?.assignments.map((a) => ({
        senderIdentity: a.senderIdentity,
        mailboxAccountId: a.mailboxAccountId,
        provider: a.provider,
      })) ?? []
    );
    setEditing(true);
  };

  const addEditRow = () => {
    setEditRows((prev) => [...prev, { senderIdentity: '', mailboxAccountId: '', provider: 'imap_mcp' }]);
  };

  const removeEditRow = (idx: number) => {
    setEditRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateEditRow = (idx: number, field: string, value: string) => {
    setEditRows((prev) => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const handleSave = async () => {
    if (!selectedCampaignId) return;
    const valid = editRows.filter((r) => r.senderIdentity.trim());
    setSaving(true);
    setError(null);
    try {
      const result = await updateCampaignMailboxAssignment(selectedCampaignId, {
        assignments: valid.map((r) => ({
          senderIdentity: r.senderIdentity.trim(),
          mailboxAccountId: r.mailboxAccountId.trim() || r.senderIdentity.trim(),
          provider: r.provider || 'imap_mcp',
        })),
        source: 'web-ui',
      });
      setAssignment(result);
      setEditing(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save assignment');
    } finally {
      setSaving(false);
    }
  };

  const alignment = deriveAlignment(assignment, observed);

  return (
    <div className="operator-desk" style={odCssVars(isDark)}>
      <div style={{ padding: '10px 16px 0', flexShrink: 0 }}>
        <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Mailboxes</h1>
        <p style={{ fontSize: 12, color: 'var(--od-text-muted)', margin: '4px 0 0' }}>
          Campaign sender planning + observed outbound usage.
        </p>
      </div>

      {error && <div className="od-error-banner" role="alert">{error}</div>}

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Column 1: Campaigns + global mailbox inventory */}
        <div className="operator-desk__column" style={{ width: listWidth, flexShrink: 0 }}>
          <div className="od-col-header">
            <h2 className="od-col-title">Campaigns</h2>
            <span className="od-count-chip">{campaigns.length}</span>
          </div>

          <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--od-border)', flexShrink: 0 }}>
            <select
              className="od-search__input"
              aria-label="Select campaign"
              title="Select a campaign to view and manage sender plan"
              value={selectedCampaignId}
              onChange={(e) => handleCampaignSelect(e.target.value)}
            >
              <option value="">Select a campaign...</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Global mailbox inventory */}
          <div className="od-col-header" style={{ borderTop: '1px solid var(--od-border)' }}>
            <h2 className="od-col-title">Active mailboxes</h2>
            <span className="od-count-chip">{mailboxes.length}</span>
          </div>
          <div className="od-col-body">
            {loading && (
              <div style={{ padding: 12 }}>
                <span className="od-skeleton" style={{ height: 14, width: '60%', display: 'block' }} />
                <span className="od-skeleton" style={{ height: 10, width: '40%', display: 'block', marginTop: 4 }} />
              </div>
            )}
            {!loading && mailboxes.length === 0 && (
              <div className="od-empty" style={{ minHeight: 80 }}>
                <span className="od-empty__text">No mailboxes in outbound ledger yet.</span>
              </div>
            )}
            {!loading && mailboxes.map((mbox) => (
              <div key={mbox.mailboxAccountId} className="od-company-item" style={{ cursor: 'default' }}>
                <span className="od-company-item__name">{mbox.senderIdentity}</span>
                <div className="od-company-item__foot">
                  <span className="od-count-chip">{mbox.provider}</span>
                  <span className="od-count-chip">{mbox.campaignCount} campaigns</span>
                  <span className="od-count-chip">{mbox.outboundCount} sent</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="od-resize-handle" onMouseDown={handleResizeStart} />

        {/* Column 2: Campaign detail — planned + observed + alignment */}
        <div className="operator-desk__column" style={{ background: 'var(--od-bg)', flex: 1 }}>
          {!selectedCampaignId ? (
            <div className="od-placeholder">
              <div className="od-placeholder__dash" />
              <span className="od-placeholder__text">Select a campaign to manage sender plan</span>
            </div>
          ) : loadingDetail ? (
            <div style={{ padding: 16 }}>
              <span className="od-skeleton" style={{ height: 14, width: '50%', display: 'block' }} />
              <span className="od-skeleton" style={{ height: 14, width: '70%', display: 'block', marginTop: 8 }} />
            </div>
          ) : (
            <div className="od-col-body">
              {/* Alignment status */}
              <div className="od-context-block">
                <h3 className="od-context-block__title">Status</h3>
                <AlignmentBadge status={alignment} />
                {alignment === 'no-plan' && (
                  <div style={{ marginTop: 6, fontSize: 11, color: 'var(--od-warning)' }}>
                    Assign at least one sender identity before moving campaign to sending.
                  </div>
                )}
              </div>

              {/* Planned sender set */}
              <div className="od-context-block" style={{ borderTop: '1px solid var(--od-border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className="od-context-block__title">Planned sender set</h3>
                  {!editing && (
                    <button type="button" className="od-btn od-btn--ghost" style={{ padding: '2px 8px', fontSize: 11 }} onClick={startEditing} title="Edit the planned sender identity set for this campaign">
                      Edit
                    </button>
                  )}
                </div>

                {!editing && (assignment?.assignments.length ?? 0) === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--od-text-muted)', padding: '6px 0' }}>
                    No sender identities assigned yet.
                  </div>
                )}

                {!editing && assignment?.assignments.map((a) => (
                  <div key={a.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--od-border)' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--od-text)' }}>{a.senderIdentity}</span>
                    <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                      <span className="od-count-chip" style={{ fontSize: 9 }}>{a.provider}</span>
                      {a.source && <span className="od-count-chip" style={{ fontSize: 9 }}>via {a.source}</span>}
                      <span style={{ fontSize: 10, color: 'var(--od-text-muted)' }}>{formatDate(a.assignedAt)}</span>
                    </div>
                  </div>
                ))}

                {!editing && assignment?.summary && assignment.summary.assignmentCount > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                    <span className="od-count-chip">{assignment.summary.assignmentCount} sender{assignment.summary.assignmentCount !== 1 ? 's' : ''}</span>
                    <span className="od-count-chip">{assignment.summary.domainCount} domain{assignment.summary.domainCount !== 1 ? 's' : ''}</span>
                    {assignment.summary.domains.map((d) => (
                      <span key={d} className="od-count-chip" style={{ fontSize: 9 }}>{d}</span>
                    ))}
                  </div>
                )}

                {/* Edit mode */}
                {editing && (
                  <div style={{ marginTop: 8 }}>
                    {editRows.map((row, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                        <input
                          className="od-search__input"
                          placeholder="sender@domain.com"
                          aria-label={`Sender identity ${idx + 1}`}
                          value={row.senderIdentity}
                          onChange={(e) => updateEditRow(idx, 'senderIdentity', e.target.value)}
                          style={{ flex: 1, padding: '4px 8px', fontSize: 12 }}
                        />
                        <input
                          className="od-search__input"
                          placeholder="mailbox id (optional)"
                          value={row.mailboxAccountId}
                          onChange={(e) => updateEditRow(idx, 'mailboxAccountId', e.target.value)}
                          style={{ flex: 1, padding: '4px 8px', fontSize: 12 }}
                        />
                        <button type="button" className="od-btn od-btn--ghost" style={{ padding: '2px 6px', fontSize: 11, color: 'var(--od-error)' }} onClick={() => removeEditRow(idx)}>
                          x
                        </button>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <button type="button" className="od-btn od-btn--ghost" style={{ padding: '3px 10px', fontSize: 11 }} onClick={addEditRow} title="Add another sender identity to the planned set">
                        + Add sender
                      </button>
                      <button type="button" className="od-btn od-btn--approve" style={{ padding: '3px 10px', fontSize: 11 }} disabled={saving} onClick={handleSave} aria-label="Save assignment" title="Replace the entire planned sender set with current entries">
                        {saving ? 'Saving...' : 'Save'}
                      </button>
                      <button type="button" className="od-btn od-btn--ghost" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => setEditing(false)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Observed outbound usage */}
              <div className="od-context-block" style={{ borderTop: '1px solid var(--od-border)' }}>
                <h3 className="od-context-block__title">Observed usage (outbound ledger)</h3>

                {(observed?.mailboxes.length ?? 0) === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--od-text-muted)', padding: '6px 0' }}>
                    No outbound records yet. Observed usage appears after real sends.
                  </div>
                )}

                {observed?.mailboxes.map((mbox) => (
                  <div key={mbox.mailboxAccountId} style={{ padding: '6px 0', borderBottom: '1px solid var(--od-border)' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--od-text)' }}>{mbox.senderIdentity}</span>
                    <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                      <span className="od-count-chip">{mbox.outboundCount} sent</span>
                      {mbox.lastSentAt && (
                        <span style={{ fontSize: 10, color: 'var(--od-text-muted)' }}>last: {formatDate(mbox.lastSentAt)}</span>
                      )}
                    </div>
                  </div>
                ))}

                {observed?.consistency && !observed.consistency.consistent && (
                  <div style={{ marginTop: 6, fontSize: 11, color: 'var(--od-warning)' }}>
                    Multiple mailbox accounts observed. Check if intentional.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default MailboxesWorkspacePage;
