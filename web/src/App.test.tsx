import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

import { resolveViewFromLocation } from './appView';

async function loadApp() {
  vi.resetModules();
  return import('./App');
}

describe('App base URL notice', () => {
  afterEach(() => {
    delete (globalThis as any).window;
  });

  it('renders the API base when provided', async () => {
    vi.stubEnv('VITE_API_BASE', 'http://example.com/api');
    vi.stubEnv('VITE_WEB_ADAPTER_MODE', 'live');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ mode: 'live', apiBase: '/api', smartleadReady: false, supabaseReady: true }),
    }));
    (globalThis as any).window = {
      location: {
        href: 'http://localhost:5173/?view=pipeline',
        search: '?view=pipeline',
      },
    };
    const { default: App } = await loadApp();
    const html = renderToString(<App />);
    expect(html).toContain('http://example.com/api');
    expect(html).toContain('Mode');
    expect(html).toContain('live');
    expect(html).toContain('Smartlead');
    expect(html).toContain('?view=builder-v2');
    expect(html).toContain('?view=inbox-v2');
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('defaults to home when no query param is set', async () => {
    vi.stubEnv('VITE_API_BASE', 'http://example.com/api');
    vi.stubEnv('VITE_WEB_ADAPTER_MODE', 'live');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ mode: 'live', apiBase: '/api', smartleadReady: false, supabaseReady: true }),
    }));
    expect(resolveViewFromLocation(undefined)).toBe('home');
    expect(resolveViewFromLocation({ search: '' } as any)).toBe('home');
    const { default: App } = await loadApp();
    const html = renderToString(<App />);
    expect(html).toContain('Home');
    expect(html).toContain('Legacy Pipeline');
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('renders icp discovery view when query param is set', async () => {
    vi.stubEnv('VITE_API_BASE', 'http://example.com/api');
    vi.stubEnv('VITE_WEB_ADAPTER_MODE', 'live');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ mode: 'live', apiBase: '/api', smartleadReady: true, supabaseReady: true }),
    }));
    (globalThis as any).window = {
      location: {
        href: 'http://localhost:5173/?view=icp-discovery&runId=run-1',
        search: '?view=icp-discovery&runId=run-1',
      },
    };
    const { default: App } = await loadApp();
    expect(resolveViewFromLocation({ search: '?view=icp-discovery' } as any)).toBe('icp-discovery');
    const html = renderToString(<App />);
    expect(html).toContain('ICP discovery &amp; prospect expansion');
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('renders campaigns workspace tab when query param is set', async () => {
    vi.stubEnv('VITE_API_BASE', 'http://example.com/api');
    vi.stubEnv('VITE_WEB_ADAPTER_MODE', 'live');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ mode: 'live', apiBase: '/api', smartleadReady: true, supabaseReady: true }),
      })
    );
    (globalThis as any).window = {
      location: {
        href: 'http://localhost:5173/?view=campaigns',
        search: '?view=campaigns',
      },
    };
    const { default: App } = await loadApp();
    expect(resolveViewFromLocation({ search: '?view=campaign-ops' } as any)).toBe('campaign-ops');
    expect(resolveViewFromLocation({ search: '?view=campaigns' } as any)).toBe('campaigns');
    const html = renderToString(<App />);
    expect(html).toContain('Campaigns');
    expect(html).toContain('Companies');
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('renders campaign ledger view when query param is set', async () => {
    vi.stubEnv('VITE_API_BASE', 'http://example.com/api');
    vi.stubEnv('VITE_WEB_ADAPTER_MODE', 'live');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ mode: 'live', apiBase: '/api', smartleadReady: true, supabaseReady: true }),
      })
    );
    (globalThis as any).window = {
      location: {
        href: 'http://localhost:5173/?view=campaign-ledger',
        search: '?view=campaign-ledger',
      },
    };
    const { default: App } = await loadApp();
    expect(resolveViewFromLocation({ search: '?view=campaign-ledger' } as any)).toBe('campaign-ledger');
    const html = renderToString(<App />);
    expect(html).toContain('Campaign Ops');
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('renders builder v2 view when query param is set', async () => {
    vi.stubEnv('VITE_API_BASE', 'http://example.com/api');
    vi.stubEnv('VITE_WEB_ADAPTER_MODE', 'live');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ mode: 'live', apiBase: '/api', smartleadReady: true, supabaseReady: true }),
      })
    );
    (globalThis as any).window = {
      location: {
        href: 'http://localhost:5173/?view=builder-v2',
        search: '?view=builder-v2',
      },
    };
    const { default: App } = await loadApp();
    expect(resolveViewFromLocation({ search: '?view=builder-v2' } as any)).toBe('builder-v2');
    const html = renderToString(<App />);
    expect(html).toContain('Campaign Builder V2');
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('renders inbox v2 view when query param is set', async () => {
    vi.stubEnv('VITE_API_BASE', 'http://example.com/api');
    vi.stubEnv('VITE_WEB_ADAPTER_MODE', 'live');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ mode: 'live', apiBase: '/api', smartleadReady: true, supabaseReady: true }),
      })
    );
    (globalThis as any).window = {
      location: {
        href: 'http://localhost:5173/?view=inbox-v2',
        search: '?view=inbox-v2',
      },
    };
    const { default: App } = await loadApp();
    expect(resolveViewFromLocation({ search: '?view=inbox-v2' } as any)).toBe('inbox-v2');
    const html = renderToString(<App />);
    expect(html).toContain('Inbox V2');
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
});
