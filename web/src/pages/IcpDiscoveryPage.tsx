// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from 'react';

import { Alert } from '../components/Alert';
import {
  createIcpHypothesis,
  createIcpProfile,
  fetchCampaigns,
  fetchIcpDiscoveryCandidates,
  fetchIcpHypotheses,
  fetchIcpProfiles,
  fetchSegments,
  generateHypothesisViaCoach,
  generateIcpProfileViaCoach,
  triggerIcpDiscovery,
  promoteIcpDiscoveryCandidates,
  type Campaign,
  type SegmentRow as ApiSegmentRow,
} from '../apiClient';
import { loadSettings } from '../hooks/useSettingsStore';
import { isSnapshotFinalized } from './WorkflowZeroPage';
import {
  appendChatMessage,
  buildHypothesisSummaryFromSearchConfig,
  buildIcpSummaryFromProfile,
  formatHypothesisSummaryForChat,
  formatIcpSummaryForChat,
  getPersistedDiscoveryRun,
} from './PipelineWorkspaceWithSidebar';

type IcpForm = {
  industry: string;
  size: string;
  geo: string;
  persona: string;
  pains: string;
  hypothesis: string;
};

type CandidateCompany = {
  id: string;
  name: string;
  domain: string;
  country: string;
  size: string;
  confidence: number;
};

export function mapDiscoveryCandidatesToCompanies(
  apiCandidates: Array<{
    id: string;
    name: string | null;
    domain: string | null;
    url: string | null;
    country: string | null;
    size: string | null;
    confidence: number | null;
  }>
): CandidateCompany[] {
  return apiCandidates.map((c) => ({
    id: c.id,
    name: c.name ?? c.domain ?? c.url ?? c.id,
    domain: c.domain ?? '',
    country: c.country ?? '',
    size: c.size ?? '',
    confidence: typeof c.confidence === 'number' ? c.confidence : 0,
  }));
}

export function deriveQueries(form: IcpForm) {
  const base = `${form.industry} ${form.persona} ${form.geo}`.trim();
  const pains = form.pains ? ` pains:${form.pains.split(',')[0]}` : '';
  const size = form.size ? ` size:${form.size}` : '';
  return [`${base}${pains}${size}`, `${form.industry} expansion ${form.geo}`, `${form.persona} hiring ${form.geo}`];
}

export function pickDefaultProfile(profiles: Array<{ id: string }> = []) {
  return profiles[0]?.id ?? '';
}

export function pickDefaultHypothesis(hypotheses: Array<{ id: string }> = []) {
  return hypotheses[0]?.id ?? '';
}

export function appendDiscoveryChatMessage(messages: any[] | null | undefined, message: any) {
  const base = Array.isArray(messages) ? messages : [];
  const next = appendChatMessage(base, message);
  return next.slice(-4);
}

export function formatIcpSummaryForChatDiscovery(summary: any) {
  return formatIcpSummaryForChat(summary);
}

export function formatHypothesisSummaryForChatDiscovery(summary: any) {
  return formatHypothesisSummaryForChat(summary);
}

