import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    environmentMatchGlobs: [
      ['web/src/hooks/useAsyncState.test.ts', 'jsdom'],
      ['web/src/pages/IcpDiscoveryPage.test.tsx', 'jsdom'],
    ],
  },
});
