import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  deleteDirectoryContact,
  fetchDirectoryCompanies,
  fetchDirectoryContacts,
  markDirectoryContactInvalid,
  type DirectoryCompaniesView,
  type DirectoryContact,
  type DirectoryContactsView,
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

type EnrichFilter = 'all' | 'fresh' | 'stale' | 'missing';
type EmailFilter = 'all' | 'work' | 'generic' | 'missing';

const ENRICH_BADGE_TITLES: Record<string, string> = {
  fresh: 'Enrichment data is current (< 90 days)',
  stale: 'Enrichment data is older than 90 days',
  missing: 'No enrichment data — company has not been enriched',
};

function EnrichBadge({ status }: { status: 'fresh' | 'stale' | 'missing' }) {
  const cls =
    status === 'fresh' ? 'od-enrich-badge--fresh'
    : status === 'stale' ? 'od-enrich-badge--stale'
    : 'od-enrich-badge--missing';
  return <span className={`od-enrich-badge ${cls}`} title={ENRICH_BADGE_TITLES[status]}>{status}</span>;
}

type EmailDeliverability = 'unknown' | 'valid' | 'invalid' | 'bounced';

const DELIVERABILITY_TITLES: Record<EmailDeliverability, string> = {
  unknown: 'Deliverability not checked yet',
  valid: 'Email address verified as deliverable',
  invalid: 'Email address is invalid',
  bounced: 'Email bounced — address rejected by server',
};

function DeliverabilityBadge({ status }: { status: EmailDeliverability }) {
  if (status === 'unknown') return null;
  const cls = status === 'valid' ? 'od-enrich-badge--fresh'
    : 'od-enrich-badge--missing';
  return <span className={`od-enrich-badge ${cls}`} title={DELIVERABILITY_TITLES[status]} style={{ fontSize: 9 }}>{status}</span>;
}

function deriveSendability(ct: { workEmail: string | null; genericEmail: string | null; workEmailStatus: EmailDeliverability; genericEmailStatus: EmailDeliverability }): { sendable: boolean; via: string; hint: string } {
  const workUsable = ct.workEmail && ct.workEmailStatus !== 'bounced' && ct.workEmailStatus !== 'invalid';
  const genericUsable = ct.genericEmail && ct.genericEmailStatus !== 'bounced' && ct.genericEmailStatus !== 'invalid';
  if (workUsable) return { sendable: true, via: 'work', hint: `Sendable via work email: ${ct.workEmail}` };
  if (genericUsable) return { sendable: true, via: 'generic (fallback)', hint: `Work email unusable, fallback to generic: ${ct.genericEmail}` };
  return { sendable: false, via: 'none', hint: 'No sendable email address available' };
}

function truncate(str: string | null | undefined, max: number): string {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

// ============================================================
// ContactActions — per-row action buttons
// ============================================================

function ContactActions({
  contact,
  busyId,
  confirmDeleteId,
  onMarkInvalid,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
}: {
  contact: DirectoryContact;
  busyId: string | null;
  confirmDeleteId: string | null;
  onMarkInvalid: (id: string) => void;
  onRequestDelete: (id: string) => void;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
}) {
  const isBusy = busyId === contact.contactId;
  const isInvalid = contact.processingStatus === 'invalid';
  const isConfirmingDelete = confirmDeleteId === contact.contactId;

  if (isConfirmingDelete) {
    return (
      <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 4 }}>
        <span style={{ fontSize: 11, color: 'var(--od-error)', fontWeight: 600 }}>Delete?</span>
        <button
          type="button"
          className="od-btn od-btn--reject"
          style={{ padding: '2px 8px', fontSize: 11 }}
          disabled={isBusy}
          onClick={(e) => { e.stopPropagation(); onConfirmDelete(contact.contactId); }}
          aria-label={`Confirm delete ${contact.fullName ?? contact.contactId}`}
        >
          {isBusy ? '...' : 'Yes, delete'}
        </button>
        <button
          type="button"
          className="od-btn od-btn--ghost"
          style={{ padding: '2px 8px', fontSize: 11 }}
          onClick={(e) => { e.stopPropagation(); onCancelDelete(); }}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 4 }}>
      {!isInvalid && (
        <button
          type="button"
          className="od-btn od-btn--ghost"
          style={{ padding: '2px 8px', fontSize: 11 }}
          disabled={isBusy}
          onClick={(e) => { e.stopPropagation(); onMarkInvalid(contact.contactId); }}
          aria-label={`Mark invalid ${contact.fullName ?? contact.contactId}`}
          title="Mark this contact record as invalid (bad data, wrong person, etc.). For bounced emails, check email deliverability status instead."
        >
          {isBusy ? '...' : 'Mark invalid'}
        </button>
      )}
      {isInvalid && (
        <span className="od-status-badge od-status-badge--review" style={{ fontSize: 10 }}>invalid</span>
      )}
      <button
        type="button"
        className="od-btn od-btn--ghost"
        style={{ padding: '2px 8px', fontSize: 11, color: 'var(--od-error)', borderColor: 'var(--od-error)' }}
        disabled={isBusy}
        onClick={(e) => { e.stopPropagation(); onRequestDelete(contact.contactId); }}
        aria-label={`Delete ${contact.fullName ?? contact.contactId}`}
        title="Delete this contact. Blocked if contact has drafts or segment memberships."
      >
        Delete
      </button>
    </div>
  );
}

