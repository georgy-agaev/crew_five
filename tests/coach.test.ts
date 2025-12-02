import { describe, expect, it, vi } from 'vitest';

import { AiClient } from '../src/services/aiClient';
import {
  generateDraftsForSegmentWithIcp,
  generateIcpHypothesisForSegment,
  generateIcpProfileFromBrief,
} from '../src/services/coach';

describe('coach service', () => {
  it('coach_generate_icp_profile_persists_profile_and_returns_id', async () => {
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'icp-1', name: 'Fintech ICP' },
          error: null,
        }),
      }),
    });
    const from = vi.fn().mockReturnValue({ insert });
    const client = { from } as any;

    const profile = await generateIcpProfileFromBrief(client, {
      name: 'Fintech ICP',
      description: 'Fintech companies',
      companyCriteria: { industry: 'fintech' },
      personaCriteria: { roles: ['CTO'] },
      createdBy: 'cli-user',
    });

    expect(from).toHaveBeenCalledWith('icp_profiles');
    expect(profile.id).toBe('icp-1');
  });

  it('coach_generate_icp_hypothesis_links_profile_and_segment', async () => {
    const insertHypo = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'hypo-1', icp_id: 'icp-1' },
          error: null,
        }),
      }),
    });
    const updateSeg = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const from = vi.fn((table: string) => {
      if (table === 'icp_hypotheses') return { insert: insertHypo };
      if (table === 'segments') return { update: updateSeg };
      return { insert: vi.fn(), update: vi.fn() };
    });
    const client = { from } as any;

    const hypothesis = await generateIcpHypothesisForSegment(client, 'segment-1', 'icp-1', 'Label', { region: ['EU'] });

    expect(from).toHaveBeenCalledWith('icp_hypotheses');
    expect(hypothesis.id).toBe('hypo-1');
  });

  it('coach_generate_drafts_uses_icp_and_sets_metadata_via_generateDrafts', async () => {
    const campaignSingle = vi.fn().mockResolvedValue({
      data: { id: 'camp', segment_id: 'seg', segment_version: 1 },
      error: null,
    });
    const campaignEq = vi.fn().mockReturnValue({ single: campaignSingle });

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
              } as any,
            },
          },
        ],
        error: null,
      }),
    });

    const insertSelect = vi.fn().mockResolvedValue({ data: [{ id: 'draft-1' }], error: null });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });

    const from = vi.fn((table: string) => {
      if (table === 'campaigns') return { select: () => ({ eq: campaignEq }) };
      if (table === 'segment_members') return { select: () => ({ match: membersMatch }) };
      if (table === 'drafts') return { insert };
      return { select: vi.fn(), insert: vi.fn() };
    });
    const client = { from } as any;

    const aiClient = new AiClient(
      vi.fn().mockResolvedValue({
        subject: 'Hello',
        body: 'Body',
        metadata: {
          model: 'mock',
          language: 'en',
          pattern_mode: 'standard',
          email_type: 'intro',
          coach_prompt_id: 'intro_v1',
        },
      })
    );

    const summary = await generateDraftsForSegmentWithIcp(client, aiClient, {
      campaignId: 'camp',
      variant: 'A',
    });

    expect(summary.generated).toBe(1);
    expect(insert).toHaveBeenCalled();
    const payload = insert.mock.calls[0]?.[0] as any[];
    const row = payload[0];
    expect(row.metadata?.draft_pattern).toBe('intro_v1:standard:A');
    expect(row.metadata?.user_edited).toBe(false);
  });
});

