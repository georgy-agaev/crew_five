import * as childProcess from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';

import type { DraftSummary } from '../types.js';

export interface GenerateDraftsTriggerRequest {
  campaignId: string;
  dryRun?: boolean;
  limit?: number;
  companyIds?: string[];
  contactIds?: string[];
  draftsModel?: 'sonnet' | 'opus';
  interactionMode?: 'coach' | 'express';
  dataQualityMode?: 'strict' | 'graceful';
  icpProfileId?: string;
  icpHypothesisId?: string;
  coachPromptStep?: string;
  explicitCoachPromptId?: string;
  provider?: string;
  model?: string;
  onProgress?: (event: GenerateDraftsProgressEvent) => void | Promise<void>;
}

export interface GenerateDraftsTriggerResult extends DraftSummary, Record<string, unknown> {
  source: 'outreacher-generate-drafts';
  requestedAt: string;
  campaignId: string;
  companyIds?: string[];
  contactIds?: string[];
  draftsModel?: 'sonnet' | 'opus';
}

export interface GenerateDraftsProgressEvent extends Record<string, unknown> {
  event: string;
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

async function runShellCommandAsync(
  command: string,
  options: { maxBuffer?: number; onStdoutLine?: (line: string) => void | Promise<void> } = {}
): Promise<{ stdout: string; stderr: string }> {
  if (!options.onStdoutLine) {
    return execFileAsync('/bin/sh', ['-lc', command], { maxBuffer: options.maxBuffer });
  }

  return new Promise((resolve, reject) => {
    const child = childProcess.spawn('/bin/sh', ['-lc', command], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let stdoutBuffer = '';
    let progressChain = Promise.resolve();

    child.stdout?.on('data', (chunk: Buffer) => {
      stdoutChunks.push(chunk);
      stdoutBuffer += chunk.toString('utf8');
      const lines = stdoutBuffer.split(/\r?\n/);
      stdoutBuffer = lines.pop() ?? '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        progressChain = progressChain.then(() => options.onStdoutLine?.(trimmed));
      }
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      const remaining = stdoutBuffer.trim();
      if (remaining) {
        progressChain = progressChain.then(() => options.onStdoutLine?.(remaining));
      }
      progressChain
        .then(() => {
          const stdout = Buffer.concat(stdoutChunks).toString('utf8');
          const stderr = Buffer.concat(stderrChunks).toString('utf8');
          if (code === 0) {
            resolve({ stdout, stderr });
          } else {
            reject({
              message: `Command failed with exit code ${code}`,
              stdout,
              stderr,
            });
          }
        })
        .catch(reject);
    });
  });
}

export const generateDraftsTriggerInternals = {
  execFileAsync,
  runShellCommandAsync,
  mkdtemp: fs.mkdtemp,
  writeFile: fs.writeFile,
  rm: fs.rm,
  tmpdir: os.tmpdir,
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

function parseProgressLine(line: string): GenerateDraftsProgressEvent | null {
  try {
    const parsed = JSON.parse(line) as Record<string, unknown>;
    return typeof parsed.event === 'string'
      ? (parsed as GenerateDraftsProgressEvent)
      : null;
  } catch {
    return null;
  }
}

export async function triggerGenerateDrafts(
  request: GenerateDraftsTriggerRequest
): Promise<GenerateDraftsTriggerResult> {
  const command = resolveGenerateDraftsCommand();
  if (!command) {
    throw new Error('Outreach generate-drafts command is not configured');
  }

  let contactIdsTempDir: string | null = null;
  const args = [`--campaign-id ${shellQuote(request.campaignId)}`];
  if (Array.isArray(request.companyIds) && request.companyIds.length > 0) {
    args.push(`--company-ids ${shellQuote(JSON.stringify(request.companyIds))}`);
  }
  if (Array.isArray(request.contactIds)) {
    contactIdsTempDir = await generateDraftsTriggerInternals.mkdtemp(
      path.join(generateDraftsTriggerInternals.tmpdir(), 'crew-five-draft-contacts-')
    );
    const contactIdsFile = path.join(contactIdsTempDir, 'contact-ids.json');
    await generateDraftsTriggerInternals.writeFile(
      contactIdsFile,
      JSON.stringify({ eligibleContactIds: request.contactIds }),
      'utf8'
    );
    args.push(`--contact-ids-file ${shellQuote(contactIdsFile)}`);
  }
  if (request.draftsModel === 'sonnet' || request.draftsModel === 'opus') {
    args.push(`--drafts-model ${shellQuote(request.draftsModel)}`);
  }
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
  if (request.onProgress) {
    args.push('--progress-jsonl');
  }

  const fullCommand = [command, ...args].join(' ').trim();

  try {
    const { stdout } = await generateDraftsTriggerInternals.runShellCommandAsync(fullCommand, {
      maxBuffer: 8 * 1024 * 1024,
      onStdoutLine: request.onProgress
        ? async (line) => {
            const event = parseProgressLine(line);
            if (event) {
              await request.onProgress?.(event);
            }
          }
        : undefined,
    });
    const parsed = parseCommandJson(stdout);
    return {
      ...(parsed as Record<string, unknown>),
      dryRun: typeof parsed.dryRun === 'boolean' ? parsed.dryRun : Boolean(request.dryRun),
      source: 'outreacher-generate-drafts',
      requestedAt: new Date().toISOString(),
      campaignId: request.campaignId,
      ...(Array.isArray(request.companyIds) ? { companyIds: request.companyIds } : {}),
      ...(Array.isArray(request.contactIds) ? { contactIds: request.contactIds } : {}),
      ...(request.draftsModel ? { draftsModel: request.draftsModel } : {}),
    } as GenerateDraftsTriggerResult;
  } catch (error) {
    const raw = error as { message?: string; stdout?: string; stderr?: string };
    const detail = raw.stderr?.trim() || raw.stdout?.trim() || raw.message || 'empty output';
    throw new Error(`Outreach generate-drafts command failed: ${detail}`);
  } finally {
    if (contactIdsTempDir) {
      await generateDraftsTriggerInternals.rm(contactIdsTempDir, { recursive: true, force: true });
    }
  }
}
