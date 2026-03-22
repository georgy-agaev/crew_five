import type { ServiceConfig } from '../../apiClient';
import { LegacyEnrichmentProvidersPanel } from './LegacyEnrichmentProvidersPanel';
import { LegacyServiceProvidersPanel } from './LegacyServiceProvidersPanel';
import type { LegacyWorkspaceColors } from './legacyWorkspaceTypes';

type ServicesCopy = {
  categories: Record<ServiceConfig['category'], string>;
};

type EnrichmentProviderOption = {
  id: string;
  label: string;
};

type EnrichmentSettingsState = {
  version?: number;
  defaultProviders: string[];
  primaryCompanyProvider: string;
  primaryEmployeeProvider: string;
};

type LegacyWorkspaceSettingsModalProps = {
  colors: LegacyWorkspaceColors;
  enrichmentProviderOptions: EnrichmentProviderOption[];
  enrichmentSettings: EnrichmentSettingsState | null;
  enrichmentSettingsBusy: boolean;
  enrichmentSettingsError: string | null;
  isDark: boolean;
  services: ServiceConfig[];
  servicesCopy: ServicesCopy;
  title: string;
  onClose: () => void;
  onPersistEnrichmentSettings: (next: EnrichmentSettingsState) => Promise<void>;
  isEnrichmentProviderReady: (providerId: string) => boolean;
};

export function LegacyWorkspaceSettingsModal({
  colors,
  enrichmentProviderOptions,
  enrichmentSettings,
  enrichmentSettingsBusy,
  enrichmentSettingsError,
  isDark,
  services,
  servicesCopy,
  title,
  onClose,
  onPersistEnrichmentSettings,
  isEnrichmentProviderReady,
}: LegacyWorkspaceSettingsModalProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: colors.card,
          borderRadius: '16px',
          width: '90%',
          maxWidth: '800px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '24px', borderBottom: `1px solid ${colors.border}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '20px', fontWeight: 700 }}>{title}</h3>
            <button
              onClick={onClose}
              style={closeButtonStyle(colors)}
            >
              ×
            </button>
          </div>
        </div>

        <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
          <LegacyServiceProvidersPanel
            colors={colors}
            isDark={isDark}
            services={services}
            servicesCopy={servicesCopy}
          />

          <LegacyEnrichmentProvidersPanel
            colors={colors}
            enrichmentProviderOptions={enrichmentProviderOptions}
            enrichmentSettings={enrichmentSettings}
            enrichmentSettingsBusy={enrichmentSettingsBusy}
            enrichmentSettingsError={enrichmentSettingsError}
            isEnrichmentProviderReady={isEnrichmentProviderReady}
            onPersistEnrichmentSettings={onPersistEnrichmentSettings}
          />
        </div>
      </div>
    </div>
  );
}

function closeButtonStyle(colors: LegacyWorkspaceColors) {
  return {
    background: 'none',
    border: 'none',
    color: colors.textMuted,
    fontSize: '24px',
    cursor: 'pointer',
    padding: '0',
    width: '32px',
    height: '32px',
  } as const;
}
