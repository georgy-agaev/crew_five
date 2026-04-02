import { useCallback, useEffect, useRef, useState } from 'react';

import {
  fetchCampaignAudit,
  fetchCampaigns,
  fetchDashboardOverview,
  type Campaign,
  type CampaignAuditView,
  type DashboardOverview,
} from '../apiClient';
import { getWorkspaceColors } from '../theme';
import './CampaignOperatorDesk.css';

function odCssVars(isDark: boolean): React.CSSProperties {
  const c = getWorkspaceColors(isDark);
  return {
    '--od-bg': c.bg, '--od-card': c.card, '--od-card-hover': c.cardHover,
    '--od-text': c.text, '--od-text-muted': c.textMuted, '--od-border': c.border,
    '--od-orange': c.orange, '--od-orange-light': c.orangeLight,
    '--od-sidebar': c.sidebar, '--od-success': c.success,
    '--od-warning': c.warning, '--od-error': c.error,
  } as React.CSSProperties;
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'n/a';
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return 'n/a';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const STATUS_TOOLTIPS: Record<string, string> = {
  draft: 'Campaign is being set up. Not yet ready for generation.',
  ready: 'Campaign is ready. Can move to generating.',
  generating: 'Drafts are being generated. Next: review or sending.',
  review: 'Drafts under review. Next: generating → sending.',
  sending: 'Emails are being sent. Can pause or complete.',
  paused: 'Sending paused. Can resume or complete.',
  complete: 'Campaign finished. Terminal status.',
};

const QUICK_LINKS = [
  { label: 'Builder', href: '?view=builder-v2', desc: 'Campaign lifecycle + draft review' },
  { label: 'Campaigns', href: '?view=campaign-ops', desc: 'Campaign operator desk' },
  { label: 'Ledger', href: '?view=campaign-ledger', desc: 'Campaign sends, outbounds, and events' },
  { label: 'Inbox', href: '?view=inbox-v2', desc: 'Reply inbox + poll' },
  { label: 'Contacts', href: '?view=contacts', desc: 'Company & contact directory' },
  { label: 'Mailboxes', href: '?view=mailboxes', desc: 'Sender planning + observed usage' },
  { label: 'Enrichment', href: '?view=enrichment', desc: 'Batch segment enrichment' },
  { label: 'Import', href: '?view=import', desc: 'XLSX company import' },
] as const;

interface ActiveCampaignCard {
  campaign: Campaign;
  audit: CampaignAuditView | null;
}

function pct(n: number, total: number): string {
  if (total === 0) return '0%';
  return `${Math.round((n / total) * 100)}%`;
}

export function HomeWorkspacePage({ isDark = false }: { isDark?: boolean }) {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [activeCampaigns, setActiveCampaigns] = useState<ActiveCampaignCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [colWidth, setColWidth] = useState(520);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = { startX: e.clientX, startW: colWidth };
      const onMouseMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const delta = ev.clientX - dragRef.current.startX;
        setColWidth(Math.max(300, Math.min(800, dragRef.current.startW + delta)));
      };
      const onMouseUp = () => {
        dragRef.current = null;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    },
    [colWidth]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // Dashboard now returns campaign-linked-only counts from backend
    fetchDashboardOverview()
      .then((result) => { if (!cancelled) setData(result); })
      .catch((err) => { if (!cancelled) setError(err?.message ?? 'Failed to load dashboard'); })
      .finally(() => { if (!cancelled) setLoading(false); });

    // Load active campaigns with audit
    fetchCampaigns()
      .then(async (campaigns) => {
        if (cancelled) return;
        const active = campaigns.filter((c) => c.status === 'sending' || c.status === 'review' || c.status === 'generating');
        const cards = await Promise.all(
          active.map(async (campaign) => ({
            campaign,
            audit: await fetchCampaignAudit(campaign.id).catch(() => null),
          }))
        );
        if (!cancelled) setActiveCampaigns(cards);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, []);

  return (
    <div className="operator-desk" style={odCssVars(isDark)}>
      <div style={{ padding: '16px 20px 0', flexShrink: 0 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Home</h1>
        <p style={{ fontSize: 12, color: 'var(--od-text-muted)', margin: '4px 0 0' }}>
          Operator overview. Campaign load, pending actions, recent activity.
        </p>
      </div>

      {error && <div className="od-error-banner" role="alert">{error}</div>}

      <div className="od-col-body" style={{ padding: '16px 20px' }}>
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className="od-skeleton" style={{ height: 20, width: '40%' }} />
            <span className="od-skeleton" style={{ height: 16, width: '60%' }} />
            <span className="od-skeleton" style={{ height: 16, width: '50%' }} />
          </div>
        )}

        {!loading && data && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>

            {/* ======== ROW 1: Status + Needs attention (card grid) ======== */}
            <div style={{ marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--od-border)' }}>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 10 }}>
                {data.campaigns.byStatus.map((s) => (
                  <span key={s.status} className={`od-status-badge od-status-badge--${s.status}`} title={STATUS_TOOLTIPS[s.status]}>{s.count} {s.status}</span>
                ))}
                <span style={{ fontSize: 11, color: 'var(--od-text-muted)', alignSelf: 'center', marginLeft: 4 }}>{data.campaigns.total} total</span>
              </div>
              <h3 className="od-context-block__title">Needs attention</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                <a href="?view=builder-v2" className="od-company-item" style={{ textDecoration: 'none', color: 'inherit', padding: '10px 12px', textAlign: 'center' }} title="Drafts awaiting review">
                  <span style={{ fontSize: 20, fontWeight: 700, color: data.pending.draftsOnReview > 0 ? 'var(--od-warning)' : 'var(--od-text)', display: 'block' }}>{data.pending.draftsOnReview}</span>
                  <span style={{ fontSize: 11, color: 'var(--od-text-muted)' }}>Drafts on review</span>
                </a>
                <a href="?view=inbox-v2" className="od-company-item" style={{ textDecoration: 'none', color: 'inherit', padding: '10px 12px', textAlign: 'center' }} title="Unhandled replies">
                  <span style={{ fontSize: 20, fontWeight: 700, color: data.pending.inboxReplies > 0 ? 'var(--od-warning)' : 'var(--od-text)', display: 'block' }}>{data.pending.inboxReplies}</span>
                  <span style={{ fontSize: 11, color: 'var(--od-text-muted)' }}>Unhandled replies</span>
                </a>
                <a href="?view=contacts" className="od-company-item" style={{ textDecoration: 'none', color: 'inherit', padding: '10px 12px', textAlign: 'center' }} title="Stale enrichment">
                  <span style={{ fontSize: 20, fontWeight: 700, color: data.pending.staleEnrichment > 0 ? 'var(--od-warning)' : 'var(--od-text)', display: 'block' }}>{data.pending.staleEnrichment}</span>
                  <span style={{ fontSize: 11, color: 'var(--od-text-muted)' }}>Stale enrichment</span>
                </a>
                <a href="?view=enrichment" className="od-company-item" style={{ textDecoration: 'none', color: 'inherit', padding: '10px 12px', textAlign: 'center' }} title="Missing enrichment">
                  <span style={{ fontSize: 20, fontWeight: 700, color: data.pending.missingEnrichment > 0 ? 'var(--od-warning)' : 'var(--od-text)', display: 'block' }}>{data.pending.missingEnrichment}</span>
                  <span style={{ fontSize: 11, color: 'var(--od-text-muted)' }}>Missing enrichment</span>
                </a>
              </div>
            </div>

            {/* ======== ROW 2: Active campaigns | drag | Recent activity ======== */}
            <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

              {/* Left: Active campaigns */}
              <div style={{ width: colWidth, flexShrink: 0, overflowY: 'auto', paddingRight: 8 }}>
                <h3 className="od-context-block__title">Active campaigns</h3>
                {activeCampaigns.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--od-text-muted)', padding: '8px 0' }}>No active campaigns.</div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {activeCampaigns.map(({ campaign, audit }) => {
                    const s = audit?.summary;
                    const sent = s?.outbound_sent_count ?? 0;
                    const bounced = s?.bounced_event_count ?? 0;
                    const replied = s?.replied_event_count ?? 0;
                    const unsub = s?.unsubscribed_event_count ?? 0;
                    const sendable = s?.sendable_draft_count ?? 0;
                    const contactsCovered = s?.contacts_with_any_draft ?? 0;
                    const totalContacts = s?.snapshot_contact_count ?? 0;

                    return (
                      <a key={campaign.id} href={`?view=campaign-ops&campaign=${campaign.id}`} style={{
                        textDecoration: 'none', color: 'inherit', padding: '10px 12px', borderRadius: 8,
                        border: '1px solid var(--od-border)', background: 'var(--od-card)', display: 'block',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--od-text)' }}>{campaign.name}</span>
                          <span className={`od-status-badge od-status-badge--${campaign.status}`}>{campaign.status}</span>
                        </div>
                        {s ? (
                          <>
                            <div style={{ height: 4, borderRadius: 2, background: 'var(--od-border)', marginBottom: 6, overflow: 'hidden' }}>
                              <div style={{ height: '100%', borderRadius: 2, background: 'var(--od-success)', width: sendable > 0 ? `${Math.round((sent / sendable) * 100)}%` : '0%' }} />
                            </div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              <span className="od-count-chip" style={{ fontSize: 10 }}>{sent}/{sendable} sent</span>
                              <span className="od-count-chip" style={{ fontSize: 10, color: bounced > 0 ? 'var(--od-error)' : 'var(--od-text-muted)' }}>{bounced} bounced{sent > 0 ? ` (${pct(bounced, sent)})` : ''}</span>
                              <span className="od-count-chip" style={{ fontSize: 10, color: replied > 0 ? 'var(--od-success)' : 'var(--od-text-muted)' }}>{replied} replied{sent > 0 ? ` (${pct(replied, sent)})` : ''}</span>
                              {unsub > 0 && <span className="od-count-chip" style={{ fontSize: 10, color: 'var(--od-warning)' }}>{unsub} unsub</span>}
                              <span className="od-count-chip" style={{ fontSize: 10, color: 'var(--od-text-muted)' }}>{contactsCovered}/{totalContacts} contacts</span>
                            </div>
                          </>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--od-text-muted)' }}>Loading...</span>
                        )}
                      </a>
                    );
                  })}
                </div>
              </div>

              {/* Drag handle */}
              <div className="od-resize-handle" onMouseDown={handleResizeStart} />

              {/* Right: Recent activity */}
              <div style={{ flex: 1, minWidth: 200, overflowY: 'auto', paddingLeft: 8 }}>
                <h3 className="od-context-block__title">Recent activity</h3>
                {data.recentActivity.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--od-text-muted)', padding: '6px 0' }}>No recent activity.</div>
                )}
                {data.recentActivity.map((item) => (
                  <div key={item.id} style={{
                    padding: '6px 0', borderBottom: '1px solid var(--od-border)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8,
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className={`od-status-badge od-status-badge--${item.kind === 'reply' ? 'review' : item.kind === 'draft' ? 'generating' : item.kind === 'outbound' ? 'sending' : 'draft'}`}>{item.kind}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--od-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
                      </div>
                      {item.subtitle && (
                        <span style={{ fontSize: 11, color: 'var(--od-text-muted)', marginTop: 1, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.subtitle}</span>
                      )}
                    </div>
                    <span style={{ fontSize: 10, color: 'var(--od-text-muted)', flexShrink: 0 }}>{timeAgo(item.timestamp)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ======== ROW 3: Go to (card grid) ======== */}
            <div style={{ borderTop: '1px solid var(--od-border)', paddingTop: 10, marginTop: 8, flexShrink: 0 }}>
              <h3 className="od-context-block__title">Go to</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                {QUICK_LINKS.map((link) => (
                  <a key={link.href} href={link.href} className="od-company-item" style={{ textDecoration: 'none', color: 'inherit', padding: '8px 10px' }} title={link.desc}>
                    <span className="od-company-item__name" style={{ fontSize: 12 }}>{link.label}</span>
                    <span style={{ fontSize: 10, color: 'var(--od-text-muted)' }}>{link.desc}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        {!loading && !data && !error && (
          <div className="od-empty">
            <div className="od-empty__line" />
            <span className="od-empty__text">No dashboard data available.</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default HomeWorkspacePage;
