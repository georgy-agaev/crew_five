import type { LegacyWorkspaceColors } from './legacyWorkspaceTypes';
import { primaryButtonStyle } from './legacyWorkspaceStepStyles';

type ProviderOption = {
  id: string;
  label: string;
};

type EnrichResult = {
  provider: string;
  status: string;
  error?: string | null;
};

type LegacyEnrichmentStepProps = {
  colors: LegacyWorkspaceColors;
  copy: {
    lockedTitle: string;
    lockedSubtitle: string;
    title: string;
    subtitle: string;
    from: string;
    optional: string;
    optionalDesc: string;
    companyData: string;
    companyDesc: string;
    leadDetails: string;
    leadDesc: string;
    webIntel: string;
    webDesc: string;
    enrich: string;
    skip: string;
  };
  enrichLoading: boolean;
  enrichResults: EnrichResult[] | null;
  enrichStatus: string | null;
  enrichmentDefaults: string[];
  enrichmentPrimarySummary: {
    company: string | null;
    lead: string | null;
  };
  hasSegment: boolean;
  isProviderReady: (providerId: string) => boolean;
  providerOptions: ProviderOption[];
  segmentSummary: {
    name: string;
    source: string;
  } | null;
  selectedProviders: string[];
  onEnrich: () => void | Promise<void>;
  onProviderToggle: (providerId: string) => void;
  onResetToDefaults: () => void;
  onSkip: () => void;
};

const INFO_CARDS = ['companyData', 'leadDetails', 'webIntel'] as const;

export function LegacyEnrichmentStep({
  colors,
  copy,
  enrichLoading,
  enrichResults,
  enrichStatus,
  enrichmentDefaults,
  enrichmentPrimarySummary,
  hasSegment,
  isProviderReady,
  providerOptions,
  segmentSummary,
  selectedProviders,
  onEnrich,
  onProviderToggle,
  onResetToDefaults,
  onSkip,
}: LegacyEnrichmentStepProps) {
  if (!hasSegment || !segmentSummary) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 40px' }}>
        <div style={lockedTitleStyle(colors)}>{copy.lockedTitle}</div>
        <div style={{ fontSize: '14px', color: colors.textMuted }}>{copy.lockedSubtitle}</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '12px' }}>{copy.title}</h2>
        <div style={{ fontSize: '14px', color: colors.textMuted, lineHeight: '1.8' }}>
          <div>
            <span style={{ fontWeight: 600 }}>{copy.subtitle}:</span> {segmentSummary.name}
          </div>
          <div>
            <span style={{ fontWeight: 600 }}>{copy.from}</span> {segmentSummary.source}
          </div>
        </div>
      </div>

      <div style={noticeStyle(colors)}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: colors.orange, marginBottom: '8px' }}>
          {copy.optional}
        </div>
        <div style={{ fontSize: '13px', color: colors.text, lineHeight: '1.6' }}>
          {copy.optionalDesc}
        </div>
      </div>

      <div style={{ display: 'grid', gap: '16px', marginBottom: '32px' }}>
        {INFO_CARDS.map((cardKey) => (
          <div key={cardKey} style={infoCardStyle(colors)}>
            <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '8px', color: colors.text }}>
              {copy[cardKey]}
            </div>
            <div style={{ fontSize: '13px', color: colors.textMuted, lineHeight: '1.5' }}>
              {copy[`${cardKey === 'companyData' ? 'companyDesc' : cardKey === 'leadDetails' ? 'leadDesc' : 'webDesc'}` as 'companyDesc' | 'leadDesc' | 'webDesc']}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginBottom: '18px' }}>
        <div style={{ fontSize: '12px', fontWeight: 700, color: colors.textMuted, marginBottom: '10px' }}>
          Providers
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          {providerOptions.map((provider) => {
            const selected = selectedProviders.includes(provider.id);
            const ready = isProviderReady(provider.id);
            return (
              <button
                key={provider.id}
                type="button"
                disabled={!ready || enrichLoading}
                onClick={() => onProviderToggle(provider.id)}
                style={providerChipStyle(colors, selected, ready, enrichLoading)}
                title={!ready ? 'Configure API key in Settings to enable' : undefined}
              >
                {provider.label}
              </button>
            );
          })}

          <button
            type="button"
            disabled={enrichLoading || !enrichmentDefaults.length}
            onClick={onResetToDefaults}
            style={resetButtonStyle(colors, enrichLoading)}
          >
            Reset to defaults
          </button>
        </div>

        <div style={{ marginTop: '10px', fontSize: '12px', color: colors.textMuted }}>
          Primary providers for workflow:{' '}
          <span style={{ color: colors.text, fontWeight: 600 }}>
            company {enrichmentPrimarySummary.company ?? '—'}, lead {enrichmentPrimarySummary.lead ?? '—'}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={() => void onEnrich()}
          style={primaryButtonStyle(colors, enrichLoading, '14px 32px')}
          disabled={enrichLoading}
        >
          {enrichLoading ? 'Enriching…' : copy.enrich}
        </button>

        <button onClick={onSkip} style={skipButtonStyle(colors)}>
          {copy.skip}
        </button>
      </div>

      {enrichResults?.length ? (
        <div style={{ marginTop: '12px', fontSize: '12px', color: colors.textMuted, display: 'grid', gap: '6px' }}>
          {enrichResults.map((result) => (
            <div key={result.provider}>
              <span style={{ fontWeight: 700, color: colors.text }}>
                {String(result.provider).toUpperCase()}
              </span>
              {': '}
              {result.status}
              {result.error ? ` — ${result.error}` : ''}
            </div>
          ))}
        </div>
      ) : enrichStatus ? (
        <div style={{ marginTop: '12px', fontSize: '12px', color: colors.textMuted }}>
          Enrichment status: {enrichStatus}
        </div>
      ) : null}
    </div>
  );
}

