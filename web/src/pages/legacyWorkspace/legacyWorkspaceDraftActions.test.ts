import { describe, expect, it, vi } from 'vitest';

import { generateDraftsForCampaign } from './legacyWorkspaceDraftActions';

describe('legacyWorkspaceDraftActions', () => {
  it('calls draft generation api with normalized options and returns dry-run summary', async () => {
    const triggerDraftGenerate = vi.fn().mockResolvedValue({
      generated: 12,
      failed: 0,
      skippedNoEmail: 1,
      dryRun: true,
    });

    const result = await generateDraftsForCampaign(
      {
        campaignId: 'camp_1',
        dryRun: true,
        limit: 25,
        dataQualityMode: 'strict',
        interactionMode: 'express',
        icpProfileId: 'icp_1',
        icpHypothesisId: 'hyp_1',
        provider: 'openai',
        model: 'gpt-4o-mini',
        explicitCoachPromptId: 'draft_intro_v1',
      },
      { triggerDraftGenerate }
    );

    expect(triggerDraftGenerate).toHaveBeenCalledWith('camp_1', {
      dryRun: true,
      limit: 25,
      dataQualityMode: 'strict',
      interactionMode: 'express',
      icpProfileId: 'icp_1',
      icpHypothesisId: 'hyp_1',
      coachPromptStep: undefined,
      explicitCoachPromptId: 'draft_intro_v1',
      provider: 'openai',
      model: 'gpt-4o-mini',
    });
    expect(result.summary).toBe(
      'Drafts ready: generated=12, failed=0, skippedNoEmail=1, dryRun=true, modes=strict/express'
    );
    expect(result.error).toBeNull();
    expect(result.completedDraft).toBeNull();
    expect(result.nextStep).toBeNull();
  });

  it('returns completed draft payload and send transition for successful live generation', async () => {
    const triggerDraftGenerate = vi.fn().mockResolvedValue({
      generated: 5,
      failed: 0,
      skippedNoEmail: 0,
      dryRun: false,
      draftIds: ['d1'],
    });

    const result = await generateDraftsForCampaign(
      {
        campaignId: 'camp_2',
        dryRun: false,
        limit: 10,
        dataQualityMode: 'graceful',
        interactionMode: 'coach',
      },
      { triggerDraftGenerate }
    );

    expect(result.error).toBeNull();
    expect(result.nextStep).toBe('send');
    expect(result.completedDraft).toEqual({
      generated: 5,
      failed: 0,
      skippedNoEmail: 0,
      dryRun: false,
      draftIds: ['d1'],
      campaignId: 'camp_2',
    });
  });

  it('returns reputationally safe error when live generation produces no ready drafts', async () => {
    const triggerDraftGenerate = vi.fn().mockResolvedValue({
      generated: 0,
      failed: 0,
      skippedNoEmail: 4,
      dryRun: false,
    });

    const result = await generateDraftsForCampaign(
      {
        campaignId: 'camp_3',
        dryRun: false,
        limit: 10,
        dataQualityMode: 'strict',
        interactionMode: 'express',
      },
      { triggerDraftGenerate }
    );

    expect(result.error).toBe('No drafts generated because 4 contact(s) have no email.');
    expect(result.nextStep).toBeNull();
    expect(result.completedDraft).toBeNull();
  });
});
