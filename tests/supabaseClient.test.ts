import { describe, expect, it, vi } from 'vitest';

vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => ({ auth: { getUser: vi.fn() } })),
  };
});

import { initSupabaseClient } from '../src/services/supabaseClient';

const { createClient } = await import('@supabase/supabase-js');

describe('initSupabaseClient', () => {
  it('creates a client with service role key', () => {
    const client = initSupabaseClient({
      supabaseUrl: 'https://example.supabase.co',
      supabaseServiceRoleKey: 'secret-key',
    });

    expect(createClient).toHaveBeenCalledWith('https://example.supabase.co', 'secret-key', {
      auth: {
        persistSession: false,
      },
    });

    expect(client).toBeDefined();
  });
});
