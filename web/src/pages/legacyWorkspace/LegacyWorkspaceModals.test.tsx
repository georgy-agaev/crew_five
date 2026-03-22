import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import type { ServiceConfig } from '../../apiClient';
import { LegacyWorkspaceServicesModal } from './LegacyWorkspaceServicesModal';
import { LegacyWorkspaceSettingsModal } from './LegacyWorkspaceSettingsModal';
import type { LegacyWorkspaceColors } from './legacyWorkspaceTypes';

const colors: LegacyWorkspaceColors = {
  bg: '#fff',
  text: '#111',
  textMuted: '#666',
  border: '#ddd',
  navSidebar: '#f7f7f7',
  sidebar: '#fafafa',
  card: '#fff',
  cardHover: '#f5f5f5',
  orange: '#f97316',
  orangeLight: '#fff7ed',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
};

const services: ServiceConfig[] = [
  { name: 'Supabase', category: 'database', status: 'connected', hasApiKey: true },
  { name: 'OpenAI', category: 'llm', status: 'warning', hasApiKey: true },
  { name: 'Smartlead', category: 'delivery', status: 'disconnected', hasApiKey: false },
];

const servicesCopy = {
  title: 'Services',
  categories: {
    database: 'Database',
    llm: 'LLM',
    delivery: 'Delivery',
    enrichment: 'Enrichment',
  },
};

const enrichmentProviderOptions = [
  { id: 'exa', label: 'EXA' },
  { id: 'parallel', label: 'Parallel' },
  { id: 'mock', label: 'Mock' },
];

describe('Legacy workspace modals', () => {
  it('renders settings modal with service providers and enrichment sections', () => {
    const html = renderToString(
      <LegacyWorkspaceSettingsModal
        colors={colors}
        enrichmentProviderOptions={enrichmentProviderOptions}
        enrichmentSettings={{
          defaultProviders: ['exa', 'mock'],
          primaryCompanyProvider: 'exa',
          primaryEmployeeProvider: 'mock',
        }}
        enrichmentSettingsBusy={false}
        enrichmentSettingsError={null}
        isDark={false}
        services={services}
        servicesCopy={servicesCopy}
        title="Settings"
        onClose={vi.fn()}
        onPersistEnrichmentSettings={vi.fn(async () => undefined)}
        isEnrichmentProviderReady={(providerId) => providerId !== 'parallel'}
      />
    );

    expect(html).toContain('Settings');
    expect(html).toContain('Service Providers');
    expect(html).toContain('COMING SOON');
    expect(html).toContain('Enrichment providers');
    expect(html).toContain('Primary provider (company)');
    expect(html).toContain('Primary provider (lead)');
    expect(html).toContain('Supabase');
    expect(html).toContain('OpenAI');
  });

  it('renders services modal with service rows and category labels', () => {
    const html = renderToString(
      <LegacyWorkspaceServicesModal
        colors={colors}
        services={services}
        servicesCopy={servicesCopy}
        title="Services"
        onClose={vi.fn()}
      />
    );

    expect(html).toContain('Services');
    expect(html).toContain('Supabase');
    expect(html).toContain('Database');
    expect(html).toContain('Smartlead');
    expect(html).toContain('Delivery');
  });
});
