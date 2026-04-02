import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  generateDraftsTriggerInternals,
  isGenerateDraftsTriggerConfigured,
  triggerGenerateDrafts,
} from './generateDraftsTrigger.js';

describe('generateDraftsTrigger', () => {
  afterEach(() => {
    delete process.env.OUTREACH_GENERATE_DRAFTS_CMD;
    vi.restoreAllMocks();
  });

  it('detects whether the generate-drafts command is configured', () => {
    delete process.env.OUTREACH_GENERATE_DRAFTS_CMD;
    expect(isGenerateDraftsTriggerConfigured()).toBe(false);

    process.env.OUTREACH_GENERATE_DRAFTS_CMD = 'outreach generate-drafts';
    expect(isGenerateDraftsTriggerConfigured()).toBe(true);
  });

  it('executes the configured command and parses the last JSON line', async () => {
    process.env.OUTREACH_GENERATE_DRAFTS_CMD = 'outreach generate-drafts';
    vi.spyOn(generateDraftsTriggerInternals, 'execFileAsync').mockResolvedValue({
      stdout: 'debug line\n{"generated":4,"dryRun":true,"failed":0}\n',
      stderr: '',
    });

    const result = await triggerGenerateDrafts({
      campaignId: 'camp-1',
      dryRun: true,
      limit: 25,
      interactionMode: 'express',
      dataQualityMode: 'strict',
      icpProfileId: 'icp-1',
      icpHypothesisId: 'hyp-1',
      coachPromptStep: 'draft',
      explicitCoachPromptId: 'prompt-1',
      provider: 'anthropic',
      model: 'claude-sonnet',
    });

    expect(generateDraftsTriggerInternals.execFileAsync).toHaveBeenCalledWith(
      '/bin/sh',
      [
        '-lc',
        "outreach generate-drafts --campaign-id 'camp-1' --dry-run --limit 25 --interaction-mode 'express' --data-quality-mode 'strict' --icp-profile-id 'icp-1' --icp-hypothesis-id 'hyp-1' --coach-prompt-step 'draft' --explicit-coach-prompt-id 'prompt-1' --provider 'anthropic' --model 'claude-sonnet'",
      ],
      { maxBuffer: 1024 * 1024 }
    );
    expect(result).toMatchObject({
      generated: 4,
      dryRun: true,
      failed: 0,
      source: 'outreacher-generate-drafts',
      campaignId: 'camp-1',
    });
  });

  it('surfaces stderr when the command fails', async () => {
    process.env.OUTREACH_GENERATE_DRAFTS_CMD = 'outreach generate-drafts';
    vi.spyOn(generateDraftsTriggerInternals, 'execFileAsync').mockRejectedValue({
      stderr: 'boom',
      stdout: '',
      message: 'Command failed',
    });

    await expect(
      triggerGenerateDrafts({
        campaignId: 'camp-2',
        dryRun: false,
      })
    ).rejects.toThrow(/boom/i);
  });
});
