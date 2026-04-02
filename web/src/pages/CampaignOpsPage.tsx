import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  fetchCampaignAudit,
  fetchCampaignCompanies,
  fetchCampaigns,
  fetchDrafts,
  fetchCampaignEvents,
  fetchCampaignOutbounds,
  reviewDraftStatus,
  type Campaign,
  type CampaignAuditView,
  type CampaignEvent,
  type CampaignCompaniesView,
  type CampaignCompany,
  type CampaignOutbound,
  type DraftRow,
} from '../apiClient';
import { CampaignAuditPanel } from '../components/CampaignAuditPanel';
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

function StatusBadge({ status }: { status?: string }) {
  if (!status) return <span className="od-status-badge od-status-badge--draft">n/a</span>;
  return <span className={`od-status-badge od-status-badge--${status}`}>{status}</span>;
}

function truncate(s: string, len: number) {
  return s.length > len ? s.slice(0, len) + '...' : s;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

type LedgerTab = 'drafts' | 'outbounds' | 'events';

export function getCampaignCompanyResearchStatus(company: CampaignCompany): 'enriched' | 'missing' {
  return company.company_research ? 'enriched' : 'missing';
}

export function formatEnrichmentStateLabel(state: CampaignCompany['enrichment']['status']): string {
  return state;
}

export function summarizeCampaignCompanies(view: CampaignCompaniesView) {
  const companyCount = view.companies.length;
  const contactCount = view.companies.reduce((sum, company) => sum + company.contact_count, 0);
  const enrichedCount = view.companies.filter((company) => getCampaignCompanyResearchStatus(company) === 'enriched').length;
  const missingResearchCount = companyCount - enrichedCount;
  const freshCount = view.companies.filter((company) => company.enrichment.status === 'fresh').length;
  const staleCount = view.companies.filter((company) => company.enrichment.status === 'stale').length;

  return {
    companyCount,
    contactCount,
    enrichedCount,
    missingResearchCount,
    freshCount,
    staleCount,
  };
}

// ============================================================
// Main
// ============================================================

export function CampaignOpsPage({ isDark = false }: { isDark?: boolean }) {
  // ---- State ----
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState('');
  const [companiesView, setCompaniesView] = useState<CampaignCompaniesView | null>(null);
  const [auditView, setAuditView] = useState<CampaignAuditView | null>(null);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [outbounds, setOutbounds] = useState<CampaignOutbound[]>([]);
  const [events, setEvents] = useState<CampaignEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [ledgerTab, setLedgerTab] = useState<LedgerTab>('drafts');
  const [selectedItemId, setSelectedItemId] = useState('');

  // ---- Resizable columns ----
  const [colWidths, setColWidths] = useState([280, 400]);
  const dragRef = useRef<{ colIndex: number; startX: number; startWidths: number[] } | null>(null);

  const handleResizeStart = useCallback(
    (colIndex: number, e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = { colIndex, startX: e.clientX, startWidths: [...colWidths] };
      const onMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const delta = ev.clientX - dragRef.current.startX;
        const next = [...dragRef.current.startWidths];
        next[colIndex] = Math.max(200, dragRef.current.startWidths[colIndex] + delta);
        setColWidths(next);
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
    [colWidths]
  );

  // ---- Load campaigns ----
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchCampaigns()
      .then((rows) => {
        if (cancelled) return;
        setCampaigns(rows);
        setSelectedCampaignId((c) => c || rows[0]?.id || '');
      })
      .catch((err) => { if (!cancelled) setError(err?.message ?? 'Failed'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // ---- Load campaign data ----
  useEffect(() => {
    if (!selectedCampaignId) {
      setCompaniesView(null); setAuditView(null); setDrafts([]); setOutbounds([]); setEvents([]);
      return;
    }
    let cancelled = false;
    fetchCampaignCompanies(selectedCampaignId).then((v) => { if (!cancelled) setCompaniesView(v); }).catch(() => {});
    fetchCampaignAudit(selectedCampaignId).then((v) => { if (!cancelled) setAuditView(v); }).catch(() => {});
    fetchDrafts(selectedCampaignId, undefined, true).then((v) => { if (!cancelled) setDrafts(v); }).catch(() => {});
    fetchCampaignOutbounds(selectedCampaignId).then((v) => { if (!cancelled) setOutbounds(v.outbounds); }).catch(() => {});
    fetchCampaignEvents(selectedCampaignId).then((v) => { if (!cancelled) setEvents(v.events); }).catch(() => {});
    return () => { cancelled = true; };
  }, [selectedCampaignId]);

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);
  const filteredCampaigns = useMemo(() => {
    if (!search) return campaigns;
    const q = search.toLowerCase();
    return campaigns.filter((c) => c.name.toLowerCase().includes(q));
  }, [campaigns, search]);

  // ---- Ledger items ----
  const ledgerItems = useMemo(() => {
    if (ledgerTab === 'drafts') return drafts.map((d) => ({ id: d.id, type: 'draft' as const, label: d.subject ?? '—', status: d.status, email_type: d.email_type, contact: d.contact_name, company: d.company_name, date: d.updated_at }));
    if (ledgerTab === 'outbounds') return outbounds.map((o) => ({ id: o.id, type: 'outbound' as const, label: o.subject ?? '—', status: o.status, email_type: o.draft_email_type, contact: o.contact_name, company: o.company_name, date: o.sent_at ?? o.created_at }));
    return events.map((e) => ({ id: e.id, type: 'event' as const, label: e.event_type ?? '—', status: e.outcome_classification, email_type: null, contact: e.contact_name, company: e.company_name, date: e.occurred_at }));
  }, [ledgerTab, drafts, outbounds, events]);

  const selectedItem = ledgerItems.find((i) => i.id === selectedItemId);
  const selectedDraft = ledgerTab === 'drafts' ? drafts.find((d) => d.id === selectedItemId) : null;
  const selectedOutbound = ledgerTab === 'outbounds' ? outbounds.find((o) => o.id === selectedItemId) : null;
  const selectedEvent = ledgerTab === 'events' ? events.find((e) => e.id === selectedItemId) : null;

  // Auto-select first item when tab changes
  useEffect(() => {
    if (ledgerItems.length > 0 && !ledgerItems.some((i) => i.id === selectedItemId)) {
      setSelectedItemId(ledgerItems[0].id);
    }
  }, [ledgerItems]);

  // ---- Review handler ----
  const handleReview = useCallback(async (draftId: string, status: 'approved' | 'rejected') => {
    try {
      const updated = await reviewDraftStatus(draftId, { status, reviewer: 'ledger-ui', metadata: { review_surface: 'ledger', reviewed_at: new Date().toISOString() } });
      setDrafts((prev) => prev.map((d) => d.id === draftId ? { ...d, ...updated, contact_name: d.contact_name, company_name: d.company_name, recipient_email: d.recipient_email } : d));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Review failed');
    }
  }, []);

  const gridTemplate = `${colWidths[0]}px 4px ${colWidths[1]}px 4px 1fr`;

  // ---- Render ----
  return (
    <div className="operator-desk" style={odCssVars(isDark)}>
      <div style={{ padding: '10px 16px 8px', flexShrink: 0 }}>
        <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Campaign Ledger</h1>
      </div>

      {error && <div className="od-error-banner" role="alert">{error}</div>}

      <div className="operator-desk__grid" style={{ gridTemplateColumns: gridTemplate, flex: 1 }}>

        {/* ======== Column 1: Campaigns + Ledger tabs ======== */}
        <div className="operator-desk__column">
          <div className="od-col-header">
            <span className="od-col-title">Campaigns</span>
            <span className="od-count-chip">{filteredCampaigns.length}</span>
          </div>
          <div className="od-search">
            <input className="od-search__input" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="od-col-body" style={{ maxHeight: '40%' }}>
            {loading && <div style={{ padding: 12 }}><span className="od-skeleton" style={{ height: 14, width: '60%' }} /></div>}
            {filteredCampaigns.map((c) => (
              <div
                key={c.id}
                className={`od-campaign-item${c.id === selectedCampaignId ? ' od-campaign-item--pinned' : ''}`}
                onClick={() => setSelectedCampaignId(c.id)}
              >
                <span className="od-campaign-item__name">{c.name}</span>
                <span className="od-campaign-item__meta"><StatusBadge status={c.status} /></span>
              </div>
            ))}
          </div>

          {/* Ledger tabs */}
          <div style={{ borderTop: '1px solid var(--od-border)', padding: '8px 10px 4px' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['drafts', 'outbounds', 'events'] as LedgerTab[]).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  className={`od-filter-chip${ledgerTab === tab ? ' od-filter-chip--active' : ''}`}
                  onClick={() => setLedgerTab(tab)}
                  style={{ fontSize: 11 }}
                >
                  {tab} ({tab === 'drafts' ? drafts.length : tab === 'outbounds' ? outbounds.length : events.length})
                </button>
              ))}
            </div>
          </div>

          {/* Ledger list */}
          <div className="od-col-body">
            {ledgerItems.length === 0 && (
              <div className="od-empty" style={{ minHeight: 60 }}>
                <span className="od-empty__text">No {ledgerTab}</span>
              </div>
            )}
            {ledgerItems.slice(0, 100).map((item) => (
              <div
                key={item.id}
                className={`od-campaign-item${item.id === selectedItemId ? ' od-campaign-item--pinned' : ''}`}
                onClick={() => setSelectedItemId(item.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <StatusBadge status={item.status ?? undefined} />
                  {item.email_type && <span style={{ fontSize: 9, color: 'var(--od-text-muted)' }}>{item.email_type}</span>}
                </div>
                <span className="od-campaign-item__name" style={{ fontSize: 12 }} title={item.label}>{truncate(item.label, 40)}</span>
                <div style={{ fontSize: 10, color: 'var(--od-text-muted)', display: 'flex', gap: 6 }}>
                  {item.contact && <span>{truncate(item.contact, 20)}</span>}
                  {item.company && <span>{truncate(item.company, 20)}</span>}
                </div>
              </div>
            ))}
            {ledgerItems.length > 100 && (
              <div style={{ padding: '6px 10px', fontSize: 10, color: 'var(--od-text-muted)', textAlign: 'center' }}>
                Showing 100 of {ledgerItems.length}
              </div>
            )}
          </div>
        </div>

        <div className="od-resize-handle" onMouseDown={(e) => handleResizeStart(0, e)} />

        {/* ======== Column 2: Audit + Companies ======== */}
        <div className="operator-desk__column" style={{ background: 'var(--od-bg)' }}>
          {!selectedCampaign ? (
            <div className="od-placeholder">
              <div className="od-placeholder__dash" />
              <span className="od-placeholder__text">Select a campaign</span>
            </div>
          ) : (
            <div className="od-col-body">
              {/* Campaign info */}
              <div className="od-context-block">
                <div className="od-context-row">
                  <span className="od-context-row__label">Campaign</span>
                  <span className="od-context-row__value">{selectedCampaign.name}</span>
                </div>
                <div className="od-context-row">
                  <span className="od-context-row__label">Status</span>
                  <StatusBadge status={selectedCampaign.status} />
                </div>
              </div>

              {/* Audit summary */}
              {auditView && (
                <div className="od-context-block" style={{ borderTop: '1px solid var(--od-border)' }}>
                  <h3 className="od-context-block__title">Audit</h3>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <span className="od-count-chip">{auditView.summary.company_count} companies</span>
                    <span className="od-count-chip">{auditView.summary.snapshot_contact_count} contacts</span>
                    <span className="od-count-chip">{auditView.summary.draft_count} drafts</span>
                    <span className="od-count-chip" style={{ color: auditView.summary.sent_draft_count > 0 ? 'var(--od-success)' : 'var(--od-text-muted)' }}>
                      {auditView.summary.sent_draft_count} sent
                    </span>
                    <span className="od-count-chip" style={{ color: auditView.summary.outbound_sent_count > 0 ? 'var(--od-success)' : 'var(--od-text-muted)' }}>
                      {auditView.summary.outbound_sent_count} outbounds
                    </span>
                    {auditView.summary.bounced_event_count > 0 && (
                      <span className="od-count-chip" style={{ color: 'var(--od-error)' }}>{auditView.summary.bounced_event_count} bounced</span>
                    )}
                    {auditView.summary.replied_event_count > 0 && (
                      <span className="od-count-chip" style={{ color: 'var(--od-success)' }}>{auditView.summary.replied_event_count} replied</span>
                    )}
                  </div>

                  {/* Issues */}
                  {auditView.issues && (
                    <div style={{ marginTop: 8 }}>
                      {auditView.summary.snapshot_contacts_without_draft_count > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--od-warning)' }}>{auditView.summary.snapshot_contacts_without_draft_count} contacts without draft</div>
                      )}
                      {auditView.summary.drafts_missing_recipient_email_count > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--od-warning)' }}>{auditView.summary.drafts_missing_recipient_email_count} drafts missing recipient</div>
                      )}
                      {auditView.summary.duplicate_draft_pair_count > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--od-warning)' }}>{auditView.summary.duplicate_draft_pair_count} duplicate draft pairs</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Companies */}
              {companiesView && (
                <div className="od-context-block" style={{ borderTop: '1px solid var(--od-border)' }}>
                  <h3 className="od-context-block__title">Companies ({companiesView.companies.length})</h3>
                  <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                    {companiesView.companies.slice(0, 50).map((co) => (
                      <div key={co.company_id} style={{ padding: '4px 0', borderBottom: '1px solid var(--od-border)', fontSize: 12 }}>
                        <div style={{ fontWeight: 600, color: 'var(--od-text)' }}>{co.company_name ?? co.company_id}</div>
                        <div style={{ display: 'flex', gap: 6, fontSize: 10, color: 'var(--od-text-muted)' }}>
                          <span>{co.contact_count} contacts</span>
                          <span style={{ color: co.enrichment.status === 'fresh' ? 'var(--od-success)' : co.enrichment.status === 'stale' ? 'var(--od-warning)' : 'var(--od-text-muted)' }}>
                            {co.enrichment.status}
                          </span>
                          {co.region && <span>{co.region}</span>}
                        </div>
                      </div>
                    ))}
                    {companiesView.companies.length > 50 && (
                      <div style={{ fontSize: 10, color: 'var(--od-text-muted)', padding: '6px 0', textAlign: 'center' }}>
                        Showing 50 of {companiesView.companies.length}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="od-resize-handle" onMouseDown={(e) => handleResizeStart(1, e)} />

        {/* ======== Column 3: Detail / Trace ======== */}
        <div className="operator-desk__column" style={{ background: 'var(--od-bg)' }}>
          {!selectedItem ? (
            <div className="od-placeholder">
              <div className="od-placeholder__dash" />
              <span className="od-placeholder__text">Select an item from the ledger</span>
            </div>
          ) : (
            <div className="od-col-body" style={{ padding: 12 }}>
              {/* Draft detail */}
              {selectedDraft && (
                <div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
                    <StatusBadge status={selectedDraft.status ?? undefined} />
                    {selectedDraft.email_type && <span className="od-count-chip" style={{ fontSize: 9 }}>{selectedDraft.email_type}</span>}
                    {selectedDraft.pattern_mode && <span className="od-count-chip" style={{ fontSize: 9 }}>{selectedDraft.pattern_mode}</span>}
                  </div>
                  <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px', color: 'var(--od-text)' }}>{selectedDraft.subject ?? '—'}</h3>
                  <div style={{ fontSize: 11, color: 'var(--od-text-muted)', marginBottom: 8 }}>
                    {selectedDraft.contact_name && <span>{selectedDraft.contact_name}</span>}
                    {selectedDraft.company_name && <span> · {selectedDraft.company_name}</span>}
                  </div>
                  {selectedDraft.recipient_email && (
                    <div style={{ fontSize: 11, color: 'var(--od-text-muted)', marginBottom: 8 }}>
                      To: {selectedDraft.recipient_email} ({selectedDraft.recipient_email_source ?? '?'})
                    </div>
                  )}
                  <pre style={{ fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap', color: 'var(--od-text)', background: 'var(--od-card)', padding: 10, borderRadius: 6, border: '1px solid var(--od-border)', maxHeight: 300, overflowY: 'auto' }}>
                    {selectedDraft.body ?? '—'}
                  </pre>
                  <div style={{ fontSize: 10, color: 'var(--od-text-muted)', marginTop: 6 }}>
                    Updated: {formatDate(selectedDraft.updated_at)}
                  </div>
                  {/* Review actions */}
                  {selectedDraft.status === 'generated' && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                      <button type="button" className="od-btn od-btn--approve" style={{ fontSize: 11, padding: '4px 12px' }} onClick={() => handleReview(selectedDraft.id, 'approved')}>Approve</button>
                      <button type="button" className="od-btn od-btn--reject" style={{ fontSize: 11, padding: '4px 12px' }} onClick={() => handleReview(selectedDraft.id, 'rejected')}>Reject</button>
                    </div>
                  )}
                </div>
              )}

              {/* Outbound detail */}
              {selectedOutbound && (
                <div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
                    <StatusBadge status={selectedOutbound.status ?? undefined} />
                    <span className="od-count-chip" style={{ fontSize: 9 }}>{selectedOutbound.provider}</span>
                  </div>
                  <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px', color: 'var(--od-text)' }}>{selectedOutbound.subject ?? '—'}</h3>
                  <div style={{ fontSize: 11, color: 'var(--od-text-muted)', marginBottom: 4 }}>
                    {selectedOutbound.contact_name && <span>{selectedOutbound.contact_name}</span>}
                    {selectedOutbound.company_name && <span> · {selectedOutbound.company_name}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--od-text-muted)', marginBottom: 4 }}>
                    From: {selectedOutbound.sender_identity ?? '—'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--od-text-muted)', marginBottom: 4 }}>
                    To: {selectedOutbound.recipient_email ?? '—'} ({selectedOutbound.recipient_email_source ?? '?'})
                  </div>
                  {selectedOutbound.error && (
                    <div style={{ fontSize: 11, color: 'var(--od-error)', marginBottom: 4 }}>Error: {selectedOutbound.error}</div>
                  )}
                  <div style={{ fontSize: 10, color: 'var(--od-text-muted)', marginTop: 6 }}>
                    Sent: {formatDate(selectedOutbound.sent_at)} · Created: {formatDate(selectedOutbound.created_at)}
                  </div>
                </div>
              )}

              {/* Event detail */}
              {selectedEvent && (
                <div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
                    <StatusBadge status={selectedEvent.event_type ?? undefined} />
                    {selectedEvent.outcome_classification && (
                      <span className="od-count-chip" style={{ fontSize: 9, color: selectedEvent.outcome_classification === 'positive' ? 'var(--od-success)' : 'var(--od-error)' }}>
                        {selectedEvent.outcome_classification}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--od-text-muted)', marginBottom: 4 }}>
                    {selectedEvent.contact_name && <span>{selectedEvent.contact_name}</span>}
                    {selectedEvent.company_name && <span> · {selectedEvent.company_name}</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--od-text-muted)', marginBottom: 4 }}>
                    Subject: {selectedEvent.subject ?? '—'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--od-text-muted)', marginBottom: 4 }}>
                    Recipient: {selectedEvent.recipient_email ?? '—'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--od-text-muted)', marginBottom: 4 }}>
                    Sender: {selectedEvent.sender_identity ?? '—'}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--od-text-muted)', marginTop: 6 }}>
                    Occurred: {formatDate(selectedEvent.occurred_at)} · Provider: {selectedEvent.provider ?? '—'}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CampaignOpsPage;
