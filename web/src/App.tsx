import { useEffect, useState } from 'react';

import './index.css';
import { CampaignsPage } from './pages/CampaignsPage';
import { DraftsPage } from './pages/DraftsPage';
import { SendPage } from './pages/SendPage';
import { EventsPage } from './pages/EventsPage';
import { SettingsPage } from './pages/SettingsPage';
import { WorkflowZeroPage } from './pages/WorkflowZeroPage';
import { IcpDiscoveryPage } from './pages/IcpDiscoveryPage';
import { SimPage } from './pages/SimPage';
import { fetchMeta, type MetaStatus } from './apiClient';

function App() {
  const [view, setView] = useState<'icp' | 'segments' | 'sim' | 'analytics' | 'settings'>('icp');
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
  const supabaseReady = meta?.supabaseReady ?? true;

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">AI SDR GTM</p>
          <h1>Workflow Hub</h1>
          <p className="muted">Guided flows for first email, ICP discovery, SIM, and operational controls.</p>
          <p className="muted">
            API base: {apiBase} · Mode: {modeLabel} · Supabase: {supabaseReady ? 'ready' : 'missing'} · Smartlead:{' '}
            {smartleadReady ? 'ready' : 'not ready'}
          </p>
          {metaError && (
            <p className="error-text" style={{ marginTop: 4 }}>
              Failed to load adapter meta: {metaError}
            </p>
          )}
        </div>
        <div className="status-block">
          <span className={`status-dot ${supabaseReady ? 'ok' : 'warn'}`} />
          <span>Supabase</span>
          <span className={`status-dot ${smartleadReady ? 'ok' : 'warn'}`} />
          <span>Smartlead</span>
        </div>
      </header>

      <nav className="tabbar">
        <button className={view === 'icp' ? 'tab active' : 'tab'} onClick={() => setView('icp')}>
          ICP & Coach
        </button>
        <button className={view === 'segments' ? 'tab active' : 'tab'} onClick={() => setView('segments')}>
          Segments & Enrichment
        </button>
        <button className={view === 'sim' ? 'tab active' : 'tab'} onClick={() => setView('sim')}>
          SIM
        </button>
        <button className={view === 'analytics' ? 'tab active' : 'tab'} onClick={() => setView('analytics')}>
          Analytics
        </button>
        <button className={view === 'settings' ? 'tab active' : 'tab'} onClick={() => setView('settings')}>
          Settings
        </button>
      </nav>

      {view === 'icp' && <IcpDiscoveryPage />}
      {view === 'segments' && <WorkflowZeroPage smartleadReady={smartleadReady} />}
      {view === 'sim' && <SimPage />}
      {view === 'analytics' && (
        <div className="grid">
          <div className="card">
            <EventsPage />
          </div>
        </div>
      )}
      {view === 'settings' && (
        <div className="grid">
          <div className="card">
            <SettingsPage />
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
