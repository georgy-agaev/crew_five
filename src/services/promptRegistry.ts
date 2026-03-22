import type { SupabaseClient } from '@supabase/supabase-js';

let promptRegistrySupportsStepColumn: boolean | null = null;

function isMissingStepColumnError(err: any): boolean {
  const msg = String(err?.message ?? err?.error_description ?? '').toLowerCase();
  if (!msg) return false;
  return msg.includes('step') && msg.includes('prompt_registry') && msg.includes('column');
}

export function __resetPromptRegistryStepSupportForTests() {
  promptRegistrySupportsStepColumn = null;
}

export interface PromptVersionInput {
  coachPromptId: string;
  description?: string;
  version?: string;
  rolloutStatus?: 'pilot' | 'active' | 'retired' | 'deprecated';
}

export interface PromptVersionRow {
  id: string;
  coach_prompt_id: string;
  description: string | null;
  version: string | null;
  rollout_status: 'pilot' | 'active' | 'retired' | 'deprecated';
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

export async function getActivePromptForStep(
  client: SupabaseClient,
  step: string
): Promise<string | null> {
  const useStepColumn = promptRegistrySupportsStepColumn !== false;

  const selectColumns = useStepColumn ? 'coach_prompt_id, step, rollout_status' : 'coach_prompt_id, rollout_status';
  const baseQuery = client.from('prompt_registry').select(selectColumns);

  const { data, error } = await (useStepColumn
    ? baseQuery.match({ step, rollout_status: 'active' } as any)
    : baseQuery.eq('rollout_status', 'active'));

  if (error) {
    if (useStepColumn && isMissingStepColumnError(error)) {
      // Cache that the column is not available and retry without relying on it.
      promptRegistrySupportsStepColumn = false;
      return getActivePromptForStep(client, step);
    }
    throw error;
  }

  if (!data || data.length === 0) {
    return null;
  }

  const row = data[0] as unknown as { coach_prompt_id: string };
  return row.coach_prompt_id ?? null;
}

export async function setActivePromptForStep(
  client: SupabaseClient,
  step: string,
  coachPromptId: string
): Promise<void> {
  /* eslint-disable security-node/detect-unhandled-async-errors */
  // Demote all prompts for the step to non-active (pilot) then set the chosen one to active.
  const demoteRes = await client
    .from('prompt_registry')
    .update({ rollout_status: 'pilot' })
    .eq('step', step);

  if (demoteRes.error) {
    if (isMissingStepColumnError(demoteRes.error)) {
      // Column is not present in this environment – avoid hard failure and fall back
      // to a simpler behaviour where we only toggle rollout_status for the target id.
      promptRegistrySupportsStepColumn = false;
    } else {
      throw demoteRes.error;
    }
  }

  const filter: any =
    promptRegistrySupportsStepColumn === false
      ? { coach_prompt_id: coachPromptId }
      : { step, coach_prompt_id: coachPromptId };

  const { error } = await client
    .from('prompt_registry')
    .update({ rollout_status: 'active' })
    .match(filter);

  if (error) {
    if (promptRegistrySupportsStepColumn !== false && isMissingStepColumnError(error)) {
      // If the step-based update fails, retry once without step.
      promptRegistrySupportsStepColumn = false;
      const retry = await client
        .from('prompt_registry')
        .update({ rollout_status: 'active' })
        .match({ coach_prompt_id: coachPromptId } as any);
      if (retry.error) {
        throw retry.error;
      }
      return;
    }
    throw error;
  }
  /* eslint-enable security-node/detect-unhandled-async-errors */
}

export async function resolvePromptForStep(
  client: SupabaseClient,
  params: { step: string; explicitId?: string }
): Promise<string> {
  if (params.explicitId) {
    return params.explicitId;
  }

  const active = await getActivePromptForStep(client, params.step);
  if (active) {
    return active;
  }

  const error: any = new Error(`No active prompt configured for step ${params.step}`);
  error.code = 'PROMPT_NOT_CONFIGURED';
  throw error;
}
