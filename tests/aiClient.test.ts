import { describe, expect, it, vi } from 'vitest';

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

describe('AiClient', () => {
  it('delegates to generator and enforces JSON contract structure', async () => {
    const generator = vi.fn().mockResolvedValue({
      subject: 'Hello',
      body: 'World',
      metadata: {
        model: 'mock',
        language: 'en',
        pattern_mode: 'standard',
        email_type: 'intro',
        coach_prompt_id: 'intro_v1',
      },
    });

    const client = new AiClient(generator);
    const response = await client.generateDraft(baseRequest);

    expect(generator).toHaveBeenCalledWith(baseRequest);
    expect(response.subject).toBe('Hello');
  });
});
