import { useEffect, useState } from 'react';

import { useReplyPatterns } from '../queryMocks';

interface EventRow {
  id: string;
  event: string;
  occurred_at: string;
}

const mockEvents: EventRow[] = [
  { id: 'evt1', event: 'delivered', occurred_at: '2025-11-25T00:00:00Z' },
  { id: 'evt2', event: 'reply', occurred_at: '2025-11-25T01:00:00Z' },
];

export function EventsPage() {
  const [since, setSince] = useState<string>('');
  const [limit, setLimit] = useState<number>(10);
  const [events, setEvents] = useState<EventRow[]>([]);
  const patterns = useReplyPatterns();

  useEffect(() => {
    setEvents(mockEvents.slice(0, limit));
  }, [limit]);

  return (
    <section>
      <h2>Events</h2>
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
              <td>{evt.event}</td>
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
