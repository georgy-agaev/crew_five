import { useMemo } from 'react';

import type { CampaignOutbound } from '../apiClient';

export const outboundLedgerFilters = ['all', 'sent', 'failed'] as const;

export type OutboundLedgerFilter = (typeof outboundLedgerFilters)[number];

export function summarizeCampaignOutbounds(outbounds: CampaignOutbound[]) {
  return {
    total: outbounds.length,
    sent: outbounds.filter((outbound) => outbound.status === 'sent').length,
    failed: outbounds.filter((outbound) => outbound.status === 'failed').length,
  };
}

function formatOutboundStatus(status: string | null | undefined) {
  if (status === 'sent') return 'sent';
  if (status === 'failed') return 'failed';
  return 'unknown';
}

function OutboundStatusPill({ status }: { status: string | null | undefined }) {
  const normalized = formatOutboundStatus(status);
  const className = normalized === 'sent' ? 'pill pill--accent' : 'pill pill--warn';
  return <span className={className}>{normalized}</span>;
}

export function CampaignOutboundLedger({
  outbounds,
  selectedOutboundId,
  onSelectOutbound,
  activeFilter,
  onFilterChange,
  linkedDraft,
  linkedEvent,
  onOpenDraft,
  onOpenEvent,
}: {
  outbounds: CampaignOutbound[];
  selectedOutboundId: string;
  onSelectOutbound: (outboundId: string) => void;
  activeFilter: OutboundLedgerFilter;
  onFilterChange: (filter: OutboundLedgerFilter) => void;
  linkedDraft?: { id: string; status?: string | null } | null;
  linkedEvent?: { id: string; event_type?: string | null } | null;
  onOpenDraft?: (draftId: string) => void;
  onOpenEvent?: (eventId: string) => void;
}) {
  const summary = useMemo(() => summarizeCampaignOutbounds(outbounds), [outbounds]);
  const filteredOutbounds = useMemo(() => {
    if (activeFilter === 'all') {
      return outbounds;
    }
    return outbounds.filter((outbound) => outbound.status === activeFilter);
  }, [activeFilter, outbounds]);

  const selectedOutbound =
    filteredOutbounds.find((outbound) => outbound.id === selectedOutboundId) ?? filteredOutbounds[0] ?? null;

  return (
    <div style={{ marginTop: 18 }}>
      <div className="card__header">
        <div>
          <h4>Outbound ledger</h4>
          <p className="muted small">Inspect recorded sends, sender identities, recipients, and draft linkage.</p>
        </div>
        <div className="pill-row" style={{ marginTop: 0 }}>
          <span className="pill">{summary.total} total</span>
          <span className="pill pill--accent">{summary.sent} sent</span>
          <span className="pill pill--warn">{summary.failed} failed</span>
        </div>
      </div>

      <div className="tabbar" style={{ marginTop: 0, marginBottom: 12 }}>
        {outboundLedgerFilters.map((filter) => (
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
          <div className="panel__title">Recorded sends</div>
          <div className="panel__content">
            <div className="table-lite">
              <div className="table-lite__head">
                <span>Recipient</span>
                <span>Type</span>
                <span>Provider</span>
                <span>Status</span>
              </div>
              {filteredOutbounds.map((outbound) => (
                <button
                  key={outbound.id}
                  type="button"
                  className="table-lite__row"
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background:
                      outbound.id === selectedOutbound?.id ? 'rgba(15, 23, 42, 0.06)' : 'transparent',
                    color: 'inherit',
                    border: 'none',
                    borderRadius: 0,
                    boxShadow: 'none',
                    transform: 'none',
                    padding: '12px 14px',
                  }}
                  onClick={() => onSelectOutbound(outbound.id)}
                >
                  <span>
                    <strong>{outbound.recipient_email ?? 'Missing recipient'}</strong>
                    <br />
                    <span className="muted small">{outbound.contact_name ?? outbound.company_name ?? 'Unknown target'}</span>
                  </span>
                  <span>{outbound.draft_email_type ?? 'n/a'}</span>
                  <span>
                    {outbound.provider}
                    <br />
                    <span className="muted small">{outbound.sender_identity ?? 'sender n/a'}</span>
                  </span>
                  <span>{formatOutboundStatus(outbound.status)}</span>
                </button>
              ))}
              {filteredOutbounds.length === 0 && (
                <div className="table-lite__row">No outbound records match this filter yet.</div>
              )}
            </div>
          </div>
        </div>

        <div className="panel" style={{ marginTop: 0 }}>
          <div className="panel__title">Selected outbound</div>
          <div className="panel__content">
            {!selectedOutbound ? (
              <p className="muted small">Select an outbound row to inspect send details and draft linkage.</p>
            ) : (
              <>
                <div className="pill-row" style={{ marginTop: 0 }}>
                  <OutboundStatusPill status={selectedOutbound.status} />
                  <span className="pill">{selectedOutbound.provider}</span>
                  <span className="pill">{selectedOutbound.draft_email_type ?? 'n/a'}</span>
                  <span className="pill">{selectedOutbound.pattern_mode ?? 'pattern n/a'}</span>
                </div>

                <div style={{ marginTop: 14 }}>
                  <strong>{selectedOutbound.subject ?? 'No subject recorded'}</strong>
                  <div className="muted small" style={{ marginTop: 6 }}>
                    {selectedOutbound.contact_name ?? 'Unknown contact'}
                    {' · '}
                    {selectedOutbound.contact_position ?? 'Unknown role'}
                    {' · '}
                    {selectedOutbound.company_name ?? 'Unknown company'}
                  </div>
                  <div className="muted small" style={{ marginTop: 4 }}>
                    To: {selectedOutbound.recipient_email ?? 'n/a'}
                    {' · '}
                    Source: {selectedOutbound.recipient_email_source ?? 'n/a'}
                    {' · '}
                    Kind: {selectedOutbound.recipient_email_kind ?? 'n/a'}
                  </div>
                  <div className="muted small" style={{ marginTop: 4 }}>
                    Sender: {selectedOutbound.sender_identity ?? 'n/a'}
                    {' · '}
                    Sent at: {selectedOutbound.sent_at?.slice(0, 16).replace('T', ' ') ?? 'n/a'}
                  </div>
                  <div className="muted small" style={{ marginTop: 4 }}>
                    Provider message id: {selectedOutbound.provider_message_id ?? 'n/a'}
                  </div>
                </div>

                <div className="pill-row" style={{ marginTop: 12 }}>
                  <span className="pill">Trace</span>
                  {linkedDraft ? (
                    <button type="button" className="ghost" onClick={() => onOpenDraft?.(linkedDraft.id)}>
                      Open draft
                    </button>
                  ) : (
                    <span className="pill pill--subtle">No draft link</span>
                  )}
                  {linkedEvent ? (
                    <button type="button" className="ghost" onClick={() => onOpenEvent?.(linkedEvent.id)}>
                      Open event
                    </button>
                  ) : (
                    <span className="pill pill--subtle">No event yet</span>
                  )}
                </div>

                {selectedOutbound.error ? (
                  <div style={{ marginTop: 12 }}>
                    <span className="pill pill--warn">Error: {selectedOutbound.error}</span>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default CampaignOutboundLedger;
