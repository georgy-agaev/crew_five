import './index.css';
import { useEffect, useState } from 'react';

import { CampaignsPage } from './pages/CampaignsPage';
import { DraftsPage } from './pages/DraftsPage';
import { SendPage } from './pages/SendPage';
import { EventsPage } from './pages/EventsPage';
import { SettingsPage } from './pages/SettingsPage';
import { fetchMeta, type MetaStatus } from './apiClient';

function App() {
  const [view, setView] = useState<'campaigns' | 'drafts' | 'send' | 'events' | 'settings'>('campaigns');
  const apiBase = import.meta.env.VITE_API_BASE ?? '/api';
  const adapterMode = import.meta.env.VITE_WEB_ADAPTER_MODE ?? 'live';
  const [meta, setMeta] = useState<MetaStatus | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);

  useEffect(() => {
    fetchMeta()
      .then(setMeta)
      .catch((err) => setMetaError(err?.message ?? 'Failed to load meta'));
  }, []);

  const smartleadReady = meta?.smartleadReady ?? true;
  const modeLabel = meta?.mode ?? adapterMode;

  return (
    <main>
      <header>
        <h1>AI SDR GTM Web (Mock)</h1>
        <small>
          API base: {apiBase} · Mode: {modeLabel}
          {!smartleadReady && <span style={{ marginLeft: 8, color: '#b91c1c' }}>Smartlead not ready</span>}
        </small>
        {metaError && (
          <p style={{ color: '#b91c1c', marginTop: 4 }}>
            Failed to load adapter meta: {metaError}
          </p>
        )}
      </header>
      <nav style={{ marginBottom: 16 }}>
        <button onClick={() => setView('campaigns')}>Campaigns</button>
        <button onClick={() => setView('drafts')} style={{ marginLeft: 8 }}>
          Drafts
        </button>
        <button onClick={() => setView('send')} style={{ marginLeft: 8 }}>
          Send
        </button>
        <button onClick={() => setView('events')} style={{ marginLeft: 8 }}>
          Events
        </button>
        <button onClick={() => setView('settings')} style={{ marginLeft: 8 }}>
          Settings
        </button>
      </nav>
      {view === 'campaigns' && <CampaignsPage />}
      {view === 'drafts' && <DraftsPage />}
      {view === 'send' && <SendPage smartleadReady={smartleadReady} />}
      {view === 'events' && <EventsPage />}
      {view === 'settings' && <SettingsPage />}
    </main>
  );
}

export default App;