export function IcpDiscoveryPage() {
  const [form, setForm] = useState<IcpForm>({
    industry: 'AI infra',
    size: '50-500',
    geo: 'US/EU',
    persona: 'RevOps',
    pains: 'signal-to-noise,manual triage',
    hypothesis: 'High-volume inbound → needs reply triage',
  });
  const [segments, setSegments] = useState<ApiSegmentRow[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>('');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('');
  const [profiles, setProfiles] = useState<Array<{ id: string; name: string }>>([]);
  const [hypotheses, setHypotheses] = useState<Array<{ id: string; hypothesis_label: string }>>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [selectedHypothesisId, setSelectedHypothesisId] = useState<string>('');
  const [generatedIcp, setGeneratedIcp] = useState<{ id: string; name?: string; jobId?: string } | null>(null);
  const [generatedHypothesis, setGeneratedHypothesis] = useState<{
    id: string;
    hypothesis_label?: string;
    jobId?: string;
  } | null>(null);
  const [newProfileName, setNewProfileName] = useState('AI SDR ICP');
  const [newHypothesisLabel, setNewHypothesisLabel] = useState('High-volume inbound → triage');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('Focus on ops-heavy teams with distributed offices and noisy inbound.');
  const [discoveryRunId, setDiscoveryRunId] = useState('');
  const [candidateCompanies, setCandidateCompanies] = useState<CandidateCompany[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [promotionStatus, setPromotionStatus] = useState<string | null>(null);
  const initialPersistedRunIdRef = useRef<string | null>(null);
  const autoLoadedCandidatesRef = useRef(false);
  const queries = useMemo(() => deriveQueries(form), [form]);
  const [discoveryStatus, setDiscoveryStatus] = useState<string | null>(null);
  const [icpChatMessages, setIcpChatMessages] = useState<any[]>([]);
  const [hypothesisChatMessages, setHypothesisChatMessages] = useState<any[]>([]);

  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const refreshProfiles = async (): Promise<any[]> => {
    try {
      const data = await fetchIcpProfiles();
      setProfiles(data as any[]);
      const defaultId = pickDefaultProfile(data as any[]);
      if (defaultId) {
        setSelectedProfileId((prev) => prev || defaultId);
      }
      return data as any[];
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load ICP profiles');
      return [];
    }
  };

  const refreshHypotheses = async (profileId?: string): Promise<any[]> => {
    try {
      const data = await fetchIcpHypotheses(profileId ? { icpProfileId: profileId } : {});
      setHypotheses(data as any[]);
      const defaultHyp = pickDefaultHypothesis(data as any[]);
      if (defaultHyp) {
        setSelectedHypothesisId((prev) => prev || defaultHyp);
      }
      return data as any[];
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load ICP hypotheses');
      return [];
    }
  };

  useEffect(() => {
    const persisted = getPersistedDiscoveryRun();
    if (persisted?.runId) {
      initialPersistedRunIdRef.current = persisted.runId;
      setDiscoveryRunId((prev) => prev || persisted.runId);
      if (persisted.icpProfileId) {
        setSelectedProfileId((prev) => prev || persisted.icpProfileId!);
      }
      if (persisted.icpHypothesisId) {
        setSelectedHypothesisId((prev) => prev || persisted.icpHypothesisId!);
      }
    } else {
      initialPersistedRunIdRef.current = null;
    }
    refreshProfiles().then(() => refreshHypotheses().catch(() => undefined)).catch(() => undefined);
    fetchSegments()
      .then((seg) => {
        setSegments(seg as any[]);
        const defaultSeg = (seg as any[])[0]?.id;
        if (!selectedSegmentId && defaultSeg) setSelectedSegmentId(defaultSeg);
      })
      .catch(() => undefined);
    fetchCampaigns()
      .then((c) => {
        setCampaigns(c as any[]);
        const defaultCamp = (c as any[])[0]?.id;
        if (!selectedCampaignId && defaultCamp) setSelectedCampaignId(defaultCamp);
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedProfileId) {
      refreshHypotheses(selectedProfileId).catch(() => undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProfileId]);

  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) {
      setError('Profile name is required');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const created = (await createIcpProfile({ name: newProfileName.trim() })) as any;
      await refreshProfiles();
      setSelectedProfileId(created.id);
      setNewProfileName('');
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateHypothesis = async () => {
    if (!selectedProfileId) {
      setError('Select an ICP profile first');
      return;
    }
    if (!newHypothesisLabel.trim()) {
      setError('Hypothesis label is required');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const created = (await createIcpHypothesis({
        icpProfileId: selectedProfileId,
        hypothesisLabel: newHypothesisLabel.trim(),
      })) as any;
      await refreshHypotheses(selectedProfileId);
      setSelectedHypothesisId(created.id);
      setNewHypothesisLabel('');
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create hypothesis');
    } finally {
      setLoading(false);
    }
  };

  const runCoachIcpGeneration = async () => {
    if (!newProfileName.trim()) {
      setError('Profile name is required');
      return;
    }
    const prompt = newProfileName.trim();
    setIcpChatMessages((prev) =>
      appendDiscoveryChatMessage(prev, {
        role: 'user',
        text: prompt,
      })
    );
    setLoading(true);
    setError(null);
    try {
      const settings = loadSettings();
      const cfg = settings.providers.icp;
      const promptId = settings.taskPrompts?.icpDiscovery;
      const icp = await generateIcpProfileViaCoach({
        name: prompt,
        userPrompt: prompt,
        provider: cfg.provider,
        model: cfg.model,
        ...(promptId ? { promptId } : {}),
      });
      setGeneratedIcp(icp as any);
      const rows = await refreshProfiles();
      const fullProfile = (rows as any[]).find((row) => row.id === icp.id) ?? null;
      if (fullProfile) {
        const summary = buildIcpSummaryFromProfile(fullProfile);
        const text = formatIcpSummaryForChatDiscovery(summary);
        if (text) {
          setIcpChatMessages((prev) =>
            appendDiscoveryChatMessage(prev, {
              role: 'assistant',
              text,
            })
          );
        }
      }
      setSelectedProfileId(icp.id ?? selectedProfileId);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to generate ICP via coach');
    } finally {
      setLoading(false);
    }
  };

  const runCoachHypothesisGeneration = async () => {
    if (!selectedProfileId) {
      setError('Select an ICP profile first');
      return;
    }
    const label = newHypothesisLabel.trim() || 'ICP hypothesis';
    setHypothesisChatMessages((prev) =>
      appendDiscoveryChatMessage(prev, {
        role: 'user',
        text: label,
      })
    );
    setLoading(true);
    setError(null);
    try {
      const settings = loadSettings();
      const cfg = settings.providers.hypothesis;
      const promptId = settings.taskPrompts?.hypothesisGen;
      const hyp = await generateHypothesisViaCoach({
        icpProfileId: selectedProfileId,
        hypothesisLabel: label,
        userPrompt: label,
        provider: cfg.provider,
        model: cfg.model,
        ...(promptId ? { promptId } : {}),
      });
      setGeneratedHypothesis(hyp as any);
      const rows = await refreshHypotheses(selectedProfileId);
      const fullHypothesis = (rows as any[]).find((row) => row.id === hyp.id) ?? null;
      if (fullHypothesis) {
        const summary = buildHypothesisSummaryFromSearchConfig(fullHypothesis);
        const text = formatHypothesisSummaryForChatDiscovery(summary);
        if (text) {
          setHypothesisChatMessages((prev) =>
            appendDiscoveryChatMessage(prev, {
              role: 'assistant',
              text,
            })
          );
        }
      }
      setSelectedHypothesisId(hyp.id ?? selectedHypothesisId);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to generate hypothesis via coach');
    } finally {
      setLoading(false);
    }
  };

  const loadCandidatesForRun = async () => {
    if (!discoveryRunId.trim()) {
      setError('Discovery run id is required to load candidates.');
      return;
    }
    setCandidatesLoading(true);
    setError(null);
    try {
      const apiCandidates = await fetchIcpDiscoveryCandidates({
        runId: discoveryRunId.trim(),
        icpProfileId: selectedProfileId || undefined,
        icpHypothesisId: selectedHypothesisId || undefined,
      });
      const companies = mapDiscoveryCandidatesToCompanies(apiCandidates as any);
      setCandidateCompanies(companies);
      setSelectedIds(new Set(companies.map((c) => c.id)));
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load discovery candidates');
    } finally {
      setCandidatesLoading(false);
    }
  };

  useEffect(() => {
    if (!initialPersistedRunIdRef.current) return;
    if (!discoveryRunId || discoveryRunId !== initialPersistedRunIdRef.current) return;
    if (autoLoadedCandidatesRef.current) return;
    autoLoadedCandidatesRef.current = true;
    loadCandidatesForRun().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discoveryRunId]);

  const handleRunDiscovery = async () => {
    if (!selectedProfileId) {
      setError('Select an ICP profile before running discovery.');
      return;
    }
    setLoading(true);
    setError(null);
    setDiscoveryStatus(null);
    try {
      const result = await triggerIcpDiscovery({
        icpProfileId: selectedProfileId,
        icpHypothesisId: selectedHypothesisId || undefined,
      });
      setDiscoveryRunId(result.runId);
      setDiscoveryStatus(`Discovery run ${result.runId} started (${result.status}).`);
      await loadCandidatesForRun();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to run ICP discovery');
    } finally {
      setLoading(false);
    }
  };

  const handlePromoteCandidates = async () => {
    if (!discoveryRunId.trim()) {
      setError('Discovery run id is required to promote candidates.');
      return;
    }
    if (!selectedSegmentId) {
      setError('Select a target segment before promoting.');
      return;
    }
    const approvedIds = candidateCompanies
      .map((c) => c.id)
      .filter((id) => selectedIds.has(id));
    if (approvedIds.length === 0) {
      setError('Select at least one approved candidate to promote.');
      return;
    }
    setLoading(true);
    setError(null);
    setPromotionStatus(null);
    try {
      const result = await promoteIcpDiscoveryCandidates({
        runId: discoveryRunId.trim(),
        candidateIds: approvedIds,
        segmentId: selectedSegmentId,
      });
      const targetSegment = segments.find((s) => s.id === selectedSegmentId);
      const segmentLabel = targetSegment?.name ?? selectedSegmentId;
      setPromotionStatus(`Promoted ${result.promotedCount} companies from run ${discoveryRunId} into segment “${segmentLabel}”.`);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to promote candidates into segment');
    } finally {
      setLoading(false);
    }
  };

  const selectedProfile = useMemo(
    () => profiles.find((p: any) => p.id === selectedProfileId) as any,
    [profiles, selectedProfileId]
  );

  const selectedHypothesis = useMemo(
    () => hypotheses.find((h: any) => h.id === selectedHypothesisId) as any,
    [hypotheses, selectedHypothesisId]
  );

  const icpSummary = useMemo(() => {
    if (!selectedProfile) return null;
    const company = (selectedProfile as any).company_criteria ?? {};
    const persona = (selectedProfile as any).persona_criteria ?? {};
    const phases = (selectedProfile as any).phase_outputs ?? {};
    const phase1 = phases.phase1 ?? {};
    const phase2 = phases.phase2 ?? {};
    const phase3 = phases.phase3 ?? {};

    const valueProp = phase1.valueProp ?? company.valueProp;

    const industries =
      (phase2.industryAndSize && phase2.industryAndSize.industries) || company.industries || [];
    const companySizes =
      (phase2.industryAndSize && phase2.industryAndSize.companySizes) || company.companySizes || [];

    const pains = phase2.pains || company.pains || [];
    const decisionMakers = phase2.decisionMakers || persona.decisionMakers || [];

    const triggers = phase3.triggers || company.triggers || [];

    return {
      valueProp,
      industries,
      companySizes,
      pains,
      decisionMakers,
      triggers,
    };
  }, [selectedProfile]);

  const hypothesisSummary = useMemo(() => {
    if (!selectedHypothesis) return null;
    const searchConfig = (selectedHypothesis as any).search_config ?? {};
    const phases = searchConfig.phases ?? {};
    const phase4 = phases.phase4 ?? {};
    const phase5 = phases.phase5 ?? {};
    const offers = phase4.offers || [];
    const critiques = phase5.critiques || [];
    const regions = searchConfig.region || [];
    return {
      label: (selectedHypothesis as any).hypothesis_label ?? (selectedHypothesis as any).hypothesisLabel,
      regions,
      offers,
      critiques,
    };
  }, [selectedHypothesis]);

  return (
    <div className="grid">
      <div className="card">
        <div className="card__header">
          <div>
            <p className="eyebrow">Workflow 1</p>
            <h2>ICP discovery & prospect expansion</h2>
            <p className="muted">Translate ICPs into Exa queries, review candidates, and push approved companies.</p>
          </div>
          <div className="pill pill--accent">Exa MCP gated · capped runs</div>
        </div>

        {error && (
          <div style={{ marginBottom: 12 }}>
            <Alert kind="error">{error}</Alert>
          </div>
        )}

        <div className="panel">
          <div className="panel__title">ICP profiles & hypotheses</div>
          <div className="panel__content grid two-column">
            <div>
              <label>
                ICP profile
                <select value={selectedProfileId} onChange={(e) => setSelectedProfileId(e.target.value)}>
                  <option value="">Select profile</option>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name ?? p.id}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                New profile
                <input value={newProfileName} onChange={(e) => setNewProfileName(e.target.value)} placeholder="Name" />
              </label>
              <div className="pill-row" style={{ marginTop: 8 }}>
                <button className="ghost" onClick={handleCreateProfile} disabled={loading}>
                  {loading ? 'Saving...' : 'Create profile'}
                </button>
                <button className="ghost" onClick={runCoachIcpGeneration} disabled={loading}>
                  {loading ? 'Generating...' : 'Generate via coach'}
                </button>
              </div>
              {generatedIcp && (
                <div className="muted small" style={{ marginTop: 6 }}>
                  Coach result:{' '}
                  <strong>{generatedIcp.name ?? 'ICP profile'}</strong> ({generatedIcp.id}
                  {generatedIcp.jobId ? ` · job ${generatedIcp.jobId}` : ''})
                </div>
              )}
            </div>
            <div>
              <label>
                Hypothesis
                <select value={selectedHypothesisId} onChange={(e) => setSelectedHypothesisId(e.target.value)}>
                  <option value="">Select hypothesis</option>
                  {hypotheses.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.hypothesis_label ?? h.id}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                New hypothesis
                <input
                  value={newHypothesisLabel}
                  onChange={(e) => setNewHypothesisLabel(e.target.value)}
                  placeholder="Label"
                />
              </label>
              <div className="pill-row" style={{ marginTop: 8 }}>
                <button className="ghost" onClick={handleCreateHypothesis} disabled={loading || !selectedProfileId}>
                  {loading ? 'Saving...' : 'Create hypothesis'}
                </button>
                <button className="ghost" onClick={runCoachHypothesisGeneration} disabled={loading || !selectedProfileId}>
                  {loading ? 'Generating...' : 'Generate via coach'}
                </button>
              </div>
              {generatedHypothesis && (
                <div className="muted small" style={{ marginTop: 6 }}>
                  Coach result:{' '}
                  <strong>{generatedHypothesis.hypothesis_label ?? 'ICP hypothesis'}</strong> (
                  {generatedHypothesis.id}
                  {generatedHypothesis.jobId ? ` · job ${generatedHypothesis.jobId}` : ''})
                </div>
              )}
            </div>
          </div>
        </div>

        {(icpChatMessages.length > 0 || hypothesisChatMessages.length > 0) && (
          <div className="panel">
            <div className="panel__title">Coach conversation (latest runs)</div>
            <div className="panel__content">
              <div className="muted small" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {icpChatMessages.map((msg, idx) => (
                  <div key={`icp-${idx}`}>
                    <strong>{msg.role === 'user' ? 'You (ICP):' : 'Coach (ICP):'}</strong> {msg.text}
                  </div>
                ))}
                {hypothesisChatMessages.map((msg, idx) => (
                  <div key={`hyp-${idx}`}>
                    <strong>{msg.role === 'user' ? 'You (Hypothesis):' : 'Coach (Hypothesis):'}</strong> {msg.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {icpSummary && (
          <div className="panel">
            <div className="panel__title">ICP Summary</div>
            <div className="panel__content">
              <div className="muted small">
                {icpSummary.valueProp && (
                  <div>Value prop: {icpSummary.valueProp}</div>
                )}
                {icpSummary.industries && icpSummary.industries.length > 0 && (
                  <div>
                    Industries: {icpSummary.industries.join(', ')}
                    {icpSummary.companySizes && icpSummary.companySizes.length
                      ? ` (${icpSummary.companySizes.join(', ')})`
                      : ''}
                  </div>
                )}
                {icpSummary.pains && icpSummary.pains.length > 0 && (
                  <div>Pains: {icpSummary.pains.join(', ')}</div>
                )}
                {icpSummary.decisionMakers && icpSummary.decisionMakers.length > 0 && (
                  <div>
                    Decision makers:{' '}
                    {icpSummary.decisionMakers
                      .map((d: any) => d.role)
                      .filter(Boolean)
                      .join(', ')}
                  </div>
                )}
                {icpSummary.triggers && icpSummary.triggers.length > 0 && (
                  <div>Triggers: {icpSummary.triggers.join(', ')}</div>
                )}
              </div>
            </div>
          </div>
        )}

        {hypothesisSummary && (
          <div className="panel">
            <div className="panel__title">Hypothesis Summary</div>
            <div className="panel__content">
              <div className="muted small">
                <div>{hypothesisSummary.label}</div>
                {hypothesisSummary.regions && hypothesisSummary.regions.length > 0 && (
                  <div>Region: {hypothesisSummary.regions.join(', ')}</div>
                )}
                {hypothesisSummary.offers && hypothesisSummary.offers.length > 0 && (
                  <div>
                    Offers:{' '}
                    {hypothesisSummary.offers
                      .map((o: any) => `${o.personaRole} – ${o.offer}`)
                      .join('; ')}
                  </div>
                )}
                {hypothesisSummary.critiques && hypothesisSummary.critiques.length > 0 && (
                  <div>
                    Critiques:{' '}
                    {hypothesisSummary.critiques
                      .map((c: any) => c.roast)
                      .filter(Boolean)
                      .join('; ')}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="panel">
          <div className="panel__title">ICP definition</div>
          <div className="panel__content grid two-column">
            <div>
              <label>
                Industry
                <input value={form.industry} onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))} />
              </label>
              <label>
                Size
                <input value={form.size} onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))} />
              </label>
              <label>
                Geo
                <input value={form.geo} onChange={(e) => setForm((f) => ({ ...f, geo: e.target.value }))} />
              </label>
            </div>
            <div>
              <label>
                Persona
                <input
                  value={form.persona}
                  onChange={(e) => setForm((f) => ({ ...f, persona: e.target.value }))}
                />
              </label>
              <label>
                Pains
                <input value={form.pains} onChange={(e) => setForm((f) => ({ ...f, pains: e.target.value }))} />
              </label>
              <label>
                Hypothesis
                <textarea
                  rows={3}
                  value={form.hypothesis}
                  onChange={(e) => setForm((f) => ({ ...f, hypothesis: e.target.value }))}
                />
              </label>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel__title">Query plan (Exa Websets)</div>
          <div className="panel__content grid two-column">
            <div>
              <ul className="pill-list">
                {queries.map((q) => (
                  <li key={q} className="pill pill--subtle">
                    {q}
                  </li>
                ))}
              </ul>
              <p className="muted small">Limit per run: 3 queries · 200 companies.</p>
            </div>
            <div>
              <label>
                Run notes
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>
              <div className="pill-row" style={{ marginTop: 8 }}>
                <button className="ghost" onClick={handleRunDiscovery} disabled={loading || !selectedProfileId}>
                  {loading ? 'Starting…' : 'Run discovery'}
                </button>
              </div>
              {discoveryStatus && (
                <div className="muted small" style={{ marginTop: 6 }}>
                  {discoveryStatus}
                </div>
              )}
              <Alert kind="info">
                Keep MCP surface minimal: `exa_websets_search` + controlled AnySite for LinkedIn enrichment. Capture
                cost estimates before running.
              </Alert>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel__title">Pre-import review</div>
          <div className="panel__content">
            <div style={{ marginBottom: 8 }}>
              <label>
                Discovery run id
                <input
                  style={{ marginLeft: 8, width: '60%' }}
                  placeholder="Paste run id from icp:discover output"
                  value={discoveryRunId}
                  onChange={(e) => setDiscoveryRunId(e.target.value)}
                />
              </label>
              <button
                className="ghost"
                style={{ marginLeft: 8 }}
                onClick={loadCandidatesForRun}
                disabled={candidatesLoading}
              >
                {candidatesLoading ? 'Loading...' : 'Load candidates'}
              </button>
            </div>
            <div className="table-lite">
              <div className="table-lite__head">
                <span>Company</span>
                <span>Country</span>
                <span>Size</span>
                <span>Confidence</span>
                <span>Decision</span>
              </div>
              {candidateCompanies.length === 0 && discoveryRunId.trim() && !candidatesLoading && (
                <div className="table-lite__row">
                  <span className="muted small" style={{ gridColumn: '1 / -1' }}>
                    No candidates found for this run. Check your ICP filters or rerun discovery.
                  </span>
                </div>
              )}
              {candidateCompanies.map((c) => (
                <div key={c.id} className="table-lite__row">
                  <span>
                    <strong>{c.name}</strong> <span className="muted small">{c.domain}</span>
                  </span>
                  <span>{c.country}</span>
                  <span>{c.size}</span>
                  <span>{Math.round(c.confidence * 100)}%</span>
                  <span>
                    <button className={selectedIds.has(c.id) ? '' : 'ghost'} onClick={() => toggle(c.id)}>
                      {selectedIds.has(c.id) ? 'Approve' : 'Discard'}
                    </button>
                  </span>
                </div>
              ))}
            </div>
            <div className="pill-row" style={{ marginTop: 12 }}>
              <span className="pill pill--accent">
                {selectedIds.size} approved / {candidateCompanies.length} candidates
              </span>
              <span className="pill pill--subtle">LinkedIn enrichment follows approval</span>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel__title">Hand-off to segments</div>
          <div className="panel__content grid two-column">
            <div>
              <p className="muted">
                Approved companies will be tagged with `icp_id` + `hypothesis_id`, then routed to the segmentation
                engine. Contacts inherit tags for downstream analytics.
              </p>
              <div className="pill-row">
                <span className="pill">icp_profiles</span>
                <span className="pill">icp_hypotheses</span>
                <span className="pill pill--subtle">segment_members</span>
              </div>
            </div>
            <div>
              <label>
                Target segment
                <select value={selectedSegmentId} onChange={(e) => setSelectedSegmentId(e.target.value)}>
                  <option value="">Select segment</option>
                  {segments.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name ?? s.id}
                    </option>
                  ))}
                </select>
              </label>
              <div className="pill-row" style={{ marginTop: 8 }}>
                <button
                  className="ghost"
                  onClick={handlePromoteCandidates}
                  disabled={loading || !selectedSegmentId || selectedIds.size === 0}
                >
                  {loading ? 'Promoting...' : 'Promote approved candidates'}
                </button>
              </div>
              {promotionStatus && (
                <div className="muted small" style={{ marginTop: 6 }}>
                  {promotionStatus}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
