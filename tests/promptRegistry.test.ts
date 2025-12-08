import { describe, expect, it, vi } from 'vitest';

import {
  getActivePromptForStep,
  resolvePromptForStep,
  setActivePromptForStep,
} from '../src/services/promptRegistry';

describe('promptRegistry service', () => {
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
