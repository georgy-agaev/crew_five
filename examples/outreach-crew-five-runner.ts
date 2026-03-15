import { spawn } from 'node:child_process';
import path from 'node:path';

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

interface CommandResult<T = unknown> {
  exitCode: number;
  stdout: string;
  stderr: string;
  data?: T;
}

interface RunnerOptions {
  repoRoot?: string;
  timeoutMs?: number;
  env?: NodeJS.ProcessEnv;
}

interface DraftRecipientRow {
  id: string;
  campaign_id: string;
  contact_id: string;
  company_id: string;
  status: string;
  recipient_email?: string | null;
  recipient_email_source?: 'work' | 'generic' | 'missing';
  recipient_email_kind?: 'corporate' | 'personal' | 'generic' | 'missing';
  sendable?: boolean;
  contact?: {
    id: string;
    full_name?: string | null;
    position?: string | null;
    work_email?: string | null;
    generic_email?: string | null;
    company_name?: string | null;
  } | null;
  company?: {
    id: string;
    company_name?: string | null;
    website?: string | null;
  } | null;
}

export class CrewFiveCliError extends Error {
  code?: string;
  details?: Record<string, unknown>;
  stdout: string;
  stderr: string;
  exitCode: number;

  constructor(message: string, params: {
    stdout: string;
    stderr: string;
    exitCode: number;
    code?: string;
    details?: Record<string, unknown>;
  }) {
    super(message);
    this.name = 'CrewFiveCliError';
    this.stdout = params.stdout;
    this.stderr = params.stderr;
    this.exitCode = params.exitCode;
    this.code = params.code;
    this.details = params.details;
  }
}

function tryParseJson(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
}

export class CrewFiveRunner {
  private repoRoot: string;
  private timeoutMs: number;
  private env: NodeJS.ProcessEnv;

  constructor(options: RunnerOptions = {}) {
    this.repoRoot = options.repoRoot ?? path.resolve(process.cwd());
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.env = { ...process.env, ...options.env };
  }

  async run<T = unknown>(args: string[]): Promise<CommandResult<T>> {
    const fullArgs = ['cli', ...args];

    return await new Promise<CommandResult<T>>((resolve, reject) => {
      const child = spawn('pnpm', fullArgs, {
        cwd: this.repoRoot,
        env: this.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new CrewFiveCliError('crew_five command timed out', {
          stdout,
          stderr,
          exitCode: -1,
          code: 'CLI_TIMEOUT',
        }));
      }, this.timeoutMs);

      child.stdout.on('data', (chunk) => {
        stdout += String(chunk);
      });

      child.stderr.on('data', (chunk) => {
        stderr += String(chunk);
      });

      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });

