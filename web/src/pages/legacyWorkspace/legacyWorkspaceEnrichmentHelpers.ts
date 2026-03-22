type ProviderOption = {
  id: string;
  label?: string;
  serviceName?: string;
};

type ServiceLike = {
  name: string;
  hasApiKey?: boolean;
  status?: string;
};

type EnrichmentSettingsLike = {
  defaultProviders?: unknown;
  primaryProvider?: unknown;
  primaryCompanyProvider?: unknown;
  primaryEmployeeProvider?: unknown;
};

export function buildFallbackEnrichmentSettings() {
  return {
    version: 2,
    defaultProviders: ['mock'],
    primaryCompanyProvider: 'mock',
    primaryEmployeeProvider: 'mock',
  };
}

export function isEnrichmentProviderReadyForServices(
  providerId: string,
  providerOptions: ProviderOption[],
  services: ServiceLike[]
) {
  if (providerId === 'mock') return true;
  const provider = providerOptions.find((entry) => entry.id === providerId);
  if (!provider?.serviceName) return false;
  const service = services.find(
    (entry) => String(entry.name).toLowerCase() === provider.serviceName?.toLowerCase()
  );
  return Boolean(service?.hasApiKey && service?.status === 'connected');
}

export function normalizeEnrichmentSettings(
  settings: EnrichmentSettingsLike,
  isProviderReady: (providerId: string) => boolean
) {
  const defaults = Array.isArray(settings?.defaultProviders)
    ? settings.defaultProviders.filter(
        (providerId): providerId is string =>
          typeof providerId === 'string' && isProviderReady(providerId)
      )
    : [];
  const safeDefaults = defaults.length ? defaults : ['mock'];
  const legacyPrimary =
    typeof settings?.primaryProvider === 'string' ? settings.primaryProvider : null;
  const primaryCompanyRaw =
    typeof settings?.primaryCompanyProvider === 'string'
      ? settings.primaryCompanyProvider
      : legacyPrimary;
  const primaryEmployeeRaw =
    typeof settings?.primaryEmployeeProvider === 'string'
      ? settings.primaryEmployeeProvider
      : legacyPrimary;

  return {
    version: 2,
    defaultProviders: safeDefaults,
    primaryCompanyProvider: safeDefaults.includes(primaryCompanyRaw ?? '')
      ? primaryCompanyRaw
      : safeDefaults[0],
    primaryEmployeeProvider: safeDefaults.includes(primaryEmployeeRaw ?? '')
      ? primaryEmployeeRaw
      : safeDefaults[0],
  };
}

export function toggleEnrichmentProviderSelection(
  selectedProviders: string[],
  providerId: string
) {
  if (selectedProviders.includes(providerId)) {
    const next = selectedProviders.filter((entry) => entry !== providerId);
    return next.length ? next : selectedProviders;
  }

  return [...selectedProviders, providerId];
}
