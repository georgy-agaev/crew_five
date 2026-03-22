import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  batchReviewDrafts,
  fetchDrafts,
  reviewDraftStatus,
  updateDraftContent,
  type DraftRow,
} from '../apiClient';
import '../pages/CampaignOperatorDesk.css';

// ============================================================
// Constants & types
// ============================================================

const STATUS_FILTERS = ['all', 'generated', 'approved', 'rejected', 'sent'] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

interface ContactGroup {
  contactId: string;
  contactName: string;
  companyName: string;
  intro: DraftRow | null;
  bump: DraftRow | null;
  all: DraftRow[];
}

// ============================================================
// Helpers
// ============================================================

const DRAFT_STATUS_TITLES: Record<string, string> = {
  generated: 'Draft generated, awaiting review',
  approved: 'Draft approved for sending',
  rejected: 'Draft rejected by reviewer',
  sent: 'Draft has been sent',
};

function DraftStatusBadge({ status }: { status?: string | null }) {
  const s = status ?? 'n/a';
  const variant =
    s === 'approved'
      ? 'ready'
      : s === 'sent'
        ? 'complete'
        : s === 'rejected'
          ? 'review'
          : s === 'generated'
            ? 'generating'
            : 'draft';
  return <span className={`od-status-badge od-status-badge--${variant}`} title={DRAFT_STATUS_TITLES[s]}>{s}</span>;
}

function getDraftReviewActions(status?: string): {
  canApprove: boolean;
  canReject: boolean;
  locked: boolean;
} {
  if (status === 'sent') return { canApprove: false, canReject: false, locked: true };
  if (status === 'approved') return { canApprove: false, canReject: true, locked: false };
  if (status === 'rejected') return { canApprove: true, canReject: false, locked: false };
  return { canApprove: true, canReject: true, locked: false };
}

function CoverageDot({ draft, label }: { draft: DraftRow | null; label: string }) {
  if (!draft) {
    return <span className="od-coverage-dot" title={`${label}: not generated`} />;
  }
  return (
    <span
      className="od-coverage-dot od-coverage-dot--filled"
      title={`${label}: ${draft.status ?? 'n/a'}`}
    />
  );
}

