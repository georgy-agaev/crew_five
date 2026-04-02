import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { fetchDashboardOverview, fetchServices, type DashboardOverview, type ServiceConfig } from '../apiClient';
import { getWorkspaceColors } from '../theme';
import type { AppView } from '../appView';

const NAV_ITEMS: Array<{ view: AppView; label: string; short: string }> = [
  { view: 'home', label: 'Home', short: 'H' },
  { view: 'campaign-ops', label: 'Campaigns', short: 'Ca' },
  { view: 'campaign-ledger', label: 'Ledger', short: 'L' },
  { view: 'builder-v2', label: 'Builder', short: 'B' },
  { view: 'inbox-v2', label: 'Inbox', short: 'I' },
  { view: 'contacts', label: 'Contacts', short: 'C' },
  { view: 'mailboxes', label: 'Mailboxes', short: 'M' },
  { view: 'enrichment', label: 'Enrichment', short: 'E' },
  { view: 'import', label: 'Import', short: 'Im' },
];

const LANGUAGES = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'ru', label: 'RU', name: 'Русский' },
] as const;

const TOPBAR_H = 48;

interface AppShellProps {
  currentView: AppView;
  isDark: boolean;
  language: string;
  sidebarExpanded: boolean;
  onToggleDark: () => void;
  onSelectLanguage: (code: string) => void;
  onToggleSidebar: () => void;
  children: ReactNode;
}

