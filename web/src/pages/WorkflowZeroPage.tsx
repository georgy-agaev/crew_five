import { useEffect, useMemo, useState } from 'react';

import {
  fetchCampaigns,
  fetchCompanies,
  fetchContacts,
  fetchSmartleadCampaigns,
  createSmartleadCampaign,
  triggerDraftGenerate,
  triggerSmartleadPreview,
  fetchSegments,
  fetchPromptRegistry,
  snapshotSegment,
  enqueueSegmentEnrichment,
  fetchEnrichmentStatus,
  type Campaign,
  type CompanyRow as ApiCompanyRow,
  type ContactRow as ApiContactRow,
} from '../apiClient';
import { Alert } from '../components/Alert';
import { loadSettings } from '../hooks/useSettingsStore';

export type CompanyRow = {
  id: string;
  name: string;
  segment?: string;
  officeQualification?: string;
  officeQuantification?: string;
  office_qualification?: string;
  office_quantification?: string;
  registrationDate?: string;
  registration_date?: string;
  outreachStatus?: string;
  outreach_status?: string;
};

export type ContactRow = {
  id: string;
  companyId: string;
  company_id?: string;
  name?: string;
  title?: string;
  email?: string;
  emailStatus?: 'verified' | 'generic' | 'missing';
  persona?: string;
};

export type SegmentRow = {
  id: string;
  name?: string;
  version?: number | null;
};

export function isSnapshotFinalized(version?: number | null) {
  return (version ?? 0) >= 1;
}

export function shouldBlockDrafts(selectedSegmentId: string, snapshotVersion: number | null) {
  return !selectedSegmentId || !isSnapshotFinalized(snapshotVersion);
}

export function formatEnrichmentStatus(status?: string | null, jobId?: string | null) {
  if (!status) return 'Not started';
  return jobId ? `${status} (#${jobId})` : status;
}

export type CompanyFilters = {
  segment?: string;
  createdWithinDays?: number;
  outreachStatus?: 'none' | 'warm' | 'recent' | '';
  officeQualification?: CompanyRow['officeQualification'] | '';
};

export function applyCompanyFilters(companies: CompanyRow[], filters: CompanyFilters) {
  return companies.filter((company) => {
    const withinCreatedWindow =
      !filters.createdWithinDays ||
      (company.registrationDate &&
        Date.now() - new Date(company.registrationDate).getTime() <=
          (filters.createdWithinDays ?? 0) * 24 * 60 * 60 * 1000);
    const matchesSegment = !filters.segment || company.segment === filters.segment;
    const matchesOutreach = !filters.outreachStatus || company.outreachStatus === filters.outreachStatus;
    const matchesOffice =
      !filters.officeQualification || company.officeQualification === filters.officeQualification;
    return withinCreatedWindow && matchesSegment && matchesOutreach && matchesOffice;
  });
}

export function filterContactsByCompanyIds(contacts: ContactRow[], companyIds: string[]) {
  if (!companyIds.length) return [];
  return contacts.filter((c) => companyIds.includes(c.companyId));
}

export function computeContactStats(contacts: ContactRow[], includedIds: Set<string>) {
  const included = contacts.filter((c) => includedIds.has(c.id));
  const excluded = contacts.filter((c) => !includedIds.has(c.id));
  const missingEmail = contacts.filter((c) => c.emailStatus === 'missing' || !c.email);
  return {
    includedCount: included.length,
    excludedCount: excluded.length,
    missingEmailCount: missingEmail.length,
  };
}

export function isCohortTooLarge(count: number, cap: number) {
  return count > cap;
}

export function collectLeadIds(contacts: ContactRow[], includedIds: Set<string>) {
  const ids = includedIds.size ? Array.from(includedIds) : contacts.filter((c) => c.email).map((c) => c.id);
  return ids.filter(Boolean);
}

