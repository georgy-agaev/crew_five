import { useMemo, useState } from 'react';

import { Alert } from '../components/Alert';
import { createSimJob } from '../apiClient';

type Persona = {
  id: string;
  name: string;
  title: string;
  mood: 'skeptical' | 'curious' | 'neutral';
  painFocus: 'signal' | 'quality' | 'deliverability';
};

type SimInputs = {
  email: string;
  valueProp: string;
  mode: 'full_sim' | 'offer_roast';
};

const seedPersonas: Persona[] = [
  { id: 'p1', name: 'Morgan Lee', title: 'VP RevOps', mood: 'curious', painFocus: 'signal' },
  { id: 'p2', name: 'Priya Nair', title: 'Director of Sales Ops', mood: 'skeptical', painFocus: 'quality' },
  { id: 'p3', name: 'Leo Santos', title: 'Head of Marketing Ops', mood: 'neutral', painFocus: 'deliverability' },
];

export function scoreSim(inputs: SimInputs) {
  const base = inputs.mode === 'offer_roast' ? 0.5 : 0.65;
  const lengthPenalty = inputs.email.length > 900 ? 0.1 : 0;
  const valueBonus = inputs.valueProp.includes('reduce noise') ? 0.15 : 0;
  return Math.min(1, base + valueBonus - lengthPenalty);
}

export function simStatusLabel(status?: string | null, jobId?: string | null) {
  if (!status) return 'Not started';
  return jobId ? `${status} (#${jobId})` : status;
}

export function SimPage() {
  const [mode, setMode] = useState<SimInputs['mode']>('full_sim');
  const [valueProp, setValueProp] = useState('AI SDR triages replies, labels intent, and routes warm leads.');
  const [email, setEmail] = useState(
    'Subject: How {{company_name}} can reduce reply triage\n\nNoticed your team handles a high volume of inbound and outbound replies. We help RevOps teams cut manual QA by 30% with an AI SDR that filters noise and flags intent instantly.'
  );
  const [seedSelection, setSeedSelection] = useState<Set<string>>(new Set(['p1', 'p3']));
  const [notes, setNotes] = useState('Prioritize inbox behaviors and objection risk (cost/credibility).');
  const [seedInput, setSeedInput] = useState('https://linkedin.com/in/revops-leader-1');
  const [segmentRef, setSegmentRef] = useState('sample-segment');
  const [simStatus, setSimStatus] = useState<string | null>(null);
  const [simJobId, setSimJobId] = useState<string | null>(null);
  const [simError, setSimError] = useState<string | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  const alignmentScore = useMemo(() => scoreSim({ email, valueProp, mode }), [email, valueProp, mode]);

  const togglePersona = (id: string) => {
    const next = new Set(seedSelection);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSeedSelection(next);
  };

  const runSimStub = async () => {
    setSimLoading(true);
    setSimError(null);
    try {
      const res = await createSimJob({ segmentId: segmentRef, mode });
      setSimStatus((res as any).status ?? 'coming_soon');
      setSimJobId((res as any).jobId ?? null);
    } catch (err: any) {
      setSimError(err?.message ?? 'Failed to start SIM');
    } finally {
      setSimLoading(false);
    }
  };

  return (
    <div className="grid">
      <div className="card">
        <div className="card__header">
          <div>
            <p className="eyebrow">Workflow 2</p>
            <h2>Prospect reaction simulation</h2>
            <p className="muted">Run a light SIM or offer roast to de-risk messaging before sending.</p>
          </div>
          <div className="pill pill--accent">Decision support · not a send engine</div>
        </div>

        <div className="panel">
          <div className="panel__title">Setup</div>
          <div className="panel__content grid two-column">
            <div>
              <label>
                Mode
                <select value={mode} onChange={(e) => setMode(e.target.value as SimInputs['mode'])}>
                  <option value="full_sim">Full SIM (persona inbox)</option>
                  <option value="offer_roast">Offer roast (skeptical buyer)</option>
                </select>
              </label>
              <label>
                Value proposition
                <textarea rows={3} value={valueProp} onChange={(e) => setValueProp(e.target.value)} />
              </label>
              <label>
                Segment id (required)
                <input value={segmentRef} onChange={(e) => setSegmentRef(e.target.value)} />
              </label>
              <div style={{ marginTop: 8 }}>
                <button onClick={runSimStub} disabled={simLoading || !segmentRef}>
                  {simLoading ? 'Submitting...' : 'Run SIM stub'}
                </button>
              </div>
              {simError && <Alert kind="error">{simError}</Alert>}
              {simStatus && (
                <div className="pill-row" style={{ marginTop: 6 }}>
                  <span className="pill pill--subtle">{simStatusLabel(simStatus, simJobId)}</span>
                </div>
              )}
            </div>
            <div>
              <label>
                Seed contacts (LinkedIn URLs or tagged employees)
                <textarea rows={3} value={seedInput} onChange={(e) => setSeedInput(e.target.value)} />
              </label>
              <Alert kind="info">Link SIM runs back to drafts/campaigns for later performance comparison.</Alert>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel__title">Email under test</div>
          <div className="panel__content grid two-column">
            <div>
              <textarea rows={9} value={email} onChange={(e) => setEmail(e.target.value)} />
              <div className="pill-row">
                <span className="pill">Length {email.length} chars</span>
                <span className="pill pill--subtle">Uses {'{{ first_name }}'} &amp; {'{{ company_name }}'}</span>
              </div>
            </div>
            <div>
              <div className="table-lite__head">
                <span>Persona</span>
                <span>Focus</span>
                <span>Mood</span>
                <span>Include</span>
              </div>
              {seedPersonas.map((p) => (
                <div key={p.id} className="table-lite__row">
                  <span>
                    <strong>{p.name}</strong> <span className="muted small">{p.title}</span>
                  </span>
                  <span>{p.painFocus}</span>
                  <span className={`badge badge--${p.mood}`}>{p.mood}</span>
                  <span>
                    <button className={seedSelection.has(p.id) ? '' : 'ghost'} onClick={() => togglePersona(p.id)}>
                      {seedSelection.has(p.id) ? 'Selected' : 'Add'}
                    </button>
                  </span>
                </div>
              ))}
              <div className="muted small" style={{ marginTop: 8 }}>
                Pull personas from AnySite/LinkedIn enrichment; avoid synthetic personas when real seeds exist.
              </div>
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel__title">Simulated reactions</div>
          <div className="panel__content grid two-column">
            <div>
              <h4>Aggregate</h4>
              <div className="pill-row">
                <span className="pill pill--accent">Alignment score: {Math.round(alignmentScore * 100)}%</span>
                <span className="pill pill--warn">Objection risk: cost / proof</span>
              </div>
              <p className="muted">
                Full SIM: inbox behaviors + emotional reactions per persona. Offer roast: fast critique on clarity,
                differentiation, and proof.
              </p>
            </div>
            <div>
              <label>
                Notes to apply
                <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </label>
              <ul className="checklist">
                <li>
                  <input type="checkbox" defaultChecked /> Attach SIM run to draft/campaign
                </li>
                <li>
                  <input type="checkbox" /> Capture recommendations JSON
                </li>
                <li>
                  <input type="checkbox" /> Re-run after edits (limit per campaign)
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
