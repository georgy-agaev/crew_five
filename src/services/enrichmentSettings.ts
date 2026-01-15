import type { SupabaseClient } from '@supabase/supabase-js';

import { getAppSetting, setAppSetting } from './appSettings';

export type EnrichmentProviderId = 'mock' | 'exa' | 'parallel' | 'firecrawl' | 'anysite';

export type EnrichmentSettingsV2 = {
  version: 2;
  defaultProviders: EnrichmentProviderId[];
  primaryCompanyProvider: EnrichmentProviderId;
  primaryEmployeeProvider: EnrichmentProviderId;
};

const APP_SETTING_KEY = 'enrichment_settings';
const KNOWN_PROVIDERS: EnrichmentProviderId[] = ['mock', 'exa', 'parallel', 'firecrawl', 'anysite'];

function isProviderId(value: string): value is EnrichmentProviderId {
  return (KNOWN_PROVIDERS as string[]).includes(value);
}

export function getDefaultEnrichmentSettings(ready: Set<EnrichmentProviderId>): EnrichmentSettingsV2 {
  const order: EnrichmentProviderId[] = ['exa', 'firecrawl', 'parallel', 'anysite', 'mock'];
  const defaults = order.filter((p) => p === 'mock' || ready.has(p));
  const defaultProviders: EnrichmentProviderId[] = defaults.length ? defaults : ['mock'];
  const primaryCompanyProvider = defaultProviders.includes('firecrawl')
    ? 'firecrawl'
    : (defaultProviders[0] ?? 'mock');
  const primaryEmployeeProvider = defaultProviders.includes('exa') ? 'exa' : (defaultProviders[0] ?? 'mock');

  return { version: 2, defaultProviders, primaryCompanyProvider, primaryEmployeeProvider };
}

export function validateEnrichmentSettings(
  input: unknown,
  ready: Set<EnrichmentProviderId>
): EnrichmentSettingsV2 {
  const raw = (input ?? {}) as any;

  const defaultProviders = Array.isArray(raw.defaultProviders) ? raw.defaultProviders : [];
  const primaryCompanyCandidate =
    typeof raw.primaryCompanyProvider === 'string' ? raw.primaryCompanyProvider.toLowerCase() : undefined;
  const primaryEmployeeCandidate =
    typeof raw.primaryEmployeeProvider === 'string' ? raw.primaryEmployeeProvider.toLowerCase() : undefined;

  const legacyPrimaryCandidate = typeof raw.primaryProvider === 'string' ? raw.primaryProvider.toLowerCase() : undefined;

  const primaryCompanyProvider =
    (primaryCompanyCandidate && isProviderId(primaryCompanyCandidate) ? primaryCompanyCandidate : undefined) ??
    (legacyPrimaryCandidate && isProviderId(legacyPrimaryCandidate) ? legacyPrimaryCandidate : undefined);
  const primaryEmployeeProvider =
    (primaryEmployeeCandidate && isProviderId(primaryEmployeeCandidate) ? primaryEmployeeCandidate : undefined) ??
    (legacyPrimaryCandidate && isProviderId(legacyPrimaryCandidate) ? legacyPrimaryCandidate : undefined);

  const normalized = Array.from(
    new Set(
      defaultProviders
        .map((p: any) => String(p).toLowerCase())
        .filter((p: string) => isProviderId(p))
        .filter((p: EnrichmentProviderId) => p === 'mock' || ready.has(p))
    )
  ) as EnrichmentProviderId[];

  const safeDefaults: EnrichmentProviderId[] = normalized.length ? normalized : ['mock'];
  const safePrimaryCompany =
    primaryCompanyProvider && safeDefaults.includes(primaryCompanyProvider)
      ? primaryCompanyProvider
      : safeDefaults.includes('firecrawl')
        ? 'firecrawl'
        : (safeDefaults[0] ?? 'mock');
  const safePrimaryEmployee =
    primaryEmployeeProvider && safeDefaults.includes(primaryEmployeeProvider)
      ? primaryEmployeeProvider
      : safeDefaults.includes('exa')
        ? 'exa'
        : (safeDefaults[0] ?? 'mock');

  return {
    version: 2,
    defaultProviders: safeDefaults,
    primaryCompanyProvider: safePrimaryCompany,
    primaryEmployeeProvider: safePrimaryEmployee,
  };
}

export async function getEnrichmentSettings(
  supabase: SupabaseClient,
  ready: Set<EnrichmentProviderId>
): Promise<EnrichmentSettingsV2> {
  const fallback = getDefaultEnrichmentSettings(ready);
  const stored = await getAppSetting<EnrichmentSettingsV2>(supabase, APP_SETTING_KEY, fallback);
  return validateEnrichmentSettings(stored, ready);
}

export async function getPrimaryProvidersForWorkflow(
  supabase: SupabaseClient,
  fallback: EnrichmentProviderId = 'mock'
): Promise<{ company: EnrichmentProviderId; employee: EnrichmentProviderId }> {
  const stored = await getAppSetting<any>(supabase, APP_SETTING_KEY, null);
  const raw = stored ?? {};
  const companyCandidate =
    typeof raw.primaryCompanyProvider === 'string' ? raw.primaryCompanyProvider.toLowerCase() : '';
  const employeeCandidate =
    typeof raw.primaryEmployeeProvider === 'string' ? raw.primaryEmployeeProvider.toLowerCase() : '';
  const legacyCandidate = typeof raw.primaryProvider === 'string' ? raw.primaryProvider.toLowerCase() : '';

  const company =
    (companyCandidate && isProviderId(companyCandidate) ? companyCandidate : undefined) ??
    (legacyCandidate && isProviderId(legacyCandidate) ? legacyCandidate : undefined) ??
    fallback;

  const employee =
    (employeeCandidate && isProviderId(employeeCandidate) ? employeeCandidate : undefined) ??
    (legacyCandidate && isProviderId(legacyCandidate) ? legacyCandidate : undefined) ??
    fallback;

  return { company, employee };
}

export async function setEnrichmentSettings(
  supabase: SupabaseClient,
  settings: unknown,
  ready: Set<EnrichmentProviderId>,
  probeProvider?: (providerId: EnrichmentProviderId) => Promise<{ ok: boolean; reason?: string }>
): Promise<EnrichmentSettingsV2> {
  const validated = validateEnrichmentSettings(settings, ready);

  if (probeProvider) {
    const toVerify = Array.from(new Set(validated.defaultProviders)).filter((p) => p !== 'mock');
    for (const providerId of toVerify) {
      const res = await probeProvider(providerId);
      if (!res.ok) {
        throw new Error(`Provider not verified: ${providerId}${res.reason ? ` (${res.reason})` : ''}`);
      }
    }
  }

  await setAppSetting(supabase, APP_SETTING_KEY, validated);
  return validated;
}
