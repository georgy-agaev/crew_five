import type { MetaStatus } from './types.js';

export function buildMeta(opts: { mode: 'live' | 'mock' }): MetaStatus {
  const supabaseReady = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const smartleadReady =
    Boolean(process.env.SMARTLEAD_API_BASE && process.env.SMARTLEAD_API_KEY) ||
    Boolean(process.env.SMARTLEAD_MCP_URL && process.env.SMARTLEAD_MCP_TOKEN);
  return {
    mode: opts.mode,
    apiBase: '/api',
    supabaseReady,
    smartleadReady,
  };
}
