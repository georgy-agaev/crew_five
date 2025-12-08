import { describe, expect, it, vi } from 'vitest';

import { AiClient } from '../src/services/aiClient';
import type { ChatClient } from '../src/services/chatClient';

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

describe('AiClient', () => {
  it('throws when chat client returns non-JSON', async () => {
    const chatClient: ChatClient = {
      complete: vi.fn().mockResolvedValue('not-json'),
    };

    const client = new AiClient(chatClient);
    await expect(client.generateDraft(baseRequest as any)).rejects.toThrow(
      /non-JSON response/i
    );
  });

  it('throws when JSON is missing required fields', async () => {
    const chatClient: ChatClient = {
      complete: vi.fn().mockResolvedValue(JSON.stringify({ subject: 'Missing body' })),
    };

    const client = new AiClient(chatClient);
    await expect(client.generateDraft(baseRequest as any)).rejects.toThrow(
      /missing subject\/body\/metadata/i
    );
  });
});
