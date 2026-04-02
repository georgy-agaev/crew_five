import * as childProcess from 'node:child_process';
import { promisify } from 'node:util';

export interface GenerateBumpsTriggerRequest {
  campaignId: string;
  contactIds: string[];
  limit?: number;
  dryRun?: boolean;
}

export interface GenerateBumpsTriggerResult extends Record<string, unknown> {
  source: 'outreacher-generate-bumps';
  requestedAt: string;
  campaignId: string;
  contactIds: string[];
}

function resolveGenerateBumpsCommand(): string | null {
  const command = process.env.OUTREACH_GENERATE_BUMPS_CMD?.trim();
  return command ? command : null;
}

export function isGenerateBumpsTriggerConfigured(): boolean {
  return resolveGenerateBumpsCommand() !== null;
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

export const generateBumpsTriggerInternals = {
  execFileAsync,
};

function parseCommandJson(stdout: string): Record<string, unknown> {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const candidate = lines.at(-1);
  if (!candidate) {
    throw new Error('Outreach generate-bumps command produced no JSON output');
  }
  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    throw new Error('Outreach generate-bumps command produced no JSON output');
  }
}

export async function triggerGenerateBumps(
  request: GenerateBumpsTriggerRequest
): Promise<GenerateBumpsTriggerResult> {
  const command = resolveGenerateBumpsCommand();
  if (!command) {
    throw new Error('Outreach generate-bumps command is not configured');
  }

  const args = [
    `--campaign-id ${shellQuote(request.campaignId)}`,
    `--contact-ids ${shellQuote(JSON.stringify(request.contactIds))}`,
  ];
  if (request.dryRun) {
    args.push('--dry-run');
  }
  if (typeof request.limit === 'number' && Number.isFinite(request.limit)) {
    args.push(`--limit ${Math.trunc(request.limit)}`);
  }

  const fullCommand = [command, ...args].join(' ').trim();

  try {
    const { stdout } = await generateBumpsTriggerInternals.execFileAsync(
      '/bin/sh',
      ['-lc', fullCommand],
      { maxBuffer: 1024 * 1024 }
    );
    const parsed = parseCommandJson(stdout);
    return {
      ...(parsed as Record<string, unknown>),
      source: 'outreacher-generate-bumps',
      requestedAt: new Date().toISOString(),
      campaignId: request.campaignId,
      contactIds: request.contactIds,
    };
  } catch (error) {
    const raw = error as { message?: string; stdout?: string; stderr?: string };
    const detail = raw.stderr?.trim() || raw.stdout?.trim() || raw.message || 'empty output';
    throw new Error(`Outreach generate-bumps command failed: ${detail}`);
  }
}
