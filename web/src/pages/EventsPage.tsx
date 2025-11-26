import { useEffect, useState } from 'react';

import { fetchEvents, fetchReplyPatterns, type EventRow, type PatternRow } from '../apiClient';
import { Alert } from '../components/Alert';

export function EventsPage() {
  const [since, setSince] = useState<string>('');
  const [limit, setLimit] = useState<number>(10);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [patterns, setPatterns] = useState<PatternRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <section>
      <h2>Events</h2>
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
    </section>
  );
}
