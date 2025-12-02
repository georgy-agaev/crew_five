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

    const membersMatch = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({
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
      }),
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

    const summary = await generateDrafts(supabase, aiClient, {
      campaignId: 'camp',
      variant: 'A',
      provider: 'openai',
      model: 'gpt-4o-mini',
    });

    expect(eq).toHaveBeenCalledWith('id', 'camp');
    expect(membersMatch).toHaveBeenCalledWith({ segment_id: 'seg', segment_version: 1 });
    expect(insert).toHaveBeenCalled();
    expect(insertSelect).toHaveBeenCalled();
    expect(summary.generated).toBe(1);
    expect(summary.gracefulUsed).toBe(0);

    const insertedPayload = insert.mock.calls[0]?.[0] as any[];
    expect(Array.isArray(insertedPayload)).toBe(true);
    const draftRow = insertedPayload[0];
    expect(draftRow.metadata?.draft_pattern).toBe('intro_v1:standard:A');
    expect(draftRow.metadata?.user_edited).toBe(false);
    expect(draftRow.metadata?.provider).toBe('openai');
    expect(draftRow.metadata?.model).toBe('gpt-4o-mini');
  });

  it('supports dry-run without inserts', async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: 'camp', segment_id: 'seg', segment_version: 1 },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ single });
    const membersMatch = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({ data: [{ contact_id: 'c', company_id: 'co', snapshot: { request: {} } }], error: null }),
    });
    const supabase = {
      from: (table: string) => {
        if (table === 'campaigns') return { select: () => ({ eq }) };
        if (table === 'segment_members') return { select: () => ({ match: membersMatch }) };
        if (table === 'drafts') return { insert: vi.fn() };
        throw new Error('unexpected');
      },
    } as any;

    const aiClient = new AiClient(vi.fn());
    const summary = await generateDrafts(supabase, aiClient, { campaignId: 'camp', dryRun: true });
    expect(summary.generated).toBe(0);
    expect(summary.skipped).toBeGreaterThanOrEqual(0);
  });

  it('fail-fast aborts on insert error', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'camp', segment_id: 'seg', segment_version: 1 }, error: null });
    const eq = vi.fn().mockReturnValue({ single });
    const membersMatch = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({
        data: [{ contact_id: 'c', company_id: 'co', snapshot: { request: {} } }],
        error: null,
      }),
    });
    const insert = vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue({ error: new Error('insert fail') }) });
    const supabase = {
      from: (table: string) => {
        if (table === 'campaigns') return { select: () => ({ eq }) };
        if (table === 'segment_members') return { select: () => ({ match: membersMatch }) };
        if (table === 'drafts') return { insert };
        throw new Error('unexpected');
      },
    } as any;
    const aiClient = new AiClient(vi.fn().mockResolvedValue({ subject: 's', body: 'b', metadata: { email_type: 'intro', language: 'en', pattern_mode: 'p', coach_prompt_id: 'c' } }));

    await expect(generateDrafts(supabase, aiClient, { campaignId: 'camp', failFast: true })).rejects.toThrow(/insert fail/);
  });
});