function normalizeCompany(row: ApiCompanyRow): CompanyRow {
  return {
    id: row.id,
    name: (row as any).company_name ?? row.name,
    segment: row.segment,
    officeQualification:
      (row as any).office_qualification ??
      (row as any).office_quantification ??
      row.officeQualification ??
      row.officeQuantification,
    registrationDate: (row as any).registration_date ?? (row as any).registrationDate ?? row.registration_date,
    outreachStatus:
      (row as any).status ??
      (row as any).outreach_status ??
      row.outreach_status ??
      row.outreachStatus,
  };
}

function normalizeContact(row: ApiContactRow): ContactRow {
  const workEmail = (row as any).work_email ?? row.email;
  const genericEmail = (row as any).generic_email;
  const emailStatus = workEmail ? 'verified' : genericEmail ? 'generic' : 'missing';
  return {
    id: row.id,
    companyId: (row as any).company_id ?? row.company_id ?? (row as any).companyId ?? row.company_id ?? '',
    name: (row as any).full_name ?? row.name,
    title: (row as any).position ?? row.title,
    email: workEmail ?? genericEmail ?? undefined,
    emailStatus: emailStatus as ContactRow['emailStatus'],
    persona: row.persona ?? (row as any).position,
  };
}

type WorkflowZeroPageProps = {
  smartleadReady?: boolean;
};

const COHORT_CAP = 5000;
const SMARTLEAD_PREVIEW_CAP = 200;

