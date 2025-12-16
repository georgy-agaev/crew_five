import { beforeEach, describe, expect, it, vi } from 'vitest';

const buildChatClientForModelMock = vi.fn();
const resolveModelConfigMock = vi.fn();

vi.mock('../src/services/providers/buildChatClient', () => ({
  buildChatClientForModel: buildChatClientForModelMock,
}));

vi.mock('../src/config/modelCatalog', async () => {
  const actual = await vi.importActual<any>('../src/config/modelCatalog');
  return {
    ...actual,
    resolveModelConfig: resolveModelConfigMock,
  };
});

describe('buildCliChatClient', () => {
  beforeEach(() => {
    buildChatClientForModelMock.mockReset();
    resolveModelConfigMock.mockReset();
    resolveModelConfigMock.mockReturnValue({ provider: 'openai', model: 'gpt-4o-mini' });
  });

  it('returns_factory_client_when_available', async () => {
    const fakeChatClient = { complete: vi.fn().mockResolvedValue('{}') };
    buildChatClientForModelMock.mockReturnValue(fakeChatClient);

    const { buildCliChatClient } = await import('../src/cli');
    const client = buildCliChatClient();

    expect(resolveModelConfigMock).toHaveBeenCalledWith({ task: 'draft' });
    expect(buildChatClientForModelMock).toHaveBeenCalledWith({
      provider: 'openai',
      model: 'gpt-4o-mini',
    });
    expect(client).toBe(fakeChatClient);
  });

  it('returns_stub_client_when_factory_throws', async () => {
    buildChatClientForModelMock.mockImplementation(() => {
      throw new Error('factory failed');
    });

    const { buildCliChatClient } = await import('../src/cli');
    const client = buildCliChatClient();

    const result = await client.complete([
      { role: 'system', content: 'sys' },
      {
        role: 'user',
        content: JSON.stringify({
          email_type: 'intro',
          language: 'en',
          pattern_mode: null,
          brief: {
            prospect: {
              full_name: 'Test User',
              role: 'CTO',
              company_name: 'TestCo',
            },
            company: {},
            context: {},
            offer: {
              product_name: 'Product',
              one_liner: 'One liner',
              key_benefits: [],
            },
            constraints: {},
          },
        }),
      },
    ]);
    const parsed = JSON.parse(result);
    expect(parsed.subject).toBeDefined();
    expect(parsed.body).toBeDefined();
  });
});

