import * as childProcess from 'node:child_process';
import { promisify } from 'node:util';

import type { InboxPollRequest, InboxPollResult } from '../types.js';

function resolveProcessRepliesCommand(): string | null {
  const command = process.env.OUTREACH_PROCESS_REPLIES_CMD?.trim();
  return command ? command : null;
}

function resolveProcessRepliesUrl(): string | null {
  const explicitUrl = process.env.OUTREACH_PROCESS_REPLIES_URL?.trim();
  if (explicitUrl) {
    return explicitUrl;
  }

  const apiBase = process.env.OUTREACH_API_BASE?.trim();
  if (!apiBase) {
    return null;
  }

  return `${apiBase.replace(/\/+$/, '')}/process-replies`;
}

export function isProcessRepliesTriggerConfigured(): boolean {
  return resolveProcessRepliesCommand() !== null || resolveProcessRepliesUrl() !== null;
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

export const processRepliesTriggerInternals = {
  execFileAsync,
};

function parseCommandJson(stdout: string): Record<string, unknown> {
  const lines = stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const candidate = lines.at(-1);
  if (!candidate) {
    throw new Error('Outreach process-replies command produced no JSON output');
  }
  return JSON.parse(candidate) as Record<string, unknown>;
}

async function triggerProcessRepliesViaCommand(
  command: string,
  request: InboxPollRequest
): Promise<InboxPollResult> {
  const args: string[] = [];
  if (typeof request.lookbackHours === 'number') {
    args.push(`--lookback-hours ${Math.trunc(request.lookbackHours)}`);
  }
  if (typeof request.mailboxAccountId === 'string' && request.mailboxAccountId.trim()) {
    args.push(`--mailbox-account-id ${shellQuote(request.mailboxAccountId.trim())}`);
  }
  const fullCommand = [command, ...args].join(' ').trim();

  try {
    const { stdout } = await processRepliesTriggerInternals.execFileAsync('/bin/sh', ['-lc', fullCommand], {
      maxBuffer: 1024 * 1024,
    });
    const parsed = parseCommandJson(stdout);
    return {
      ...(parsed as Record<string, unknown>),
      source: 'outreacher-process-replies',
      requestedAt: new Date().toISOString(),
      upstreamStatus: 200,
      mailboxAccountId:
        typeof request.mailboxAccountId === 'string' ? request.mailboxAccountId : null,
    };
  } catch (err: unknown) {
    const raw = err as { message?: string; stdout?: string; stderr?: string };
    const detail = raw.stderr?.trim() || raw.stdout?.trim() || raw.message || 'empty output';
    throw new Error(`Outreach process-replies command failed: ${detail}`);
  }
}

export async function triggerProcessReplies(
  request: InboxPollRequest
): Promise<InboxPollResult> {
  const command = resolveProcessRepliesCommand();
  if (command) {
    return triggerProcessRepliesViaCommand(command, request);
  }

  const url = resolveProcessRepliesUrl();
  if (!url) {
    throw new Error('Outreach process-replies endpoint is not configured');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = process.env.OUTREACH_API_TOKEN?.trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(request),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Outreach process-replies failed with HTTP ${response.status}: ${raw || 'empty response'}`);
  }

  const parsed =
    raw && response.headers.get('content-type')?.includes('application/json')
      ? (JSON.parse(raw) as Record<string, unknown>)
      : raw
        ? { raw }
        : {};

  return {
    ...(parsed as Record<string, unknown>),
    source: 'outreacher-process-replies',
    requestedAt: new Date().toISOString(),
    upstreamStatus: response.status,
    mailboxAccountId:
      typeof request.mailboxAccountId === 'string' ? request.mailboxAccountId : null,
  };
}
