import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { fetchInboxReplies, markInboxReplyHandled, markInboxReplyUnhandled, triggerInboxPoll, type InboxReply } from '../apiClient';
import { getWorkspaceColors } from '../theme';
import { usePersistedState } from '../hooks/usePersistedState';
import './CampaignOperatorDesk.css';

// ============================================================
// Constants & types
// ============================================================

const REPLY_LABELS = ['all', 'positive', 'negative', 'bounce', 'unclassified'] as const;
type ReplyLabelFilter = (typeof REPLY_LABELS)[number];
type ReplySummaryCounts = Record<ReplyLabelFilter, number>;

// ============================================================
// Helpers
// ============================================================

function odCssVars(isDark: boolean): React.CSSProperties {
  const c = getWorkspaceColors(isDark);
  return {
    '--od-bg': c.bg,
    '--od-card': c.card,
    '--od-card-hover': c.cardHover,
    '--od-text': c.text,
    '--od-text-muted': c.textMuted,
    '--od-border': c.border,
    '--od-orange': c.orange,
    '--od-orange-light': c.orangeLight,
    '--od-sidebar': c.sidebar,
    '--od-success': c.success,
    '--od-warning': c.warning,
    '--od-error': c.error,
  } as React.CSSProperties;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase();
}

function matchesSearch(reply: InboxReply, query: string): boolean {
  if (!query) return true;
  const haystack = [
    reply.contact_name,
    reply.company_name,
    reply.subject,
    reply.reply_text,
    reply.recipient_email,
  ]
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

function buildReplySummary(replies: InboxReply[]): ReplySummaryCounts {
  const summary: ReplySummaryCounts = {
    all: replies.length,
    positive: 0,
    negative: 0,
    bounce: 0,
    unclassified: 0,
  };

  for (const reply of replies) {
    const label = reply.reply_label ?? 'unclassified';
    if (label === 'positive' || label === 'negative' || label === 'bounce') {
      summary[label] += 1;
      continue;
    }
    summary.unclassified += 1;
  }

  return summary;
}

const LABEL_BADGE_TITLES: Record<string, string> = {
  positive: 'Recipient expressed interest',
  negative: 'Recipient declined',
  bounce: 'Email bounced — address invalid or mailbox full',
  bounced: 'Email bounced — address invalid or mailbox full',
  unsubscribed: 'Recipient unsubscribed from further emails',
  unclassified: 'Reply not yet classified',
};

function LabelBadge({ label, eventType }: { label: string | null; eventType?: string }) {
  // Fall back to event_type when reply_label is null (e.g. bounced events)
  const s = label ?? (eventType === 'bounced' ? 'bounce' : eventType === 'unsubscribed' ? 'unsubscribed' : 'unclassified');
  const variant =
    s === 'positive'
      ? 'ready'
      : s === 'negative'
        ? 'review'
        : s === 'bounce' || s === 'bounced'
          ? 'generating'
          : s === 'unsubscribed'
            ? 'review'
            : 'draft';
  return <span className={`od-status-badge od-status-badge--${variant}`} title={LABEL_BADGE_TITLES[s] ?? `Reply event: ${s}`}>{s}</span>;
}

// ============================================================
// Main component
// ============================================================

export function InboxWorkspacePage({ isDark = false }: { isDark?: boolean }) {
  const [replies, setReplies] = useState<InboxReply[]>([]);
  const [selectedReplyId, setSelectedReplyId] = usePersistedState('c5:inbox-v2:reply', '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [labelFilter, setLabelFilter] = usePersistedState<ReplyLabelFilter>('c5:inbox-v2:label-filter', 'all');
  const [campaignFilter, setCampaignFilter] = usePersistedState('c5:inbox-v2:campaign-filter', 'all');
  const [searchQuery, setSearchQuery] = usePersistedState('c5:inbox-v2:search', '');
  const [handledFilter, setHandledFilter] = usePersistedState<'all' | 'unhandled' | 'handled'>('c5:inbox-v2:handled-filter', 'unhandled');
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // ---- Poll state ----
  type PollStatus = 'idle' | 'submitting' | 'success' | 'unavailable' | 'error';
  const [pollStatus, setPollStatus] = useState<PollStatus>('idle');
  const [pollMessage, setPollMessage] = useState<string | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePollNow = useCallback(async () => {
    setPollStatus('submitting');
    setPollMessage(null);
    try {
      const result = await triggerInboxPoll();
      setPollStatus('success');
      setPollMessage(
        result.accepted === false
          ? 'Outreach acknowledged the request but is not processing right now.'
          : 'Polling requested. New replies will appear after Outreach processes the inbox.'
      );
      // Best-effort: reload replies after a short delay
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      pollTimerRef.current = setTimeout(() => {
        setReloadKey((k) => k + 1);
      }, 5000);
    } catch (err: unknown) {
      const apiError = (err as any)?.apiError;
      if (apiError?.statusCode === 501) {
        setPollStatus('unavailable');
        setPollMessage('Inbox polling is not configured. Set OUTREACH_PROCESS_REPLIES_URL or OUTREACH_API_BASE on the server.');
      } else {
        setPollStatus('error');
        // Prefer the technical API message over the generic user-friendly one
        const technicalMessage = apiError?.message ?? (err instanceof Error ? err.message : null);
        setPollMessage(technicalMessage || 'Failed to trigger inbox poll.');
      }
    }
  }, []);

  // ---- Handle/unhandle reply ----
  const handleToggleHandled = useCallback(async (replyId: string, currentlyHandled: boolean) => {
    setActionBusyId(replyId);
    setError(null);
    try {
      if (currentlyHandled) {
        await markInboxReplyUnhandled(replyId);
      } else {
        await markInboxReplyHandled(replyId, 'operator');
      }
      // Update local state
      setReplies((prev) => prev.map((r) =>
        r.id === replyId
          ? { ...r, handled: !currentlyHandled, handled_at: currentlyHandled ? null : new Date().toISOString(), handled_by: currentlyHandled ? null : 'operator' }
          : r
      ));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update reply state');
    } finally {
      setActionBusyId(null);
    }
  }, []);

  // Clean up timer
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  // ---- Resizable list column ----
  const [listWidth, setListWidth] = usePersistedState('c5:inbox-v2:list-width', 320);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  const handleListResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = { startX: e.clientX, startW: listWidth };

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const delta = ev.clientX - dragRef.current.startX;
        setListWidth(Math.max(220, Math.min(500, dragRef.current.startW + delta)));
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

  useEffect(() => {
    let cancelled = false;
    const opts: { limit: number; replyLabel?: string; handled?: boolean } = { limit: 50 };
    if (labelFilter !== 'all') opts.replyLabel = labelFilter;
    if (handledFilter === 'unhandled') opts.handled = false;
    else if (handledFilter === 'handled') opts.handled = true;

    fetchInboxReplies(opts)
      .then((view) => {
        if (cancelled) return;
        setReplies(view.replies);
        setSelectedReplyId((current) => {
          if (current && view.replies.some((r) => r.id === current)) return current;
          return view.replies[0]?.id || '';
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load inbox replies');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [labelFilter, handledFilter, reloadKey]);

  const campaignNames = useMemo(() => {
    const names = new Set<string>();
    for (const r of replies) {
      if (r.campaign_name) names.add(r.campaign_name);
    }
    return Array.from(names).sort();
  }, [replies]);

  const filteredReplies = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(searchQuery);
    return replies.filter((reply) => {
      if (campaignFilter !== 'all' && reply.campaign_name !== campaignFilter) return false;
      return matchesSearch(reply, normalizedQuery);
    });
  }, [replies, campaignFilter, searchQuery]);

  const replySummary = useMemo(() => buildReplySummary(replies), [replies]);
  const hasLocalFilters = campaignFilter !== 'all' || normalizeSearchValue(searchQuery).length > 0;

  const selectedReply = useMemo(
    () => filteredReplies.find((r) => r.id === selectedReplyId) ?? filteredReplies[0] ?? null,
    [filteredReplies, selectedReplyId]
  );

  return (
    <div className="operator-desk" style={odCssVars(isDark)}>
      <div style={{ padding: '10px 16px 0', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Inbox V2</h1>
        <button
          type="button"
          className="od-btn od-btn--ghost"
          disabled={pollStatus === 'submitting'}
          onClick={handlePollNow}
          aria-label="Poll now"
          title="Trigger Outreach inbox polling. New replies will appear after processing."
          style={{ padding: '4px 10px', fontSize: 12 }}
        >
          {pollStatus === 'submitting' ? 'Polling...' : 'Poll now'}
        </button>
        {pollMessage && (
          <span
            aria-live="polite"
            style={{
              fontSize: 11,
              color: pollStatus === 'success'
                ? 'var(--od-success)'
                : pollStatus === 'unavailable'
                  ? 'var(--od-warning)'
                  : pollStatus === 'error'
                    ? 'var(--od-error)'
                    : 'var(--od-text-muted)',
            }}
          >
            {pollMessage}
          </span>
        )}
      </div>

      {/* Label filter bar */}
      <div className="od-filterbar">
        {REPLY_LABELS.map((label) => {
          const filterTitles: Record<string, string> = {
            all: 'Show all reply types',
            positive: 'Show positive/interested replies',
            negative: 'Show negative/decline replies',
            bounce: 'Show bounced emails',
            unclassified: 'Show replies without classification',
          };
          return (
            <button
              key={label}
              type="button"
              className={`od-filter-chip${labelFilter === label ? ' od-filter-chip--active' : ''}`}
              onClick={() => {
                setLoading(true);
                setLabelFilter(label);
                setCampaignFilter('all');
              }}
              title={filterTitles[label]}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Handled filter bar */}
      <div className="od-filterbar">
        {(['unhandled', 'handled', 'all'] as const).map((h) => {
          const handledTitles: Record<string, string> = {
            all: 'Show all replies regardless of handled state',
            unhandled: 'Show replies needing attention',
            handled: 'Show replies already processed',
          };
          return (
            <button
              key={h}
              type="button"
              className={`od-filter-chip${handledFilter === h ? ' od-filter-chip--active' : ''}`}
              onClick={() => { setLoading(true); setHandledFilter(h); }}
              title={handledTitles[h]}
            >
              {h}
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '6px 12px',
          borderBottom: '1px solid var(--od-border)',
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        {REPLY_LABELS.map((label) => (
          <span
            key={`summary-${label}`}
            aria-label={`Loaded ${label} replies`}
            title={`Loaded ${label} replies`}
            className="od-count-chip"
          >
            {label}: {replySummary[label]}
          </span>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 8,
          padding: '6px 12px',
          borderBottom: '1px solid var(--od-border)',
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        <input
          aria-label="Search replies"
          title="Search by contact, company, subject, or reply text"
          className="od-search__input"
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search contact, company, subject, or reply"
          style={{ flex: '1 1 280px' }}
        />
        {campaignNames.length > 1 && (
          <select
            aria-label="Campaign filter"
            title="Filter replies by campaign"
            className="od-search__input"
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
            style={{ flex: '0 0 220px' }}
          >
            <option value="all">All campaigns</option>
            {campaignNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        )}
      </div>

      {error && <div className="od-error-banner" role="alert">{error}</div>}

      {/* Loading */}
      {loading && (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="od-skeleton" style={{ height: 18, width: '55%' }} />
          <span className="od-skeleton" style={{ height: 14, width: '35%' }} />
          <span className="od-skeleton" style={{ height: 14, width: '70%' }} />
        </div>
      )}

      {/* Empty */}
      {!loading && filteredReplies.length === 0 && (
        <div className="od-empty">
          <div className="od-empty__line" />
          <span className="od-empty__text">
            {hasLocalFilters
              ? 'No replies match the current filters.'
              : 'No replies yet. Replies appear here after Outreach processes inbox events.'}
          </span>
        </div>
      )}

      {/* Two-column reply list + drag handle + detail */}
      {!loading && filteredReplies.length > 0 && (
        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          {/* Reply list */}
          <div className="operator-desk__column" style={{ width: listWidth, flexShrink: 0 }}>
            <div className="od-col-header">
              <h2 className="od-col-title">Replies</h2>
              <span className="od-count-chip">{filteredReplies.length}</span>
            </div>
            <div className="od-col-body">
              {filteredReplies.map((reply) => (
                <button
                  key={reply.id}
                  type="button"
                  className={`od-message-list-item${reply.id === selectedReply?.id ? ' od-message-list-item--active' : ''}`}
                  onClick={() => setSelectedReplyId(reply.id)}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--od-border)',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    display: 'block',
                    boxShadow: 'none',
                    borderRadius: 0,
                    transform: 'none',
                    color: 'inherit',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="od-message-list-item__subject">
                      {reply.contact_name ?? reply.recipient_email ?? reply.id}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--od-text-muted)', flexShrink: 0, marginLeft: 6 }}>
                      {timeAgo(reply.occurred_at)}
                    </span>
                  </div>
                  <div className="od-message-list-item__meta">
                    <span className="od-message-list-item__type">
                      {reply.company_name ?? 'Unknown company'}
                    </span>
                    <LabelBadge label={reply.reply_label} eventType={reply.event_type} />
                    {reply.handled && (
                      <span className="od-send-dot od-send-dot--ok" title="Handled" style={{ width: 6, height: 6 }} />
                    )}
                  </div>
                  <div style={{
                    marginTop: 3,
                    fontSize: 11,
                    color: 'var(--od-text-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {reply.reply_text?.slice(0, 80) ?? 'No reply text captured'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Drag handle */}
          <div className="od-resize-handle" onMouseDown={handleListResizeStart} />

          {/* Reply detail */}
          <div className="operator-desk__column" style={{ background: 'var(--od-bg)', flex: 1 }}>
            {selectedReply ? (
              <div className="od-message-workspace">
                <div className="od-message-card">
                  <div className="od-message-card__header">
                    <div>
                      <h3 className="od-message-subject">
                        {selectedReply.contact_name ?? 'Unknown contact'}
                      </h3>
                      <div style={{ marginTop: 4, fontSize: 12, color: 'var(--od-text-muted)' }}>
                        {selectedReply.company_name ?? 'Unknown company'}
                        {selectedReply.contact_position ? ` / ${selectedReply.contact_position}` : ''}
                      </div>
                    </div>
                    <LabelBadge label={selectedReply.reply_label} eventType={selectedReply.event_type} />
                  </div>

                  <div className="od-message-card__meta">
                    <div className="od-message-meta-item">
                      <span className="od-message-meta-label">Campaign</span>
                      <span className="od-message-meta-value">Campaign: {selectedReply.campaign_name ?? 'Unknown'}</span>
                    </div>
                    <div className="od-message-meta-item">
                      <span className="od-message-meta-label">Subject</span>
                      <span className="od-message-meta-value">{selectedReply.subject ?? 'No subject'}</span>
                    </div>
                    {selectedReply.draft_email_type && (
                      <div className="od-message-meta-item">
                        <span className="od-message-meta-label">Type</span>
                        <span className="od-message-meta-value">{selectedReply.draft_email_type}</span>
                      </div>
                    )}
                    {selectedReply.draft_status && (
                      <div className="od-message-meta-item">
                        <span className="od-message-meta-label">Status</span>
                        <span className="od-message-meta-value">{selectedReply.draft_status}</span>
                      </div>
                    )}
                  </div>

                  <div className="od-message-card__body">
                    <p className="od-message-body-text">
                      {selectedReply.reply_text ?? 'No reply text captured'}
                    </p>
                  </div>

                  {selectedReply.occurred_at && (
                    <div style={{
                      padding: '8px 16px',
                      borderTop: '1px solid var(--od-border)',
                      fontSize: 11,
                      color: 'var(--od-text-muted)',
                    }}>
                      Received: {new Date(selectedReply.occurred_at).toLocaleString()}
                    </div>
                  )}

                  {/* Handled state + action */}
                  <div style={{
                    padding: '8px 16px',
                    borderTop: '1px solid var(--od-border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    {selectedReply.handled ? (
                      <span className="od-enrich-badge od-enrich-badge--fresh" title="This reply has been processed by the operator">
                        handled
                      </span>
                    ) : (
                      <span className="od-enrich-badge od-enrich-badge--stale" title="This reply needs operator attention">
                        unhandled
                      </span>
                    )}
                    {selectedReply.handled && selectedReply.handled_by && (
                      <span style={{ fontSize: 10, color: 'var(--od-text-muted)' }}>
                        by {selectedReply.handled_by}
                      </span>
                    )}
                    <button
                      type="button"
                      className="od-btn od-btn--ghost"
                      style={{ padding: '3px 10px', fontSize: 11, marginLeft: 'auto' }}
                      disabled={actionBusyId === selectedReply.id}
                      onClick={() => handleToggleHandled(selectedReply.id, !!selectedReply.handled)}
                      aria-label={selectedReply.handled ? 'Mark unhandled' : 'Mark handled'}
                      title={selectedReply.handled ? 'Move back to unhandled queue' : 'Mark as processed — remove from active queue'}
                    >
                      {actionBusyId === selectedReply.id ? '...' : selectedReply.handled ? 'Mark unhandled' : 'Mark handled'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="od-placeholder">
                <div className="od-placeholder__dash" />
                <span className="od-placeholder__text">Select a reply to inspect its detail.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default InboxWorkspacePage;