function CoverageLegend() {
  return (
    <div style={{
      padding: '6px 12px',
      borderBottom: '1px solid var(--od-border)',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      fontSize: 10,
      color: 'var(--od-text-muted)',
      flexShrink: 0,
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <span className="od-coverage-dot od-coverage-dot--filled" />
        draft exists
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <span className="od-coverage-dot" />
        not generated
      </span>
      <span style={{ color: 'var(--od-text-muted)', opacity: 0.7 }}>[E1 / E2]</span>
    </div>
  );
}

function groupByContact(drafts: DraftRow[]): ContactGroup[] {
  const map = new Map<string, ContactGroup>();
  for (const draft of drafts) {
    const key = draft.contact_id ?? draft.id;
    if (!map.has(key)) {
      map.set(key, {
        contactId: key,
        contactName: draft.contact_name ?? 'Unknown contact',
        companyName: draft.company_name ?? 'Unknown company',
        intro: null,
        bump: null,
        all: [],
      });
    }
    const group = map.get(key)!;
    group.all.push(draft);
    if (draft.email_type === 'bump') {
      group.bump = group.bump ?? draft;
    } else {
      group.intro = group.intro ?? draft;
    }
  }
  return Array.from(map.values());
}

// ============================================================
// Main component
// ============================================================

export function BuilderDraftReview({ campaignId }: { campaignId: string }) {
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDraftId, setSelectedDraftId] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');

  // ---- Batch selection ----
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  const toggleChecked = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAllVisible = () => {
    const nonSent = filtered.filter((d) => d.status !== 'sent');
    const allChecked = nonSent.every((d) => checkedIds.has(d.id));
    if (allChecked) {
      setCheckedIds((prev) => {
        const next = new Set(prev);
        for (const d of nonSent) next.delete(d.id);
        return next;
      });
    } else {
      setCheckedIds((prev) => {
        const next = new Set(prev);
        for (const d of nonSent) next.add(d.id);
        return next;
      });
    }
  };

  // ---- Resizable list width ----
  const [listWidth, setListWidth] = useState(280);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  const handleListResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = { startX: e.clientX, startW: listWidth };
      const onMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const delta = ev.clientX - dragRef.current.startX;
        setListWidth(Math.max(200, Math.min(500, dragRef.current.startW + delta)));
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
    },
    [listWidth]
  );

  const loadDrafts = useCallback(() => {
    setLoading(true);
    fetchDrafts(campaignId, undefined, true)
      .then((rows) => {
        setDrafts(rows);
        setSelectedDraftId((c) => c || rows[0]?.id || '');
        setCheckedIds(new Set());
      })
      .catch((err) => setError(err?.message ?? 'Failed to load drafts'))
      .finally(() => setLoading(false));
  }, [campaignId]);

  useEffect(() => { loadDrafts(); }, [loadDrafts]);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return drafts;
    return drafts.filter((d) => d.status === statusFilter);
  }, [drafts, statusFilter]);

  const contactGroups = useMemo(() => groupByContact(filtered), [filtered]);

  const selected = useMemo(
    () => filtered.find((d) => d.id === selectedDraftId) ?? filtered[0] ?? null,
    [filtered, selectedDraftId]
  );

  const counts = useMemo(() => ({
    total: drafts.length,
    generated: drafts.filter((d) => d.status === 'generated').length,
    approved: drafts.filter((d) => d.status === 'approved').length,
    rejected: drafts.filter((d) => d.status === 'rejected').length,
    sent: drafts.filter((d) => d.status === 'sent').length,
  }), [drafts]);

  // Checked IDs that are still in drafts (not stale)
  const validCheckedIds = useMemo(
    () => [...checkedIds].filter((id) => drafts.some((d) => d.id === id && d.status !== 'sent')),
    [checkedIds, drafts]
  );

  // ---- Single draft review ----
  const handleReview = async (draftId: string, status: 'approved' | 'rejected') => {
    setBusyId(draftId);
    setError(null);
    try {
      const updated = await reviewDraftStatus(draftId, { status, reviewer: 'builder-v2' });
      setDrafts((prev) => prev.map((d) => (d.id === draftId ? { ...d, ...updated } : d)));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to review draft');
    } finally {
      setBusyId(null);
    }
  };

  // ---- Batch review via backend endpoint ----
  const handleBatchAction = async (status: 'approved' | 'rejected') => {
    if (validCheckedIds.length === 0) return;
    setBatchBusy(true);
    setError(null);
    try {
      const result = await batchReviewDrafts({
        draftIds: validCheckedIds,
        status,
        reviewer: 'builder-v2',
      });
      // Apply updates from response
      const updatedMap = new Map(result.updated.map((d) => [d.id, d]));
      setDrafts((prev) =>
        prev.map((d) => {
          const upd = updatedMap.get(d.id);
          return upd ? { ...d, ...upd } : d;
        })
      );
      setCheckedIds(new Set());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Batch ${status} failed`);
    } finally {
      setBatchBusy(false);
    }
  };

  // ---- "Approve all generated" shortcut (uses batch endpoint) ----
  const handleBatchApproveGenerated = async () => {
    const generated = drafts.filter((d) => d.status === 'generated');
    if (generated.length === 0) return;
    setBatchBusy(true);
    setError(null);
    try {
      const result = await batchReviewDrafts({
        draftIds: generated.map((d) => d.id),
        status: 'approved',
        reviewer: 'builder-v2',
      });
      const updatedMap = new Map(result.updated.map((d) => [d.id, d]));
      setDrafts((prev) =>
        prev.map((d) => {
          const upd = updatedMap.get(d.id);
          return upd ? { ...d, ...upd } : d;
        })
      );
      setCheckedIds(new Set());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Batch approve failed');
    } finally {
      setBatchBusy(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selected) return;
    setBusyId(selected.id);
    setError(null);
    try {
      const updated = await updateDraftContent(selected.id, { subject: editSubject, body: editBody });
      setDrafts((prev) => prev.map((d) => (d.id === selected.id ? { ...d, ...updated } : d)));
      setEditMode(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save draft edits');
    } finally {
      setBusyId(null);
    }
  };

  const startEdit = () => {
    if (!selected) return;
    setEditSubject(selected.subject ?? '');
    setEditBody(selected.body ?? '');
    setEditMode(true);
  };

  // ---- Loading ----
  if (loading) {
    return (
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span className="od-skeleton" style={{ height: 14, width: '45%' }} />
        <span className="od-skeleton" style={{ height: 14, width: '65%' }} />
      </div>
    );
  }

  // ---- Empty ----
  if (drafts.length === 0) {
    return (
      <div className="od-empty">
        <div className="od-empty__line" />
        <span className="od-empty__text">No drafts for this campaign yet. Generate drafts via CLI or the Pipeline workspace.</span>
      </div>
    );
  }

  const nonSentVisible = filtered.filter((d) => d.status !== 'sent');
  const allVisibleChecked = nonSentVisible.length > 0 && nonSentVisible.every((d) => checkedIds.has(d.id));

  return (
    <div className="od-message-list-layout">
      {/* Summary chips + "approve all generated" shortcut */}
      <div style={{
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        flexWrap: 'wrap',
        borderBottom: '1px solid var(--od-border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="od-count-chip">{counts.total} total</span>
          <span className="od-count-chip">{counts.generated} generated</span>
          <span className="od-count-chip">{counts.approved} approved</span>
          <span className="od-count-chip">{counts.rejected} rejected</span>
          <span className="od-count-chip">{counts.sent} sent</span>
        </div>
        {counts.generated > 0 && (
          <button
            type="button"
            className="od-btn od-btn--approve"
            disabled={batchBusy || busyId !== null}
            onClick={handleBatchApproveGenerated}
            title="Approve all generated drafts in one batch action"
          >
            {batchBusy ? 'Approving...' : `Approve all generated (${counts.generated})`}
          </button>
        )}
      </div>

      {/* Status filter tabs */}
      <div className="od-filterbar">
        {STATUS_FILTERS.map((f) => {
          const tabTitles: Record<string, string> = {
            all: 'Show all drafts',
            generated: 'Show newly generated drafts',
            approved: 'Show approved drafts',
            rejected: 'Show rejected drafts',
            sent: 'Show sent drafts',
          };
          return (
            <button
              key={f}
              type="button"
              className={`tab od-filter-chip${statusFilter === f ? ' od-filter-chip--active' : ''}`}
              onClick={() => setStatusFilter(f)}
              title={tabTitles[f]}
            >
              {f}
            </button>
          );
        })}
      </div>

      {/* Batch action bar — visible when items are checked */}
      {validCheckedIds.length > 0 && (
        <div
          aria-label="Batch actions"
          style={{
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            borderBottom: '1px solid var(--od-border)',
            flexShrink: 0,
            background: 'color-mix(in srgb, var(--od-orange) 6%, transparent)',
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--od-text)', fontWeight: 600 }}>
            {validCheckedIds.length} selected
          </span>
          <button
            type="button"
            className="od-btn od-btn--approve"
            style={{ padding: '3px 10px', fontSize: 12 }}
            disabled={batchBusy}
            onClick={() => handleBatchAction('approved')}
            aria-label="Approve selected"
            title="Approve all checked drafts via batch endpoint"
          >
            {batchBusy ? 'Processing...' : 'Approve selected'}
          </button>
          <button
            type="button"
            className="od-btn od-btn--reject"
            style={{ padding: '3px 10px', fontSize: 12 }}
            disabled={batchBusy}
            onClick={() => handleBatchAction('rejected')}
            aria-label="Reject selected"
            title="Reject all checked drafts via batch endpoint"
          >
            Reject selected
          </button>
          <button
            type="button"
            className="od-btn od-btn--ghost"
            style={{ padding: '3px 10px', fontSize: 12 }}
            onClick={() => setCheckedIds(new Set())}
          >
            Clear
          </button>
        </div>
      )}

      {error && <div className="od-error-banner" role="alert">{error}</div>}

      {/* List + resize handle + detail */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Contact-grouped draft list with checkboxes */}
        <div style={{
          width: listWidth,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}>
          <div className="od-col-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={allVisibleChecked}
                onChange={toggleAllVisible}
                title="Select or deselect all visible non-sent drafts"
                aria-label="Select all visible"
                style={{ width: 'auto', margin: 0, cursor: 'pointer' }}
              />
              <h3 className="od-col-title">Drafts ({filtered.length})</h3>
            </div>
          </div>
          <CoverageLegend />
          <div className="od-col-body">
            {contactGroups.map((group) => (
              <div key={group.contactId} style={{ borderBottom: '1px solid var(--od-border)' }}>
                <div style={{ padding: '8px 12px 4px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className="od-employee-item__name" style={{ flex: 1 }}>
                    {group.contactName}
                  </span>
                  <span className="od-coverage-dots" title="Email 1 (intro) / Email 2 (bump)">
                    <CoverageDot draft={group.intro} label="Email 1 (intro)" />
                    <CoverageDot draft={group.bump} label="Email 2 (bump)" />
                  </span>
                </div>
                <div style={{ padding: '0 12px 2px', fontSize: 11, color: 'var(--od-text-muted)' }}>
                  {group.companyName}
                </div>
                {group.all.map((draft) => {
                  const isActive = draft.id === selected?.id;
                  const typeLabel = draft.email_type === 'bump' ? 'Email 2' : 'Email 1';
                  const isSent = draft.status === 'sent';
                  return (
                    <div
                      key={draft.id}
                      className={`od-message-list-item${isActive ? ' od-message-list-item--active' : ''}`}
                      onClick={() => { setSelectedDraftId(draft.id); setEditMode(false); }}
                      style={{ cursor: 'pointer', paddingLeft: 12, display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <input
                        type="checkbox"
                        checked={checkedIds.has(draft.id)}
                        disabled={isSent}
                        onChange={(e) => { e.stopPropagation(); toggleChecked(draft.id); }}
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: 'auto', margin: 0, cursor: isSent ? 'not-allowed' : 'pointer', flexShrink: 0 }}
                      />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="od-message-list-item__type" style={{ flexShrink: 0 }}>{typeLabel}</span>
                          <DraftStatusBadge status={draft.status} />
                        </div>
                        <span className="od-message-list-item__subject" style={{ fontSize: 12 }}>
                          {draft.subject ?? 'No subject'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="od-empty" style={{ minHeight: 80 }}>
                <span className="od-empty__text">No drafts match this filter.</span>
              </div>
            )}
          </div>
        </div>

        <div className="od-resize-handle" onMouseDown={handleListResizeStart} />

        {/* Draft detail */}
        <div className="od-message-detail">
          {!selected ? (
            <div className="od-placeholder">
              <div className="od-placeholder__dash" />
              <span className="od-placeholder__text">Select a draft to review.</span>
            </div>
          ) : editMode ? (
            <div className="od-message-workspace">
              <div className="od-message-card">
                <div className="od-message-card__body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--od-text-muted)', display: 'block', marginBottom: 4 }}>Subject</label>
                    <input className="od-edit-subject" value={editSubject} onChange={(e) => setEditSubject(e.target.value)} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--od-text-muted)', display: 'block', marginBottom: 4 }}>Body</label>
                    <textarea className="od-edit-body" rows={10} value={editBody} onChange={(e) => setEditBody(e.target.value)} />
                  </div>
                </div>
                <div className="od-message-card__actions">
                  <button type="button" className="od-btn od-btn--approve" disabled={busyId === selected.id} onClick={handleSaveEdit}>Save</button>
                  <button type="button" className="od-btn od-btn--ghost" onClick={() => setEditMode(false)}>Cancel</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="od-message-workspace">
              <div className="od-message-card">
                <div className="od-message-card__header">
                  <div>
                    <h3 className="od-message-subject">{selected.subject ?? 'No subject'}</h3>
                    <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <DraftStatusBadge status={selected.status} />
                      <span className="od-status-badge od-status-badge--draft">
                        {selected.email_type === 'bump' ? 'Email 2' : 'Email 1'}
                      </span>
                      {selected.pattern_mode && (
                        <span className="od-status-badge od-status-badge--draft">{selected.pattern_mode}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="od-message-card__body">
                  <p className="od-message-body-text">{selected.body ?? 'No body generated yet.'}</p>
                </div>
                <div className="od-message-card__meta">
                  {selected.pattern_mode && (
                    <div className="od-message-meta-item">
                      <span className="od-message-meta-label">Pattern</span>
                      <span className="od-message-meta-value">{selected.pattern_mode}</span>
                    </div>
                  )}
                  <div className="od-message-meta-item">
                    <span className="od-message-meta-label">Recipient</span>
                    <span className="od-message-meta-value">
                      {selected.contact_name ?? 'Unknown contact'} / {selected.company_name ?? 'Unknown company'}
                    </span>
                  </div>
                  <div className="od-message-meta-item">
                    <span className="od-message-meta-label">Email</span>
                    <span className="od-message-meta-value">{selected.recipient_email ?? 'Missing recipient'}</span>
                  </div>
                </div>
                <div className="od-message-card__actions">
                  {(() => {
                    const actions = getDraftReviewActions(selected.status);
                    if (actions.locked) {
                      return <span className="od-sent-lock">Sent drafts are locked.</span>;
                    }
                    return (
                      <>
                        {actions.canApprove && (
                          <button type="button" className="od-btn od-btn--approve" disabled={busyId !== null} onClick={() => handleReview(selected.id, 'approved')}>Approve</button>
                        )}
                        {actions.canReject && (
                          <button type="button" className="od-btn od-btn--reject" disabled={busyId !== null} onClick={() => handleReview(selected.id, 'rejected')}>Reject</button>
                        )}
                        <button type="button" className="od-btn od-btn--ghost" onClick={startEdit}>Edit</button>
                      </>
                    );
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BuilderDraftReview;
