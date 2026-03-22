import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  isProcessRepliesTriggerConfigured,
  processRepliesTriggerInternals,
  triggerProcessReplies,
} from './processRepliesTrigger.js';

describe('processRepliesTrigger', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('runs OUTREACH_PROCESS_REPLIES_CMD and parses JSON stdout', async () => {
    vi.stubEnv(
      'OUTREACH_PROCESS_REPLIES_CMD',
      'python3 /Users/georgyagaev/Projects/Outreach/scripts/process_replies_cli.py'
    );
    const execSpy = vi.spyOn(processRepliesTriggerInternals, 'execFileAsync').mockResolvedValue({
      stdout: '{"accepted":true,"processed":4,"ingested":3}\n',
      stderr: '',
    });

    expect(isProcessRepliesTriggerConfigured()).toBe(true);

    const result = await triggerProcessReplies({
      mailboxAccountId: 'mbox-1',
      lookbackHours: 24,
    });

    expect(execSpy).toHaveBeenCalledWith(
      '/bin/sh',
      [
        '-lc',
        "python3 /Users/georgyagaev/Projects/Outreach/scripts/process_replies_cli.py --lookback-hours 24 --mailbox-account-id 'mbox-1'",
      ],
      { maxBuffer: 1024 * 1024 }
    );
    expect(result.accepted).toBe(true);
    expect(result.processed).toBe(4);
    expect(result.ingested).toBe(3);
    expect(result.source).toBe('outreacher-process-replies');
    expect(result.upstreamStatus).toBe(200);
    expect(result.mailboxAccountId).toBe('mbox-1');
  });

  it('posts to explicit process-replies url with optional bearer token', async () => {
    vi.stubEnv('OUTREACH_PROCESS_REPLIES_URL', 'https://outreach.example/process-replies');
    vi.stubEnv('OUTREACH_API_TOKEN', 'secret-token');
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({ accepted: true, processed: 2 }), {
        status: 202,
        headers: { 'content-type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchSpy);

    const result = await triggerProcessReplies({
      mailboxAccountId: 'mbox-1',
      lookbackHours: 12,
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://outreach.example/process-replies',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer secret-token',
        }),
        body: JSON.stringify({ mailboxAccountId: 'mbox-1', lookbackHours: 12 }),
      })
    );
    expect(result.accepted).toBe(true);
    expect(result.processed).toBe(2);
    expect(result.source).toBe('outreacher-process-replies');
    expect(result.upstreamStatus).toBe(202);
  });

  it('uses OUTREACH_API_BASE fallback and reports configuration state', async () => {
    vi.stubEnv('OUTREACH_API_BASE', 'https://outreach.example/api/');
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({ queued: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    );
    vi.stubGlobal('fetch', fetchSpy);

    expect(isProcessRepliesTriggerConfigured()).toBe(true);

    const result = await triggerProcessReplies({});

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://outreach.example/api/process-replies',
      expect.objectContaining({
        method: 'POST',
        body: '{}',
      })
    );
    expect(result.queued).toBe(true);
    expect(result.upstreamStatus).toBe(200);
  });
});
