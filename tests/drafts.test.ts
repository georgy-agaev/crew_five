import { describe, expect, it, vi } from 'vitest';

import { AiClient, type EmailDraftResponse } from '../src/services/aiClient';
import { generateDrafts } from '../src/services/drafts';

describe('generateDrafts', () => {
  it('fetches campaign context, calls AI client, and inserts drafts', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: 'camp',
        segment_id: 'seg',
        segment_version: 1,
        language: 'en',
        pattern_mode: 'standard',
      },
      error: null,
    });

    const eq = vi.fn().mockReturnValue({ single });

    const membersMatch = vi.fn().mockResolvedValue({
      data: [
        {
          contact_id: 'contact-1',
          company_id: 'company-1',
          snapshot: {
            request: {
              email_type: 'intro',
              language: 'en',
              pattern_mode: 'standard',
              brief: {
                prospect: { full_name: 'Jane Doe', role: 'CTO', company_name: 'Acme' },
                company: {},
                context: {},
                offer: { product_name: 'Tool', one_liner: 'Desc', key_benefits: ['a'] },
                constraints: {},
              },
            },
          },
        },
      ],
      error: null,
    });

    const insertSelect = vi.fn().mockResolvedValue({ data: [{ id: 'draft-1' }], error: null });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });

    const from = vi.fn((table: string) => {
      if (table === 'campaigns') {
        return { select: () => ({ eq }) } as any;
      }
      if (table === 'segment_members') {
        return {
          select: () => ({ match: membersMatch }),
        } as any;
      }
      if (table === 'drafts') {
        return { insert } as any;
      }
      throw new Error(`Unexpected table ${table}`);
    });

    const supabase = { from } as any;

    const aiResponse: EmailDraftResponse = {
      subject: 'Hello',
      body: 'Body',
      metadata: {
        model: 'mock',
        language: 'en',
        pattern_mode: 'standard',
        email_type: 'intro',
        coach_prompt_id: 'intro_v1',
      },
    };
    const aiClient = new AiClient(vi.fn().mockResolvedValue(aiResponse));

    const drafts = await generateDrafts(supabase, aiClient, { campaignId: 'camp' });

    expect(eq).toHaveBeenCalledWith('id', 'camp');
    expect(membersMatch).toHaveBeenCalledWith({ segment_id: 'seg', segment_version: 1 });
    expect(insert).toHaveBeenCalled();
    expect(insertSelect).toHaveBeenCalled();
    expect(drafts).toEqual([{ id: 'draft-1' }]);
  });
});
