import { useEffect, useState } from 'react';

import { fetchDashboardOverview, type DashboardOverview } from '../apiClient';
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

export function HomeWorkspacePage({ isDark = false }: { isDark?: boolean }) {
  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchDashboardOverview()
      .then((result) => { if (!cancelled) setData(result); })
      .catch((err) => { if (!cancelled) setError(err?.message ?? 'Failed to load dashboard'); })
      .finally(() => { if (!cancelled) setLoading(false); });
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
          <>
            {/* ---- Campaigns ---- */}
            <div className="od-context-block" style={{ marginBottom: 16 }}>
              <h3 className="od-context-block__title">
                Campaigns: {data.campaigns.total} total, {data.campaigns.active} active
              </h3>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {data.campaigns.byStatus.map((s) => (
                  <span
                    key={s.status}
                    className={`od-status-badge od-status-badge--${s.status}`}
                    title={STATUS_TOOLTIPS[s.status] ?? `Campaigns in ${s.status} status`}
                  >
                    {s.count} {s.status}
                  </span>
                ))}
              </div>
            </div>

            {/* ---- Pending actions ---- */}
            <div className="od-context-block" style={{ marginBottom: 16, borderTop: '1px solid var(--od-border)' }}>
              <h3 className="od-context-block__title">Needs attention</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
                <a
                  href="?view=builder-v2"
                  className="od-company-item"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                  title="Generated drafts awaiting operator review (approve/reject). Go to Builder."
                >
                  <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--od-text)' }}>{data.pending.draftsOnReview}</span>
                  <span className="od-employee-item__role">Drafts on review</span>
                </a>
                <a
                  href="?view=inbox-v2"
                  className="od-company-item"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                  title="Unhandled reply events needing operator attention. Go to Inbox."
                >
                  <span style={{ fontSize: 22, fontWeight: 700, color: data.pending.inboxReplies > 0 ? 'var(--od-warning)' : 'var(--od-text)' }}>{data.pending.inboxReplies}</span>
                  <span className="od-employee-item__role">Unhandled replies</span>
                </a>
                <a
                  href="?view=contacts"
                  className="od-company-item"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                  title="Companies with enrichment data older than 90 days. Consider re-enriching. Go to Contacts."
                >
                  <span style={{ fontSize: 22, fontWeight: 700, color: data.pending.staleEnrichment > 0 ? 'var(--od-warning)' : 'var(--od-text)' }}>
                    {data.pending.staleEnrichment}
                  </span>
                  <span className="od-employee-item__role">Stale enrichment</span>
                </a>
                <a
                  href="?view=enrichment"
                  className="od-company-item"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                  title="Companies that have never been enriched (no research data at all). Run enrichment to populate. Go to Enrichment."
                >
                  <span style={{ fontSize: 22, fontWeight: 700, color: data.pending.missingEnrichment > 0 ? 'var(--od-warning)' : 'var(--od-text)' }}>
                    {data.pending.missingEnrichment}
                  </span>
                  <span className="od-employee-item__role">Missing enrichment</span>
                </a>
              </div>
            </div>

            {/* ---- Recent activity ---- */}
            <div className="od-context-block" style={{ marginBottom: 16, borderTop: '1px solid var(--od-border)' }}>
              <h3 className="od-context-block__title">Recent activity</h3>
              {data.recentActivity.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--od-text-muted)', padding: '6px 0' }}>No recent activity.</div>
              )}
              {data.recentActivity.map((item) => (
                <div key={item.id} style={{
                  padding: '8px 0', borderBottom: '1px solid var(--od-border)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8,
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        className={`od-status-badge od-status-badge--${item.kind === 'reply' ? 'review' : item.kind === 'draft' ? 'generating' : item.kind === 'outbound' ? 'sending' : 'draft'}`}
                        title={
                          item.kind === 'reply'
                            ? 'Email reply event'
                            : item.kind === 'draft'
                              ? 'Draft lifecycle event'
                              : item.kind === 'outbound'
                                ? 'Sent email event'
                                : 'Campaign event'
                        }
                      >
                        {item.kind}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--od-text)' }}>{item.title}</span>
                    </div>
                    {item.subtitle && (
                      <span style={{ fontSize: 11, color: 'var(--od-text-muted)', marginTop: 2, display: 'block' }}>{item.subtitle}</span>
                    )}
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--od-text-muted)', flexShrink: 0 }}>{timeAgo(item.timestamp)}</span>
                </div>
              ))}
            </div>

            {/* ---- Quick links ---- */}
            <div className="od-context-block" style={{ borderTop: '1px solid var(--od-border)' }}>
              <h3 className="od-context-block__title">Go to</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                {QUICK_LINKS.map((link) => (
                  <a key={link.href} href={link.href} className="od-company-item" style={{ textDecoration: 'none', color: 'inherit' }} title={link.desc}>
                    <span className="od-company-item__name">{link.label}</span>
                    <span style={{ fontSize: 11, color: 'var(--od-text-muted)' }}>{link.desc}</span>
                  </a>
                ))}
              </div>
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--od-border)' }}>
                <a
                  href="?view=pipeline"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--od-text-muted)',
                    textDecoration: 'none',
                    opacity: 0.72,
                  }}
                  title="Open the frozen legacy pipeline surface"
                >
                  Legacy Pipeline
                  <span style={{ fontSize: 11, fontWeight: 500 }}>secondary</span>
                </a>
              </div>
            </div>
          </>
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
