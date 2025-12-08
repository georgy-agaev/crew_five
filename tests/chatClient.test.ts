import { describe, expect, it, vi } from 'vitest';

import type { ChatClient, ChatMessage } from '../src/services/chatClient';
import { AiClient } from '../src/services/aiClient';

const baseRequest = {
  email_type: 'intro' as const,
  language: 'en',
  pattern_mode: 'standard' as const,
  brief: {
    prospect: { full_name: 'Jane Smith', role: 'CTO', company_name: 'Acme' },
    company: {},
    context: {},
    offer: { product_name: 'Tool', one_liner: 'desc', key_benefits: ['a'] },
    constraints: {},
  },
};

describe('ChatClient + AiClient integration', () => {
  it('ai_client_delegates_to_chat_client_for_drafts', async () => {
    const complete = vi.fn<ChatClient['complete']>().mockResolvedValue(
      JSON.stringify({
        subject: 'Hello',
        body: 'World',
        metadata: {
          model: 'mock-model',
          language: 'en',
          pattern_mode: 'standard',
          email_type: 'intro',
          coach_prompt_id: 'intro_v1',
        },
      })
    );

    const chatClient: ChatClient = {
      complete,
    };

    const client = new AiClient(chatClient);
    const response = await client.generateDraft(baseRequest);

    expect(complete).toHaveBeenCalledTimes(1);
    const messages = complete.mock.calls[0]?.[0] as ChatMessage[];
    expect(Array.isArray(messages)).toBe(true);
    expect(response.subject).toBe('Hello');
    expect(response.body).toBe('World');
    expect(response.metadata.coach_prompt_id).toBe('intro_v1');
  });
});

