import { describe, expect, it } from 'vitest';

import { devProxyConfig } from './devProxyConfig';

describe('vite config', () => {
  it('proxies /api requests to the daily web adapter by default', () => {
    expect(devProxyConfig['/api']).toEqual({
      target: 'http://localhost:8787',
      changeOrigin: true,
    });
  });
});
