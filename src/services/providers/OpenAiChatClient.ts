import type { ChatClient, ChatMessage } from '../chatClient.js';
import { normalizeOpenAiBaseUrl } from './baseUrls.js';

export interface OpenAiChatClientConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export class OpenAiChatClient implements ChatClient {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;

  constructor(config: OpenAiChatClientConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.baseUrl = normalizeOpenAiBaseUrl(config.baseUrl);
  }

  async complete(messages: ChatMessage[]): Promise<string> {
    const url = `${this.baseUrl.replace(/\/+$/, '')}/chat/completions`;

    const body = {
      model: this.model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      response_format: { type: 'json_object' as const },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`OpenAI chat error ${res.status}: ${text || res.statusText}`);
    }

    const data: any = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('OpenAI chat returned empty or non-string content');
    }
    return content;
  }
}
