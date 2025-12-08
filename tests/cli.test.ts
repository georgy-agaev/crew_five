/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, expect, it, vi } from 'vitest';

import { createProgram } from '../src/cli';
import { AiClient } from '../src/services/aiClient';
import * as icpDiscoverySvc from '../src/services/icpDiscovery';

describe('createProgram', () => {
  it('handles draft:generate errors without throwing from parseAsync', async () => {
    const draftGenerate = vi.fn().mockRejectedValue(new Error('draft failed'));
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      handlers: { draftGenerate },
    });

    const originalExitCode = process.exitCode;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'draft:generate',
      '--campaign-id',
      'camp-err',
      '--dry-run',
    ]);

    expect(draftGenerate).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
    process.exitCode = originalExitCode;
  });

  it('handles segment:snapshot errors without throwing from parseAsync', async () => {
    const segmentSnapshot = vi.fn().mockRejectedValue(new Error('snapshot failed'));
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      handlers: { segmentSnapshot },
    });

    const originalExitCode = process.exitCode;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'segment:snapshot',
      '--segment-id',
      'seg-err',
      '--allow-empty',
    ]);

    expect(segmentSnapshot).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
    process.exitCode = originalExitCode;
  });

  it('handles event:ingest JSON errors without throwing from parseAsync', async () => {
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
    });

    const originalExitCode = process.exitCode;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'event:ingest',
      '--payload',
      'not-json',
      '--dry-run',
    ]);

    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
    process.exitCode = originalExitCode;
  });

  it('event:ingest emits JSON error when error-format=json', async () => {
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
    });

    const originalExitCode = process.exitCode;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'event:ingest',
      '--payload',
      'not-json',
      '--dry-run',
      '--error-format',
      'json',
    ]);

    expect(errorSpy).toHaveBeenCalled();
    const payload = JSON.parse((errorSpy.mock.calls[0] as any)[0] as string);
    expect(payload.ok).toBe(false);
    expect(payload.error?.code).toBe('INVALID_JSON');
    expect(payload.error?.message).toMatch(/payload is not valid json/i);

    errorSpy.mockRestore();
    process.exitCode = originalExitCode;
  });

  it('handles missing Smartlead env for smartlead:campaigns:list', async () => {
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
    });

    const originalExitCode = process.exitCode;
    const originalUrl = process.env.SMARTLEAD_MCP_URL;
    const originalToken = process.env.SMARTLEAD_MCP_TOKEN;
    const originalApiBase = process.env.SMARTLEAD_API_BASE;
    const originalApiKey = process.env.SMARTLEAD_API_KEY;
    delete process.env.SMARTLEAD_MCP_URL;
    delete process.env.SMARTLEAD_MCP_TOKEN;
    delete process.env.SMARTLEAD_API_BASE;
    delete process.env.SMARTLEAD_API_KEY;

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await program.parseAsync(['node', 'gtm', 'smartlead:campaigns:list', '--dry-run']);

    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
    process.exitCode = originalExitCode;
    if (originalUrl !== undefined) process.env.SMARTLEAD_MCP_URL = originalUrl;
    if (originalToken !== undefined) process.env.SMARTLEAD_MCP_TOKEN = originalToken;
    if (originalApiBase !== undefined) process.env.SMARTLEAD_API_BASE = originalApiBase;
    if (originalApiKey !== undefined) process.env.SMARTLEAD_API_KEY = originalApiKey;
  });

  it('emits friendly Smartlead config error with code when error-format=json', async () => {
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
    });

    const originalExitCode = process.exitCode;
    const originalEnv = {
      url: process.env.SMARTLEAD_MCP_URL,
      token: process.env.SMARTLEAD_MCP_TOKEN,
      apiBase: process.env.SMARTLEAD_API_BASE,
      apiKey: process.env.SMARTLEAD_API_KEY,
    };
    delete process.env.SMARTLEAD_MCP_URL;
    delete process.env.SMARTLEAD_MCP_TOKEN;
    delete process.env.SMARTLEAD_API_BASE;
    delete process.env.SMARTLEAD_API_KEY;

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'smartlead:campaigns:list',
      '--dry-run',
      '--error-format',
      'json',
    ]);

    expect(errorSpy).toHaveBeenCalled();
    const payload = JSON.parse((errorSpy.mock.calls[0] as any)[0] as string);
    expect(payload.ok).toBe(false);
    expect(payload.error?.code).toBe('SMARTLEAD_CONFIG_MISSING');
    expect(payload.error?.message).toMatch(/SMARTLEAD_API_BASE|SMARTLEAD_MCP_URL/);

    errorSpy.mockRestore();
    process.exitCode = originalExitCode;
    if (originalEnv.url !== undefined) process.env.SMARTLEAD_MCP_URL = originalEnv.url;
    if (originalEnv.token !== undefined) process.env.SMARTLEAD_MCP_TOKEN = originalEnv.token;
    if (originalEnv.apiBase !== undefined) process.env.SMARTLEAD_API_BASE = originalEnv.apiBase;
    if (originalEnv.apiKey !== undefined) process.env.SMARTLEAD_API_KEY = originalEnv.apiKey;
  });

  it('wires campaign:create dry-run flag into handler', async () => {
    const campaignCreate = vi.fn().mockResolvedValue({});
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      handlers: { campaignCreate },
    });

    await program.parseAsync([
      'node',
      'gtm',
      'campaign:create',
      '--name',
      'Q1 Dry',
      '--segment-id',
      'seg-1',
      '--dry-run',
    ]);

    expect(campaignCreate).toHaveBeenCalledWith(
      supabaseClient,
      expect.objectContaining({
        name: 'Q1 Dry',
        segmentId: 'seg-1',
        dryRun: true,
      })
    );
  });

  it('campaign:create emits JSON error when error-format=json', async () => {
    const error = { code: 'ERR_CAMPAIGN', message: 'campaign create failed', details: { reason: 'test' } };
    const campaignCreate = vi.fn().mockRejectedValue(error);
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      handlers: { campaignCreate },
    });

    const originalExitCode = process.exitCode;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'campaign:create',
      '--name',
      'Q1 Err',
      '--segment-id',
      'seg-err',
      '--error-format',
      'json',
    ]);

    expect(campaignCreate).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    const payload = JSON.parse((errorSpy.mock.calls[0] as any)[0] as string);
    expect(payload.ok).toBe(false);
    expect(payload.error?.code).toBe('ERR_CAMPAIGN');
    expect(payload.error?.message).toBe('campaign create failed');

    errorSpy.mockRestore();
    process.exitCode = originalExitCode;
  });

  it('wires icp:discover with minimal args and returns summary json', async () => {
    const supabaseClient = {
      from: (table: string) => {
        if (table === 'jobs') {
          return {
            insert: () => ({
              select: () => ({
                single: async () => ({ data: { id: 'job-1' }, error: null }),
              }),
            }),
            update: () => ({
              eq: () => ({
                select: () => ({
                  single: async () => ({ data: { id: 'job-1', status: 'running', result: {} }, error: null }),
                }),
              }),
            }),
            select: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: { id: 'job-1', status: 'running', result: {} },
                    error: null,
                  }),
              }),
            }),
          };
        }
        if (table === 'icp_discovery_runs') {
          return {
            insert: () => ({
              select: () => ({
                single: async () => ({ data: { id: 'run-1', metadata: {} }, error: null }),
              }),
            }),
            update: () => ({
              eq: () => ({
                select: () => ({
                  single: async () => ({
                    data: { id: 'run-1', metadata: { provider_run_id: 'ws-1' } },
                    error: null,
                  }),
                }),
              }),
            }),
            select: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: { id: 'run-1', icp_profile_id: 'icp-1', icp_hypothesis_id: 'hypo-1' },
                    error: null,
                  }),
              }),
            }),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      },
    } as any;

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const originalExitCode = process.exitCode;

    process.env.EXA_API_KEY = 'test-key';
    process.env.EXA_API_BASE = 'https://api.exa.example';
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch' as any)
      .mockResolvedValue({ ok: true, json: async () => ({ id: 'ws-1', items: [] }) } as any);

    await program.parseAsync(['node', 'gtm', 'icp:discover', '--icp-profile-id', 'icp-1']);

    expect(logSpy).toHaveBeenCalled();
    const payload = JSON.parse((logSpy.mock.calls[0] as any)[0] as string);
    expect(payload.jobId).toBe('job-1');
    expect(payload.runId).toBe('run-1');
    expect(payload.provider).toBe('exa');

    logSpy.mockRestore();
    fetchSpy.mockRestore();
    process.exitCode = originalExitCode;
  });

  it('icp_discover_cli_with_promote_returns_promoted_count', async () => {
    const supabaseClient = { from: vi.fn() } as any;
    const discoverSpy = vi
      .spyOn(icpDiscoverySvc, 'runIcpDiscoveryWithExa')
      .mockResolvedValue({ jobId: 'job-1', runId: 'run-1', provider: 'exa', status: 'running' } as any);
    const promoteSpy = vi
      .spyOn(icpDiscoverySvc, 'promoteIcpDiscoveryCandidatesToSegment')
      .mockResolvedValue({ promotedCount: 1 });

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const originalExitCode = process.exitCode;

    process.env.EXA_API_KEY = 'test-key';

    await program.parseAsync([
      'node',
      'gtm',
      'icp:discover',
      '--icp-profile-id',
      'icp-1',
      '--promote',
      '--segment-id',
      'seg-1',
      '--candidate-ids',
      'cand-1',
    ]);

    expect(discoverSpy).toHaveBeenCalledWith(supabaseClient, expect.anything(), {
      icpProfileId: 'icp-1',
      icpHypothesisId: undefined,
      limit: undefined,
    });
    expect(promoteSpy).toHaveBeenCalledWith(supabaseClient, {
      runId: 'run-1',
      candidateIds: ['cand-1'],
      segmentId: 'seg-1',
    });
    expect(logSpy).toHaveBeenCalled();
    const payload = JSON.parse((logSpy.mock.calls[0] as any)[0] as string);
    expect(payload.jobId).toBe('job-1');
    expect(payload.runId).toBe('run-1');
    expect(payload.promotedCount).toBe(1);

    logSpy.mockRestore();
    discoverSpy.mockRestore();
    promoteSpy.mockRestore();
    process.exitCode = originalExitCode;
  });

  it('wires draft:generate limit and dry-run into handler', async () => {
    const draftGenerate = vi.fn().mockResolvedValue({});
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      handlers: { draftGenerate },
    });

    await program.parseAsync([
      'node',
      'gtm',
      'draft:generate',
      '--campaign-id',
      'camp-2',
      '--dry-run',
      '--limit',
      '25',
    ]);

    expect(draftGenerate).toHaveBeenCalledWith(
      supabaseClient,
      expect.anything(),
      expect.objectContaining({
        campaignId: 'camp-2',
        dryRun: true,
        limit: 25,
      })
    );
  });

  it('wires draft:generate ICP flags into handler', async () => {
    const draftGenerate = vi.fn().mockResolvedValue({});
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      handlers: { draftGenerate },
    });

    await program.parseAsync([
      'node',
      'gtm',
      'draft:generate',
      '--campaign-id',
      'camp-icp',
      '--icp-profile-id',
      'icp-1',
      '--icp-hypothesis-id',
      'hyp-1',
    ]);

    expect(draftGenerate).toHaveBeenCalledWith(
      supabaseClient,
      expect.anything(),
      expect.objectContaining({
        campaignId: 'camp-icp',
        icpProfileId: 'icp-1',
        icpHypothesisId: 'hyp-1',
      })
    );
  });

  it('draft:generate emits JSON error when error-format=json', async () => {
    const error = { code: 'ERR_DRAFT', message: 'draft generation failed', details: { reason: 'test' } };
    const draftGenerate = vi.fn().mockRejectedValue(error);
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      handlers: { draftGenerate },
    });

    const originalExitCode = process.exitCode;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'draft:generate',
      '--campaign-id',
      'camp-json',
      '--dry-run',
      '--error-format',
      'json',
    ]);

    expect(draftGenerate).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    const payload = JSON.parse((errorSpy.mock.calls[0] as any)[0] as string);
    expect(payload.ok).toBe(false);
    expect(payload.error?.code).toBe('ERR_DRAFT');
    expect(payload.error?.message).toBe('draft generation failed');

    errorSpy.mockRestore();
    process.exitCode = originalExitCode;
  });

  it('campaign:status emits JSON error when error-format=json', async () => {
    const singleSelect = vi.fn().mockResolvedValue({ data: { status: 'draft' }, error: null });
    const eqSelect = vi.fn().mockReturnValue({ single: singleSelect });
    const select = vi.fn().mockReturnValue({ eq: eqSelect });
    const supabaseClient = {
      from: (table: string) => {
        if (table === 'campaigns') {
          return { select };
        }
        return { select };
      },
    } as any;

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
    });

    const originalExitCode = process.exitCode;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'campaign:status',
      '--campaign-id',
      'camp-1',
      '--status',
      'sending',
      '--error-format',
      'json',
    ]);

    expect(errorSpy).toHaveBeenCalled();
    const payload = JSON.parse((errorSpy.mock.calls[0] as any)[0] as string);
    expect(payload.ok).toBe(false);
    expect(payload.error?.code).toBe('ERR_STATUS_INVALID');
    expect(payload.error?.message).toMatch(/invalid status transition/i);

    errorSpy.mockRestore();
    process.exitCode = originalExitCode;
  });

  it('wires the email:send command', async () => {
    const limit = vi.fn().mockResolvedValue({ data: [], error: null });
    const eq = vi.fn().mockReturnValue({ limit });
    const select = vi.fn().mockReturnValue({ eq });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) });
    const supabaseClient = {
      from: (table: string) => {
        if (table === 'drafts') {
          return { select };
        }
        if (table === 'email_outbound') {
          return { insert };
        }
        return { update };
      },
    } as any;

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
    });

    await program.parseAsync([
      'node',
      'gtm',
      'email:send',
      '--provider',
      'smtp',
      '--sender-identity',
      'noreply@example.com',
      '--throttle-per-minute',
      '25',
      '--summary-format',
      'text',
      '--fail-on-error',
    ]);

    // No error thrown means command is wired; smtpClient is stubbed internally.
  });

  it('wires the campaign:status command', async () => {
    const singleUpdate = vi.fn().mockResolvedValue({ data: { id: 'c', status: 'ready' }, error: null });
    const eqUpdate = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: singleUpdate }) });
    const update = vi.fn().mockReturnValue({ eq: eqUpdate });

    const singleSelect = vi.fn().mockResolvedValue({ data: { status: 'draft' }, error: null });
    const eqSelect = vi.fn().mockReturnValue({ single: singleSelect });
    const select = vi.fn().mockReturnValue({ eq: eqSelect });
    const supabaseClient = {
      from: (table: string) => {
        if (table === 'campaigns') {
          return { select, update };
        }
        return { update };
      },
    } as any;

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
    });

    await program.parseAsync([
      'node',
      'gtm',
      'campaign:status',
      '--campaign-id',
      'camp-1',
      '--status',
      'ready',
    ]);
  });

  it('wires the event:ingest command with JSON payload and dry-run', async () => {
    const limit = vi.fn().mockResolvedValue({ data: [], error: null });
    const eq2 = vi.fn().mockReturnValue({ limit });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const selectDedup = vi.fn().mockReturnValue({ eq: eq1 });

    const single = vi.fn().mockResolvedValue({ data: { id: 'evt-1' }, error: null });
    const selectInsert = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select: selectInsert });
    const supabaseClient = {
      from: (table: string) => {
        if (table === 'email_events') {
          return { select: selectDedup, insert };
        }
        return { select: selectDedup };
      },
    } as any;

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
    });

    await program.parseAsync([
      'node',
      'gtm',
      'event:ingest',
      '--payload',
      '{"provider":"stub","event_type":"delivered"}',
      '--dry-run',
    ]);
  });

  it('wires smartlead:campaigns:list with injected client', async () => {
    const listCampaigns = vi.fn().mockResolvedValue({ campaigns: [{ id: 'c1', name: 'C' }] });
    const client = { listCampaigns } as any;
    const supabaseClient = { from: vi.fn() } as any;

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      smartleadClient: client,
    });

    await program.parseAsync(['node', 'gtm', 'smartlead:campaigns:list', '--dry-run']);

    expect(listCampaigns).toHaveBeenCalledWith({ dryRun: true, format: 'json' });
  });

  it('wires smartlead:events:pull and calls ingest', async () => {
    const events = [
      {
        provider: 'smartlead',
        provider_event_id: 'evt-1',
        event_type: 'delivered',
        outcome_classification: null,
        contact_id: null,
        outbound_id: null,
        occurred_at: '2025-01-01T00:00:00Z',
        payload: {},
      },
    ];
    const pullEvents = vi.fn().mockResolvedValue({ events });
    const client = { pullEvents } as any;

    const insert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn() }) });
    const select = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ limit: vi.fn() }) });
    const supabaseClient = {
      from: (table: string) => {
        if (table === 'email_events') {
          return { insert, select };
        }
        return { insert, select };
      },
    } as any;

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      smartleadClient: client,
    });

    await program.parseAsync([
      'node',
      'gtm',
      'smartlead:events:pull',
      '--dry-run',
      '--since',
      '2025-01-01T00:00:00Z',
      '--limit',
      '25',
    ]);

    expect(pullEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        dryRun: true,
        format: 'json',
        since: '2025-01-01T00:00:00Z',
        limit: 25,
      })
    );
  });

  it('smartlead:events:pull rejects bad since/limit', async () => {
    const pullEvents = vi.fn();
    const client = { pullEvents } as any;
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      smartleadClient: client,
    });

    const originalExitCode = process.exitCode;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await program.parseAsync(['node', 'gtm', 'smartlead:events:pull', '--since', 'invalid', '--limit', '-1']);

    expect(pullEvents).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
    process.exitCode = originalExitCode;
  });

  it('smartlead:events:pull emits JSON error when error-format=json', async () => {
    const pullEvents = vi.fn();
    const client = { pullEvents } as any;
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      smartleadClient: client,
    });

    const originalExitCode = process.exitCode;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'smartlead:events:pull',
      '--since',
      'invalid',
      '--limit',
      '-1',
      '--error-format',
      'json',
    ]);

    expect(pullEvents).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    const payload = JSON.parse((errorSpy.mock.calls[0] as any)[0] as string);
    expect(payload.ok).toBe(false);
    expect(payload.error?.message).toMatch(/invalid --since/i);

    errorSpy.mockRestore();
    process.exitCode = originalExitCode;
  });

  it('smartlead:events:pull wires retry cap and assume-now flag', async () => {
    const pullEvents = vi.fn().mockResolvedValue({ events: [] });
    const client = { pullEvents } as any;
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      smartleadClient: client,
    });

    await program.parseAsync([
      'node',
      'gtm',
      'smartlead:events:pull',
      '--retry-after-cap-ms',
      '250',
      '--assume-now-occurred-at',
    ]);

    expect(pullEvents).toHaveBeenCalledWith({
      dryRun: false,
      format: 'json',
      since: undefined,
      limit: undefined,
      retryAfterCapMs: 250,
      assumeNowOccurredAt: true,
    });
  });

  it('wires smartlead:send', async () => {
    const listDrafts = [{ id: 'd1', campaign_id: 'c1', contact_id: 'lead@example.com', company_id: 'co', subject: 's', body: 'b', metadata: {} }];
    const select = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue({ data: listDrafts, error: null }) }) });
    const update = vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }), eq: vi.fn().mockResolvedValue({ error: null }) });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const supabaseClient = {
      from: (table: string) => {
        if (table === 'drafts') return { select, update };
        if (table === 'email_outbound') return { insert };
        return { insert, update };
      },
    } as any;
    const sendEmail = vi.fn().mockResolvedValue({ provider_message_id: 'm1' });
    const client = { sendEmail } as any;

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      smartleadClient: client,
    });

    await program.parseAsync(['node', 'gtm', 'smartlead:send', '--batch-size', '10']);

    expect(sendEmail).toHaveBeenCalled();
    expect(insert).toHaveBeenCalled();
  });

  it('smartlead:send emits JSON error when error-format=json and env missing', async () => {
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
    });

    const originalExitCode = process.exitCode;
    const originalUrl = process.env.SMARTLEAD_MCP_URL;
    const originalToken = process.env.SMARTLEAD_MCP_TOKEN;
    const originalApiBase = process.env.SMARTLEAD_API_BASE;
    const originalApiKey = process.env.SMARTLEAD_API_KEY;
    delete process.env.SMARTLEAD_MCP_URL;
    delete process.env.SMARTLEAD_MCP_TOKEN;
    delete process.env.SMARTLEAD_API_BASE;
    delete process.env.SMARTLEAD_API_KEY;

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'smartlead:send',
      '--error-format',
      'json',
    ]);

    expect(errorSpy).toHaveBeenCalled();
    const payload = JSON.parse((errorSpy.mock.calls[0] as any)[0] as string);
    expect(payload.ok).toBe(false);
    expect(payload.error?.message).toMatch(/SMARTLEAD_MCP_URL and SMARTLEAD_MCP_TOKEN/);

    errorSpy.mockRestore();
    process.exitCode = originalExitCode;
    if (originalUrl !== undefined) process.env.SMARTLEAD_MCP_URL = originalUrl;
    if (originalToken !== undefined) process.env.SMARTLEAD_MCP_TOKEN = originalToken;
    if (originalApiBase !== undefined) process.env.SMARTLEAD_API_BASE = originalApiBase;
    if (originalApiKey !== undefined) process.env.SMARTLEAD_API_KEY = originalApiKey;
  });

  it('smartlead:leads:push builds leads from Supabase rows', async () => {
    const employees = [
      { id: 'e1', full_name: 'Alice Doe', work_email: 'alice@example.com', company_name: 'Example Co' },
    ];
    const select = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({ data: employees, error: null }),
    });
    const from = (table: string) => {
      if (table === 'employees') {
        return { select };
      }
      return { select };
    };
    const supabaseClient = { from } as any;
    const addLeadsToCampaign = vi.fn().mockResolvedValue({});
    const smartleadClient = { addLeadsToCampaign } as any;

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      smartleadClient,
    });

    await program.parseAsync([
      'node',
      'gtm',
      'smartlead:leads:push',
      '--campaign-id',
      '123',
      '--limit',
      '10',
    ]);

    expect(addLeadsToCampaign).toHaveBeenCalledTimes(1);
    const args = addLeadsToCampaign.mock.calls[0][0];
    expect(args.campaignId).toBe('123');
    expect(args.leads).toHaveLength(1);
    expect(args.leads[0].email).toBe('alice@example.com');
    expect(args.leads[0].first_name).toBe('Alice');
    expect(args.leads[0].company_name).toBe('Example Co');
  });

  it('smartlead:leads:push respects dry-run flag', async () => {
    const employees = [
      { id: 'e1', full_name: 'Alice Doe', work_email: 'alice@example.com', company_name: 'Example Co' },
    ];
    const select = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({ data: employees, error: null }),
    });
    const from = (_table: string) => ({ select });
    const supabaseClient = { from } as any;
    const addLeadsToCampaign = vi.fn().mockResolvedValue({});
    const smartleadClient = { addLeadsToCampaign } as any;

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      smartleadClient,
    });

    await program.parseAsync([
      'node',
      'gtm',
      'smartlead:leads:push',
      '--campaign-id',
      '123',
      '--dry-run',
    ]);

    expect(addLeadsToCampaign).not.toHaveBeenCalled();
  });

  it('smartlead:sequences:sync builds sequence from first draft', async () => {
    const drafts = [
      { id: 'd1', campaign_id: '456', subject: 'Hello', body: '<p>Hello</p>' },
    ];
    const select = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: drafts, error: null }),
        }),
      }),
    });
    const from = (table: string) => {
      if (table === 'drafts') {
        return { select };
      }
      return { select };
    };
    const supabaseClient = { from } as any;
    const saveCampaignSequences = vi.fn().mockResolvedValue({});
    const smartleadClient = { saveCampaignSequences } as any;

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      smartleadClient,
    });

    await program.parseAsync([
      'node',
      'gtm',
      'smartlead:sequences:sync',
      '--campaign-id',
      '456',
    ]);

    expect(saveCampaignSequences).toHaveBeenCalledTimes(1);
    const args = saveCampaignSequences.mock.calls[0][0];
    expect(args.campaignId).toBe('456');
    expect(args.sequences).toHaveLength(1);
    expect(args.sequences[0].subject).toBe('Hello');
    expect(args.sequences[0].email_body).toBe('<p>Hello</p>');
  });

  it('smartlead:sequences:sync respects dry-run flag', async () => {
    const drafts = [
      { id: 'd1', campaign_id: '456', subject: 'Hello', body: '<p>Hello</p>' },
    ];
    const select = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: drafts, error: null }),
        }),
      }),
    });
    const from = (_table: string) => ({ select });
    const supabaseClient = { from } as any;
    const saveCampaignSequences = vi.fn().mockResolvedValue({});
    const smartleadClient = { saveCampaignSequences } as any;

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      smartleadClient,
    });

    await program.parseAsync([
      'node',
      'gtm',
      'smartlead:sequences:sync',
      '--campaign-id',
      '456',
      '--dry-run',
    ]);

    expect(saveCampaignSequences).not.toHaveBeenCalled();
  });

  it('wires enrich command', async () => {
    const members = [{ contact_id: 'lead@example.com', company_id: 'co1' }];
    const segmentMembersSelect = vi.fn((_columns?: any, _opts?: any) => ({
      match: vi.fn().mockResolvedValue({ data: [], error: null, count: 1 }),
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: members, error: null }),
        }),
      }),
    }));
    const segmentSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'seg-1', version: 1 }, error: null }),
      }),
    });
    const jobInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'job-1',
            type: 'enrich',
            status: 'created',
            segment_id: 'seg-1',
            segment_version: 1,
            payload: {},
            result: null,
            created_at: '',
            updated_at: '',
          },
          error: null,
        }),
      }),
    });
    const from = (table: string) => {
      if (table === 'segment_members') {
        return { select: segmentMembersSelect };
      }
      if (table === 'segments') {
        return { select: segmentSelect };
      }
      if (table === 'jobs') {
        return { insert: jobInsert };
      }
      if (table === 'companies' || table === 'employees') {
        return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) };
      }
      return { select: vi.fn(), insert: vi.fn() };
    };
    const supabaseClient = { from } as any;
    const smartleadClient = { sendEmail: vi.fn() } as any;

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      smartleadClient,
    });

    await program.parseAsync(['node', 'gtm', 'enrich:run', '--segment-id', 'seg-1', '--limit', '5']);

    expect(segmentMembersSelect).toHaveBeenCalled();
  });

  it('enrich_run_emits_json_error_for_unknown_provider', async () => {
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
    });

    const originalExitCode = process.exitCode;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'enrich:run',
      '--segment-id',
      'seg-err',
      '--provider',
      'unknown-provider',
      '--error-format',
      'json',
    ]);

    expect(errorSpy).toHaveBeenCalled();
    const payload = JSON.parse((errorSpy.mock.calls[0] as any)[0] as string);
    expect(payload.ok).toBe(false);
    expect(payload.error?.code).toBe('ENRICHMENT_PROVIDER_UNKNOWN');

    errorSpy.mockRestore();
    process.exitCode = originalExitCode;
  });

  it('wires icp:create and prints profile id', async () => {
    const from = vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'icp-1' },
            error: null,
          }),
        }),
      }),
    });
    const supabaseClient = { from } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      smartleadClient: {} as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync([
      'node',
      'gtm',
      'icp:create',
      '--name',
      'Fintech ICP',
      '--company-criteria',
      '{"industry":"fintech"}',
    ]);

    expect(from).toHaveBeenCalledWith('icp_profiles');
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify({ id: 'icp-1' }));
    logSpy.mockRestore();
  });

  it('wires icp:hypothesis:create and prints hypothesis id', async () => {
    const from = vi.fn((table: string) => {
      if (table === 'icp_hypotheses') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'hypo-1' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'segments') {
        return {
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      return { select: vi.fn() };
    });
    const supabaseClient = { from } as any;

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      smartleadClient: {} as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync([
      'node',
      'gtm',
      'icp:hypothesis:create',
      '--icp-profile-id',
      'icp-1',
      '--label',
      'Mid-market',
      '--segment-id',
      'segment-1',
    ]);

    expect(from).toHaveBeenCalledWith('icp_hypotheses');
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify({ id: 'hypo-1' }));
    logSpy.mockRestore();
  });

  it('wires icp:list command and prints profiles', async () => {
    const selectProfiles = vi.fn().mockResolvedValue({
      data: [{ id: 'icp-1', name: 'ICP One' }],
      error: null,
    });
    const from = vi.fn().mockReturnValue({ select: selectProfiles });
    const supabaseClient = { from } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      smartleadClient: {} as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'gtm', 'icp:list', '--columns', 'id,name']);

    expect(from).toHaveBeenCalledWith('icp_profiles');
    const payload = JSON.parse((logSpy.mock.calls[0] as any[])[0] as string);
    expect(payload[0].id).toBe('icp-1');
    logSpy.mockRestore();
  });

  it('wires icp:hypothesis:list with filters', async () => {
    const eq = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [{ id: 'hyp-1', icp_profile_id: 'icp-1' }],
        error: null,
      }),
    });
    const selectHyp = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select: selectHyp });
    const supabaseClient = { from } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      smartleadClient: {} as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync([
      'node',
      'gtm',
      'icp:hypothesis:list',
      '--icp-profile-id',
      'icp-1',
      '--segment-id',
      'seg-1',
      '--columns',
      'id,icp_profile_id',
    ]);

    expect(from).toHaveBeenCalledWith('icp_hypotheses');
    const payload = JSON.parse((logSpy.mock.calls[0] as any[])[0] as string);
    expect(payload[0].id).toBe('hyp-1');
    logSpy.mockRestore();
  });

  it('cli_icp_coach_profile_calls_orchestrator_and_prints_json', async () => {
    const from = vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'icp-1', name: 'ICP' },
            error: null,
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'job-1', status: 'completed', result: {} },
              error: null,
            }),
          }),
        }),
      }),
    });
    const supabaseClient = { from } as any;
    const chatClient = {
      complete: vi.fn().mockResolvedValue(
        JSON.stringify({
          name: 'ICP',
          companyCriteria: {},
          personaCriteria: {},
        })
      ),
    };
    const program = createProgram({
      supabaseClient,
      aiClient: new AiClient(chatClient as any),
      smartleadClient: {} as any,
      chatClient: chatClient as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync(['node', 'gtm', 'icp:coach:profile', '--name', 'ICP']);

    expect(logSpy).toHaveBeenCalledTimes(1);
    const printed = (logSpy.mock.calls[0] as any[])[0] as string;
    const parsed = JSON.parse(printed);
    expect(parsed).toHaveProperty('jobId');
    expect(parsed).toHaveProperty('profileId', 'icp-1');
    logSpy.mockRestore();
  });

  it('cli_icp_coach_hypothesis_calls_orchestrator_and_prints_json', async () => {
    const from = vi.fn((table: string) => {
      if (table === 'icp_hypotheses') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'hypo-1', icp_id: 'icp-1' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'jobs') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'job-2', type: 'icp', status: 'created', result: {} },
                error: null,
              }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'job-2', type: 'icp', status: 'completed', result: {} },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return { select: vi.fn(), insert: vi.fn(), update: vi.fn() };
    });
    const supabaseClient = { from } as any;
    const chatClient = {
      complete: vi.fn().mockResolvedValue(
        JSON.stringify({
          hypothesisLabel: 'H1',
          searchConfig: {},
        })
      ),
    };
    const program = createProgram({
      supabaseClient,
      aiClient: new AiClient(chatClient as any),
      smartleadClient: {} as any,
      chatClient: chatClient as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync([
      'node',
      'gtm',
      'icp:coach:hypothesis',
      '--icp-profile-id',
      'icp-1',
    ]);

    expect(logSpy).toHaveBeenCalledTimes(1);
    const printed = (logSpy.mock.calls[0] as any[])[0] as string;
    const parsed = JSON.parse(printed);
    expect(parsed).toHaveProperty('jobId', 'job-2');
    expect(parsed).toHaveProperty('hypothesisId', 'hypo-1');
    logSpy.mockRestore();
  });

  it('analytics_optimize_command_prints_suggestions_without_crashing', async () => {
    const selectAnalytics = vi.fn().mockReturnValue(
      Promise.resolve({
        data: [
          {
            draft_pattern: 'intro_v1:standard:A',
            user_edited: false,
            event_type: 'delivered',
            outcome_classification: null,
          },
        ],
        error: null,
      })
    );
    const gte = vi.fn().mockReturnValue({ select: selectAnalytics });
    const eqJobs = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue(Promise.resolve({ data: [{ status: 'not_implemented' }], error: null })) });
    const selectJobs = vi.fn().mockReturnValue({ eq: eqJobs });
    const from = vi.fn((table: string) => {
      if (table === 'analytics_events_flat') return { select: selectAnalytics, gte };
      if (table === 'jobs') return { select: selectJobs };
      return { select: vi.fn() };
    });
    const supabaseClient = { from } as any;

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      smartleadClient: {} as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync(['node', 'gtm', 'analytics:optimize']);

    expect(logSpy).toHaveBeenCalled();
    const printed = (logSpy.mock.calls[0] as any[])[0] as string;
    expect(printed).toMatch(/suggestions/);

    logSpy.mockRestore();
  });

  it('wires judge:drafts with dry-run', async () => {
    const drafts = [{ id: 'd1', subject: 's', body: 'b' }];
    const select = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue({ data: drafts, error: null }) }) });
    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    const supabaseClient = {
      from: (table: string) => {
        if (table === 'drafts') return { select, update };
        return { select, update };
      },
    } as any;

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      smartleadClient: {} as any,
    });

    await program.parseAsync(['node', 'gtm', 'judge:drafts', '--campaign-id', 'c1', '--dry-run', '--limit', '5']);
    expect(select).toHaveBeenCalled();
  });
});
