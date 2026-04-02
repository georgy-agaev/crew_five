import * as childProcess from 'node:child_process';
import { promisify } from 'node:util';

import type { DraftSummary } from '../types.js';

export interface GenerateDraftsTriggerRequest {
  campaignId: string;
  dryRun?: boolean;
  limit?: number;
  interactionMode?: 'coach' | 'express';
  dataQualityMode?: 'strict' | 'graceful';
  icpProfileId?: string;
  icpHypothesisId?: string;
  coachPromptStep?: string;
  explicitCoachPromptId?: string;
  provider?: string;
  model?: string;
}

export interface GenerateDraftsTriggerResult extends DraftSummary, Record<string, unknown> {
  source: 'outreacher-generate-drafts';
  requestedAt: string;
  campaignId: string;
}

function resolveGenerateDraftsCommand(): string | null {
  const command = process.env.OUTREACH_GENERATE_DRAFTS_CMD?.trim();
  return command ? command : null;
}

export function isGenerateDraftsTriggerConfigured(): boolean {
  return resolveGenerateDraftsCommand() !== null;
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

export const generateDraftsTriggerInternals = {
  execFileAsync,
};

function parseCommandJson(stdout: string): Record<string, unknown> {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const candidate = lines.at(-1);
  if (!candidate) {
    throw new Error('Outreach generate-drafts command produced no JSON output');
  }
  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    throw new Error('Outreach generate-drafts command produced no JSON output');
  }
}

export async function triggerGenerateDrafts(
  request: GenerateDraftsTriggerRequest
): Promise<GenerateDraftsTriggerResult> {
  const command = resolveGenerateDraftsCommand();
  if (!command) {
    throw new Error('Outreach generate-drafts command is not configured');
  }

  const args = [`--campaign-id ${shellQuote(request.campaignId)}`];
  if (request.dryRun) {
    args.push('--dry-run');
  }
  if (typeof request.limit === 'number' && Number.isFinite(request.limit)) {
    args.push(`--limit ${Math.trunc(request.limit)}`);
  }
  if (request.interactionMode) {
    args.push(`--interaction-mode ${shellQuote(request.interactionMode)}`);
  }
  if (request.dataQualityMode) {
    args.push(`--data-quality-mode ${shellQuote(request.dataQualityMode)}`);
  }
  if (request.icpProfileId) {
    args.push(`--icp-profile-id ${shellQuote(request.icpProfileId)}`);
  }
  if (request.icpHypothesisId) {
    args.push(`--icp-hypothesis-id ${shellQuote(request.icpHypothesisId)}`);
  }
  if (request.coachPromptStep) {
    args.push(`--coach-prompt-step ${shellQuote(request.coachPromptStep)}`);
  }
  if (request.explicitCoachPromptId) {
    args.push(`--explicit-coach-prompt-id ${shellQuote(request.explicitCoachPromptId)}`);
  }
  if (request.provider) {
    args.push(`--provider ${shellQuote(request.provider)}`);
  }
  if (request.model) {
    args.push(`--model ${shellQuote(request.model)}`);
  }

  const fullCommand = [command, ...args].join(' ').trim();

  try {
    const { stdout } = await generateDraftsTriggerInternals.execFileAsync(
      '/bin/sh',
      ['-lc', fullCommand],
      { maxBuffer: 1024 * 1024 }
    );
    const parsed = parseCommandJson(stdout);
    return {
      ...(parsed as Record<string, unknown>),
      source: 'outreacher-generate-drafts',
      requestedAt: new Date().toISOString(),
      campaignId: request.campaignId,
    } as GenerateDraftsTriggerResult;
  } catch (error) {
    const raw = error as { message?: string; stdout?: string; stderr?: string };
    const detail = raw.stderr?.trim() || raw.stdout?.trim() || raw.message || 'empty output';
    throw new Error(`Outreach generate-drafts command failed: ${detail}`);
  }
}
