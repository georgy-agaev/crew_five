import dotenv from 'dotenv';

dotenv.config();

export interface AppEnv {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
}

export function loadEnv(): AppEnv {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL is required. Set it in your environment or .env file.');
  }

  if (!supabaseServiceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required. Set it in your environment or .env file.'
    );
  }

  return {
    supabaseUrl,
    supabaseServiceRoleKey,
  };
}
