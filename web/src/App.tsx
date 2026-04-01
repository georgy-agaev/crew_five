import { useEffect, useState } from 'react';

import './index.css';
import PipelineWorkspaceWithSidebar from './pages/PipelineWorkspaceWithSidebar';
import { fetchMeta, type MetaStatus } from './apiClient';
import { IcpDiscoveryPage } from './pages/IcpDiscoveryPage';
import { BuilderWorkspacePage } from './pages/BuilderWorkspacePage';
import { InboxWorkspacePage } from './pages/InboxWorkspacePage';
import { ContactsWorkspacePage } from './pages/ContactsWorkspacePage';
import { MailboxesWorkspacePage } from './pages/MailboxesWorkspacePage';
import { EnrichmentWorkspacePage } from './pages/EnrichmentWorkspacePage';
import { ImportWorkspacePage } from './pages/ImportWorkspacePage';
import { HomeWorkspacePage } from './pages/HomeWorkspacePage';
import CampaignOperatorDesk from './pages/CampaignOperatorDesk';
import CampaignOpsPage from './pages/CampaignOpsPage';
import { AppShell } from './components/AppShell';
import { usePersistedState } from './hooks/usePersistedState';
import { resolveViewFromLocation } from './appView';

const LEGACY_VIEWS = new Set(['pipeline', 'campaigns', 'icp-discovery']);

function App() {
  const apiBase = import.meta.env.VITE_API_BASE ?? '/api';
  const adapterMode = import.meta.env.VITE_WEB_ADAPTER_MODE ?? 'live';
  const [meta, setMeta] = useState<MetaStatus | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [isDark, setIsDark] = usePersistedState('c5:shell:dark', false);
  const [language, setLanguage] = usePersistedState('c5:shell:language', 'en');
  const [sidebarExpanded, setSidebarExpanded] = usePersistedState('c5:shell:sidebar', true);

  const view = resolveViewFromLocation(
    typeof window !== 'undefined' && window.location ? window.location : undefined
  );

  useEffect(() => {
    fetchMeta()
      .then(setMeta)
      .catch((err) => setMetaError(err?.message ?? 'Failed to load meta'));
  }, []);

  const smartleadReady = meta?.smartleadReady ?? true;
  const modeLabel = meta?.mode ?? adapterMode;
  const supabaseReady = meta?.supabaseReady ?? true;

  // Legacy views render without new shell
  if (LEGACY_VIEWS.has(view)) {
    return (
      <main className="shell">
        {view === 'icp-discovery' ? (
          <IcpDiscoveryPage />
        ) : (
          <PipelineWorkspaceWithSidebar
            apiBase={apiBase}
            modeLabel={modeLabel}
            supabaseReady={supabaseReady}
            smartleadReady={smartleadReady}
            initialPage={view === 'campaigns' ? 'campaigns' : 'pipeline'}
          />
        )}
      </main>
    );
  }

  // New surfaces render inside AppShell
  return (
    <AppShell
      currentView={view}
      isDark={isDark}
      language={language}
      sidebarExpanded={sidebarExpanded}
      onToggleDark={() => setIsDark((d) => !d)}
      onSelectLanguage={setLanguage}
      onToggleSidebar={() => setSidebarExpanded((s) => !s)}
    >
      {metaError && (
        <p className="error-text" style={{ margin: '8px 16px' }}>
          Failed to load adapter meta: {metaError}
        </p>
      )}
      {view === 'home' ? (
        <HomeWorkspacePage isDark={isDark} />
      ) : view === 'campaign-ops' ? (
        <CampaignOperatorDesk isDark={isDark} language={language} />
      ) : view === 'campaign-ledger' ? (
        <CampaignOpsPage />
      ) : view === 'builder-v2' ? (
        <BuilderWorkspacePage isDark={isDark} language={language} />
      ) : view === 'inbox-v2' ? (
        <InboxWorkspacePage isDark={isDark} />
      ) : view === 'contacts' ? (
        <ContactsWorkspacePage isDark={isDark} />
      ) : view === 'mailboxes' ? (
        <MailboxesWorkspacePage isDark={isDark} />
      ) : view === 'enrichment' ? (
        <EnrichmentWorkspacePage isDark={isDark} />
      ) : view === 'import' ? (
        <ImportWorkspacePage isDark={isDark} />
      ) : null}
    </AppShell>
  );
}

export default App;
