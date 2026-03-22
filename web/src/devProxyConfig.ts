export const devProxyConfig = {
  '/api': {
    target: 'http://localhost:8787',
    changeOrigin: true,
  },
} as const;
