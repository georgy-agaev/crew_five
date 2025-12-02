import type { SupabaseClient } from '@supabase/supabase-js';

export interface PromptVersionInput {
  coachPromptId: string;
  description?: string;
  version?: string;
  rolloutStatus?: 'active' | 'deprecated';
}

export interface PromptVersionRow {
  id: string;
  coach_prompt_id: string;
  description: string | null;
  version: string | null;
  rollout_status: 'active' | 'deprecated';
  created_at: string;
  updated_at: string;
}

export async function registerPromptVersion(
  client: SupabaseClient,
  input: PromptVersionInput
): Promise<PromptVersionRow> {
  const { data, error } = await client
    .from('prompt_registry')
    .insert({
      coach_prompt_id: input.coachPromptId,
      description: input.description ?? null,
      version: input.version ?? null,
      rollout_status: input.rolloutStatus ?? 'active',
    })
    .select()
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to register prompt version');
  }

  return data as PromptVersionRow;
}