// ============================================================
// Main component
// ============================================================

export function ContactsWorkspacePage({ isDark = false }: { isDark?: boolean }) {
  const [companies, setCompanies] = useState<DirectoryCompaniesView | null>(null);
  const [contacts, setContacts] = useState<DirectoryContactsView | null>(null);
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [search, setSearch] = usePersistedState('c5:contacts:search', '');
  const [enrichFilter, setEnrichFilter] = usePersistedState<EnrichFilter>('c5:contacts:enrich-filter', 'all');
  const [emailFilter, setEmailFilter] = usePersistedState<EmailFilter>('c5:contacts:email-filter', 'all');
  const [selectedCompanyId, setSelectedCompanyId] = usePersistedState<string | null>('c5:contacts:company', null);

  // ---- Contact action state ----
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // ---- Resizable columns ----
  const [colWidths, setColWidths] = usePersistedState('c5:contacts:col-widths', [340]);
  const dragRef = useRef<{ startX: number; startWidths: number[] } | null>(null);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = { startX: e.clientX, startWidths: [...colWidths] };
      const onMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const delta = ev.clientX - dragRef.current.startX;
        setColWidths([Math.max(240, dragRef.current.startWidths[0] + delta)]);
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

  // ---- Load companies ----
  useEffect(() => {
    let cancelled = false;
    setLoadingCompanies(true);
    const opts: Parameters<typeof fetchDirectoryCompanies>[0] = { limit: 200 };
    if (search) opts.q = search;
    if (enrichFilter !== 'all') opts.enrichmentStatus = enrichFilter;

    fetchDirectoryCompanies(opts)
      .then((view) => {
        if (cancelled) return;
        setCompanies(view);
        // Validate persisted company selection
        setSelectedCompanyId((current) => {
          if (!current) return current;
          if (view.items.some((c) => c.companyId === current)) return current;
          return null;
        });
      })
      .catch((err) => { if (!cancelled) setError(err?.message ?? 'Failed to load companies'); })
      .finally(() => { if (!cancelled) setLoadingCompanies(false); });
    return () => { cancelled = true; };
  }, [search, enrichFilter, reloadKey]);

  // ---- Load contacts for selected company ----
  useEffect(() => {
    if (!selectedCompanyId || loadingCompanies) {
      if (!selectedCompanyId) setContacts(null);
      return;
    }
    let cancelled = false;
    setLoadingContacts(true);
    const opts: Parameters<typeof fetchDirectoryContacts>[0] = {
      companyIds: [selectedCompanyId],
      limit: 200,
    };
    if (emailFilter !== 'all') opts.emailStatus = emailFilter;

    fetchDirectoryContacts(opts)
      .then((view) => { if (!cancelled) setContacts(view); })
      .catch((err) => { if (!cancelled) setError(err?.message ?? 'Failed to load contacts'); })
      .finally(() => { if (!cancelled) setLoadingContacts(false); });
    return () => { cancelled = true; };
  }, [selectedCompanyId, emailFilter, reloadKey, loadingCompanies]);

  const selectedCompany = useMemo(
    () => companies?.items.find((c) => c.companyId === selectedCompanyId) ?? null,
    [companies, selectedCompanyId]
  );

  // ---- Contact actions ----
  const handleMarkInvalid = useCallback(async (contactId: string) => {
    setActionBusyId(contactId);
    setError(null);
    try {
      await markDirectoryContactInvalid(contactId);
      setReloadKey((k) => k + 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to mark contact invalid');
    } finally {
      setActionBusyId(null);
    }
  }, []);

  const handleConfirmDelete = useCallback(async (contactId: string) => {
    setActionBusyId(contactId);
    setError(null);
    try {
      await deleteDirectoryContact(contactId);
      setConfirmDeleteId(null);
      setReloadKey((k) => k + 1);
    } catch (err: unknown) {
      const apiError = (err as any)?.apiError;
      if (apiError?.statusCode === 409) {
        const details = apiError.details;
        const parts: string[] = [];
        if (details?.details?.drafts) parts.push(`${details.details.drafts} draft(s)`);
        if (details?.details?.segmentMemberships) parts.push(`${details.details.segmentMemberships} segment membership(s)`);
        setError(
          `Cannot delete: contact has ${parts.length > 0 ? parts.join(' and ') : 'dependent records'}. Mark as invalid instead.`
        );
      } else {
        setError(err instanceof Error ? err.message : 'Failed to delete contact');
      }
      setConfirmDeleteId(null);
    } finally {
      setActionBusyId(null);
    }
  }, []);

  return (
    <div className="operator-desk" style={odCssVars(isDark)}>
      <div style={{ padding: '10px 16px 0', flexShrink: 0 }}>
        <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Contacts</h1>
      </div>

      {error && <div className="od-error-banner" role="alert">{error}</div>}

      {/* Summary chips */}
      {companies && (
        <div style={{
          display: 'flex', gap: 8, padding: '6px 12px',
          borderBottom: '1px solid var(--od-border)', flexWrap: 'wrap', flexShrink: 0,
        }}>
          <span className="od-count-chip" aria-label="Total companies" title="Total companies in directory">{companies.summary.total} companies</span>
          <span className="od-enrich-badge od-enrich-badge--fresh">{companies.summary.enrichment.fresh} fresh</span>
          <span className="od-enrich-badge od-enrich-badge--stale">{companies.summary.enrichment.stale} stale</span>
          <span className="od-enrich-badge od-enrich-badge--missing">{companies.summary.enrichment.missing} missing</span>
        </div>
      )}

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Column 1: Companies */}
        <div className="operator-desk__column" style={{ width: colWidths[0], flexShrink: 0 }}>
          <div className="od-col-header">
            <h2 className="od-col-title">Companies</h2>
            <span className="od-count-chip">{companies?.items.length ?? 0}</span>
          </div>

          <div className="od-search">
            <input
              className="od-search__input"
              placeholder="Search companies..."
              aria-label="Search companies"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="od-filterbar">
            {(['all', 'fresh', 'stale', 'missing'] as EnrichFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                className={`od-filter-chip${enrichFilter === f ? ' od-filter-chip--active' : ''}`}
                onClick={() => setEnrichFilter(f)}
                title={f === 'all' ? 'Show all companies regardless of enrichment status' : `Show only companies with ${f} enrichment data`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="od-col-body">
            {loadingCompanies && (
              <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[1, 2, 3].map((i) => (
                  <div key={i}>
                    <span className="od-skeleton" style={{ height: 13, width: '65%', display: 'block' }} />
                    <span className="od-skeleton" style={{ height: 10, width: '40%', display: 'block', marginTop: 4 }} />
                  </div>
                ))}
              </div>
            )}
            {!loadingCompanies && (companies?.items ?? []).length === 0 && (
              <div className="od-empty" style={{ minHeight: 100 }}>
                <div className="od-empty__line" />
                <span className="od-empty__text">No companies match this filter.</span>
              </div>
            )}
            {!loadingCompanies && (companies?.items ?? []).map((co) => (
              <div
                key={co.companyId}
                className={`od-company-item${co.companyId === selectedCompanyId ? ' od-company-item--pinned' : ''}`}
                onClick={() => { setSelectedCompanyId(co.companyId); setSelectedContactId(null); }}
              >
                <span className="od-company-item__name">{co.companyName ?? co.companyId}</span>
                {co.website && (
                  <a
                    className="od-company-item__website"
                    href={co.website.startsWith('http') ? co.website : `https://${co.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {truncate(co.website, 30)}
                  </a>
                )}
                <div className="od-company-item__foot">
                  <EnrichBadge status={co.enrichment.status} />
                  <span className="od-count-chip" title="Contacts">{co.contacts.total}</span>
                  {co.contacts.withWorkEmail > 0 && (
                    <span className="od-count-chip" title="Work emails" style={{ fontSize: 9 }}>
                      {co.contacts.withWorkEmail} work
                    </span>
                  )}
                  {co.contacts.missingEmail > 0 && (
                    <span className="od-count-chip" title="Missing email" style={{ fontSize: 9, color: 'var(--od-warning)' }}>
                      {co.contacts.missingEmail} no email
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Drag handle */}
        <div className="od-resize-handle" onMouseDown={handleResizeStart} />

        {/* Column 2: Contacts */}
        <div className="operator-desk__column" style={{ background: 'var(--od-bg)', flex: 1 }}>
          {!selectedCompanyId ? (
            <div className="od-placeholder">
              <div className="od-placeholder__dash" />
              <span className="od-placeholder__text">Select a company to view contacts</span>
            </div>
          ) : (
            <>
              {selectedCompany && (
                <div className="od-company-context">
                  <div className="od-company-context__grid">
                    {selectedCompany.segment && (
                      <div className="od-company-context__field">
                        <span className="od-company-context__label">Segment</span>
                        <span className="od-company-context__value">{selectedCompany.segment}</span>
                      </div>
                    )}
                    {selectedCompany.employeeCount != null && (
                      <div className="od-company-context__field">
                        <span className="od-company-context__label">Headcount</span>
                        <span className="od-company-context__value">{selectedCompany.employeeCount}</span>
                      </div>
                    )}
                    {selectedCompany.officeQualification && (
                      <div className="od-company-context__field">
                        <span className="od-company-context__label">Office</span>
                        <span className="od-company-context__value">{selectedCompany.officeQualification}</span>
                      </div>
                    )}
                    <div className="od-company-context__field">
                      <span className="od-company-context__label">Enrichment</span>
                      <EnrichBadge status={selectedCompany.enrichment.status} />
                    </div>
                  </div>
                </div>
              )}

              <div className="od-col-header">
                <h2 className="od-col-title">Contacts</h2>
                <span className="od-count-chip">{contacts?.items.length ?? 0}</span>
              </div>

              <div className="od-filterbar">
                {(['all', 'work', 'generic', 'missing'] as EmailFilter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`od-filter-chip${emailFilter === f ? ' od-filter-chip--active' : ''}`}
                    onClick={() => setEmailFilter(f)}
                    title={f === 'all' ? 'Show all contacts regardless of email status' : `Show only contacts with ${f} email`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              {contacts && (
                <div style={{
                  display: 'flex', gap: 8, padding: '6px 12px',
                  borderBottom: '1px solid var(--od-border)', flexWrap: 'wrap', flexShrink: 0,
                }}>
                  <span className="od-count-chip">{contacts.summary.emailStatus.work} work email</span>
                  <span className="od-count-chip">{contacts.summary.emailStatus.generic} generic</span>
                  <span className="od-count-chip" style={{ color: contacts.summary.emailStatus.missing > 0 ? 'var(--od-warning)' : undefined }}>
                    {contacts.summary.emailStatus.missing} missing
                  </span>
                </div>
              )}

              <div className="od-col-body">
                {loadingContacts && (
                  <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[1, 2, 3].map((i) => (
                      <div key={i}>
                        <span className="od-skeleton" style={{ height: 13, width: '55%', display: 'block' }} />
                        <span className="od-skeleton" style={{ height: 10, width: '35%', display: 'block', marginTop: 4 }} />
                      </div>
                    ))}
                  </div>
                )}
                {!loadingContacts && (contacts?.items ?? []).length === 0 && (
                  <div className="od-empty" style={{ minHeight: 100 }}>
                    <div className="od-empty__line" />
                    <span className="od-empty__text">No contacts for this company.</span>
                  </div>
                )}
                {!loadingContacts && (contacts?.items ?? []).map((ct) => (
                  <div
                    key={ct.contactId}
                    className={`od-employee-item${selectedContactId === ct.contactId ? ' od-employee-item--pinned' : ''}`}
                    style={{ cursor: 'pointer', ...(ct.processingStatus === 'invalid' ? { opacity: 0.55 } : {}) }}
                    onClick={() => setSelectedContactId(ct.contactId)}
                  >
                    <span className="od-employee-item__name">{ct.fullName ?? ct.contactId}</span>
                    {ct.position && (
                      <span className="od-employee-item__role">{truncate(ct.position, 40)}</span>
                    )}
                    <div className="od-employee-item__foot">
                      {(() => {
                        const send = deriveSendability(ct);
                        return (
                          <span
                            className={`od-send-dot ${send.sendable ? 'od-send-dot--ok' : 'od-send-dot--warn'}`}
                            title={send.hint}
                          />
                        );
                      })()}
                      <span style={{ fontSize: 11, color: 'var(--od-text-muted)' }}>
                        {ct.workEmail ?? ct.genericEmail ?? 'no email'}
                      </span>
                      {(ct.workEmailStatus === 'bounced' || ct.workEmailStatus === 'invalid') && (
                        <DeliverabilityBadge status={ct.workEmailStatus} />
                      )}
                      {(ct.genericEmailStatus === 'bounced' || ct.genericEmailStatus === 'invalid') && (
                        <DeliverabilityBadge status={ct.genericEmailStatus} />
                      )}
                      <EnrichBadge status={ct.enrichment.status} />
                    </div>
                    <ContactActions
                      contact={ct}
                      busyId={actionBusyId}
                      confirmDeleteId={confirmDeleteId}
                      onMarkInvalid={handleMarkInvalid}
                      onRequestDelete={(id) => setConfirmDeleteId(id)}
                      onConfirmDelete={handleConfirmDelete}
                      onCancelDelete={() => setConfirmDeleteId(null)}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Column 3: Contact detail */}
        {selectedContactId && (() => {
          const ct = contacts?.items.find((c) => c.contactId === selectedContactId);
          if (!ct) return null;
          return (
            <>
              <div className="od-resize-handle" />
              <div className="operator-desk__column" style={{ background: 'var(--od-bg)', flex: 1, minWidth: 280 }}>
                <div className="od-col-header">
                  <h2 className="od-col-title">Contact detail</h2>
                </div>
                <div className="od-col-body" style={{ padding: '10px 12px' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 4px', color: 'var(--od-text)' }}>
                    {ct.fullName ?? ct.contactId}
                  </h3>
                  {ct.position && (
                    <div style={{ fontSize: 12, color: 'var(--od-text-muted)', marginBottom: 8 }}>{ct.position}</div>
                  )}

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    <span
                      className={`od-send-dot ${ct.emailStatus === 'work' ? 'od-send-dot--ok' : 'od-send-dot--warn'}`}
                      title={ct.emailStatus === 'work' ? 'Has verified work email' : ct.emailStatus === 'generic' ? 'Only generic email' : 'No email'}
                      style={{ marginTop: 3 }}
                    />
                    <span className={`od-status-badge od-status-badge--${ct.emailStatus === 'work' ? 'ready' : ct.emailStatus === 'generic' ? 'generating' : 'review'}`}>
                      {ct.emailStatus}
                    </span>
                    <EnrichBadge status={ct.enrichment.status} />
                    {ct.processingStatus && ct.processingStatus !== 'completed' && (
                      <span className="od-status-badge od-status-badge--review">{ct.processingStatus}</span>
                    )}
                  </div>

                  <div className="od-context-block" style={{ padding: 0 }}>
                    <h4 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--od-text-muted)', margin: '0 0 6px' }}>Email addresses</h4>
                    <div style={{ padding: '3px 0', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid var(--od-border)' }}>
                      <span className="od-context-row__label" style={{ flexShrink: 0 }}>Work</span>
                      <span style={{ fontSize: 12, color: ct.workEmail ? 'var(--od-text)' : 'var(--od-text-muted)', flex: 1 }}>
                        {ct.workEmail || '—'}
                      </span>
                      <DeliverabilityBadge status={ct.workEmailStatus} />
                    </div>
                    <div style={{ padding: '3px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="od-context-row__label" style={{ flexShrink: 0 }}>Generic</span>
                      <span style={{ fontSize: 12, color: ct.genericEmail ? 'var(--od-text)' : 'var(--od-text-muted)', flex: 1 }}>
                        {ct.genericEmail || '—'}
                      </span>
                      <DeliverabilityBadge status={ct.genericEmailStatus} />
                    </div>

                    {/* Sendability hint */}
                    {(() => {
                      const send = deriveSendability(ct);
                      return (
                        <div style={{ marginTop: 6, padding: '4px 0', fontSize: 11, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            className={`od-send-dot ${send.sendable ? 'od-send-dot--ok' : 'od-send-dot--warn'}`}
                            title={send.hint}
                          />
                          <span style={{ color: send.sendable ? 'var(--od-success)' : 'var(--od-warning)' }}>
                            {send.sendable ? `Sendable via ${send.via}` : 'No sendable email'}
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="od-context-block" style={{ padding: 0, marginTop: 10 }}>
                    <h4 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--od-text-muted)', margin: '0 0 6px' }}>Company</h4>
                    <div className="od-context-row" style={{ padding: '3px 0' }}>
                      <span className="od-context-row__label">Company</span>
                      <span className="od-context-row__value" style={{ maxWidth: 'none' }}>{ct.companyName ?? '—'}</span>
                    </div>
                    <div className="od-context-row" style={{ padding: '3px 0' }}>
                      <span className="od-context-row__label">Segment</span>
                      <span className="od-context-row__value" style={{ maxWidth: 'none' }}>{ct.companySegment ?? '—'}</span>
                    </div>
                    <div className="od-context-row" style={{ padding: '3px 0' }}>
                      <span className="od-context-row__label">Company status</span>
                      <span className="od-context-row__value" style={{ maxWidth: 'none' }}>{ct.companyStatus ?? '—'}</span>
                    </div>
                  </div>

                  <div className="od-context-block" style={{ padding: 0, marginTop: 10 }}>
                    <h4 style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--od-text-muted)', margin: '0 0 6px' }}>Processing</h4>
                    <div className="od-context-row" style={{ padding: '3px 0' }}>
                      <span className="od-context-row__label">Status</span>
                      <span className="od-context-row__value" style={{ maxWidth: 'none' }}>{ct.processingStatus ?? '—'}</span>
                    </div>
                    <div className="od-context-row" style={{ padding: '3px 0' }}>
                      <span className="od-context-row__label">Updated</span>
                      <span className="od-context-row__value" style={{ maxWidth: 'none' }}>{ct.updatedAt ? new Date(ct.updatedAt).toLocaleString() : '—'}</span>
                    </div>
                    {ct.enrichment.providerHint && (
                      <div className="od-context-row" style={{ padding: '3px 0' }}>
                        <span className="od-context-row__label">Enrichment provider</span>
                        <span className="od-context-row__value" style={{ maxWidth: 'none' }}>{ct.enrichment.providerHint}</span>
                      </div>
                    )}
                    {ct.enrichment.lastUpdatedAt && (
                      <div className="od-context-row" style={{ padding: '3px 0' }}>
                        <span className="od-context-row__label">Last enriched</span>
                        <span className="od-context-row__value" style={{ maxWidth: 'none' }}>{new Date(ct.enrichment.lastUpdatedAt).toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <ContactActions
                      contact={ct}
                      busyId={actionBusyId}
                      confirmDeleteId={confirmDeleteId}
                      onMarkInvalid={handleMarkInvalid}
                      onRequestDelete={(id) => setConfirmDeleteId(id)}
                      onConfirmDelete={handleConfirmDelete}
                      onCancelDelete={() => setConfirmDeleteId(null)}
                    />
                  </div>
                </div>
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}

export default ContactsWorkspacePage;
