import type { CSSProperties } from 'react';
import type {
  LegacyWorkspaceColors,
  LegacyWorkspaceLanguage,
  LegacyWorkspaceNavItem,
  LegacyWorkspacePage,
  LegacyWorkspaceParallelLink,
  LegacyWorkspaceService,
} from './legacyWorkspaceTypes';

type SidebarProps = {
  colors: LegacyWorkspaceColors;
  currentPage: LegacyWorkspacePage;
  navItems: LegacyWorkspaceNavItem[];
  parallelSurfaceLinks: LegacyWorkspaceParallelLink[];
  settingsLabel: string;
  servicesLabel: string;
  collapseLabel: string;
  sidebarExpanded: boolean;
  onNavigate: (page: LegacyWorkspacePage) => void;
  onToggleSidebar: () => void;
  onShowSettings: () => void;
  onShowServices: () => void;
};

type TopbarProps = {
  apiBase: string;
  colors: LegacyWorkspaceColors;
  heroSubtitle: string;
  heroTitleAccent: string;
  heroTitlePrefix: string;
  heroTitleSuffix: string;
  language: string;
  languages: LegacyWorkspaceLanguage[];
  modeLabel: string;
  parallelSurfaceLinks: LegacyWorkspaceParallelLink[];
  services: LegacyWorkspaceService[];
  showLanguageMenu: boolean;
  smartleadReady: boolean;
  supabaseReady: boolean;
  deliveryReady?: boolean;
  enrichmentCount?: number;
  isDark?: boolean;
  llmCount?: number;
  onSelectLanguage: (languageCode: string) => void;
  onToggleDarkMode: () => void;
  onToggleLanguageMenu: () => void;
};

const logoBoxStyle: CSSProperties = {
  width: '56px',
  height: '56px',
  borderRadius: '10px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '24px',
  fontWeight: 700,
  color: '#FFF',
};