function LegendModal({ colors, onClose }: {
  colors: ReturnType<typeof getWorkspaceColors>;
  onClose: () => void;
}) {
  const S = (props: { cls: string; label: string; desc: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
      <span className={props.cls} style={{ flexShrink: 0 }}>{props.label}</span>
      <span style={{ fontSize: 12, color: colors.textMuted }}>{props.desc}</span>
    </div>
  );
  const Dot = (props: { cls: string; desc: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
      <span className={props.cls} style={{ flexShrink: 0 }} />
      <span style={{ fontSize: 12, color: colors.textMuted }}>{props.desc}</span>
    </div>
  );
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }} onClick={onClose}>
      <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 24, minWidth: 420, maxWidth: 560, maxHeight: '80vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Visual Guide</h3>
          <button onClick={onClose} style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: colors.textMuted, transform: 'none', boxShadow: 'none' }}>Close</button>
        </div>

        <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: colors.textMuted, margin: '12px 0 6px' }}>Campaign status</h4>
        <S cls="od-status-badge od-status-badge--draft" label="draft" desc="Campaign is being set up. Not yet ready for generation." />
        <S cls="od-status-badge od-status-badge--ready" label="ready" desc="Ready for draft generation. Next: generating." />
        <S cls="od-status-badge od-status-badge--generating" label="generating" desc="Drafts are being generated. Next: review or sending." />
        <S cls="od-status-badge od-status-badge--review" label="review" desc="Drafts under operator review. Next: generating → sending." />
        <S cls="od-status-badge od-status-badge--sending" label="sending" desc="Emails are being sent via mailbox. Can pause or complete." />
        <S cls="od-status-badge od-status-badge--paused" label="paused" desc="Sending paused. Can resume or complete." />
        <S cls="od-status-badge od-status-badge--complete" label="complete" desc="Campaign finished. Terminal status." />

        <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: colors.textMuted, margin: '16px 0 6px' }}>Draft status</h4>
        <S cls="od-status-badge od-status-badge--generating" label="generated" desc="Draft created by AI, awaiting operator review." />
        <S cls="od-status-badge od-status-badge--ready" label="approved" desc="Draft approved by operator, ready for sending." />
        <S cls="od-status-badge od-status-badge--review" label="rejected" desc="Draft rejected by operator." />
        <S cls="od-status-badge od-status-badge--complete" label="sent" desc="Draft has been sent. Locked — no further changes." />

        <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: colors.textMuted, margin: '16px 0 6px' }}>Enrichment status</h4>
        <S cls="od-enrich-badge od-enrich-badge--fresh" label="fresh" desc="Enrichment data is current (less than 90 days old)." />
        <S cls="od-enrich-badge od-enrich-badge--stale" label="stale" desc="Enrichment data exists but is older than 90 days." />
        <S cls="od-enrich-badge od-enrich-badge--missing" label="missing" desc="No enrichment data. Company has never been enriched." />

        <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: colors.textMuted, margin: '16px 0 6px' }}>Reply labels</h4>
        <S cls="od-status-badge od-status-badge--ready" label="positive" desc="Recipient expressed interest or agreed to a meeting." />
        <S cls="od-status-badge od-status-badge--review" label="negative" desc="Recipient declined or asked to stop." />
        <S cls="od-status-badge od-status-badge--generating" label="bounce" desc="Email bounced — address invalid or mailbox full." />
        <S cls="od-status-badge od-status-badge--draft" label="unclassified" desc="Reply received but not yet classified." />

        <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: colors.textMuted, margin: '16px 0 6px' }}>Indicators</h4>
        <Dot cls="od-send-dot od-send-dot--ok" desc="Contact has a verified work email — ready to send." />
        <Dot cls="od-send-dot od-send-dot--warn" desc="Contact has only generic email or no email — may need attention." />
        <Dot cls="od-coverage-dot od-coverage-dot--filled" desc="Draft exists for this email slot (Email 1 or Email 2)." />
        <Dot cls="od-coverage-dot" desc="No draft generated yet for this email slot." />

        <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: colors.textMuted, margin: '16px 0 6px' }}>Mailbox alignment</h4>
        <S cls="od-enrich-badge od-enrich-badge--missing" label="no plan" desc="No sender identities assigned. Sending is blocked." />
        <S cls="od-enrich-badge od-enrich-badge--stale" label="planned, not sent" desc="Sender identities planned but no emails sent yet." />
        <S cls="od-enrich-badge od-enrich-badge--fresh" label="aligned" desc="Planned sender set matches observed outbound usage." />
        <S cls="od-enrich-badge od-enrich-badge--stale" label="mismatch" desc="Observed outbound differs from planned sender set." />

        <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: colors.textMuted, margin: '16px 0 6px' }}>Email deliverability</h4>
        <S cls="od-enrich-badge od-enrich-badge--fresh" label="valid" desc="Email address verified as deliverable." />
        <S cls="od-enrich-badge od-enrich-badge--missing" label="bounced" desc="Email bounced — address rejected by mail server." />
        <S cls="od-enrich-badge od-enrich-badge--missing" label="invalid" desc="Email address is invalid / does not exist." />
        <div style={{ padding: '4px 0', fontSize: 11, color: colors.textMuted }}>
          Note: bounced email ≠ invalid contact. A contact can have a bounced work email but still be reachable via generic email.
        </div>

        <h4 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: colors.textMuted, margin: '16px 0 6px' }}>Import actions</h4>
        <S cls="od-enrich-badge od-enrich-badge--fresh" label="create" desc="New company — will be created in the database." />
        <S cls="od-enrich-badge od-enrich-badge--stale" label="update" desc="Existing company matched — will be updated." />
        <S cls="od-enrich-badge od-enrich-badge--missing" label="skip" desc="Company skipped due to validation issues." />

        <div style={{ marginTop: 16, paddingTop: 12, borderTop: `1px solid ${colors.border}`, fontSize: 11, color: colors.textMuted }}>
          Hover over any badge, dot, or button for a contextual tooltip.
        </div>
      </div>
    </div>
  );
}

