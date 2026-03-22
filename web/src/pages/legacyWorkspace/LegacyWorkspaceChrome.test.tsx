import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import {
  LegacyWorkspaceSidebar,
  LegacyWorkspaceTopbar,
} from './LegacyWorkspaceChrome';
import type {
  LegacyWorkspaceColors,
  LegacyWorkspaceLanguage,
  LegacyWorkspaceNavItem,
  LegacyWorkspaceParallelLink,
  LegacyWorkspaceService,
} from './legacyWorkspaceTypes';

const colors: LegacyWorkspaceColors = {
  bg: '#f8fafc',
  text: '#111827',
  textMuted: '#6b7280',
  border: '#e5e7eb',
  navSidebar: '#ffffff',
  sidebar: '#ffffff',
  card: '#ffffff',
  cardHover: '#f3f4f6',
  orange: '#f97316',
  orangeLight: '#ffedd5',
};

const navItems: LegacyWorkspaceNavItem[] = [
  { page: 'pipeline', label: 'Pipeline', short: 'P', title: 'Pipeline' },
  { page: 'campaigns', label: 'Campaigns', short: 'C', title: 'Campaigns' },
];

const parallelLinks: LegacyWorkspaceParallelLink[] = [
  { href: '?view=builder-v2', label: 'Builder V2', short: 'B2', title: 'Open Builder V2' },
  { href: '?view=inbox-v2', label: 'Inbox V2', short: 'I2', title: 'Open Inbox V2' },
];

const languages: LegacyWorkspaceLanguage[] = [
  { code: 'en', label: 'EN', name: 'English' },
  { code: 'ru', label: 'RU', name: 'Russian' },
];

const services: LegacyWorkspaceService[] = [
  { category: 'llm', hasApiKey: true },
  { category: 'enrichment', hasApiKey: true },
  { category: 'delivery', hasApiKey: false },
];

describe('LegacyWorkspaceChrome', () => {
  it('renders sidebar navigation and parallel surface links', () => {
    const html = renderToString(
      <LegacyWorkspaceSidebar
        colors={colors}
        currentPage="pipeline"
        navItems={navItems}
        parallelSurfaceLinks={parallelLinks}
        settingsLabel="Settings"
        servicesLabel="Services"
        collapseLabel="Collapse"
        sidebarExpanded
        onNavigate={vi.fn()}
        onToggleSidebar={vi.fn()}
        onShowSettings={vi.fn()}
        onShowServices={vi.fn()}
      />
    );

    expect(html).toContain('Pipeline');
    expect(html).toContain('Campaigns');
    expect(html).toContain('Parallel Surfaces');
    expect(html).toContain('?view=builder-v2');
    expect(html).toContain('?view=inbox-v2');
  });

  it('renders topbar hero, status summary, and visible v2 links', () => {
    const html = renderToString(
      <LegacyWorkspaceTopbar
        apiBase="/api"
        colors={colors}
        deliveryReady={false}
        enrichmentCount={1}
        heroSubtitle="Hero subtitle"
        heroTitleAccent="pipeline-ready"
        heroTitlePrefix="Turn prospects into "
        heroTitleSuffix=" conversations"
        language="en"
        languages={languages}
        llmCount={1}
        modeLabel="live"
        parallelSurfaceLinks={parallelLinks}
        services={services}
        showLanguageMenu={false}
        smartleadReady
        supabaseReady
        onSelectLanguage={vi.fn()}
        onToggleDarkMode={vi.fn()}
        onToggleLanguageMenu={vi.fn()}
      />
    );

    expect(html).toContain('Turn prospects into');
    expect(html).toContain('pipeline-ready');
    expect(html).toContain('API base: /api');
    expect(html).toContain('Parallel Surfaces');
    expect(html).toContain('Builder V2');
    expect(html).toContain('Inbox V2');
  });
});
