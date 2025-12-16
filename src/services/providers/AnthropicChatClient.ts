import type { ChatClient, ChatMessage } from '../chatClient';
import { normalizeAnthropicBaseUrl } from './baseUrls';

export interface AnthropicChatClientConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  version?: string;
  maxTokens?: number;
}

export class AnthropicChatClient implements ChatClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly version: string;
  private readonly maxTokens: number;

  constructor(config: AnthropicChatClientConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.baseUrl = normalizeAnthropicBaseUrl(config.baseUrl);
    this.version = config.version ?? '2023-06-01';
    this.maxTokens = config.maxTokens ?? 2048;
  }

  async complete(messages: ChatMessage[]): Promise<string> {
    const url = `${this.baseUrl.replace(/\/+$/, '')}/messages`;

    const systemMessages = messages.filter((m) => m.role === 'system');
    const system = systemMessages.length ? systemMessages.map((m) => m.content).join('\n\n') : undefined;
    const userMessages = messages.filter((m) => m.role === 'user');

    const body: any = {
      model: this.model,
      max_tokens: this.maxTokens,
      messages: userMessages.map((m) => ({
        role: 'user',
        content: m.content,
      })),
    };
    if (system) {
      body.system = system;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': this.version,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Anthropic chat error ${res.status}: ${text || res.statusText}`);
    }

    const data: any = await res.json();
    const first = Array.isArray(data?.content) ? data.content[0] : undefined;
    const text = first?.text;
    if (typeof text !== 'string' || !text.trim()) {
      throw new Error('Anthropic chat returned empty or non-string content');
    }
    return text;
  }
}
