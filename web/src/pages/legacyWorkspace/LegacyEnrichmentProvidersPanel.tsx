import type { LegacyWorkspaceColors } from './legacyWorkspaceTypes';

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

type LegacyEnrichmentProvidersPanelProps = {
  colors: LegacyWorkspaceColors;
  enrichmentProviderOptions: EnrichmentProviderOption[];
  enrichmentSettings: EnrichmentSettingsState | null;
  enrichmentSettingsBusy: boolean;
  enrichmentSettingsError: string | null;
  isEnrichmentProviderReady: (providerId: string) => boolean;
  onPersistEnrichmentSettings: (next: EnrichmentSettingsState) => Promise<void>;
};

const FALLBACK_SETTINGS: EnrichmentSettingsState = {
  version: 2,
  defaultProviders: ['mock'],
  primaryCompanyProvider: 'mock',
  primaryEmployeeProvider: 'mock',
};

export function LegacyEnrichmentProvidersPanel({
  colors,
  enrichmentProviderOptions,
  enrichmentSettings,
  enrichmentSettingsBusy,
  enrichmentSettingsError,
  isEnrichmentProviderReady,
  onPersistEnrichmentSettings,
}: LegacyEnrichmentProvidersPanelProps) {
  const current = enrichmentSettings ?? FALLBACK_SETTINGS;

  return (
    <div
      style={{
        marginBottom: '12px',
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: '12px',
        padding: '16px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
        }}
      >
        <div style={{ fontSize: '16px', fontWeight: 700, color: colors.text }}>
          Enrichment providers
        </div>
        {enrichmentSettingsBusy ? (
          <div style={{ fontSize: '12px', color: colors.textMuted }}>Saving…</div>
        ) : null}
      </div>

      <div style={{ display: 'grid', gap: '10px' }}>
        {enrichmentProviderOptions.map((provider) => {
          const ready = isEnrichmentProviderReady(provider.id);
          const enabled = Boolean(current.defaultProviders.includes(provider.id));
          const disabled = enrichmentSettingsBusy || (!ready && provider.id !== 'mock');

          return (
            <div
              key={provider.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 12px',
                background: colors.sidebar,
                borderRadius: '10px',
                border: `1px solid ${colors.border}`,
                opacity: disabled ? 0.7 : 1,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: colors.text }}>
                  {provider.label}
                </div>
                <div style={{ fontSize: '11px', color: colors.textMuted }}>
                  {provider.id === 'mock'
                    ? 'Built-in (no API key required)'
                    : ready
                      ? 'Ready'
                      : 'Missing API key'}
                </div>
              </div>

              <label
                style={{
                  position: 'relative',
                  display: 'inline-block',
                  width: '44px',
                  height: '24px',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={enabled}
                  disabled={disabled}
                  onChange={() =>
                    void onPersistEnrichmentSettings(
                      nextDefaultsState(current, provider.id, enabled)
                    )
                  }
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: enabled ? colors.orange : colors.border,
                    borderRadius: '24px',
                    transition: 'background 0.2s',
                  }}
                />
                <span
                  style={{
                    position: 'absolute',
                    left: enabled ? '22px' : '2px',
                    top: '2px',
                    width: '20px',
                    height: '20px',
                    background: '#FFF',
                    borderRadius: '50%',
                    transition: 'left 0.2s',
                  }}
                />
              </label>
            </div>
          );
        })}
      </div>

      <ProviderSelect
        colors={colors}
        cursorDisabled={enrichmentSettingsBusy}
        label="Primary provider (company)"
        value={current.primaryCompanyProvider}
        options={current.defaultProviders}
        providerOptions={enrichmentProviderOptions}
        onChange={(nextPrimary) =>
          void onPersistEnrichmentSettings({
            ...current,
            primaryCompanyProvider: nextPrimary,
          })
        }
      />

      <ProviderSelect
        colors={colors}
        cursorDisabled={enrichmentSettingsBusy}
        label="Primary provider (lead)"
        value={current.primaryEmployeeProvider}
        options={current.defaultProviders}
        providerOptions={enrichmentProviderOptions}
        onChange={(nextPrimary) =>
          void onPersistEnrichmentSettings({
            ...current,
            primaryEmployeeProvider: nextPrimary,
          })
        }
      />

      {enrichmentSettingsError ? (
        <div style={{ marginTop: '10px', fontSize: '12px', color: colors.error }}>
          {enrichmentSettingsError}
        </div>
      ) : null}
    </div>
  );
}

function ProviderSelect({
  colors,
  cursorDisabled,
  label,
  value,
  options,
  providerOptions,
  onChange,
}: {
  colors: LegacyWorkspaceColors;
  cursorDisabled: boolean;
  label: string;
  value: string;
  options: string[];
  providerOptions: EnrichmentProviderOption[];
  onChange: (nextPrimary: string) => void;
}) {
  return (
    <div style={{ marginTop: '14px', display: 'grid', gap: '6px' }}>
      <div style={{ fontSize: '12px', fontWeight: 700, color: colors.textMuted }}>{label}</div>
      <select
        value={value}
        disabled={cursorDisabled}
        onChange={(event) => onChange(event.target.value)}
        style={{
          width: '100%',
          background: colors.sidebar,
          border: `1px solid ${colors.border}`,
          borderRadius: '8px',
          padding: '10px 12px',
          fontSize: '13px',
          color: colors.text,
          cursor: cursorDisabled ? 'not-allowed' : 'pointer',
        }}
      >
        {options.map((providerId) => {
          const providerLabel =
            providerOptions.find((option) => option.id === providerId)?.label ?? providerId;

          return (
            <option key={providerId} value={providerId}>
              {providerLabel}
            </option>
          );
        })}
      </select>
    </div>
  );
}

function nextDefaultsState(
  current: EnrichmentSettingsState,
  providerId: string,
  enabled: boolean
) {
  const nextDefaults = enabled
    ? current.defaultProviders.filter((entry) => entry !== providerId)
    : [...current.defaultProviders, providerId];
  const safeDefaults = nextDefaults.length ? nextDefaults : ['mock'];

  return {
    ...current,
    defaultProviders: safeDefaults,
    primaryCompanyProvider: safeDefaults.includes(current.primaryCompanyProvider)
      ? current.primaryCompanyProvider
      : safeDefaults[0],
    primaryEmployeeProvider: safeDefaults.includes(current.primaryEmployeeProvider)
      ? current.primaryEmployeeProvider
      : safeDefaults[0],
  };
}
