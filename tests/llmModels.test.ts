import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { listOpenAiModels, listAnthropicModels } from '../src/services/providers/llmModels';
import { normalizeOpenAiBaseUrl, normalizeAnthropicBaseUrl } from '../src/services/providers/baseUrls';

declare const global: any;

const ORIGINAL_ENV = { ...process.env };

describe('llmModels helpers', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('listOpenAiModels_maps_response_shape', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'gpt-4o', owned_by: 'openai', context_window: 128000 },
          { id: 'gpt-4o-mini', owned_by: 'openai', context_window: 64000 },
        ],
      }),
    } as any);
    global.fetch = fetchMock;

    const models = await listOpenAiModels();
    expect(models.map((m) => m.id)).toEqual(['gpt-4o', 'gpt-4o-mini']);
    expect(models[0].provider).toBe('openai');
    expect(models[0].ownedBy).toBe('openai');
  });

  it('listOpenAiModels_missing_api_key_throws', async () => {
    delete process.env.OPENAI_API_KEY;
    await expect(listOpenAiModels()).rejects.toThrow(/OPENAI_API_KEY/);
  });

  it('normalizeOpenAiBaseUrl_appends_v1_when_missing', () => {
    expect(normalizeOpenAiBaseUrl('https://api.openai.com')).toBe('https://api.openai.com/v1');
    expect(normalizeOpenAiBaseUrl('https://proxy.example.com/openai')).toBe(
      'https://proxy.example.com/openai/v1'
    );
    expect(normalizeOpenAiBaseUrl('https://api.openai.com/v1')).toBe('https://api.openai.com/v1');
    expect(normalizeOpenAiBaseUrl('https://api.openai.com/v1/')).toBe('https://api.openai.com/v1');
  });

  it('listAnthropicModels_maps_response_shape', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'claude-3-5-sonnet', context_window: 200000 },
          { id: 'claude-3-haiku', context_window: 200000 },
        ],
      }),
    } as any);
    global.fetch = fetchMock;

    const models = await listAnthropicModels();
    expect(models.map((m) => m.id)).toEqual(['claude-3-5-sonnet', 'claude-3-haiku']);
    expect(models[0].provider).toBe('anthropic');
  });

  it('listAnthropicModels_missing_api_key_throws', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(listAnthropicModels()).rejects.toThrow(/ANTHROPIC_API_KEY/);
  });

  it('normalizeAnthropicBaseUrl_appends_v1_when_missing', () => {
    expect(normalizeAnthropicBaseUrl('https://api.anthropic.com')).toBe(
      'https://api.anthropic.com/v1'
    );
    expect(normalizeAnthropicBaseUrl('https://proxy.example.com/anthropic')).toBe(
      'https://proxy.example.com/anthropic/v1'
    );
    expect(normalizeAnthropicBaseUrl('https://api.anthropic.com/v1')).toBe(
      'https://api.anthropic.com/v1'
    );
    expect(normalizeAnthropicBaseUrl('https://api.anthropic.com/v1/')).toBe(
      'https://api.anthropic.com/v1'
    );
  });
});
