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
    vi.spyOn(generateDraftsTriggerInternals, 'runShellCommandAsync').mockResolvedValue({
      stdout: 'debug line\n{"generated":4,"dryRun":true,"failed":0}\n',
      stderr: '',
    });

    const result = await triggerGenerateDrafts({
      campaignId: 'camp-1',
      dryRun: true,
      limit: 25,
      companyIds: [
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
      ],
      contactIds: [
        '33333333-3333-4333-8333-333333333333',
        '44444444-4444-4444-8444-444444444444',
      ],
      draftsModel: 'opus',
      interactionMode: 'express',
      dataQualityMode: 'strict',
      icpProfileId: 'icp-1',
      icpHypothesisId: 'hyp-1',
      coachPromptStep: 'draft',
      explicitCoachPromptId: 'prompt-1',
      provider: 'anthropic',
      model: 'claude-sonnet',
    });

    const command = vi.mocked(generateDraftsTriggerInternals.runShellCommandAsync).mock.calls[0][0];
    expect(command).toContain("outreach generate-drafts --campaign-id 'camp-1'");
    expect(command).toContain("--company-ids '[\"11111111-1111-4111-8111-111111111111\",\"22222222-2222-4222-8222-222222222222\"]'");
    expect(command).toContain('--contact-ids-file ');
    expect(command).toContain("--drafts-model 'opus'");
    expect(generateDraftsTriggerInternals.runShellCommandAsync).toHaveBeenCalledWith(
      expect.stringContaining("--contact-ids-file "),
      { maxBuffer: 8 * 1024 * 1024, onStdoutLine: undefined }
    );
    expect(result).toMatchObject({
      generated: 4,
      dryRun: true,
      failed: 0,
      source: 'outreacher-generate-drafts',
      campaignId: 'camp-1',
      companyIds: [
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-8222-222222222222',
      ],
      contactIds: [
        '33333333-3333-4333-8333-333333333333',
        '44444444-4444-4444-8444-444444444444',
      ],
      draftsModel: 'opus',
    });
  });

  it('writes an explicit empty contact allowlist to a temp file', async () => {
    process.env.OUTREACH_GENERATE_DRAFTS_CMD = 'outreach generate-drafts';
    const writtenFiles: Array<{ file: string; body: string }> = [];
    vi.spyOn(generateDraftsTriggerInternals, 'mkdtemp').mockResolvedValue('/tmp/crew-five-test');
    vi.spyOn(generateDraftsTriggerInternals, 'writeFile').mockImplementation(async (file, body) => {
      writtenFiles.push({ file: String(file), body: String(body) });
    });
    vi.spyOn(generateDraftsTriggerInternals, 'rm').mockResolvedValue(undefined);
    vi.spyOn(generateDraftsTriggerInternals, 'runShellCommandAsync').mockResolvedValue({
      stdout: '{"generated":0,"dryRun":false,"failed":0,"skipped":7}\n',
      stderr: '',
    });

    const result = await triggerGenerateDrafts({
      campaignId: 'camp-1',
      dryRun: false,
      contactIds: [],
    });

    expect(writtenFiles).toEqual([
      {
        file: '/tmp/crew-five-test/contact-ids.json',
        body: '{"eligibleContactIds":[]}',
      },
    ]);
    expect(generateDraftsTriggerInternals.runShellCommandAsync).toHaveBeenCalledWith(
      "outreach generate-drafts --campaign-id 'camp-1' --contact-ids-file '/tmp/crew-five-test/contact-ids.json'",
      { maxBuffer: 8 * 1024 * 1024, onStdoutLine: undefined }
    );
    expect(generateDraftsTriggerInternals.rm).toHaveBeenCalledWith('/tmp/crew-five-test', {
      recursive: true,
      force: true,
    });
    expect(result).toMatchObject({ generated: 0, skipped: 7, contactIds: [] });
  });

  it('omits batch flags when companyIds and draftsModel are absent', async () => {
    process.env.OUTREACH_GENERATE_DRAFTS_CMD = 'outreach generate-drafts';
    vi.spyOn(generateDraftsTriggerInternals, 'runShellCommandAsync').mockResolvedValue({
      stdout: '{"generated":1,"dryRun":false,"failed":0,"skipped":0}\n',
      stderr: '',
    });

    await triggerGenerateDrafts({
      campaignId: 'camp-1',
      dryRun: false,
    });

    expect(generateDraftsTriggerInternals.runShellCommandAsync).toHaveBeenCalledWith(
      "outreach generate-drafts --campaign-id 'camp-1'",
      { maxBuffer: 8 * 1024 * 1024, onStdoutLine: undefined }
    );
  });

  it('enables JSONL progress and forwards progress events', async () => {
    process.env.OUTREACH_GENERATE_DRAFTS_CMD = 'outreach generate-drafts';
    const events: Array<Record<string, unknown>> = [];
    vi.spyOn(generateDraftsTriggerInternals, 'runShellCommandAsync').mockImplementation(
      async (command, options) => {
        await options?.onStdoutLine?.('{"event":"started","campaign_id":"camp-1","total_recipients":2}');
        await options?.onStdoutLine?.('{"event":"skipped","employee_id":"ct-1","reason":"already_used"}');
        await options?.onStdoutLine?.('{"event":"completed","generated":0,"failed":0,"skipped":1}');
        return {
          stdout:
            '{"event":"started","campaign_id":"camp-1","total_recipients":2}\n' +
            '{"event":"skipped","employee_id":"ct-1","reason":"already_used"}\n' +
            '{"event":"completed","generated":0,"failed":0,"skipped":1}\n' +
            '{"status":"ok","generated":0,"failed":0,"skipped":1,"dryRun":true}\n',
          stderr: '',
        };
      }
    );

    const result = await triggerGenerateDrafts({
      campaignId: 'camp-1',
      dryRun: true,
      onProgress: async (event) => {
        events.push(event);
      },
    });

    const command = vi.mocked(generateDraftsTriggerInternals.runShellCommandAsync).mock.calls[0][0];
    expect(command).toContain('--progress-jsonl');
    expect(events.map((event) => event.event)).toEqual(['started', 'skipped', 'completed']);
    expect(result).toMatchObject({ generated: 0, skipped: 1, dryRun: true });
  });

  it('surfaces stderr when the command fails', async () => {
    process.env.OUTREACH_GENERATE_DRAFTS_CMD = 'outreach generate-drafts';
    vi.spyOn(generateDraftsTriggerInternals, 'runShellCommandAsync').mockRejectedValue({
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
