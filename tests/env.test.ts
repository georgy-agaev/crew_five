import { beforeEach, describe, expect, it } from 'vitest';

import { loadEnv } from '../src/config/env';

describe('loadEnv', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it('throws a helpful error when SUPABASE_URL missing', () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'key';

    expect(() => loadEnv()).toThrow(/SUPABASE_URL/);
  });

  it('returns config when required env vars exist', () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'key';

    const config = loadEnv();

    expect(config.supabaseUrl).toBe('https://example.supabase.co');
    expect(config.supabaseServiceRoleKey).toBe('key');
  });
});