      child.on('close', (exitCode) => {
        clearTimeout(timer);
        const parsedStdout = tryParseJson(stdout) as T | undefined;

        if ((exitCode ?? 1) === 0) {
          resolve({
            exitCode: exitCode ?? 0,
            stdout,
            stderr,
            data: parsedStdout,
          });
          return;
        }

        const parsedStderr = tryParseJson(stderr) as
          | { ok?: boolean; error?: { code?: string; message?: string; details?: Record<string, unknown> } }
          | undefined;

        reject(
          new CrewFiveCliError(
            parsedStderr?.error?.message ?? stderr.trim() || 'crew_five command failed',
            {
              stdout,
              stderr,
              exitCode: exitCode ?? 1,
              code: parsedStderr?.error?.code,
              details: parsedStderr?.error?.details,
            }
          )
        );
      });
    });
  }

  listSegments() {
    return this.run<any[]>(['segment:list', '--error-format', 'json']);
  }

  listCampaigns() {
    return this.run<any[]>(['campaign:list', '--error-format', 'json']);
  }

  listCampaignsByIcp(input: { icpProfileId: string }) {
    return this.run<any[]>([
      'campaign:list',
      '--icp-profile-id',
      input.icpProfileId,
      '--error-format',
      'json',
    ]);
  }

  enrichSegment(input: {
    segmentId: string;
    provider?: string;
    limit?: number;
    dryRun?: boolean;
    runNow?: boolean;
    maxAgeDays?: number;
    forceRefresh?: boolean;
  }) {
    const args = ['enrich:run', '--segment-id', input.segmentId, '--error-format', 'json'];
    if (input.provider) {
      args.push('--provider', input.provider);
    }
    if (input.limit !== undefined) {
      args.push('--limit', String(input.limit));
    }
    if (input.maxAgeDays !== undefined) {
      args.push('--max-age-days', String(input.maxAgeDays));
    }
    if (input.dryRun) {
      args.push('--dry-run');
    }
    if (input.runNow) {
      args.push('--run-now');
    }
    if (input.forceRefresh) {
      args.push('--force-refresh');
    }
    return this.run<Record<string, JsonValue>>(args);
  }

  createCampaign(input: {
    name: string;
    segmentId: string;
    snapshotMode?: 'reuse' | 'refresh';
  }) {
    return this.run<Record<string, JsonValue>>([
      'campaign:create',
      '--name',
      input.name,
      '--segment-id',
      input.segmentId,
      '--snapshot-mode',
      input.snapshotMode ?? 'refresh',
      '--error-format',
      'json',
    ]);
  }

  saveDraft(payload: Record<string, JsonValue> | Array<Record<string, JsonValue>>) {
    return this.run<any[]>([
      'draft:save',
      '--payload',
      JSON.stringify(payload),
      '--error-format',
      'json',
    ]);
  }

  loadDrafts(input: { campaignId: string; status?: string; limit?: number }) {
    const args = ['draft:load', '--campaign-id', input.campaignId, '--error-format', 'json'];
    if (input.status) {
      args.push('--status', input.status);
    }
    if (input.limit !== undefined) {
      args.push('--limit', String(input.limit));
    }
    return this.run<any[]>(args);
  }

  loadDraftsForSend(input: { campaignId: string; status?: string; limit?: number }) {
    const args = [
      'draft:load',
      '--campaign-id',
      input.campaignId,
      '--include-recipient-context',
      '--error-format',
      'json',
    ];
    if (input.status) {
      args.push('--status', input.status);
    }
    if (input.limit !== undefined) {
      args.push('--limit', String(input.limit));
    }
    return this.run<DraftRecipientRow[]>(args);
  }

  updateDraftStatus(input: {
    draftId: string;
    status: 'generated' | 'approved' | 'rejected' | 'sent';
    reviewer?: string;
    metadata?: Record<string, JsonValue>;
  }) {
    const args = [
      'draft:update-status',
      '--draft-id',
      input.draftId,
      '--status',
      input.status,
      '--error-format',
      'json',
    ];

    if (input.reviewer) {
      args.push('--reviewer', input.reviewer);
    }
    if (input.metadata) {
      args.push('--metadata', JSON.stringify(input.metadata));
    }

    return this.run<Record<string, JsonValue>>(args);
  }

  recordOutbound(input: {
    draftId: string;
    provider?: string;
    providerMessageId?: string;
    senderIdentity?: string;
    recipientEmail?: string;
    recipientEmailSource?: 'work' | 'generic' | 'missing';
    recipientEmailKind?: 'corporate' | 'personal' | 'generic' | 'missing';
    status?: 'sent' | 'failed';
    sentAt?: string;
    error?: string;
    metadata?: Record<string, JsonValue>;
  }) {
    return this.run<Record<string, JsonValue>>([
      'email:record-outbound',
      '--payload',
      JSON.stringify({
        draftId: input.draftId,
        provider: input.provider ?? 'imap_mcp',
        providerMessageId: input.providerMessageId,
        senderIdentity: input.senderIdentity,
        recipientEmail: input.recipientEmail,
        recipientEmailSource: input.recipientEmailSource,
        recipientEmailKind: input.recipientEmailKind,
        status: input.status ?? 'sent',
        sentAt: input.sentAt,
        error: input.error,
        metadata: input.metadata,
      }),
      '--error-format',
      'json',
    ]);
  }
}

async function main() {
  const runner = new CrewFiveRunner({
    repoRoot: path.resolve(process.cwd()),
  });

  const segments = await runner.listSegments();
  console.log('segments', segments.data?.length ?? 0);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
