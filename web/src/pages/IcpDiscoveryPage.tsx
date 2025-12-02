import { useEffect, useMemo, useState } from 'react';

import { Alert } from '../components/Alert';
import {
  createIcpHypothesis,
  createIcpProfile,
  fetchCampaigns,
  fetchIcpHypotheses,
  fetchIcpProfiles,
  fetchSegments,
  generateHypothesisViaCoach,
  generateIcpProfileViaCoach,
  type Campaign,
  type SegmentRow as ApiSegmentRow,
} from '../apiClient';
import { isSnapshotFinalized } from './WorkflowZeroPage';

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

const candidates: CandidateCompany[] = [
  { id: 'cc1', name: 'Voltworks Energy', domain: 'voltworks.io', country: 'US', size: '200-500', confidence: 0.78 },
  { id: 'cc2', name: 'Atlas Robotics', domain: 'atlasrobotics.ai', country: 'DE', size: '50-200', confidence: 0.62 },
  { id: 'cc3', name: 'Nova Freight', domain: 'novafreight.com', country: 'US', size: '500-1000', confidence: 0.55 },
  { id: 'cc4', name: 'CarePoint Health', domain: 'carepoint.health', country: 'UK', size: '200-500', confidence: 0.7 },
];

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
  const [generatedIcp, setGeneratedIcp] = useState<any | null>(null);
  const [generatedHypothesis, setGeneratedHypothesis] = useState<any | null>(null);
  const [newProfileName, setNewProfileName] = useState('AI SDR ICP');
  const [newHypothesisLabel, setNewHypothesisLabel] = useState('High-volume inbound → triage');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(['cc1', 'cc4']));
  const [notes, setNotes] = useState('Focus on ops-heavy teams with distributed offices and noisy inbound.');
  const queries = useMemo(() => deriveQueries(form), [form]);

  const toggle = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const refreshProfiles = async () => {
    try {
      const data = await fetchIcpProfiles();
      setProfiles(data as any[]);
      const defaultId = pickDefaultProfile(data as any[]);
      if (!selectedProfileId && defaultId) {
        setSelectedProfileId(defaultId);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load ICP profiles');
    }
  };

  const refreshHypotheses = async (profileId?: string) => {
    try {
      const data = await fetchIcpHypotheses(profileId ? { icpProfileId: profileId } : {});
      setHypotheses(data as any[]);
      const defaultHyp = pickDefaultHypothesis(data as any[]);
      if (!selectedHypothesisId && defaultHyp) {
        setSelectedHypothesisId(defaultHyp);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load ICP hypotheses');
    }
  };

  useEffect(() => {
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
    setLoading(true);
    setError(null);
    try {
      const icp = await generateIcpProfileViaCoach({ name: newProfileName.trim() });
      setGeneratedIcp(icp);
      await refreshProfiles();
      setSelectedProfileId((icp as any).id ?? selectedProfileId);
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
    setLoading(true);
    setError(null);
    try {
      const hyp = await generateHypothesisViaCoach({ icpProfileId: selectedProfileId, hypothesisLabel: label });
      setGeneratedHypothesis(hyp);
      await refreshHypotheses(selectedProfileId);
      setSelectedHypothesisId((hyp as any).id ?? selectedHypothesisId);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to generate hypothesis via coach');
    } finally {
      setLoading(false);
    }
  };

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
                  Generated ICP id: {(generatedIcp as any).id}
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
                  Generated hypothesis id: {(generatedHypothesis as any).id}
                </div>
              )}
            </div>
          </div>
        </div>

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
            <div className="table-lite">
              <div className="table-lite__head">
                <span>Company</span>
                <span>Country</span>
                <span>Size</span>
                <span>Confidence</span>
                <span>Decision</span>
              </div>
              {candidates.map((c) => (
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
                {selectedIds.size} approved / {candidates.length} candidates
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
              <ul className="checklist">
                <li>
                  <input type="checkbox" defaultChecked /> Hypothesis stored for analytics
                </li>
                <li>
                  <input type="checkbox" /> Apply confidence + source metadata
                </li>
                <li>
                  <input type="checkbox" /> Enrichment capped per run
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