function ServicesModal({ colors, services, onClose }: {
  colors: ReturnType<typeof getWorkspaceColors>;
  services: ServiceConfig[];
  onClose: () => void;
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300 }} onClick={onClose}>
      <div style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 24, minWidth: 360, maxWidth: 500, maxHeight: '70vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Services</h3>
          <button onClick={onClose} style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: colors.textMuted }}>Close</button>
        </div>
        {services.length === 0 && <div style={{ fontSize: 13, color: colors.textMuted }}>No services configured.</div>}
        {services.map((svc) => (
          <div key={svc.name} style={{ padding: '8px 0', borderBottom: `1px solid ${colors.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>{svc.name}</div>
              <div style={{ fontSize: 11, color: colors.textMuted }}>{svc.category}</div>
            </div>
            <span style={{
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '2px 6px', borderRadius: 3,
              background: svc.status === 'connected' ? `color-mix(in srgb, ${colors.success} 14%, transparent)` : `color-mix(in srgb, ${colors.warning} 14%, transparent)`,
              color: svc.status === 'connected' ? colors.success : colors.warning,
            }}>{svc.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AppShell({
  currentView,
  isDark,
  language,
  sidebarExpanded,
  onToggleDark,
  onSelectLanguage,
  onToggleSidebar,
  children,
}: AppShellProps) {
  const colors = getWorkspaceColors(isDark);
  const [showServices, setShowServices] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [services, setServices] = useState<ServiceConfig[]>([]);
  const [pending, setPending] = useState<DashboardOverview['pending'] | null>(null);

  const loadServices = useCallback(() => {
    fetchServices()
      .then((res) => setServices(res.services ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => { loadServices(); }, [loadServices]);
  useEffect(() => {
    // Dashboard now returns campaign-linked-only counts from backend
    fetchDashboardOverview()
      .then((d) => setPending(d.pending))
      .catch(() => {});
  }, []);

  const btnH = 32;

  return (
    <div style={{ display: 'flex', height: '100vh', background: colors.bg, color: colors.text, fontFamily: "'Space Grotesk', 'DM Sans', system-ui, sans-serif" }}>
      {/* Sidebar */}
      <div style={{
        width: sidebarExpanded ? 200 : 56,
        background: colors.navSidebar,
        borderRight: `1px solid ${colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease',
        flexShrink: 0,
      }}>
        {/* Logo — same height as topbar */}
        <div style={{
          height: TOPBAR_H,
          borderBottom: `1px solid ${colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarExpanded ? 'flex-start' : 'center',
          padding: sidebarExpanded ? '0 12px' : 0,
          gap: 8,
        }}>
          <a href="?view=home" title="Go to Home" style={{
            width: 32, height: 32, borderRadius: 8,
            background: colors.orange, color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, textDecoration: 'none', flexShrink: 0,
          }}>
            C5
          </a>
          {sidebarExpanded && (
            <span style={{ fontSize: 13, fontWeight: 700, color: colors.text, whiteSpace: 'nowrap' }}>
              crew<span style={{ color: colors.orange }}>_five</span>
            </span>
          )}
        </div>

        {/* Nav items */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3, padding: '10px 6px', overflowY: 'auto' }}>
          {NAV_ITEMS.map((item) => {
            const isActive = currentView === item.view;
            const badge =
              pending && item.view === 'builder-v2' && pending.draftsOnReview > 0 ? pending.draftsOnReview
              : pending && item.view === 'inbox-v2' && pending.inboxReplies > 0 ? pending.inboxReplies
              : null;
            return (
              <a
                key={item.view}
                href={`?view=${item.view}`}
                title={item.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: sidebarExpanded ? 'flex-start' : 'center',
                  padding: sidebarExpanded ? '7px 12px' : '7px 0',
                  borderRadius: 6,
                  textDecoration: 'none',
                  fontSize: sidebarExpanded ? 13 : 13,
                  fontWeight: 600,
                  color: isActive ? colors.orange : colors.textMuted,
                  background: isActive ? colors.orangeLight : 'transparent',
                  border: `1px solid ${isActive ? colors.orange : 'transparent'}`,
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap',
                  position: 'relative',
                }}
              >
                {sidebarExpanded ? item.label : item.short}
                {badge != null && (
                  <span style={{
                    position: 'absolute',
                    top: 2,
                    right: sidebarExpanded ? 8 : 4,
                    minWidth: 16,
                    height: 16,
                    borderRadius: 8,
                    background: colors.warning,
                    color: '#fff',
                    fontSize: 9,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px',
                  }}>
                    {badge}
                  </span>
                )}
              </a>
            );
          })}

          <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid ${colors.border}` }}>
            <a
              href="?view=pipeline"
              title="Legacy Pipeline"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: sidebarExpanded ? 'flex-start' : 'center',
                padding: sidebarExpanded ? '7px 12px' : '7px 0',
                borderRadius: 6,
                textDecoration: 'none',
                fontSize: 12,
                fontWeight: 500,
                color: colors.textMuted,
                opacity: 0.6,
              }}
            >
              {sidebarExpanded ? 'Legacy Pipeline' : 'LP'}
            </a>
          </div>
        </div>

        {/* Bottom: Help + Services + Collapse */}
        <div style={{ padding: '6px', borderTop: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <button
            onClick={() => setShowLegend(true)}
            title="Visual guide — explains icons, badges, and colors"
            style={{
              background: colors.card, border: `1px solid ${colors.border}`, color: colors.textMuted,
              height: btnH, borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: sidebarExpanded ? 'flex-start' : 'center',
              width: '100%', gap: 8, paddingLeft: sidebarExpanded ? 12 : 0,
              transform: 'none', boxShadow: 'none',
            }}
          >
            <span style={{ fontSize: 14 }}>?</span>
            {sidebarExpanded && 'Visual Guide'}
          </button>
          <button
            onClick={() => { setShowServices(true); loadServices(); }}
            title="View connected service status"
            style={{
              background: colors.card, border: `1px solid ${colors.border}`, color: colors.textMuted,
              height: btnH, borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: sidebarExpanded ? 'flex-start' : 'center',
              width: '100%', gap: 8, paddingLeft: sidebarExpanded ? 12 : 0,
              transform: 'none', boxShadow: 'none',
            }}
          >
            <span style={{ fontSize: 14 }}>⚡</span>
            {sidebarExpanded && 'Services'}
          </button>
          <button
            onClick={onToggleSidebar}
            title={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
            style={{
              background: colors.card, border: `1px solid ${colors.border}`, color: colors.textMuted,
              height: btnH, borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 500,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: '100%', transform: 'none', boxShadow: 'none',
            }}
          >
            {sidebarExpanded ? '← Collapse' : '→'}
          </button>
        </div>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Topbar — aligned with sidebar logo */}
        <div style={{
          height: TOPBAR_H,
          background: colors.sidebar,
          borderBottom: `1px solid ${colors.border}`,
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <span style={{ fontSize: 13, color: colors.textMuted }}>
              GTM Operator Workspace
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {/* Language selector */}
            <select
              value={language}
              onChange={(e) => onSelectLanguage(e.target.value)}
              aria-label="Language"
              title="Switch interface language"
              style={{
                background: colors.card, border: `1px solid ${colors.border}`, color: colors.text,
                borderRadius: 6, padding: '0 8px', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', width: 'auto', height: btnH,
                margin: 0,
              }}
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.label}</option>
              ))}
            </select>
            {/* Theme toggle — colorful */}
            <button
              onClick={onToggleDark}
              aria-label="Toggle theme"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{
                background: isDark ? colors.orange : colors.orangeLight,
                border: `1px solid ${colors.orange}`,
                color: isDark ? '#fff' : colors.orange,
                width: btnH, height: btnH, borderRadius: 6, cursor: 'pointer',
                fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, transform: 'none', boxShadow: 'none',
              }}
            >
              {isDark ? '☀' : '☾'}
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
          {children}
        </div>
      </div>

      {/* Services modal */}
      {showServices && (
        <ServicesModal colors={colors} services={services} onClose={() => setShowServices(false)} />
      )}
      {showLegend && (
        <LegendModal colors={colors} onClose={() => setShowLegend(false)} />
      )}
    </div>
  );
}
