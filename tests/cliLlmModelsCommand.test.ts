import { describe, expect, it, vi } from 'vitest';

import { createProgram } from '../src/cli';

vi.mock('../src/services/providers/llmModels', () => ({
  listLlmModels: vi.fn().mockResolvedValue([
    { id: 'gpt-4o', provider: 'openai' },
    { id: 'gpt-4o-mini', provider: 'openai' },
  ]),
}));

describe('cli llm:models command', () => {
  it('prints provider models as JSON', async () => {
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync(['node', 'gtm', 'llm:models', '--provider', 'openai']);

    expect(logSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse((logSpy.mock.calls[0] as any)[0] as string);
    expect(Array.isArray(payload)).toBe(true);
    expect(payload[0].id).toBe('gpt-4o');

    logSpy.mockRestore();
  });
});