function lockedTitleStyle(colors: LegacyWorkspaceColors) {
  return {
    fontSize: '18px',
    fontWeight: 600,
    color: colors.textMuted,
    marginBottom: '8px',
  } as const;
}

function noticeStyle(colors: LegacyWorkspaceColors) {
  return {
    background: colors.orangeLight,
    border: `1px solid ${colors.orange}`,
    borderRadius: '12px',
    padding: '20px',
    marginBottom: '32px',
  };
}

function infoCardStyle(colors: LegacyWorkspaceColors) {
  return {
    background: colors.card,
    border: `1px solid ${colors.border}`,
    borderRadius: '8px',
    padding: '20px',
  };
}

function providerChipStyle(
  colors: LegacyWorkspaceColors,
  selected: boolean,
  ready: boolean,
  enrichLoading: boolean
) {
  return {
    padding: '8px 12px',
    borderRadius: '999px',
    border: selected ? `1px solid ${colors.orange}` : `1px solid ${colors.border}`,
    background: selected ? colors.orangeLight : colors.sidebar,
    color: selected ? colors.orange : colors.text,
    fontSize: '12px',
    fontWeight: 700,
    cursor: !ready || enrichLoading ? 'not-allowed' : 'pointer',
    opacity: !ready ? 0.5 : 1,
  } as const;
}

function resetButtonStyle(colors: LegacyWorkspaceColors, enrichLoading: boolean) {
  return {
    marginLeft: '6px',
    padding: '8px 12px',
    borderRadius: '999px',
    border: `1px solid ${colors.border}`,
    background: 'transparent',
    color: colors.textMuted,
    fontSize: '12px',
    fontWeight: 700,
    cursor: enrichLoading ? 'not-allowed' : 'pointer',
    opacity: enrichLoading ? 0.6 : 1,
  } as const;
}

function skipButtonStyle(colors: LegacyWorkspaceColors) {
  return {
    background: 'transparent',
    color: colors.textMuted,
    border: `1px solid ${colors.border}`,
    borderRadius: '8px',
    padding: '14px 32px',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  } as const;
}
