import { useMemo } from 'react';

import type { CampaignEvent } from '../apiClient';

export const campaignEventFilters = [
  'all',
  'replied',
  'bounced',
  'unsubscribed',
  'delivered',
  'opened',
  'clicked',
  'complaint',
] as const;

export type CampaignEventFilter = (typeof campaignEventFilters)[number];

export function summarizeCampaignEvents(events: CampaignEvent[]) {
  return {
    total: events.length,
    replied: events.filter((event) => event.event_type === 'replied').length,
    bounced: events.filter((event) => event.event_type === 'bounced').length,
    unsubscribed: events.filter((event) => event.event_type === 'unsubscribed').length,
  };
}

function formatEventLabel(eventType: string) {
  return eventType || 'unknown';
}

function EventPill({ eventType }: { eventType: string }) {
  const normalized = formatEventLabel(eventType);
  const className =
    normalized === 'replied'
      ? 'pill pill--accent'
      : normalized === 'bounced' || normalized === 'unsubscribed' || normalized === 'complaint'
        ? 'pill pill--warn'
        : 'pill';
  return <span className={className}>{normalized}</span>;
}

export function CampaignEventLedger({
  events,
  selectedEventId,
  onSelectEvent,
  activeFilter,
  onFilterChange,
  linkedDraft,
  linkedOutbound,
  onOpenDraft,
  onOpenOutbound,
}: {
  events: CampaignEvent[];
  selectedEventId: string;
  onSelectEvent: (eventId: string) => void;
  activeFilter: CampaignEventFilter;
  onFilterChange: (filter: CampaignEventFilter) => void;
  linkedDraft?: { id: string; status?: string | null } | null;
  linkedOutbound?: { id: string; status?: string | null } | null;
  onOpenDraft?: (draftId: string) => void;
  onOpenOutbound?: (outboundId: string) => void;
}) {
  const summary = useMemo(() => summarizeCampaignEvents(events), [events]);
  const filteredEvents = useMemo(() => {
    if (activeFilter === 'all') {
      return events;
    }
    return events.filter((event) => event.event_type === activeFilter);
  }, [activeFilter, events]);

  const selectedEvent = filteredEvents.find((event) => event.id === selectedEventId) ?? filteredEvents[0] ?? null;

  return (
    <div style={{ marginTop: 18 }}>
      <div className="card__header">
        <div>
          <h4>Campaign events</h4>
          <p className="muted small">Track replies, bounces, unsubscribes, and other send outcomes for this campaign.</p>
        </div>
        <div className="pill-row" style={{ marginTop: 0 }}>
          <span className="pill">{summary.total} total</span>
          <span className="pill pill--accent">{summary.replied} replied</span>
          <span className="pill pill--warn">{summary.bounced} bounced</span>
          <span className="pill pill--warn">{summary.unsubscribed} unsubscribed</span>
        </div>
      </div>

      <div className="tabbar" style={{ marginTop: 0, marginBottom: 12 }}>
        {campaignEventFilters.map((filter) => (
          <button
            key={filter}
            type="button"
            className={`tab ${activeFilter === filter ? 'active' : ''}`}
            onClick={() => onFilterChange(filter)}
          >
            {filter}
          </button>
        ))}
      </div>

      <div className="grid two-column" style={{ alignItems: 'start' }}>
        <div className="panel" style={{ marginTop: 0 }}>
          <div className="panel__title">Recorded events</div>
          <div className="panel__content">
            <div className="table-lite">
              <div className="table-lite__head">
                <span>Event</span>
                <span>Recipient</span>
                <span>Outcome</span>
                <span>When</span>
              </div>
              {filteredEvents.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  className="table-lite__row"
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: event.id === selectedEvent?.id ? 'rgba(15, 23, 42, 0.06)' : 'transparent',
                    color: 'inherit',
                    border: 'none',
                    borderRadius: 0,
                    boxShadow: 'none',
                    transform: 'none',
                    padding: '12px 14px',
                  }}
                  onClick={() => onSelectEvent(event.id)}
                >
                  <span>
                    <strong>{formatEventLabel(event.event_type)}</strong>
                    <br />
                    <span className="muted small">{event.subject ?? 'No subject recorded'}</span>
                  </span>
                  <span>
                    {event.recipient_email ?? 'n/a'}
                    <br />
                    <span className="muted small">{event.contact_name ?? event.company_name ?? 'Unknown target'}</span>
                  </span>
                  <span>{event.outcome_classification ?? 'n/a'}</span>
                  <span>{event.occurred_at?.slice(0, 16).replace('T', ' ') ?? 'n/a'}</span>
                </button>
              ))}
              {filteredEvents.length === 0 && (
                <div className="table-lite__row">No campaign events match this filter yet.</div>
              )}
            </div>
          </div>
        </div>

        <div className="panel" style={{ marginTop: 0 }}>
          <div className="panel__title">Selected event</div>
          <div className="panel__content">
            {!selectedEvent ? (
              <p className="muted small">Select an event to inspect the reply/outcome context.</p>
            ) : (
              <>
                <div className="pill-row" style={{ marginTop: 0 }}>
                  <EventPill eventType={selectedEvent.event_type} />
                  <span className="pill">{selectedEvent.draft_email_type ?? 'n/a'}</span>
                  <span className="pill">{selectedEvent.outcome_classification ?? 'outcome n/a'}</span>
                  <span className="pill">{selectedEvent.pattern_id ?? selectedEvent.coach_prompt_id ?? 'pattern n/a'}</span>
                </div>

                <div style={{ marginTop: 14 }}>
                  <strong>{selectedEvent.subject ?? 'No subject recorded'}</strong>
                  <div className="muted small" style={{ marginTop: 6 }}>
                    {selectedEvent.contact_name ?? 'Unknown contact'}
                    {' · '}
                    {selectedEvent.contact_position ?? 'Unknown role'}
                    {' · '}
                    {selectedEvent.company_name ?? 'Unknown company'}
                  </div>
                  <div className="muted small" style={{ marginTop: 4 }}>
                    To: {selectedEvent.recipient_email ?? 'n/a'}
                    {' · '}
                    Source: {selectedEvent.recipient_email_source ?? 'n/a'}
                    {' · '}
                    Kind: {selectedEvent.recipient_email_kind ?? 'n/a'}
                  </div>
                  <div className="muted small" style={{ marginTop: 4 }}>
                    Sender: {selectedEvent.sender_identity ?? 'n/a'}
                    {' · '}
                    Occurred: {selectedEvent.occurred_at?.slice(0, 16).replace('T', ' ') ?? 'n/a'}
                  </div>
                  <div className="muted small" style={{ marginTop: 4 }}>
                    Provider event id: {selectedEvent.provider_event_id ?? 'n/a'}
                    {' · '}
                    Provider message id: {selectedEvent.provider_message_id ?? 'n/a'}
                  </div>
                </div>

                <div className="pill-row" style={{ marginTop: 12 }}>
                  <span className="pill">Trace</span>
                  {linkedOutbound ? (
                    <button type="button" className="ghost" onClick={() => onOpenOutbound?.(linkedOutbound.id)}>
                      Open outbound
                    </button>
                  ) : (
                    <span className="pill pill--subtle">No outbound link</span>
                  )}
                  {linkedDraft ? (
                    <button type="button" className="ghost" onClick={() => onOpenDraft?.(linkedDraft.id)}>
                      Open draft
                    </button>
                  ) : (
                    <span className="pill pill--subtle">No draft link</span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CampaignEventLedger;
