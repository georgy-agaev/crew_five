import { describe, expect, it } from 'vitest';

import {
  buildFallbackEnrichmentSettings,
  isEnrichmentProviderReadyForServices,
  normalizeEnrichmentSettings,
  toggleEnrichmentProviderSelection,
} from './legacyWorkspaceEnrichmentHelpers';

describe('legacyWorkspaceEnrichmentHelpers', () => {
  it('treats mock provider as always ready and requires connected service for real providers', () => {
    const providerOptions = [
      { id: 'mock', label: 'Mock' },
      { id: 'apollo', label: 'Apollo', serviceName: 'Apollo' },
      { id: 'hunter', label: 'Hunter', serviceName: 'Hunter' },
    ];
    const services = [
      { name: 'Apollo', hasApiKey: true, status: 'connected' },
      { name: 'Hunter', hasApiKey: false, status: 'connected' },
    ];

    expect(isEnrichmentProviderReadyForServices('mock', providerOptions, services)).toBe(true);
    expect(isEnrichmentProviderReadyForServices('apollo', providerOptions, services)).toBe(true);
    expect(isEnrichmentProviderReadyForServices('hunter', providerOptions, services)).toBe(false);
  });

  it('normalizes enrichment settings by filtering unavailable defaults and resolving legacy primary provider', () => {
    const normalized = normalizeEnrichmentSettings(
      {
        defaultProviders: ['apollo', 'hunter'],
        primaryProvider: 'apollo',
      },
      (providerId) => providerId === 'apollo'
    );

    expect(normalized).toEqual({
      version: 2,
      defaultProviders: ['apollo'],
      primaryCompanyProvider: 'apollo',
      primaryEmployeeProvider: 'apollo',
    });
  });

  it('falls back to mock settings when no providers are available', () => {
    const normalized = normalizeEnrichmentSettings(
      {
        defaultProviders: ['hunter'],
      },
      () => false
    );

    expect(normalized).toEqual(buildFallbackEnrichmentSettings());
  });

  it('toggles provider selection without allowing an empty list', () => {
    expect(toggleEnrichmentProviderSelection(['mock'], 'mock')).toEqual(['mock']);
    expect(toggleEnrichmentProviderSelection(['mock'], 'apollo')).toEqual(['mock', 'apollo']);
    expect(toggleEnrichmentProviderSelection(['mock', 'apollo'], 'apollo')).toEqual(['mock']);
  });
});
