import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  isSendCampaignTriggerConfigured,
  sendCampaignTriggerInternals,
  triggerSendCampaign,
} from './sendCampaignTrigger.js';

describe('sendCampaignTrigger', () => {
  afterEach(() => {
    delete process.env.OUTREACH_SEND_CAMPAIGN_CMD;
    vi.restoreAllMocks();
  });

  it('detects whether the send-campaign command is configured', () => {
    delete process.env.OUTREACH_SEND_CAMPAIGN_CMD;
    expect(isSendCampaignTriggerConfigured()).toBe(false);

    process.env.OUTREACH_SEND_CAMPAIGN_CMD = 'outreach send-campaign';
    expect(isSendCampaignTriggerConfigured()).toBe(true);
  });

  it('executes the configured command and parses the last JSON line', async () => {
    process.env.OUTREACH_SEND_CAMPAIGN_CMD = 'outreach send-campaign';
    vi.spyOn(sendCampaignTriggerInternals, 'execFileAsync').mockResolvedValue({
      stdout: 'debug line\n{"ok":true,"sent":5}\n',
      stderr: '',
    });

    const result = await triggerSendCampaign({
      campaignId: 'camp-1',
      reason: 'auto_send_intro',
      batchLimit: 25,
    });

    expect(sendCampaignTriggerInternals.execFileAsync).toHaveBeenCalledWith(
      '/bin/sh',
      ['-lc', "outreach send-campaign --campaign-id 'camp-1' --reason 'auto_send_intro' --batch-limit 25"],
      { maxBuffer: 1024 * 1024 }
    );
    expect(result).toMatchObject({
      ok: true,
      sent: 5,
      source: 'outreacher-send-campaign',
      reason: 'auto_send_intro',
      campaignId: 'camp-1',
    });
  });

  it('surfaces stderr when the command fails', async () => {
    process.env.OUTREACH_SEND_CAMPAIGN_CMD = 'outreach send-campaign';
    vi.spyOn(sendCampaignTriggerInternals, 'execFileAsync').mockRejectedValue({
      stderr: 'boom',
      stdout: '',
      message: 'Command failed',
    });

    await expect(
      triggerSendCampaign({
        campaignId: 'camp-2',
        reason: 'auto_send_bump',
      })
    ).rejects.toThrow(/boom/i);
  });

  it('fails cleanly when the command output has no JSON line', async () => {
    process.env.OUTREACH_SEND_CAMPAIGN_CMD = 'outreach send-campaign';
    vi.spyOn(sendCampaignTriggerInternals, 'execFileAsync').mockResolvedValue({
      stdout: 'plain text only',
      stderr: '',
    });

    await expect(
      triggerSendCampaign({
        campaignId: 'camp-3',
        reason: 'auto_send_mixed',
      })
    ).rejects.toThrow(/no json output/i);
  });
});