export function WorkflowZeroPage({ smartleadReady = true }: WorkflowZeroPageProps) {
  const [filters, setFilters] = useState<CompanyFilters>({
    segment: '',
    createdWithinDays: undefined,
    outreachStatus: '',
    officeQualification: '',
  });
  const [segments, setSegments] = useState<SegmentRow[]>([]);
  const [selectedSegment, setSelectedSegment] = useState<string>('');
  const [snapshotVersion, setSnapshotVersion] = useState<number | null>(null);
  const [snapshotStatus, setSnapshotStatus] = useState<string | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [enrichStatus, setEnrichStatus] = useState<string | null>(null);
  const [enrichJobId, setEnrichJobId] = useState<string | null>(null);
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [dryRun, setDryRun] = useState(true);
  const [limit, setLimit] = useState(50);
  const [dataQualityMode, setDataQualityMode] = useState<'strict' | 'graceful'>('strict');
  const [interactionMode, setInteractionMode] = useState<'express' | 'coach'>('coach');
  const [draftSummary, setDraftSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendSummary, setSendSummary] = useState<string | null>(null);
  const [companies, setCompanies] = useState<CompanyRow[]>([]);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [smartleadCampaigns, setSmartleadCampaigns] = useState<Array<{ id: string; name: string; status?: string }>>(
    []
  );
  const [smartleadCampaignId, setSmartleadCampaignId] = useState<string>('');
  const [subject, setSubject] = useState('Quick idea on reducing manual outreach time');
  const [body, setBody] = useState(
    'Hey {{first_name}},\n\nNoticed {{company_name}} is scaling AI infra quickly. Teams like yours have cut manual QA by 30% by layering an AI SDR to triage inbound + outbound replies. Worth a 6-min teardown?'
  );
  const [bumpDelay, setBumpDelay] = useState(3);
  const [bumpTone, setBumpTone] = useState<'curious' | 'direct'>('curious');
  const [newCampaignName, setNewCampaignName] = useState('');
  const [promptRegistry, setPromptRegistry] = useState<Array<{ id: string; step?: string }>>([]);
  const [selectedPromptId, setSelectedPromptId] = useState<string>('');

  const filteredCompanies = useMemo(() => applyCompanyFilters(companies, filters), [companies, filters]);
  const filteredCompanyIds = filteredCompanies.map((c) => c.id);
  const filteredContacts = useMemo(
    () => filterContactsByCompanyIds(contacts, filteredCompanyIds),
    [contacts, filteredCompanyIds]
  );

  const [includedContacts, setIncludedContacts] = useState<Set<string>>(new Set());
  useEffect(() => {
    const autoIncluded = filteredContacts.filter((c) => c.email && c.emailStatus !== 'missing').map((c) => c.id);
    setIncludedContacts(new Set(autoIncluded));
  }, [filteredContacts]);

  useEffect(() => {
    fetchSegments()
      .then((res) => {
        setSegments(res as SegmentRow[]);
        if (!selectedSegment && res[0]) {
          setSelectedSegment(res[0].id);
        }
      })
      .catch((err) => setError(err?.message ?? 'Failed to load segments'));
  }, []);

  useEffect(() => {
    const match = segments.find((s) => s.id === selectedSegment);
    setSnapshotVersion(match?.version ?? null);
  }, [segments, selectedSegment]);

  useEffect(() => {
    if (!selectedSegment) {
      setEnrichStatus(null);
      setEnrichJobId(null);
      return;
    }
    fetchEnrichmentStatus(selectedSegment)
      .then((res) => {
        if (res) {
          setEnrichStatus(res.status ?? null);
          setEnrichJobId(res.jobId ?? null);
        } else {
          setEnrichStatus(null);
          setEnrichJobId(null);
        }
      })
      .catch(() => {
        // ignore enrichment status errors for now
      });
  }, [selectedSegment]);

  useEffect(() => {
    fetchCampaigns()
      .then((res) => {
        setCampaigns(res);
        if (res[0]) setSelectedCampaign(res[0].id);
        if (!selectedSegment && res[0]?.segment_id) {
          setSelectedSegment(res[0].segment_id);
        }
      })
      .catch((err) => setError(err?.message ?? 'Failed to load campaigns'));
  }, []);

  useEffect(() => {
    fetchSmartleadCampaigns()
      .then((res) => {
        setSmartleadCampaigns(res);
        if (res[0]) setSmartleadCampaignId(res[0].id);
      })
      .catch((err) => {
        setError(err?.message ?? 'Failed to load Smartlead campaigns');
      });
  }, []);
  useEffect(() => {
    fetchCompanies({ segment: filters.segment || undefined, limit: COHORT_CAP })
      .then((res) => setCompanies(res.map(normalizeCompany)))
      .catch((err) => setError(err?.message ?? 'Failed to load companies'));
  }, [filters.segment]);

  useEffect(() => {
    fetchPromptRegistry()
      .then((res) => {
        setPromptRegistry(res as any[]);
        if (!selectedPromptId && (res as any[])[0]) {
          setSelectedPromptId((res as any[])[0].id);
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!filteredCompanyIds.length) {
      setContacts([]);
      return;
    }
    fetchContacts({ companyIds: filteredCompanyIds, limit: COHORT_CAP })
      .then((res) => setContacts(res.map(normalizeContact)))
      .catch((err) => setError(err?.message ?? 'Failed to load contacts'));
  }, [filteredCompanyIds]);

  const contactStats = computeContactStats(filteredContacts, includedContacts);
  const cohortTooLarge = isCohortTooLarge(filteredContacts.length, COHORT_CAP);

  const applyTransform = (kind: 'shorten' | 'add-proof') => {
    if (kind === 'shorten') {
      setBody(
        'Hey {{first_name}}, quick idea: teams like yours are cutting reply triage by 30% with an AI SDR that filters noise and flags intent. Want the 6-min teardown?'
      );
    }
    if (kind === 'add-proof') {
      setBody(
        `${body}\n\nQuick proof: Acme Ops team saved 12 hrs/week by auto-labeling replies and routing warm leads. Happy to share the playbook.`
      );
    }
  };

  const handleCreateSmartleadCampaign = async () => {
    if (!newCampaignName.trim()) {
      setError('Campaign name is required to create Smartlead campaign.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const created = await createSmartleadCampaign({ name: newCampaignName.trim(), dryRun: false });
      setNewCampaignName('');
      const refreshed = await fetchSmartleadCampaigns();
      setSmartleadCampaigns(refreshed);
      const found = (refreshed as any[]).find((c) => c.id === (created as any).id) ?? created;
      setSmartleadCampaignId((found as any).id);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create Smartlead campaign');
    } finally {
      setLoading(false);
    }
  };

  const snapshotSelectedSegment = async () => {
    if (!selectedSegment) {
      setError('Select a segment to snapshot.');
      return;
    }
    setSnapshotLoading(true);
    setError(null);
    try {
      const res = await snapshotSegment({ segmentId: selectedSegment });
      const anyRes = res as any;
      setSnapshotStatus(`Snapshot v${anyRes.version} ready (${anyRes.count} members)`);
      setSnapshotVersion((anyRes as any).version ?? snapshotVersion);
      setSegments((prev) =>
        prev.map((s) => (s.id === selectedSegment ? { ...s, version: (anyRes as any).version ?? s.version } : s))
      );
    } catch (err: any) {
      setError(err?.message ?? 'Failed to snapshot segment');
    } finally {
      setSnapshotLoading(false);
    }
  };

  const runEnrichment = async () => {
    if (!selectedSegment) {
      setError('Select a segment to enrich.');
      return;
    }
    if (!isSnapshotFinalized(snapshotVersion)) {
      setError('Finalize the segment snapshot before enrichment.');
      return;
    }
    setEnrichLoading(true);
    setError(null);
    try {
      const res = (await enqueueSegmentEnrichment({
        segmentId: selectedSegment,
        adapter: 'mock',
        runNow: true,
      })) as any;
      const status = res?.status ?? res?.summary?.status ?? 'queued';
      setEnrichStatus(status);
      setEnrichJobId(res?.jobId ?? res?.summary?.jobId ?? null);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to enqueue enrichment');
    } finally {
      setEnrichLoading(false);
    }
  };

  const runGenerate = async () => {
    if (!selectedCampaign) {
      setError('Select a campaign first');
      return;
    }
    if (shouldBlockDrafts(selectedSegment, snapshotVersion)) {
      setError('Finalize the selected segment snapshot before generating drafts.');
      return;
    }
    if (!selectedPromptId) {
      setError('Select a prompt');
      return;
    }
    if (cohortTooLarge) {
      setError(`Cohort exceeds cap of ${COHORT_CAP}. Tighten filters.`);
      return;
    }
    setLoading(true);
    setError(null);
    const settings = loadSettings();
    const draftModel = settings.providers.draft;
    try {
      const res = await triggerDraftGenerate(selectedCampaign, {
        dryRun,
        limit,
        dataQualityMode,
        interactionMode,
        provider: draftModel.provider,
        model: draftModel.model,
        promptId: selectedPromptId,
      });
      setDraftSummary(
        `Drafts ready: generated=${res.generated}, dryRun=${res.dryRun}, modes=${dataQualityMode}/${interactionMode}`
      );
    } catch (err: any) {
      setError(err?.message ?? 'Failed to generate drafts');
    } finally {
      setLoading(false);
    }
  };

  const runSend = async () => {
    if (!smartleadReady) {
      setError('Smartlead env missing');
      return;
    }
    if (shouldBlockDrafts(selectedSegment, snapshotVersion)) {
      setError('Finalize the selected segment snapshot before sending.');
      return;
    }
    if (cohortTooLarge) {
      setError(`Cohort exceeds cap of ${COHORT_CAP}. Tighten filters.`);
      return;
    }
    if (!smartleadCampaignId) {
      setError('Select a Smartlead campaign or choose create later.');
      return;
    }
    const leadIds = collectLeadIds(filteredContacts, includedContacts);
    if (!leadIds.length) {
      setError('No outreach-ready contacts with email selected.');
      return;
    }
    const cappedLeadIds = leadIds.slice(0, SMARTLEAD_PREVIEW_CAP);
    const truncated = leadIds.length - cappedLeadIds.length;
    setLoading(true);
    setError(null);
    try {
    const res = await triggerSmartleadPreview({
      dryRun: true,
      batchSize: 10,
      leadIds: cappedLeadIds,
    });
      setSendSummary(
        `Smartlead preview: fetched=${res.fetched ?? 0}, sent=${res.sent ?? 0}, skipped=${res.skipped ?? 0}${
          truncated > 0 ? ` (truncated preview by ${truncated})` : ''
        }`
      );
    } catch (err: any) {
      setError(err?.message ?? 'Failed to preview Smartlead send');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid">
      <div className="card">
        <div className="card__header">
          <div>
            <p className="eyebrow">Workflow 0</p>
            <h2>Audience selection → first email</h2>
            <p className="muted">
              Pick companies, review contacts, lock a base email, and get drafts ready with a bump step.
            </p>
          </div>
          <div className="pill pill--accent">Cohort size guardrail: 5k max</div>
        </div>

        <div className="panel">
          <div className="panel__title">Segment snapshot & enrichment</div>
          <div className="panel__content grid two-column">
            <div>
              <label>
                Segment
                <select value={selectedSegment} onChange={(e) => setSelectedSegment(e.target.value)}>
                  <option value="">Select segment</option>
                  {segments.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name ?? s.id} {isSnapshotFinalized(s.version) ? `(v${s.version})` : '(unfinalized)'}
                    </option>
                  ))}
                </select>
              </label>
              <div className="pill-row" style={{ marginTop: 8 }}>
                <span className="pill pill--subtle">
                  Snapshot: {snapshotVersion !== null ? `v${snapshotVersion}` : 'n/a'}
                </span>
                <span className={`pill ${isSnapshotFinalized(snapshotVersion) ? 'pill--accent' : 'pill--warn'}`}>
                  {isSnapshotFinalized(snapshotVersion) ? 'Finalized' : 'Needs snapshot'}
                </span>
              </div>
            </div>
            <div className="pill-row" style={{ alignItems: 'flex-start' }}>
              <button className="ghost" onClick={snapshotSelectedSegment} disabled={snapshotLoading || !selectedSegment}>
                {snapshotLoading ? 'Finalizing...' : 'Finalize snapshot'}
              </button>
              <button className="ghost" onClick={runEnrichment} disabled={enrichLoading || !selectedSegment}>
                {enrichLoading ? 'Enriching...' : 'Enrich segment'}
              </button>
              {snapshotStatus && <span className="pill pill--subtle">{snapshotStatus}</span>}
              {enrichStatus && (
                <span className="pill pill--subtle">
                  {formatEnrichmentStatus(enrichStatus, enrichJobId)}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel__title">Audience filters</div>
          <div className="panel__content">
            <div className="filter-grid">
              <label>
                Segment
                <select
                  value={filters.segment ?? ''}
                  onChange={(e) => setFilters((f) => ({ ...f, segment: e.target.value }))}
                >
                  <option value="">Any</option>
                  <option value="AI infra">AI infra</option>
                  <option value="Industrial">Industrial</option>
                  <option value="Healthcare">Healthcare</option>
                </select>
              </label>
              <label>
                Office profile
                <select
                  value={filters.officeQualification ?? ''}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      officeQualification: e.target.value as CompanyFilters['officeQualification'],
                    }))
                  }
                >
                  <option value="">Any</option>
                  <option value="More">Office (More)</option>
                  <option value="Less">Office (Less)</option>
                </select>
              </label>
              <label>
                Created within (days)
                <input
                  type="number"
                  value={filters.createdWithinDays ?? ''}
                  onChange={(e) =>
                    setFilters((f) => ({ ...f, createdWithinDays: Number(e.target.value) || undefined }))
                  }
                />
              </label>
              <label>
                Outreach status
                <select
                  value={filters.outreachStatus ?? ''}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      outreachStatus: e.target.value as CompanyFilters['outreachStatus'],
                    }))
                  }
                >
                  <option value="">Any</option>
                  <option value="none">No outreach</option>
                  <option value="warm">Warm</option>
                  <option value="recent">Recent</option>
                </select>
              </label>
            </div>
            <div className="pill-row">
              <span className="pill">Matches {filteredCompanies.length} companies</span>
              <span className="pill pill--subtle">
                Outreach-ready contacts: {contactStats.includedCount} / {filteredContacts.length}
              </span>
              <span className="pill pill--warn">Missing email: {contactStats.missingEmailCount}</span>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel__title">Contacts review</div>
          <div className="panel__content">
            <div className="contact-list">
              {filteredContacts.map((contact) => {
                const included = includedContacts.has(contact.id);
                return (
                  <div key={contact.id} className="contact-row">
                    <div>
                      <div className="contact-name">
                        {contact.name}{' '}
                        <span className={`badge badge--${contact.emailStatus}`}>
                          {contact.emailStatus === 'verified'
                            ? 'work email'
                            : contact.emailStatus === 'generic'
                            ? 'generic'
                            : 'no email'}
                        </span>
                      </div>
                      <div className="muted small">
                        {contact.title} · {contact.persona} persona · {contact.email ?? 'email missing'}
                      </div>
                    </div>
                    <div className="contact-actions">
                      <button
                        className={included ? 'ghost' : ''}
                        onClick={() => {
                          const next = new Set(includedContacts);
                          if (included) {
                            next.delete(contact.id);
                          } else {
                            next.add(contact.id);
                          }
                          setIncludedContacts(next);
                        }}
                      >
                        {included ? 'Exclude' : 'Include'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel__title">Coach: Offer & ICP summary</div>
          <div className="panel__content grid two-column">
            <div>
              <label>
                Offer summary
                <textarea
                  rows={3}
                  defaultValue="AI SDR that triages inbound/outbound replies and flags intent."
                />
              </label>
              <label>
                Target persona
                <textarea rows={2} defaultValue="Ops / RevOps leaders feeling inbox noise and manual QA." />
              </label>
            </div>
            <div>
              <label>
                CTA
                <input defaultValue="6-min teardown call" />
              </label>
              <label>
                Tone
                <select defaultValue="curious">
                  <option value="curious">Curious</option>
                  <option value="direct">Direct</option>
                  <option value="formal">Formal</option>
                </select>
              </label>
              <div className="pill-row" style={{ marginTop: 12 }}>
                <span className="pill pill--accent">Coach ready</span>
                <span className="pill pill--subtle">Interactive Coach mode</span>
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel__title">Base email editor</div>
          <div className="panel__content grid two-column">
            <div>
              <label>
                Subject
                <input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </label>
              <label>
                Body
                <textarea value={body} rows={9} onChange={(e) => setBody(e.target.value)} />
              </label>
              <div className="pill-row">
                <button className="ghost" onClick={() => applyTransform('shorten')}>
                  Shorten
                </button>
                <button className="ghost" onClick={() => applyTransform('add-proof')}>
                  Add proof point
                </button>
              </div>
            </div>
            <div>
              <div className="sequence-card">
                <h4>Sequence setup</h4>
                <label>
                  Data quality mode
                  <select
                    value={dataQualityMode}
                    onChange={(e) => setDataQualityMode(e.target.value as 'strict' | 'graceful')}
                  >
                    <option value="strict">Strict (high confidence only)</option>
                    <option value="graceful">Graceful (allow partial)</option>
                  </select>
                </label>
                <label>
                  Interaction mode
                  <select
                    value={interactionMode}
                    onChange={(e) => setInteractionMode(e.target.value as 'express' | 'coach')}
                  >
                    <option value="express">Pipeline Express</option>
                    <option value="coach">Interactive Coach</option>
                  </select>
                </label>
                <label>
                  Draft limit
                  <input type="number" value={limit} onChange={(e) => setLimit(Number(e.target.value))} />
                </label>
                <label>
                  Prompt
                  <select value={selectedPromptId} onChange={(e) => setSelectedPromptId(e.target.value)}>
                    <option value="">Select prompt</option>
                    {promptRegistry.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.id} {p.step ? `(${p.step})` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Campaign
                  <select value={selectedCampaign} onChange={(e) => setSelectedCampaign(e.target.value)}>
                    <option value="">Select campaign</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Dry-run drafts
                  <input
                    type="checkbox"
                    checked={dryRun}
                    onChange={(e) => setDryRun(e.target.checked)}
                    style={{ marginLeft: 8 }}
                  />
                </label>
                <button onClick={runGenerate} disabled={loading || !selectedCampaign}>
                  Generate drafts
                </button>
                <div className="muted small" style={{ marginTop: 8 }}>
                  Drafts reuse merge fields {'{{ first_name }}'} and {'{{ company_name }}'}; bump will clone
                  subject/body.
                </div>
              </div>
              <div className="sequence-card">
                <h4>Smartlead campaign</h4>
                <label>
                  Select existing
                  <select
                    value={smartleadCampaignId}
                    onChange={(e) => setSmartleadCampaignId(e.target.value)}
                  >
                    <option value="">Choose campaign (required)</option>
                    {smartleadCampaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.status ? `(${c.status})` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="muted small" style={{ marginBottom: 8 }}>
                  Choose an active Smartlead campaign to receive leads; leave blank to block preview.
                </div>
                <div className="pill-row">
                  <span className="pill pill--subtle">Loaded {smartleadCampaigns.length} campaigns</span>
                  <span className="pill pill--subtle">Preview caps at {SMARTLEAD_PREVIEW_CAP} leads</span>
                </div>
                <div style={{ marginTop: 10 }}>
                  <label>
                    Or create new
                    <input
                      placeholder="New campaign name"
                      value={newCampaignName}
                      onChange={(e) => setNewCampaignName(e.target.value)}
                      style={{ marginTop: 6 }}
                    />
                  </label>
                  <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
                    <button className="ghost" onClick={handleCreateSmartleadCampaign} disabled={loading}>
                      Create & select
                    </button>
                    <small className="muted">Creates immediately via Smartlead API.</small>
                  </div>
                </div>
              </div>

              <div className="sequence-card">
                <h4>Bump email</h4>
                <label>
                  Delay (days)
                  <input
                    type="number"
                    value={bumpDelay}
                    onChange={(e) => setBumpDelay(Number(e.target.value))}
                  />
                </label>
                <label>
                  Tone
                  <select value={bumpTone} onChange={(e) => setBumpTone(e.target.value as 'curious' | 'direct')}>
                    <option value="curious">Curious</option>
                    <option value="direct">Direct</option>
                  </select>
                </label>
                <div className="muted small">Condition: send if no reply, no positive outcome.</div>
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel__title">Draft QA & Smartlead readiness</div>
          <div className="panel__content grid two-column">
            <div>
              <p className="muted">
                Drafts will be written to Supabase with statuses (generated, edited, regenerated). Use dry-run to
                sanity check payloads before pushing to Smartlead.
              </p>
              <div className="pill-row">
                <span className="pill pill--accent">Smartlead</span>
                <span className={`pill ${smartleadReady ? 'pill--subtle' : 'pill--warn'}`}>
                  {smartleadReady ? 'Ready from env' : 'Missing SMARTLEAD envs'}
                </span>
              </div>
              <button className="ghost" onClick={runSend} disabled={!smartleadReady || loading}>
                Preview Smartlead send
              </button>
              {sendSummary && <div className="muted" style={{ marginTop: 6 }}>{sendSummary}</div>}
            </div>
            <div>
              <ul className="checklist">
                <li>
                  <input type="checkbox" defaultChecked /> Base email reviewed for anchor contact
                </li>
                <li>
                  <input type="checkbox" defaultChecked /> Contacts with missing email excluded or enriched
                </li>
                <li>
                  <input type="checkbox" /> Sequence bump configured with delay and tone
                </li>
              </ul>
            </div>
          </div>
        </div>

        {draftSummary && <Alert kind="success">{draftSummary}</Alert>}
        {error && <Alert kind="error">{error}</Alert>}
        {loading && <Alert>Working...</Alert>}
      </div>
    </div>
  );
}
