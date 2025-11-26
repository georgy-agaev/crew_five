import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

async function loadApp() {
  vi.resetModules();
  return import('./App');
}

describe('App base URL notice', () => {
  it('renders the API base when provided', async () => {
    vi.stubEnv('VITE_API_BASE', 'http://example.com/api');
    vi.stubEnv('VITE_WEB_ADAPTER_MODE', 'live');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ mode: 'live', apiBase: '/api', smartleadReady: false, supabaseReady: true }),
    }));
    const { default: App } = await loadApp();
    const html = renderToString(<App />);
    expect(html).toContain('http://example.com/api');
    expect(html).toContain('Mode');
    expect(html).toContain('live');
    expect(html).toContain('Smartlead');
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
});