export function LegacyWorkspaceSidebar({
  colors,
  currentPage,
  navItems,
  parallelSurfaceLinks,
  settingsLabel,
  servicesLabel,
  collapseLabel,
  sidebarExpanded,
  onNavigate,
  onToggleSidebar,
  onShowSettings,
  onShowServices,
}: SidebarProps) {
  return (
    <div
      style={{
        width: sidebarExpanded ? '240px' : '72px',
        background: colors.navSidebar,
        borderRight: `1px solid ${colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s ease',
      }}
    >
      <div style={{ height: '110px', borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ ...logoBoxStyle, background: colors.orange }}>C5</div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingTop: '20px', paddingBottom: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 12px' }}>
          {navItems.map((navItem) => {
            const isActive = currentPage === navItem.page;
            return (
              <button
                key={navItem.page}
                onClick={() => onNavigate(navItem.page)}
                title={navItem.title}
                style={buildNavButtonStyle(colors, sidebarExpanded, isActive)}
                onMouseEnter={(event) => {
                  if (!isActive) event.currentTarget.style.backgroundColor = colors.cardHover;
                }}
                onMouseLeave={(event) => {
                  if (!isActive) event.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <span style={buildNavLabelStyle(sidebarExpanded)}>
                  {sidebarExpanded ? navItem.label : navItem.short}
                </span>
              </button>
            );
          })}
          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sidebarExpanded ? <div style={buildParallelLabelStyle(colors)}>Parallel Surfaces</div> : null}
            {parallelSurfaceLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                title={link.title}
                style={buildParallelLinkStyle(colors, sidebarExpanded)}
                onMouseEnter={(event) => {
                  event.currentTarget.style.borderColor = colors.orange;
                  event.currentTarget.style.backgroundColor = colors.orangeLight;
                }}
                onMouseLeave={(event) => {
                  event.currentTarget.style.borderColor = colors.border;
                  event.currentTarget.style.backgroundColor = colors.card;
                }}
              >
                {sidebarExpanded ? link.label : link.short}
              </a>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 12px', borderTop: `1px solid ${colors.border}`, paddingTop: '16px' }}>
          <button
            onClick={onToggleSidebar}
            style={buildFooterButtonStyle(colors, sidebarExpanded, true)}
            onMouseEnter={(event) => {
              event.currentTarget.style.borderColor = colors.orange;
              event.currentTarget.style.backgroundColor = colors.orangeLight;
              event.currentTarget.style.color = colors.orange;
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.borderColor = colors.border;
              event.currentTarget.style.backgroundColor = colors.card;
              event.currentTarget.style.color = colors.textMuted;
            }}
          >
            {sidebarExpanded ? <><span>{collapseLabel}</span><span>←</span></> : <span>→</span>}
          </button>
          <button
            onClick={onShowSettings}
            title={settingsLabel}
            style={buildFooterButtonStyle(colors, sidebarExpanded)}
            onMouseEnter={(event) => {
              event.currentTarget.style.borderColor = colors.orange;
              event.currentTarget.style.backgroundColor = colors.orangeLight;
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.borderColor = colors.border;
              event.currentTarget.style.backgroundColor = colors.card;
            }}
          >
            <span>⚙</span>
            {sidebarExpanded ? <span style={{ fontWeight: 600 }}>{settingsLabel}</span> : null}
          </button>
          <button
            onClick={onShowServices}
            title={servicesLabel}
            style={buildFooterButtonStyle(colors, sidebarExpanded)}
            onMouseEnter={(event) => {
              event.currentTarget.style.borderColor = colors.orange;
              event.currentTarget.style.backgroundColor = colors.orangeLight;
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.borderColor = colors.border;
              event.currentTarget.style.backgroundColor = colors.card;
            }}
          >
            <span>🔌</span>
            {sidebarExpanded ? <span style={{ fontWeight: 600 }}>{servicesLabel}</span> : null}
          </button>
        </div>
      </div>
    </div>
  );
}

export function LegacyWorkspaceTopbar({
  apiBase,
  colors,
  heroSubtitle,
  heroTitleAccent,
  heroTitlePrefix,
  heroTitleSuffix,
  language,
  languages,
  modeLabel,
  parallelSurfaceLinks,
  services,
  showLanguageMenu,
  smartleadReady,
  supabaseReady,
  deliveryReady,
  enrichmentCount,
  isDark,
  llmCount,
  onSelectLanguage,
  onToggleDarkMode,
  onToggleLanguageMenu,
}: TopbarProps) {
  const connected = services.filter((service) => service.hasApiKey);
  const resolvedLlmCount = llmCount ?? connected.filter((service) => service.category === 'llm').length;
  const resolvedEnrichmentCount = enrichmentCount ?? connected.filter((service) => service.category === 'enrichment').length;
  const resolvedDeliveryCount = deliveryReady === false ? 0 : connected.filter((service) => service.category === 'delivery').length;
  const languageLabel = languages.find((entry) => entry.code === language)?.label ?? language.toUpperCase();
  const statusSummary = `API base: ${apiBase} · Mode: ${modeLabel} · Supabase: ${supabaseReady ? 'ready' : 'missing'} · Smartlead: ${smartleadReady ? 'ready' : 'not ready'} · LLMs: ${resolvedLlmCount} · Enrichment: ${resolvedEnrichmentCount} · Delivery: ${resolvedDeliveryCount}`;

  return (
    <div style={{ height: '110px', background: colors.sidebar, borderBottom: `1px solid ${colors.border}`, padding: '0 32px', display: 'flex', alignItems: 'center' }}>
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '32px' }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '8px', lineHeight: '1.2' }}>
            {heroTitlePrefix}
            <span style={{ color: colors.orange }}>{heroTitleAccent}</span>
            {heroTitleSuffix}
          </h1>
          <p style={{ fontSize: '14px', color: colors.textMuted, lineHeight: '1.5' }}>{heroSubtitle}</p>
          <p style={{ fontSize: '12px', color: colors.textMuted, marginTop: '4px' }}>{statusSummary}</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '10px', background: colors.card, border: `1px solid ${colors.border}` }}>
            <span style={buildParallelLabelStyle(colors)}>Parallel Surfaces</span>
            {parallelSurfaceLinks.map((link) => (
              <a key={`hero-${link.href}`} href={link.href} title={link.title} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '32px', padding: '0 12px', borderRadius: '999px', textDecoration: 'none', background: colors.orangeLight, border: `1px solid ${colors.orange}`, color: colors.orange, fontSize: '13px', fontWeight: 700, whiteSpace: 'nowrap' }}>
                {link.label}
              </a>
            ))}
          </div>
          <div style={{ position: 'relative' }} onClick={(event) => event.stopPropagation()}>
            <button onClick={onToggleLanguageMenu} style={{ background: colors.card, border: `1px solid ${colors.border}`, color: colors.text, width: '52px', height: '40px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {languageLabel}
            </button>
            {showLanguageMenu ? (
              <div style={{ position: 'absolute', top: '48px', right: 0, background: colors.card, border: `1px solid ${colors.border}`, borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', minWidth: '180px', zIndex: 200 }}>
                {languages.map((entry) => (
                  <button key={entry.code} onClick={() => onSelectLanguage(entry.code)} style={{ width: '100%', background: language === entry.code ? colors.orangeLight : 'transparent', border: 'none', color: language === entry.code ? colors.orange : colors.text, padding: '12px 16px', textAlign: 'left', cursor: 'pointer', fontSize: '14px', fontWeight: language === entry.code ? 600 : 500, borderBottom: `1px solid ${colors.border}` }}>
                    {entry.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <button onClick={onToggleDarkMode} style={{ background: colors.card, border: `1px solid ${colors.border}`, color: colors.text, width: '40px', height: '40px', borderRadius: '8px', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {isDark ? '☀️' : '🌙'}
          </button>
        </div>
      </div>
    </div>
  );
}

function buildNavButtonStyle(colors: LegacyWorkspaceColors, sidebarExpanded: boolean, isActive: boolean): CSSProperties {
  return { background: isActive ? colors.orangeLight : 'transparent', border: `2px solid ${isActive ? colors.orange : 'transparent'}`, color: isActive ? colors.orange : colors.textMuted, width: sidebarExpanded ? '216px' : '48px', height: '48px', borderRadius: '8px', cursor: 'pointer', fontSize: sidebarExpanded ? '15px' : '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s ease', fontWeight: 600, padding: 0 };
}

function buildNavLabelStyle(sidebarExpanded: boolean): CSSProperties {
  return { width: '100%', display: 'flex', alignItems: 'center', justifyContent: sidebarExpanded ? 'flex-start' : 'center', paddingLeft: sidebarExpanded ? '16px' : '0', textAlign: sidebarExpanded ? 'left' : 'center' };
}

function buildParallelLabelStyle(colors: LegacyWorkspaceColors): CSSProperties {
  return { fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: colors.textMuted, padding: '0 4px' };
}

function buildParallelLinkStyle(colors: LegacyWorkspaceColors, sidebarExpanded: boolean): CSSProperties {
  return { background: colors.card, border: `1px solid ${colors.border}`, color: colors.text, width: sidebarExpanded ? '216px' : '48px', minHeight: sidebarExpanded ? '44px' : '48px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: sidebarExpanded ? 'flex-start' : 'center', paddingLeft: sidebarExpanded ? '16px' : '0', textDecoration: 'none', fontSize: sidebarExpanded ? '14px' : '16px', fontWeight: 600, transition: 'all 0.2s ease' };
}

function buildFooterButtonStyle(colors: LegacyWorkspaceColors, sidebarExpanded: boolean, compact = false): CSSProperties {
  return { background: colors.card, border: `1px solid ${colors.border}`, color: compact ? colors.textMuted : colors.text, width: sidebarExpanded ? '216px' : '48px', height: compact ? '40px' : '48px', borderRadius: '8px', cursor: 'pointer', fontSize: sidebarExpanded ? '15px' : compact ? '14px' : '18px', display: 'flex', alignItems: 'center', justifyContent: sidebarExpanded ? (compact ? 'space-between' : 'flex-start') : 'center', paddingLeft: sidebarExpanded ? '16px' : '0', paddingRight: sidebarExpanded && compact ? '16px' : '0', gap: sidebarExpanded && !compact ? '12px' : '0', transition: 'all 0.2s ease', fontWeight: compact ? 500 : 600, marginBottom: compact ? '8px' : undefined };
}
