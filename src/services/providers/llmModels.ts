import { normalizeAnthropicBaseUrl, normalizeOpenAiBaseUrl } from './baseUrls';

export type SupportedLlmProvider = 'openai' | 'anthropic';

export interface LlmModelInfo {
  id: string;
  provider: SupportedLlmProvider;
  ownedBy?: string | null;
  contextWindow?: number | null;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required to list models`);
  }
  return value;
}

export async function listOpenAiModels(): Promise<LlmModelInfo[]> {
  const apiKey = requireEnv('OPENAI_API_KEY');
  const baseUrl = normalizeOpenAiBaseUrl(process.env.OPENAI_API_BASE);
  const url = `${baseUrl}/models`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`OpenAI models error ${res.status}: ${text || res.statusText}`);
  }

  const data: any = await res.json();
  const items: any[] = Array.isArray(data?.data) ? data.data : [];
  return items.map((m) => ({
    id: String(m.id ?? ''),
    provider: 'openai' as const,
    ownedBy: (m.owned_by as string | undefined) ?? null,
    contextWindow: (m.context_window as number | undefined) ?? null,
  }));
}

export async function listAnthropicModels(): Promise<LlmModelInfo[]> {
  const apiKey = requireEnv('ANTHROPIC_API_KEY');
  const baseUrl = normalizeAnthropicBaseUrl(process.env.ANTHROPIC_API_BASE);
  const url = `${baseUrl}/models`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': process.env.ANTHROPIC_API_VERSION || '2023-06-01',
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Anthropic models error ${res.status}: ${text || res.statusText}`);
  }

  const data: any = await res.json();
  const items: any[] = Array.isArray(data?.data) ? data.data : [];
  return items.map((m) => ({
    id: String(m.id ?? ''),
    provider: 'anthropic' as const,
    ownedBy: null,
    contextWindow: (m.context_window as number | undefined) ?? null,
  }));
}

export async function listLlmModels(provider: SupportedLlmProvider): Promise<LlmModelInfo[]> {
  if (provider === 'openai') {
    return listOpenAiModels();
  }
  if (provider === 'anthropic') {
    return listAnthropicModels();
  }
  throw new Error(`Unsupported LLM provider: ${provider}`);
}
