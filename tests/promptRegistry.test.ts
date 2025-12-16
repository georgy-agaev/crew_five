import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  __resetPromptRegistryStepSupportForTests,
  getActivePromptForStep,
  resolvePromptForStep,
  setActivePromptForStep,
} from '../src/services/promptRegistry';

describe('promptRegistry service', () => {
  beforeEach(() => {
    __resetPromptRegistryStepSupportForTests();
  });

  it('prompt_registry_gets_and_sets_active_prompt_per_step', async () => {
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
      match: vi.fn().mockResolvedValue({ error: null }),
    });
    const select = vi.fn().mockReturnValue({
      match: vi.fn().mockResolvedValue({
        data: [{ coach_prompt_id: 'intro_v1', step: 'draft', rollout_status: 'active' }],
        error: null,
      }),
    });
    const from = vi.fn((table: string) => {
      if (table === 'prompt_registry') {
        return {
          select,
          update,
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });
    const client = { from } as any;

    await setActivePromptForStep(client, 'draft', 'intro_v1');
    const active = await getActivePromptForStep(client, 'draft');

    expect(from).toHaveBeenCalledWith('prompt_registry');
    expect(update).toHaveBeenCalled();
    expect(active).toBe('intro_v1');
  });

  it('prompt_registry_handles_missing_step_column_gracefully_on_get', async () => {
    const eq = vi.fn().mockResolvedValue({
      data: [{ coach_prompt_id: 'fallback_v1', rollout_status: 'active' }],
      error: null,
    });
    const match = vi.fn()
      // First call simulates missing step column error.
      .mockResolvedValueOnce({
        data: null,
        error: new Error("Could not find the 'step' column of 'prompt_registry' in the schema cache."),
      });

    const select = vi.fn().mockReturnValue({
      match,
      eq,
    });

    const from = vi.fn((table: string) => {
      if (table === 'prompt_registry') {
        return { select };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const client = { from } as any;

    const active = await getActivePromptForStep(client, 'draft');

    expect(select).toHaveBeenCalled();
    expect(match).toHaveBeenCalledTimes(1);
    expect(eq).toHaveBeenCalledTimes(1);
    expect(active).toBe('fallback_v1');
  });

  it('prompt_registry_handles_missing_step_column_gracefully_on_set', async () => {
    const eq = vi.fn().mockResolvedValue({
      error: new Error("Could not find the 'step' column of 'prompt_registry' in the schema cache."),
    });
    const match = vi.fn().mockResolvedValue({ error: null });

    const update = vi.fn().mockReturnValue({
      eq,
      match,
    });

    const from = vi.fn((table: string) => {
      if (table === 'prompt_registry') {
        return { update };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const client = { from } as any;

    await setActivePromptForStep(client, 'draft', 'intro_v1');

    expect(update).toHaveBeenCalledTimes(2);
    expect(eq).toHaveBeenCalledTimes(1);
    expect(match).toHaveBeenCalledTimes(1);
    const matchFilter = match.mock.calls[0]?.[0];
    expect(matchFilter).toEqual({ coach_prompt_id: 'intro_v1' });
  });

  it('prompt_registry_resolve_prompt_prefers_explicit_else_active_else_errors', async () => {
    const select = vi.fn().mockReturnValue({
      match: vi.fn().mockResolvedValue({
        data: [{ coach_prompt_id: 'intro_v1', step: 'draft', rollout_status: 'active' }],
        error: null,
      }),
    });

    const from = vi.fn((table: string) => {
      if (table === 'prompt_registry') return { select };
      return { select: vi.fn() };
    });
    const client = { from } as any;

    const explicit = await resolvePromptForStep(client, { step: 'draft', explicitId: 'explicit_v1' });
    expect(explicit).toBe('explicit_v1');

    const resolved = await resolvePromptForStep(client, { step: 'draft' });
    expect(resolved).toBe('intro_v1');

    select.mockReturnValueOnce({
      match: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    await expect(resolvePromptForStep(client, { step: 'draft' })).rejects.toHaveProperty('code', 'PROMPT_NOT_CONFIGURED');
  });
});
