import { useEffect, useState } from 'react';

import './index.css';
import PipelineWorkspaceWithSidebar from './pages/PipelineWorkspaceWithSidebar';
import { fetchMeta, type MetaStatus } from './apiClient';
import { IcpDiscoveryPage } from './pages/IcpDiscoveryPage';

export function resolveViewFromLocation(loc?: Location | URL): 'pipeline' | 'icp-discovery' {
  if (!loc) return 'pipeline';
  const search = loc.search ?? '';
  if (!search) return 'pipeline';
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const view = params.get('view');
  if (view === 'icp-discovery') return 'icp-discovery';
  return 'pipeline';
}

function App() {
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
  const view = resolveViewFromLocation(
    typeof window !== 'undefined' && window.location ? window.location : undefined
  );

  return (
    <main className="shell">
      {metaError && (
        <p className="error-text" style={{ marginTop: 4 }}>
          Failed to load adapter meta: {metaError}
        </p>
      )}
      {view === 'icp-discovery' ? (
        <IcpDiscoveryPage />
      ) : (
        <PipelineWorkspaceWithSidebar
          apiBase={apiBase}
          modeLabel={modeLabel}
          supabaseReady={supabaseReady}
          smartleadReady={smartleadReady}
        />
      )}
    </main>
  );
}

export default App;
