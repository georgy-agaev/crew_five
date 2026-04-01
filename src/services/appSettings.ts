import type { SupabaseClient } from '@supabase/supabase-js';

export async function getAppSetting<T>(
  supabase: SupabaseClient,
  key: string,
  fallback: T
): Promise<T> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();

  if (error) throw error;
  if (!data?.value) return fallback;
  return data.value as T;
}

export async function setAppSetting<T>(
  supabase: SupabaseClient,
  key: string,
  value: T
): Promise<void> {
  const { error } = await supabase.from('app_settings').upsert(
    {
      key,
      value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'key' }
  );
  if (error) throw error;
}
