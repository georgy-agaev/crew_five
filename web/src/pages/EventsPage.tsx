import { useEffect, useState } from 'react';

import {
  fetchEvents,
  fetchReplyPatterns,
  fetchAnalyticsSummary,
  fetchAnalyticsOptimize,
  fetchPromptRegistry,
  type EventRow,
  type PatternRow,
} from '../apiClient';
import { Alert } from '../components/Alert';

export function formatGroupKey(groupBy: string, row: Record<string, any>) {
  if (groupBy === 'segment') {
    return `${row.segment_id ?? 'n/a'}@v${row.segment_version ?? 'n/a'} (${row.role ?? 'any'})`;
  }
  if (groupBy === 'pattern') {
    return `${row.draft_pattern ?? 'unknown'} [edited=${row.user_edited ?? false}]`;
  }
  return `${row.icp_profile_id ?? 'n/a'} / ${row.icp_hypothesis_id ?? 'n/a'}`;
}

export function EventsPage() {
  const [since, setSince] = useState<string>('');
  const [limit, setLimit] = useState<number>(10);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [patterns, setPatterns] = useState<PatternRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<'icp' | 'segment' | 'pattern'>('icp');
  const [analyticsSummary, setAnalyticsSummary] = useState<any[]>([]);
  const [analyticsOptimize, setAnalyticsOptimize] = useState<{ suggestions: any[]; simSummary?: any[] }>({
    suggestions: [],
    simSummary: [],
  });
  const [promptRegistry, setPromptRegistry] = useState<any[]>([]);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([fetchEvents({ since, limit }), fetchReplyPatterns({ since })])
      .then(([evts, pats]) => {
        setEvents(evts);
        setPatterns(pats);
      })
      .catch((err) => setError(err?.message ?? 'Failed to load events'))
      .finally(() => setLoading(false));
  }, [since, limit]);

  useEffect(() => {
    setAnalyticsLoading(true);
    setError(null);
    Promise.all([
      fetchAnalyticsSummary({ groupBy, since }),
      fetchAnalyticsOptimize({ since }),
      fetchPromptRegistry(),
    ])
      .then(([summary, optimize, registry]) => {
        setAnalyticsSummary(summary as any[]);
        setAnalyticsOptimize(optimize as any);
        setPromptRegistry(registry as any[]);
      })
      .catch((err) => setError(err?.message ?? 'Failed to load analytics'))
      .finally(() => setAnalyticsLoading(false));
  }, [groupBy, since]);

  return (
    <section>
      <h2>Analytics (AN.v2)</h2>
      {error && <Alert kind="error">{error}</Alert>}
      {loading && <Alert>Loading...</Alert>}
      <div style={{ marginBottom: 8 }}>
        <label>
          Since
          <input type="text" value={since} onChange={(e) => setSince(e.target.value)} style={{ marginLeft: 8 }} />
        </label>
        <label style={{ marginLeft: 12 }}>
          Limit
          <input
            type="number"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            style={{ width: 64 }}
          />
        </label>
      </div>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Event</th>
            <th>Occurred At</th>
          </tr>
        </thead>
        <tbody>
          {events.map((evt) => (
            <tr key={evt.id}>
              <td>{evt.id}</td>
              <td>{evt.event_type}</td>
              <td>{evt.occurred_at}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 16 }}>
        <h3>Reply Patterns</h3>
        <ul>
          {patterns.map((p) => (
            <li key={p.reply_label}>
              {p.reply_label}: {p.count}
            </li>
          ))}
        </ul>
      </div>

      <div style={{ marginTop: 24 }}>
        <h3>Analytics (AN.v2)</h3>
        <div style={{ marginBottom: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
          <label>
            Group by
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as typeof groupBy)}
              style={{ marginLeft: 8 }}
            >
              <option value="icp">ICP + Hypothesis</option>
              <option value="segment">Segment + Role</option>
              <option value="pattern">Pattern + Edited</option>
            </select>
          </label>
          <label>
            Since
            <input
              type="text"
              value={since}
              onChange={(e) => setSince(e.target.value)}
              style={{ marginLeft: 8 }}
              placeholder="ISO timestamp"
            />
          </label>
        </div>
        {analyticsLoading && <Alert>Loading analytics...</Alert>}
        {!analyticsLoading && (
          <div className="table-lite" style={{ marginTop: 8 }}>
            <div className="table-lite__head">
              <span>Group</span>
              <span>Delivered</span>
              <span>Opened</span>
              <span>Replied</span>
              <span>Positive replies</span>
            </div>
            {analyticsSummary.map((row, idx) => (
              <div key={idx} className="table-lite__row">
                <span>{formatGroupKey(groupBy, row)}</span>
                <span>{row.delivered ?? 0}</span>
                <span>{row.opened ?? 0}</span>
                <span>{row.replied ?? 0}</span>
                <span>{row.positive_replies ?? 0}</span>
              </div>
            ))}
            {analyticsSummary.length === 0 && <div className="table-lite__row">No analytics rows</div>}
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <h4>Prompt Registry</h4>
          <ul>
            {promptRegistry.map((p) => (
              <li key={p.id ?? p.coach_prompt_id}>
                {p.coach_prompt_id ?? p.id} – {p.version ?? p.description ?? 'v1'}
              </li>
            ))}
            {promptRegistry.length === 0 && <li>No prompt entries</li>}
          </ul>
        </div>

        <div style={{ marginTop: 16 }}>
          <h4>Optimize suggestions</h4>
          <ul>
            {(analyticsOptimize.suggestions ?? []).map((s: any, idx: number) => (
              <li key={idx}>
                {s.draft_pattern ?? 'pattern'} → {s.recommendation}
              </li>
            ))}
            {(analyticsOptimize.suggestions ?? []).length === 0 && <li>No suggestions</li>}
          </ul>
        </div>
      </div>
    </section>
  );
}
