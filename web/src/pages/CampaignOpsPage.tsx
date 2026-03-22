import { useEffect, useMemo, useState } from 'react';

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
import { Alert } from '../components/Alert';
import { CampaignAuditPanel } from '../components/CampaignAuditPanel';
import { CampaignDraftReview, type DraftReviewFilter } from '../components/CampaignDraftReview';
import { CampaignEventLedger, type CampaignEventFilter } from '../components/CampaignEventLedger';
import { CampaignOutboundLedger, type OutboundLedgerFilter } from '../components/CampaignOutboundLedger';
import {
  findDraftForEvent,
  findDraftForOutbound,
  findEventForOutbound,
  findOutboundForDraft,
  findOutboundForEvent,
} from '../components/campaignTrace';
import {
  filterAndSortCampaignCompanies,
  filterAndSortCampaigns,
  type CampaignListSort,
  type CampaignListStatusFilter,
  type CompanyResearchFilter,
  type CompanySort,
} from './campaignOpsFilters';

export function getCampaignCompanyResearchStatus(company: CampaignCompany): 'enriched' | 'missing' {
  return company.company_research ? 'enriched' : 'missing';
}

export function formatEnrichmentStateLabel(status: CampaignCompany['enrichment']['status']) {
  if (status === 'fresh') return 'fresh';
  if (status === 'stale') return 'stale';
  return 'missing';
}

export function summarizeCampaignCompanies(view: CampaignCompaniesView | null) {
  if (!view) {
    return {
      companyCount: 0,
      contactCount: 0,
      enrichedCount: 0,
      missingResearchCount: 0,
      freshCount: 0,
      staleCount: 0,
    };
  }

  const companyCount = view.companies.length;
  const contactCount = view.companies.reduce((sum, company) => sum + company.contact_count, 0);
  const enrichedCount = view.companies.filter((company) => getCampaignCompanyResearchStatus(company) === 'enriched').length;
  const freshCount = view.companies.filter((company) => company.enrichment.status === 'fresh').length;
  const staleCount = view.companies.filter((company) => company.enrichment.status === 'stale').length;

  return {
    companyCount,
    contactCount,
    enrichedCount,
    missingResearchCount: companyCount - enrichedCount,
    freshCount,
    staleCount,
  };
}

function StatusPill({ status }: { status?: string }) {
  const normalized = (status ?? 'n/a').toLowerCase();
  const className =
    normalized === 'review' || normalized === 'ready'
      ? 'pill pill--accent'
      : normalized === 'paused'
        ? 'pill pill--warn'
        : 'pill pill--subtle';

  return <span className={className}>{status ?? 'n/a'}</span>;
}

