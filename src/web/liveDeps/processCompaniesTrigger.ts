import * as childProcess from 'node:child_process';
import { promisify } from 'node:util';

import type {
  CompanyImportProcessCommandResult,
  CompanyImportProcessRequest,
} from '../../services/companyImportProcessing.js';

function resolveProcessCompaniesCommand(): string | null {
  const command = process.env.OUTREACH_PROCESS_COMPANY_CMD?.trim();
  return command ? command : null;
}

export function isProcessCompaniesTriggerConfigured(): boolean {
  return resolveProcessCompaniesCommand() !== null;
}

function shellQuote(value: string) {
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

export const processCompaniesTriggerInternals = {
  execFileAsync,
};

function parseCommandJson(stdout: string) {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const candidate = lines.at(-1);
  if (!candidate) {
    throw new Error('Outreach process-companies command produced no JSON output');
  }
  return JSON.parse(candidate) as CompanyImportProcessCommandResult;
}

export async function triggerProcessCompanies(
  request: CompanyImportProcessRequest
): Promise<CompanyImportProcessCommandResult> {
  const command = resolveProcessCompaniesCommand();
  if (!command) {
    throw new Error('Outreach process-companies command is not configured');
  }

  const companyIds = request.companyIds.map((companyId) => String(companyId).trim()).filter(Boolean);
  if (companyIds.length === 0) {
    throw new Error('companyIds must be a non-empty array');
  }

  const fullCommand = [
    command,
    `--company-ids ${shellQuote(companyIds.join(','))}`,
    `--mode ${request.mode === 'light' ? 'light' : 'full'}`,
  ].join(' ');

  try {
    const { stdout } = await processCompaniesTriggerInternals.execFileAsync('/bin/sh', ['-lc', fullCommand], {
      maxBuffer: 4 * 1024 * 1024,
    });
    return parseCommandJson(stdout);
  } catch (err: unknown) {
    const raw = err as { message?: string; stdout?: string; stderr?: string };
    const detail = raw.stderr?.trim() || raw.stdout?.trim() || raw.message || 'empty output';
    throw new Error(`Outreach process-companies command failed: ${detail}`);
  }
}
