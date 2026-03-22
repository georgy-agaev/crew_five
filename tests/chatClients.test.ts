import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { OpenAiChatClient } from '../src/services/providers/OpenAiChatClient';
import { AnthropicChatClient } from '../src/services/providers/AnthropicChatClient';
import { buildChatClientForModel } from '../src/services/providers/buildChatClient';

declare const global: any;

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.restoreAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('buildChatClientForModel', () => {
  it('buildChatClientForModel_selects_openai_client', () => {
    process.env.OPENAI_API_KEY = 'test-key';
    const client = buildChatClientForModel({ provider: 'openai', model: 'gpt-4o-mini' });
    expect(client).toBeInstanceOf(OpenAiChatClient);
  });

  it('buildChatClientForModel_selects_anthropic_client', () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const client = buildChatClientForModel({ provider: 'anthropic', model: 'claude-3-5-sonnet' });
    expect(client).toBeInstanceOf(AnthropicChatClient);
  });

  it('buildChatClientForModel_throws_for_missing_keys', () => {
    expect(() =>
      buildChatClientForModel({ provider: 'openai', model: 'gpt-4o-mini' })
    ).toThrow(/OPENAI_API_KEY/);
    expect(() =>
      buildChatClientForModel({ provider: 'anthropic', model: 'claude-3-5-sonnet' })
    ).toThrow(/ANTHROPIC_API_KEY/);
  });
});

describe('OpenAiChatClient', () => {
  it('openai_chat_client_sends_expected_payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: '{"subject":"Hi","body":"Body","metadata":{"model":"gpt-4o-mini"}}',
            },
          },
        ],
      }),
    } as any);
    global.fetch = fetchMock;

    const client = new OpenAiChatClient({
      apiKey: 'test',
      model: 'gpt-4o-mini',
      baseUrl: 'https://api.openai.test',
    });

    const result = await client.complete([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'payload' },
    ]);

    expect(result).toContain('"subject"');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as any;
    expect(url).toBe('https://api.openai.test/v1/chat/completions');
    expect(options.method).toBe('POST');
    const body = JSON.parse(options.body);
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.messages).toHaveLength(2);
  });
});

describe('AnthropicChatClient', () => {
  it('anthropic_chat_client_sends_expected_payload', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ text: '{"subject":"Hi","body":"Body","metadata":{"model":"claude"}}' }],
      }),
    } as any);
    global.fetch = fetchMock;

    const client = new AnthropicChatClient({
      apiKey: 'test',
      model: 'claude-3-5-sonnet',
      baseUrl: 'https://api.anthropic.test',
      version: '2023-06-01',
      maxTokens: 128,
    });

    const result = await client.complete([
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'payload' },
    ]);

    expect(result).toContain('"subject"');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as any;
    expect(url).toBe('https://api.anthropic.test/v1/messages');
    expect(options.method).toBe('POST');
    expect(options.headers['anthropic-version']).toBe('2023-06-01');
    const body = JSON.parse(options.body);
    expect(body.model).toBe('claude-3-5-sonnet');
    expect(body.messages).toHaveLength(1); // system pulled into top-level system
    expect(body.system).toContain('helpful');
  });
});