export function CampaignOpsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [companiesView, setCompaniesView] = useState<CampaignCompaniesView | null>(null);
  const [auditView, setAuditView] = useState<CampaignAuditView | null>(null);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [outbounds, setOutbounds] = useState<CampaignOutbound[]>([]);
  const [events, setEvents] = useState<CampaignEvent[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string>('');
  const [selectedOutboundId, setSelectedOutboundId] = useState<string>('');
  const [selectedEventId, setSelectedEventId] = useState<string>('');
  const [draftFilter, setDraftFilter] = useState<DraftReviewFilter>('all');
  const [outboundFilter, setOutboundFilter] = useState<OutboundLedgerFilter>('all');
  const [eventFilter, setEventFilter] = useState<CampaignEventFilter>('all');
  const [campaignSearch, setCampaignSearch] = useState('');
  const [campaignStatusFilter, setCampaignStatusFilter] = useState<CampaignListStatusFilter>('all');
  const [campaignSort, setCampaignSort] = useState<CampaignListSort>('name');
  const [companySearch, setCompanySearch] = useState('');
  const [companyResearchFilter, setCompanyResearchFilter] = useState<CompanyResearchFilter>('all');
  const [companySort, setCompanySort] = useState<CompanySort>('name');
  const [listLoading, setListLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);
  const [outboundLoading, setOutboundLoading] = useState(false);
  const [eventLoading, setEventLoading] = useState(false);
  const [reviewBusyId, setReviewBusyId] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [outboundError, setOutboundError] = useState<string | null>(null);
  const [eventError, setEventError] = useState<string | null>(null);

  useEffect(() => {
    setListLoading(true);
    setListError(null);
    fetchCampaigns()
      .then((rows) => {
        setCampaigns(rows);
        setSelectedCampaignId((current) => current || rows[0]?.id || '');
      })
      .catch((err) => setListError(err?.message ?? 'Failed to load campaigns'))
      .finally(() => setListLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedCampaignId) {
      setCompaniesView(null);
      return;
    }

    setDetailLoading(true);
    setDetailError(null);
    fetchCampaignCompanies(selectedCampaignId)
      .then(setCompaniesView)
      .catch((err) => {
        setCompaniesView(null);
        setDetailError(err?.message ?? 'Failed to load campaign companies');
      })
      .finally(() => setDetailLoading(false));
  }, [selectedCampaignId]);

  useEffect(() => {
    if (!selectedCampaignId) {
      setAuditView(null);
      return;
    }

    setAuditLoading(true);
    setAuditError(null);
    fetchCampaignAudit(selectedCampaignId)
      .then(setAuditView)
      .catch((err) => {
        setAuditView(null);
        setAuditError(err?.message ?? 'Failed to load campaign audit');
      })
      .finally(() => setAuditLoading(false));
  }, [selectedCampaignId]);

  useEffect(() => {
    if (!selectedCampaignId) {
      setDrafts([]);
      setSelectedDraftId('');
      return;
    }

    setDraftLoading(true);
    setDraftError(null);
    fetchDrafts(selectedCampaignId, undefined, true)
      .then((rows) => {
        setDrafts(rows);
        setSelectedDraftId((current) => current || rows[0]?.id || '');
      })
      .catch((err) => {
        setDrafts([]);
        setSelectedDraftId('');
        setDraftError(err?.message ?? 'Failed to load drafts');
      })
      .finally(() => setDraftLoading(false));
  }, [selectedCampaignId]);

  useEffect(() => {
    if (!selectedCampaignId) {
      setOutbounds([]);
      setSelectedOutboundId('');
      return;
    }

    setOutboundLoading(true);
    setOutboundError(null);
    fetchCampaignOutbounds(selectedCampaignId)
      .then((view) => {
        setOutbounds(view.outbounds);
        setSelectedOutboundId((current) => current || view.outbounds[0]?.id || '');
      })
      .catch((err) => {
        setOutbounds([]);
        setSelectedOutboundId('');
        setOutboundError(err?.message ?? 'Failed to load outbound ledger');
      })
      .finally(() => setOutboundLoading(false));
  }, [selectedCampaignId]);

  useEffect(() => {
    if (!selectedCampaignId) {
      setEvents([]);
      setSelectedEventId('');
      return;
    }

    setEventLoading(true);
    setEventError(null);
    fetchCampaignEvents(selectedCampaignId)
      .then((view) => {
        setEvents(view.events);
        setSelectedEventId((current) => current || view.events[0]?.id || '');
      })
      .catch((err) => {
        setEvents([]);
        setSelectedEventId('');
        setEventError(err?.message ?? 'Failed to load campaign events');
      })
      .finally(() => setEventLoading(false));
  }, [selectedCampaignId]);

  const visibleCampaigns = useMemo(
    () => filterAndSortCampaigns(campaigns, campaignSearch, campaignStatusFilter, campaignSort),
    [campaignSearch, campaignSort, campaignStatusFilter, campaigns]
  );
  const visibleCompanies = useMemo(
    () => filterAndSortCampaignCompanies(companiesView, companySearch, companyResearchFilter, companySort),
    [companiesView, companyResearchFilter, companySearch, companySort]
  );
  const summary = useMemo(
    () =>
      companiesView
        ? summarizeCampaignCompanies({
            ...companiesView,
            companies: visibleCompanies,
          })
        : summarizeCampaignCompanies(null),
    [companiesView, visibleCompanies]
  );
  const visibleDrafts = useMemo(() => {
    if (draftFilter === 'all') {
      return drafts;
    }
    return drafts.filter((draft) => draft.status === draftFilter);
  }, [draftFilter, drafts]);

  const visibleOutbounds = useMemo(() => {
    if (outboundFilter === 'all') {
      return outbounds;
    }
    return outbounds.filter((outbound) => outbound.status === outboundFilter);
  }, [outboundFilter, outbounds]);
  const visibleEvents = useMemo(() => {
    if (eventFilter === 'all') {
      return events;
    }
    return events.filter((event) => event.event_type === eventFilter);
  }, [eventFilter, events]);
  const selectedDraft = useMemo(
    () => drafts.find((draft) => draft.id === selectedDraftId) ?? null,
    [drafts, selectedDraftId]
  );
  const selectedOutbound = useMemo(
    () => outbounds.find((outbound) => outbound.id === selectedOutboundId) ?? null,
    [outbounds, selectedOutboundId]
  );
  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId]
  );
  const linkedOutboundForDraft = useMemo(
    () => findOutboundForDraft(selectedDraft, outbounds),
    [outbounds, selectedDraft]
  );
  const linkedEventForDraft = useMemo(
    () => findEventForOutbound(linkedOutboundForDraft, events),
    [events, linkedOutboundForDraft]
  );
  const linkedDraftForOutbound = useMemo(
    () => findDraftForOutbound(selectedOutbound, drafts),
    [drafts, selectedOutbound]
  );
  const linkedEventForOutbound = useMemo(
    () => findEventForOutbound(selectedOutbound, events),
    [events, selectedOutbound]
  );
  const linkedOutboundForEvent = useMemo(
    () => findOutboundForEvent(selectedEvent, outbounds),
    [outbounds, selectedEvent]
  );
  const linkedDraftForEvent = useMemo(
    () => findDraftForEvent(selectedEvent, drafts),
    [drafts, selectedEvent]
  );

  useEffect(() => {
    if (visibleDrafts.length === 0) {
      setSelectedDraftId('');
      return;
    }
    if (!visibleDrafts.some((draft) => draft.id === selectedDraftId)) {
      setSelectedDraftId(visibleDrafts[0].id);
    }
  }, [selectedDraftId, visibleDrafts]);

  useEffect(() => {
    if (visibleOutbounds.length === 0) {
      setSelectedOutboundId('');
      return;
    }
    if (!visibleOutbounds.some((outbound) => outbound.id === selectedOutboundId)) {
      setSelectedOutboundId(visibleOutbounds[0].id);
    }
  }, [selectedOutboundId, visibleOutbounds]);

  useEffect(() => {
    if (visibleEvents.length === 0) {
      setSelectedEventId('');
      return;
    }
    if (!visibleEvents.some((event) => event.id === selectedEventId)) {
      setSelectedEventId(visibleEvents[0].id);
    }
  }, [selectedEventId, visibleEvents]);

  const handleReviewDraft = async (
    draftId: string,
    review: {
      status: 'approved' | 'rejected';
      metadata?: Record<string, unknown>;
    }
  ) => {
    setReviewBusyId(draftId);
    setDraftError(null);
    try {
      const updated = await reviewDraftStatus(draftId, {
        status: review.status,
        reviewer: 'campaigns-ui',
        metadata: {
          review_surface: 'campaigns',
          reviewed_at: new Date().toISOString(),
          reviewed_by: 'campaigns-ui',
          ...(review.status === 'approved'
            ? {
                review_reason_code: null,
                review_reason_codes: [],
                review_reason_text: null,
              }
            : {}),
          ...(review.metadata ?? {}),
        },
      });
      setDrafts((rows) =>
        rows.map((row) =>
          row.id === draftId
            ? {
                ...row,
                ...updated,
                contact_name: row.contact_name,
                contact_position: row.contact_position,
                company_name: row.company_name,
                recipient_email: row.recipient_email,
                recipient_email_source: row.recipient_email_source,
                recipient_email_kind: row.recipient_email_kind,
                sendable: row.sendable,
              }
            : row
        )
      );
    } catch (err: any) {
      setDraftError(err?.message ?? 'Failed to update draft review');
    } finally {
      setReviewBusyId(null);
    }
  };

  const handleOpenDraft = (draftId: string) => {
    setDraftFilter('all');
    setSelectedDraftId(draftId);
  };

  const handleOpenOutbound = (outboundId: string) => {
    setOutboundFilter('all');
    setSelectedOutboundId(outboundId);
  };

  const handleOpenEvent = (eventId: string) => {
    setEventFilter('all');
    setSelectedEventId(eventId);
  };

  return (
    <section style={{ padding: '24px 28px 40px' }}>
      <div className="topbar">
        <div>
          <p className="eyebrow">Operator Console</p>
          <h1>Campaign Ops</h1>
          <p className="muted">
            Review campaign composition, drafts, and recorded sends from a single campaign surface.
          </p>
        </div>
      </div>

      {listError && <Alert kind="error">{listError}</Alert>}
      {(listLoading || detailLoading || auditLoading || draftLoading || outboundLoading || eventLoading) && (
        <Alert>Loading...</Alert>
      )}

      <div className="grid two-column" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card__header">
            <div>
              <h2>Campaigns</h2>
              <p className="muted small">Choose a campaign to inspect its bound snapshot companies.</p>
            </div>
            <span className="pill">
              {visibleCampaigns.length}/{campaigns.length}
            </span>
          </div>
          <div className="grid two-column" style={{ marginBottom: 12 }}>
            <label style={{ marginBottom: 0 }}>
              Search
              <input
                value={campaignSearch}
                onChange={(event) => setCampaignSearch(event.target.value)}
                placeholder="Name, status, or segment id"
              />
            </label>
            <div className="grid two-column" style={{ gap: 12 }}>
              <label style={{ marginBottom: 0 }}>
                Status
                <select
                  value={campaignStatusFilter}
                  onChange={(event) => setCampaignStatusFilter(event.target.value as CampaignListStatusFilter)}
                >
                  <option value="all">all</option>
                  <option value="draft">draft</option>
                  <option value="review">review</option>
                  <option value="ready">ready</option>
                  <option value="paused">paused</option>
                </select>
              </label>
              <label style={{ marginBottom: 0 }}>
                Sort
                <select value={campaignSort} onChange={(event) => setCampaignSort(event.target.value as CampaignListSort)}>
                  <option value="name">name</option>
                  <option value="status">status</option>
                </select>
              </label>
            </div>
          </div>
          <div className="table-lite">
            <div className="table-lite__head">
              <span>Name</span>
              <span>Status</span>
            </div>
            {visibleCampaigns.map((campaign) => (
              <button
                key={campaign.id}
                type="button"
                className="table-lite__row"
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background:
                    campaign.id === selectedCampaignId ? 'rgba(15, 23, 42, 0.06)' : 'transparent',
                  color: 'inherit',
                  border: 'none',
                  borderRadius: 0,
                  boxShadow: 'none',
                  transform: 'none',
                  padding: '12px 14px',
                }}
                onClick={() => setSelectedCampaignId(campaign.id)}
              >
                <span>{campaign.name}</span>
                <span>{campaign.status ?? 'n/a'}</span>
              </button>
            ))}
            {visibleCampaigns.length === 0 && <div className="table-lite__row">No campaigns match these controls.</div>}
          </div>
        </div>

        <div className="card">
          {!companiesView ? (
            <div>
              <h2>Campaign detail</h2>
              <p className="muted small">Select a campaign to load its companies.</p>
              {detailError ? <Alert kind="error">{detailError}</Alert> : null}
            </div>
          ) : (
            <>
              <div className="card__header">
                <div>
                  <h2>{companiesView.campaign.name}</h2>
                  <div className="pill-row">
                    <StatusPill status={companiesView.campaign.status} />
                    <span className="pill">Segment {companiesView.campaign.segment_id}</span>
                    <span className="pill">v{companiesView.campaign.segment_version}</span>
                  </div>
                </div>
              </div>

              <div className="grid two-column">
                <div className="panel">
                  <div className="panel__title">Composition</div>
                  <div className="panel__content">
                    <div className="pill-row">
                      <span className="pill">{summary.companyCount} companies</span>
                      <span className="pill">{summary.contactCount} contacts</span>
                    </div>
                  </div>
                </div>
                <div className="panel">
                  <div className="panel__title">Research Coverage</div>
                  <div className="panel__content">
                    <div className="pill-row">
                      <span className="pill pill--accent">{summary.enrichedCount} enriched</span>
                      <span className="pill">{summary.freshCount} fresh</span>
                      <span className="pill pill--warn">{summary.staleCount} stale</span>
                      <span className="pill pill--warn">{summary.missingResearchCount} missing</span>
                    </div>
                  </div>
                </div>
              </div>

              {auditError ? <Alert kind="error">{auditError}</Alert> : null}
              <CampaignAuditPanel audit={auditView} />

              <div style={{ marginTop: 18 }}>
                <div className="card__header" style={{ marginBottom: 8 }}>
                  <div>
                    <h4>Companies in campaign</h4>
                    <p className="muted small">Filter and sort the campaign snapshot before reviewing drafts.</p>
                  </div>
                  <span className="pill">
                    {visibleCompanies.length}/{companiesView.companies.length}
                  </span>
                </div>
                <div className="grid two-column" style={{ marginBottom: 12 }}>
                  <label style={{ marginBottom: 0 }}>
                    Search
                    <input
                      value={companySearch}
                      onChange={(event) => setCompanySearch(event.target.value)}
                      placeholder="Company, website, region, provider"
                    />
                  </label>
                  <div className="grid two-column" style={{ gap: 12 }}>
                    <label style={{ marginBottom: 0 }}>
                      Research
                      <select
                        value={companyResearchFilter}
                        onChange={(event) => setCompanyResearchFilter(event.target.value as CompanyResearchFilter)}
                      >
                        <option value="all">all</option>
                        <option value="fresh">fresh</option>
                        <option value="stale">stale</option>
                        <option value="missing">missing</option>
                      </select>
                    </label>
                    <label style={{ marginBottom: 0 }}>
                      Sort
                      <select value={companySort} onChange={(event) => setCompanySort(event.target.value as CompanySort)}>
                        <option value="name">name</option>
                        <option value="contacts">contacts</option>
                        <option value="updated">updated</option>
                      </select>
                    </label>
                  </div>
                </div>
                <div className="table-lite" style={{ marginTop: 8 }}>
                  <div className="table-lite__head">
                    <span>Company</span>
                    <span>Contacts</span>
                    <span>Research</span>
                    <span>Updated</span>
                    <span>Region</span>
                    <span>Employees</span>
                  </div>
                  {visibleCompanies.map((company) => (
                    <div key={company.company_id} className="table-lite__row">
                      <span>
                        <strong>{company.company_name ?? company.company_id}</strong>
                        <br />
                        <span className="muted small">{company.website ?? company.company_description ?? 'No company context yet'}</span>
                      </span>
                      <span>{company.contact_count}</span>
                      <span>
                        {formatEnrichmentStateLabel(company.enrichment.status)}
                        {company.enrichment.provider_hint ? (
                          <>
                            <br />
                            <span className="muted small">{company.enrichment.provider_hint}</span>
                          </>
                        ) : null}
                      </span>
                      <span>{company.enrichment.last_updated_at ? company.enrichment.last_updated_at.slice(0, 10) : 'n/a'}</span>
                      <span>{company.region ?? 'n/a'}</span>
                      <span>{company.employee_count ?? 'n/a'}</span>
                    </div>
                  ))}
                  {visibleCompanies.length === 0 && (
                    <div className="table-lite__row">No companies match these controls.</div>
                  )}
                </div>
              </div>

              {draftError ? <Alert kind="error">{draftError}</Alert> : null}
              <CampaignDraftReview
                drafts={drafts}
                selectedDraftId={selectedDraftId}
                onSelectDraft={setSelectedDraftId}
                activeFilter={draftFilter}
                onFilterChange={setDraftFilter}
                reviewBusyId={reviewBusyId}
                onReview={handleReviewDraft}
                linkedOutbound={linkedOutboundForDraft}
                linkedEvent={linkedEventForDraft}
                onOpenOutbound={handleOpenOutbound}
                onOpenEvent={handleOpenEvent}
              />

              {outboundError ? <Alert kind="error">{outboundError}</Alert> : null}
              <CampaignOutboundLedger
                outbounds={outbounds}
                selectedOutboundId={selectedOutboundId}
                onSelectOutbound={setSelectedOutboundId}
                activeFilter={outboundFilter}
                onFilterChange={setOutboundFilter}
                linkedDraft={linkedDraftForOutbound}
                linkedEvent={linkedEventForOutbound}
                onOpenDraft={handleOpenDraft}
                onOpenEvent={handleOpenEvent}
              />

              {eventError ? <Alert kind="error">{eventError}</Alert> : null}
              <CampaignEventLedger
                events={events}
                selectedEventId={selectedEventId}
                onSelectEvent={setSelectedEventId}
                activeFilter={eventFilter}
                onFilterChange={setEventFilter}
                linkedDraft={linkedDraftForEvent}
                linkedOutbound={linkedOutboundForEvent}
                onOpenDraft={handleOpenDraft}
                onOpenOutbound={handleOpenOutbound}
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default CampaignOpsPage;
