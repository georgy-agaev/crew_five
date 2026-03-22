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

  it('includes per-entity enrichment provider guidance in system prompt', async () => {
    const complete = vi.fn().mockResolvedValue(
      JSON.stringify({ subject: 'S', body: 'B', metadata: { model: 'm', language: 'en', coach_prompt_id: 'p', email_type: 'intro', pattern_mode: 'standard' } })
    );
    const chatClient: ChatClient = { complete };

    const client = new AiClient(chatClient);
    await client.generateDraft(baseRequest as any);

    const messages = complete.mock.calls[0]?.[0] as any[];
    expect(messages?.[0]?.role).toBe('system');
    expect(String(messages?.[0]?.content)).toContain('brief.context.enrichment_provider');
    expect(String(messages?.[0]?.content)).toContain('primaryCompanyProvider');
    expect(String(messages?.[0]?.content)).toContain('primaryEmployeeProvider');
  });
});
