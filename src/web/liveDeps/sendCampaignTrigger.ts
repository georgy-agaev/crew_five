import * as childProcess from 'node:child_process';
import { promisify } from 'node:util';

import type { CampaignAutoSendTriggerReason } from '../../services/campaignAutoSend.js';

export interface SendCampaignTriggerRequest {
  campaignId: string;
  reason: CampaignAutoSendTriggerReason;
  batchLimit?: number;
}

export interface SendCampaignTriggerResult extends Record<string, unknown> {
  source: 'outreacher-send-campaign';
  requestedAt: string;
  campaignId: string;
  reason: CampaignAutoSendTriggerReason;
}

function resolveSendCampaignCommand(): string | null {
  const command = process.env.OUTREACH_SEND_CAMPAIGN_CMD?.trim();
  return command ? command : null;
}

export function isSendCampaignTriggerConfigured(): boolean {
  return resolveSendCampaignCommand() !== null;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

async function execFileAsync(
  file: string,
  args: string[],
  options: { maxBuffer?: number } = {}
): Promise<{ stdout: string; stderr: string }> {
  const execFile = promisify(childProcess.execFile);
  return execFile(file, args, options);
}

export const sendCampaignTriggerInternals = {
  execFileAsync,
};

function parseCommandJson(stdout: string): Record<string, unknown> {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const candidate = lines.at(-1);
  if (!candidate) {
    throw new Error('Outreach send-campaign command produced no JSON output');
  }
  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    throw new Error('Outreach send-campaign command produced no JSON output');
  }
}

export async function triggerSendCampaign(
  request: SendCampaignTriggerRequest
): Promise<SendCampaignTriggerResult> {
  const command = resolveSendCampaignCommand();
  if (!command) {
    throw new Error('Outreach send-campaign command is not configured');
  }

  const args = [
    `--campaign-id ${shellQuote(request.campaignId)}`,
    `--reason ${shellQuote(request.reason)}`,
  ];
  if (typeof request.batchLimit === 'number' && Number.isFinite(request.batchLimit)) {
    args.push(`--batch-limit ${Math.trunc(request.batchLimit)}`);
  }
  const fullCommand = [command, ...args].join(' ').trim();

  try {
    const { stdout } = await sendCampaignTriggerInternals.execFileAsync(
      '/bin/sh',
      ['-lc', fullCommand],
      { maxBuffer: 1024 * 1024 }
    );
    const parsed = parseCommandJson(stdout);
    return {
      ...(parsed as Record<string, unknown>),
      source: 'outreacher-send-campaign',
      requestedAt: new Date().toISOString(),
      campaignId: request.campaignId,
      reason: request.reason,
    };
  } catch (error) {
    const raw = error as { message?: string; stdout?: string; stderr?: string };
    const detail = raw.stderr?.trim() || raw.stdout?.trim() || raw.message || 'empty output';
    throw new Error(`Outreach send-campaign command failed: ${detail}`);
  }
}
