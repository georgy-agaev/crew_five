import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { AppEnv } from '../config/env';

export function initSupabaseClient(env: AppEnv): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
    },
  });
}
