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
      '--offer-id',
      'offer-1',
      '--icp-hypothesis-id',
      'hyp-1',
      '--dry-run',
    ]);

    expect(campaignCreate).toHaveBeenCalledWith(
      supabaseClient,
      expect.objectContaining({
        name: 'Q1 Dry',
        segmentId: 'seg-1',
        offerId: 'offer-1',
        icpHypothesisId: 'hyp-1',
        dryRun: true,
      })
    );
  });

  it('wires offer:create', async () => {
    const offerCreate = vi.fn().mockResolvedValue({
      id: 'offer-1',
      title: 'Negotiation room audit',
      project_name: 'VoiceXpert',
      description: 'Audit offer',
      status: 'active',
    });
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      handlers: { offerCreate } as any,
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'offer:create',
      '--title',
      'Negotiation room audit',
      '--project-name',
      'VoiceXpert',
      '--description',
      'Audit offer',
      '--status',
      'active',
      '--error-format',
      'json',
    ]);

    expect(offerCreate).toHaveBeenCalledWith(supabaseClient, {
      title: 'Negotiation room audit',
      projectName: 'VoiceXpert',
      description: 'Audit offer',
      status: 'active',
    });
    const payload = JSON.parse((logSpy.mock.calls.at(-1) as any[])[0] as string);
    expect(payload.id).toBe('offer-1');
    logSpy.mockRestore();
  });

  it('wires offer:list with status filter', async () => {
    const offerList = vi.fn().mockResolvedValue([
      {
        id: 'offer-1',
        title: 'Negotiation room audit',
        project_name: 'VoiceXpert',
        description: 'Audit offer',
        status: 'active',
      },
    ]);
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      handlers: { offerList } as any,
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'offer:list',
      '--status',
      'active',
      '--error-format',
      'json',
    ]);

    expect(offerList).toHaveBeenCalledWith(supabaseClient, { status: 'active' });
    const payload = JSON.parse((logSpy.mock.calls.at(-1) as any[])[0] as string);
    expect(payload[0].id).toBe('offer-1');
    logSpy.mockRestore();
  });

  it('wires offer:update', async () => {
    const offerUpdate = vi.fn().mockResolvedValue({
      id: 'offer-1',
      title: 'Negotiation room audit',
      project_name: 'VoiceXpert',
      description: 'Updated audit offer',
      status: 'inactive',
    });
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      handlers: { offerUpdate } as any,
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'offer:update',
      '--offer-id',
      'offer-1',
      '--description',
      'Updated audit offer',
      '--status',
      'inactive',
      '--error-format',
      'json',
    ]);

    expect(offerUpdate).toHaveBeenCalledWith(supabaseClient, 'offer-1', {
      description: 'Updated audit offer',
      status: 'inactive',
    });
    const payload = JSON.parse((logSpy.mock.calls.at(-1) as any[])[0] as string);
    expect(payload.status).toBe('inactive');
    logSpy.mockRestore();
  });

  it('wires project:create, project:list, and project:update', async () => {
    const projectCreate = vi.fn().mockResolvedValue({
      id: 'project-1',
      key: 'voicexpert',
      name: 'VoiceXpert',
      description: 'Core workspace',
      status: 'active',
    });
    const projectList = vi.fn().mockResolvedValue([
      {
        id: 'project-1',
        key: 'voicexpert',
        name: 'VoiceXpert',
        description: 'Core workspace',
        status: 'active',
      },
    ]);
    const projectUpdate = vi.fn().mockResolvedValue({
      id: 'project-1',
      key: 'voicexpert',
      name: 'VoiceXpert Core',
      description: 'Updated',
      status: 'inactive',
    });
    const program = createProgram({
      supabaseClient: { from: vi.fn() } as any,
      aiClient: {} as any,
      handlers: { projectCreate, projectList, projectUpdate } as any,
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'project:create',
      '--key',
      'voicexpert',
      '--name',
      'VoiceXpert',
      '--description',
      'Core workspace',
      '--error-format',
      'json',
    ]);
    expect(projectCreate).toHaveBeenCalledWith(expect.anything(), {
      key: 'voicexpert',
      name: 'VoiceXpert',
      description: 'Core workspace',
      status: undefined,
    });

    await program.parseAsync([
      'node',
      'gtm',
      'project:list',
      '--status',
      'active',
      '--error-format',
      'json',
    ]);
    expect(projectList).toHaveBeenCalledWith(expect.anything(), { status: 'active' });

    await program.parseAsync([
      'node',
      'gtm',
      'project:update',
      '--project-id',
      'project-1',
      '--name',
      'VoiceXpert Core',
      '--description',
      'Updated',
      '--status',
      'inactive',
      '--error-format',
      'json',
    ]);
    expect(projectUpdate).toHaveBeenCalledWith(expect.anything(), 'project-1', {
      name: 'VoiceXpert Core',
      description: 'Updated',
      status: 'inactive',
    });

    const lastPayload = JSON.parse((logSpy.mock.calls.at(-1) as any[])[0] as string);
    expect(lastPayload.status).toBe('inactive');
    logSpy.mockRestore();
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

  it('runs employee:repair-names in dry-run mode and prints JSON summary', async () => {
    const repairNames = vi.fn().mockResolvedValue({
      mode: 'dry-run',
      summary: {
        scanned_count: 2,
        candidate_count: 1,
        fixable_count: 1,
        skipped_count: 0,
        updated_count: 0,
      },
      candidates: [
        {
          employee_id: 'emp-1',
          current_first_name: 'Федина',
          current_last_name: 'Инна',
          proposed_first_name: 'Инна',
          proposed_last_name: 'Федина',
          confidence: 'high',
        },
      ],
    });
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      handlers: { repairEmployeeNames: repairNames } as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'employee:repair-names',
      '--dry-run',
      '--error-format',
      'json',
    ]);

    expect(repairNames).toHaveBeenCalledWith(supabaseClient, {
      dryRun: true,
      confidence: 'high',
    });
    const payload = JSON.parse((logSpy.mock.calls[0] as any)[0] as string);
    expect(payload.mode).toBe('dry-run');
    expect(payload.summary.fixable_count).toBe(1);

    logSpy.mockRestore();
  });

  it('passes confidence filter to employee:repair-names handler', async () => {
    const repairNames = vi.fn().mockResolvedValue({
      mode: 'dry-run',
      summary: {
        scanned_count: 2,
        candidate_count: 2,
        fixable_count: 2,
        skipped_count: 0,
        updated_count: 0,
      },
      candidates: [],
    });
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      handlers: { repairEmployeeNames: repairNames } as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'employee:repair-names',
      '--dry-run',
      '--confidence',
      'all',
      '--error-format',
      'json',
    ]);

    expect(repairNames).toHaveBeenCalledWith(supabaseClient, {
      dryRun: true,
      confidence: 'all',
    });

    logSpy.mockRestore();
  });

  it('runs company:import in dry-run mode from a JSON file', async () => {
    const companyImport = vi.fn().mockResolvedValue({
      mode: 'dry-run',
      summary: {
        total_count: 1,
        created_count: 1,
        updated_count: 0,
        skipped_count: 0,
        employee_created_count: 0,
        employee_updated_count: 0,
      },
      items: [{ company_name: 'ООО Новая', action: 'create', warnings: [] }],
    });
    const tmpFile = '/tmp/crew-five-company-import.json';
    await import('node:fs/promises').then((fs) =>
      fs.writeFile(tmpFile, JSON.stringify([{ company_name: 'ООО Новая', tin: '1234567890' }]), 'utf8')
    );

    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      handlers: { companyImport } as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'company:import',
      '--file',
      tmpFile,
      '--dry-run',
      '--error-format',
      'json',
    ]);

    expect(companyImport).toHaveBeenCalledWith(supabaseClient, expect.objectContaining({ dryRun: true }));
    const payload = JSON.parse((logSpy.mock.calls[0] as any)[0] as string);
    expect(payload.mode).toBe('dry-run');
    expect(payload.summary.created_count).toBe(1);

    logSpy.mockRestore();
  });

  it('runs company:save-processed from payload json', async () => {
    const companySaveProcessed = vi.fn().mockResolvedValue({
      company_id: 'company-1',
      employee_ids: ['employee-1'],
      warnings: [],
    });
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      handlers: { companySaveProcessed } as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'company:save-processed',
      '--payload',
      JSON.stringify({
        company: {
          tin: '7707083893',
          company_name: 'ООО Пример',
          processing_status: 'completed',
        },
        employees: [{ full_name: 'Инна Федина' }],
      }),
      '--error-format',
      'json',
    ]);

    expect(companySaveProcessed).toHaveBeenCalledWith(
      supabaseClient,
      expect.objectContaining({
        company: expect.objectContaining({
          tin: '7707083893',
          company_name: 'ООО Пример',
        }),
        employees: [expect.objectContaining({ full_name: 'Инна Федина' })],
      })
    );
    const payload = JSON.parse((logSpy.mock.calls[0] as any)[0] as string);
    expect(payload.company_id).toBe('company-1');
    expect(payload.employee_ids).toEqual(['employee-1']);

    logSpy.mockRestore();
  });

  it('runs campaign:attach-companies and prints JSON summary', async () => {
    const campaignAttachCompanies = vi.fn().mockResolvedValue({
      campaignId: 'camp-1',
      summary: {
        requestedCompanyCount: 2,
        attachedCompanyCount: 1,
        alreadyPresentCompanyCount: 1,
        blockedCompanyCount: 0,
        invalidCompanyCount: 0,
        insertedContactCount: 2,
        alreadyPresentContactCount: 1,
      },
      items: [],
    });
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      handlers: { campaignAttachCompanies } as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'campaign:attach-companies',
      '--campaign-id',
      'camp-1',
      '--company-ids',
      '["co-1","co-2"]',
      '--attached-by',
      'web-ui',
      '--source',
      'import_workspace',
      '--error-format',
      'json',
    ]);

    expect(campaignAttachCompanies).toHaveBeenCalledWith(supabaseClient, {
      campaignId: 'camp-1',
      companyIds: ['co-1', 'co-2'],
      attachedBy: 'web-ui',
      source: 'import_workspace',
    });
    const payload = JSON.parse((logSpy.mock.calls.at(-1) as any[])[0] as string);
    expect(payload.summary.attachedCompanyCount).toBe(1);

    logSpy.mockRestore();
  });

  it('runs campaign:followup-candidates and prints JSON rows', async () => {
    const campaignFollowupCandidates = vi.fn().mockResolvedValue([
      {
        contact_id: 'contact-1',
        company_id: 'company-1',
        intro_sent: true,
        intro_sent_at: '2026-03-10T10:00:00Z',
        intro_sender_identity: 'sales@example.com',
        reply_received: false,
        bounce: false,
        unsubscribed: false,
        bump_draft_exists: true,
        bump_sent: false,
        eligible: true,
        days_since_intro: 6,
        auto_reply: null,
      },
    ]);
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      handlers: { campaignFollowupCandidates } as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'campaign:followup-candidates',
      '--campaign-id',
      'camp-1',
      '--error-format',
      'json',
    ]);

    expect(campaignFollowupCandidates).toHaveBeenCalledWith(supabaseClient, 'camp-1');
    const payload = JSON.parse((logSpy.mock.calls[0] as any)[0] as string);
    expect(payload).toHaveLength(1);
    expect(payload[0]?.eligible).toBe(true);

    logSpy.mockRestore();
  });

  it('runs campaign:detail and prints the campaign read model', async () => {
    const campaignDetailReadModel = vi.fn().mockResolvedValue({
      campaign: { id: 'camp-1', name: 'Q1 Push' },
      segment: { id: 'segment-1', name: 'SMB Moscow' },
      icp_profile: { id: 'icp-1', name: 'VoiceXpert ICP' },
      icp_hypothesis: { id: 'hyp-1', name: 'Negotiation room refresh' },
      companies: [],
    });
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      handlers: { campaignDetailReadModel } as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'campaign:detail',
      '--campaign-id',
      'camp-1',
      '--error-format',
      'json',
    ]);

    expect(campaignDetailReadModel).toHaveBeenCalledWith(supabaseClient, 'camp-1');
    const payload = JSON.parse((logSpy.mock.calls[0] as any)[0] as string);
    expect(payload.campaign?.name).toBe('Q1 Push');
    expect(payload.segment?.name).toBe('SMB Moscow');

    logSpy.mockRestore();
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

    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true as any);
    const originalExitCode = process.exitCode;

    process.env.EXA_API_KEY = 'test-key';
    process.env.EXA_API_BASE = 'https://api.exa.example';
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch' as any)
      .mockResolvedValue({ ok: true, json: async () => ({ id: 'ws-1', items: [] }) } as any);

    await program.parseAsync(['node', 'gtm', 'icp:discover', '--icp-profile-id', 'icp-1']);

    expect(stdoutSpy).toHaveBeenCalled();
    const payload = JSON.parse((stdoutSpy.mock.calls[0] as any)[0] as string);
    expect(payload.jobId).toBe('job-1');
    expect(payload.runId).toBe('run-1');
    expect(payload.provider).toBe('exa');

    stdoutSpy.mockRestore();
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

    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true as any);
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
    expect(stdoutSpy).toHaveBeenCalled();
    const payload = JSON.parse((stdoutSpy.mock.calls[0] as any)[0] as string);
    expect(payload.jobId).toBe('job-1');
    expect(payload.runId).toBe('run-1');
    expect(payload.promotedCount).toBe(1);

    stdoutSpy.mockRestore();
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

  it('wires draft:save and prints inserted rows', async () => {
    const insertSelect = vi.fn().mockResolvedValue({
      data: [{ id: 'draft-1', campaign_id: 'camp-1', contact_id: 'contact-1', company_id: 'company-1' }],
      error: null,
    });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });
    const from = vi.fn((table: string) => {
      if (table === 'drafts') return { insert };
      throw new Error(`Unexpected table ${table}`);
    });
    const supabaseClient = { from } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync([
      'node',
      'gtm',
      'draft:save',
      '--payload',
      JSON.stringify({
        campaignId: 'camp-1',
        contactId: 'contact-1',
        companyId: 'company-1',
        subject: 'Hello',
        body: 'World',
      }),
    ]);

    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        campaign_id: 'camp-1',
        contact_id: 'contact-1',
        company_id: 'company-1',
        email_type: 'intro',
        language: 'en',
      }),
    ]);
    const payload = JSON.parse((logSpy.mock.calls[0] as any[])[0] as string);
    expect(payload[0].id).toBe('draft-1');
    logSpy.mockRestore();
  });

  it('wires draft:load with campaign and status filters', async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [{ id: 'draft-1', campaign_id: 'camp-1', status: 'approved' }],
      error: null,
    });
    const statusEq = vi.fn().mockReturnValue({ limit });
    const campaignEq = vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({ eq: statusEq }),
    });
    const select = vi.fn().mockReturnValue({ eq: campaignEq });
    const from = vi.fn((table: string) => {
      if (table === 'drafts') return { select };
      throw new Error(`Unexpected table ${table}`);
    });
    const supabaseClient = { from } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync([
      'node',
      'gtm',
      'draft:load',
      '--campaign-id',
      'camp-1',
      '--status',
      'approved',
      '--limit',
      '5',
    ]);

    expect(from).toHaveBeenCalledWith('drafts');
    expect(select).toHaveBeenCalledWith('*');
    expect(campaignEq).toHaveBeenCalledWith('campaign_id', 'camp-1');
    expect(statusEq).toHaveBeenCalledWith('status', 'approved');
    const payload = JSON.parse((logSpy.mock.calls[0] as any[])[0] as string);
    expect(payload[0].status).toBe('approved');
    logSpy.mockRestore();
  });

  it('wires draft:load with recipient context when requested', async () => {
    const limit = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'draft-1',
          campaign_id: 'camp-1',
          status: 'approved',
          contact: {
            id: 'contact-1',
            work_email: '',
            generic_email: 'info@example.com',
          },
          company: {
            id: 'company-1',
            company_name: 'Example Co',
          },
        },
      ],
      error: null,
    });
    const statusEq = vi.fn().mockReturnValue({ limit });
    const campaignEq = vi.fn().mockReturnValue({
      order: vi.fn().mockReturnValue({ eq: statusEq, limit }),
    });
    const select = vi.fn().mockReturnValue({ eq: campaignEq });
    const from = vi.fn((table: string) => {
      if (table === 'drafts') return { select };
      throw new Error(`Unexpected table ${table}`);
    });
    const supabaseClient = { from } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync([
      'node',
      'gtm',
      'draft:load',
      '--campaign-id',
      'camp-1',
      '--status',
      'approved',
      '--limit',
      '5',
      '--include-recipient-context',
    ]);

    expect(select).toHaveBeenCalledWith(expect.stringContaining('generic_email'));
    const payload = JSON.parse((logSpy.mock.calls.at(-1) as any[])[0] as string);
    expect(payload[0].recipient_email_source).toBe('generic');
    logSpy.mockRestore();
  });

  it('wires draft:update-status and merges metadata', async () => {
    const singleCurrent = vi.fn().mockResolvedValue({
      data: { metadata: { source: 'agent' } },
      error: null,
    });
    const currentEq = vi.fn().mockReturnValue({ single: singleCurrent });
    const recipientEq = vi.fn();
    const currentSelect = vi.fn((columns: string) => {
      if (columns === 'metadata') {
        return { eq: currentEq };
      }
      return { eq: recipientEq };
    });

    const singleUpdated = vi.fn().mockResolvedValue({
      data: { id: 'draft-1', status: 'approved', reviewer: 'qa-user', metadata: { source: 'agent', note: 'ok' } },
      error: null,
    });
    recipientEq.mockReturnValue({ single: singleUpdated });
    const updateEq = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ single: singleUpdated }),
    });
    const update = vi.fn().mockReturnValue({ eq: updateEq });

    const from = vi.fn((table: string) => {
      if (table !== 'drafts') throw new Error(`Unexpected table ${table}`);
      return {
        select: currentSelect,
        update,
      };
    });
    const supabaseClient = { from } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync([
      'node',
      'gtm',
      'draft:update-status',
      '--draft-id',
      'draft-1',
      '--status',
      'approved',
      '--reviewer',
      'qa-user',
      '--metadata',
      '{"note":"ok"}',
    ]);

    expect(update).toHaveBeenCalledWith({
      status: 'approved',
      reviewer: 'qa-user',
      metadata: { source: 'agent', note: 'ok' },
    });
    const payload = JSON.parse((logSpy.mock.calls.at(-1) as any[])[0] as string);
    expect(payload.status).toBe('approved');
    logSpy.mockRestore();
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

  it('wires the email:record-outbound command', async () => {
    const outboundLimit = vi.fn().mockResolvedValue({ data: [], error: null });
    const outboundEqMessage = vi.fn().mockReturnValue({ limit: outboundLimit });
    const outboundEqProvider = vi.fn().mockReturnValue({ eq: outboundEqMessage });
    const outboundSelectExisting = vi.fn().mockReturnValue({ eq: outboundEqProvider });

    const draftSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'draft-1',
        campaign_id: 'camp-1',
        contact_id: 'contact-1',
        company_id: 'company-1',
        pattern_mode: 'direct',
        metadata: {},
        contact: { id: 'contact-1', work_email: '', generic_email: 'info@example.com' },
      },
      error: null,
    });
    const draftEq = vi.fn().mockReturnValue({ single: draftSingle });
    const draftSelect = vi.fn().mockReturnValue({ eq: draftEq });

    const insertedSingle = vi.fn().mockResolvedValue({
      data: { id: 'out-1', status: 'sent' },
      error: null,
    });
    const insertedSelect = vi.fn().mockReturnValue({ single: insertedSingle });
    const insert = vi.fn().mockReturnValue({ select: insertedSelect });

    const updatedDraftSingle = vi.fn().mockResolvedValue({
      data: { id: 'draft-1', status: 'sent' },
      error: null,
    });
    const updatedDraftSelect = vi.fn().mockReturnValue({ single: updatedDraftSingle });
    const updatedDraftEq = vi.fn().mockReturnValue({ select: updatedDraftSelect });
    const update = vi.fn().mockReturnValue({ eq: updatedDraftEq });

    const supabaseClient = {
      from: (table: string) => {
        if (table === 'email_outbound') {
          return { select: outboundSelectExisting, insert };
        }
        if (table === 'drafts') {
          return { select: draftSelect, update };
        }
        throw new Error(`Unexpected table ${table}`);
      },
    } as any;

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'email:record-outbound',
      '--payload',
      JSON.stringify({
        draftId: 'draft-1',
        provider: 'imap_mcp',
        providerMessageId: '<msg-1@example.com>',
        senderIdentity: 'sales-1@example.com',
        status: 'sent',
      }),
    ]);

    const payload = JSON.parse((logSpy.mock.calls.at(-1) as any[])[0] as string);
    expect(payload.outbound.id).toBe('out-1');
    expect(update).toHaveBeenCalledWith({ status: 'sent' });
    logSpy.mockRestore();
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
    const addLeadsToCampaign = vi.fn().mockResolvedValue({ message: 'ok' });
    const saveCampaignSequences = vi.fn().mockResolvedValue({ ok: true });

    const supabaseClient = {
      from: (table: string) => {
        if (table === 'campaigns') {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: { id: 'camp-1', segment_id: 'seg-1', segment_version: 1, metadata: {} },
                  error: null,
                }),
              }),
            }),
            update: () => ({
              eq: async () => ({ error: null }),
            }),
          };
        }
        if (table === 'segment_members') {
          return {
            select: () => ({
              match: () => ({
                limit: async () => ({
                  data: [{ contact_id: 'e1' }],
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'campaign_member_additions') {
          return {
            select: () => ({
              eq: async () => ({
                data: [],
                error: null,
              }),
            }),
          };
        }
        if (table === 'campaign_member_exclusions') {
          return {
            select: () => ({
              eq: async () => ({
                data: [],
                error: null,
              }),
            }),
          };
        }
        if (table === 'employees') {
          return {
            select: () => ({
              in: async () => ({
                data: [{ id: 'e1', full_name: 'Alice A', work_email: 'lead@example.com', company_name: 'Acme' }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'drafts') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  limit: async () => ({
                    data: [{ subject: 's', body: 'b' }],
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      },
    } as any;
    const client = { addLeadsToCampaign, saveCampaignSequences } as any;

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      smartleadClient: client,
    });

    await program.parseAsync([
      'node',
      'gtm',
      'smartlead:send',
      '--batch-size',
      '10',
      '--campaign-id',
      'camp-1',
      '--smartlead-campaign-id',
      'sl-1',
    ]);

    expect(addLeadsToCampaign).toHaveBeenCalled();
    expect(saveCampaignSequences).toHaveBeenCalled();
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
      '--campaign-id',
      'camp-1',
      '--smartlead-campaign-id',
      'sl-1',
      '--error-format',
      'json',
    ]);

    expect(errorSpy).toHaveBeenCalled();
    const payload = JSON.parse((errorSpy.mock.calls[0] as any)[0] as string);
    expect(payload.ok).toBe(false);
    expect(payload.error?.message).toMatch(/SMARTLEAD_(MCP_URL|API_BASE)/);

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
      match: vi.fn().mockResolvedValue({ data: [{ id: 'member-1' }], error: null, count: 1 }),
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          data: members,
          error: null,
          limit: vi.fn().mockResolvedValue({ data: members, error: null }),
        }),
      }),
    }));
    const segmentSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'seg-1', version: 1 }, error: null }),
      }),
    });
    const companyIn = vi.fn().mockResolvedValue({ data: [{ id: 'co1', company_research: null }], error: null });
    const employeeIn = vi.fn().mockResolvedValue({ data: [{ id: 'lead@example.com', ai_research_data: null }], error: null });
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
      if (table === 'companies') {
        return {
          select: vi.fn().mockReturnValue({ in: companyIn }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        };
      }
      if (table === 'employees') {
        return {
          select: vi.fn().mockReturnValue({ in: employeeIn }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
        };
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
    expect(companyIn).toHaveBeenCalled();
    expect(employeeIn).toHaveBeenCalled();
  });

  it('wires campaign:list with icp profile filter', async () => {
    const segmentsEq = vi.fn().mockResolvedValue({
      data: [{ id: 'seg-1' }],
      error: null,
    });
    const segmentsSelect = vi.fn().mockReturnValue({ eq: segmentsEq });

    const campaignsIn = vi.fn().mockResolvedValue({
      data: [{ id: 'camp-1', segment_id: 'seg-1', status: 'draft' }],
      error: null,
    });
    const campaignsOrder = vi.fn().mockReturnValue({ in: campaignsIn });
    const campaignsSelect = vi.fn().mockReturnValue({ order: campaignsOrder });

    const supabaseClient = {
      from: vi.fn((table: string) => {
        if (table === 'segments') return { select: segmentsSelect };
        if (table === 'campaigns') return { select: campaignsSelect };
        throw new Error(`Unexpected table ${table}`);
      }),
    } as any;

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync([
      'node',
      'gtm',
      'campaign:list',
      '--icp-profile-id',
      'icp-1',
      '--error-format',
      'json',
    ]);

    const payload = JSON.parse((logSpy.mock.calls[0] as any[])[0] as string);
    expect(segmentsEq).toHaveBeenCalledWith('icp_profile_id', 'icp-1');
    expect(campaignsIn).toHaveBeenCalledWith('segment_id', ['seg-1']);
    expect(payload[0].id).toBe('camp-1');
    logSpy.mockRestore();
  });

  it('wires campaign:audit and prints JSON payload', async () => {
    const campaignAudit = vi.fn().mockResolvedValue({
      campaign: {
        id: 'camp-1',
        name: 'Q1 Push',
        status: 'review',
        segment_id: 'seg-1',
        segment_version: 2,
      },
      summary: {
        company_count: 3,
        snapshot_contact_count: 7,
        contacts_with_any_draft: 6,
        contacts_with_intro_draft: 5,
        contacts_with_bump_draft: 1,
        contacts_with_sent_outbound: 4,
        contacts_with_events: 2,
        draft_count: 7,
        generated_draft_count: 1,
        approved_draft_count: 5,
        rejected_draft_count: 1,
        sent_draft_count: 1,
        sendable_draft_count: 6,
        unsendable_draft_count: 1,
        outbound_count: 4,
        outbound_sent_count: 4,
        outbound_failed_count: 0,
        outbound_missing_recipient_email_count: 0,
        event_count: 2,
        replied_event_count: 1,
        bounced_event_count: 1,
        unsubscribed_event_count: 0,
        snapshot_contacts_without_draft_count: 1,
        drafts_missing_recipient_email_count: 1,
        duplicate_draft_pair_count: 0,
        draft_company_mismatch_count: 0,
        sent_drafts_without_outbound_count: 0,
        outbounds_without_draft_count: 0,
      },
      issues: {
        snapshot_contacts_without_draft: [{ contact_id: 'contact-7' }],
        drafts_missing_recipient_email: [{ draft_id: 'draft-7' }],
        duplicate_drafts: [],
        draft_company_mismatches: [],
        sent_drafts_without_outbound: [],
        outbounds_without_draft: [],
        outbounds_missing_recipient_email: [],
      },
    });

    const program = createProgram({
      supabaseClient: { from: vi.fn() } as any,
      aiClient: {} as any,
      handlers: { campaignAudit },
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'campaign:audit',
      '--campaign-id',
      'camp-1',
      '--error-format',
      'json',
    ]);

    expect(campaignAudit).toHaveBeenCalledWith(expect.anything(), 'camp-1');
    const payload = JSON.parse((logSpy.mock.calls[0] as any[])[0] as string);
    expect(payload.summary.snapshot_contact_count).toBe(7);
    expect(payload.issues.drafts_missing_recipient_email[0].draft_id).toBe('draft-7');
    logSpy.mockRestore();
  });

  it('enrich_run_dry_run_returns_preview_with_company_limit_and_refresh_policy', async () => {
    const segmentMembersSelect = vi.fn().mockReturnValue({
      match: vi.fn().mockResolvedValue({ data: [{ id: 'member-1' }], error: null, count: 2 }),
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [
            { contact_id: 'c1', company_id: 'co1' },
            { contact_id: 'c2', company_id: 'co2' },
          ],
          error: null,
        }),
      }),
    });
    const segmentSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'seg-1', version: 2 }, error: null }),
      }),
    });
    const companyIn = vi.fn().mockResolvedValue({
      data: [
        { id: 'co1', company_research: { version: 1, providers: { exa: {} }, lastUpdatedAt: new Date().toISOString() } },
        { id: 'co2', company_research: null },
      ],
      error: null,
    });
    const employeeIn = vi.fn().mockResolvedValue({
      data: [
        { id: 'c1', ai_research_data: { version: 1, providers: { exa: {} }, lastUpdatedAt: new Date().toISOString() } },
        { id: 'c2', ai_research_data: null },
      ],
      error: null,
    });

    const from = (table: string) => {
      if (table === 'segment_members') return { select: segmentMembersSelect };
      if (table === 'segments') return { select: segmentSelect };
      if (table === 'companies') return { select: vi.fn().mockReturnValue({ in: companyIn }) };
      if (table === 'employees') return { select: vi.fn().mockReturnValue({ in: employeeIn }) };
      throw new Error(`Unexpected table ${table}`);
    };
    const supabaseClient = { from } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    await program.parseAsync([
      'node',
      'gtm',
      'enrich:run',
      '--segment-id',
      'seg-1',
      '--provider',
      'exa,firecrawl',
      '--limit',
      '1',
      '--max-age-days',
      '90',
      '--dry-run',
    ]);

    const payload = JSON.parse((logSpy.mock.calls[0] as any[])[0] as string);
    expect(payload.status).toBe('preview');
    expect(payload.providers).toEqual(['exa', 'firecrawl']);
    expect(payload.refreshPolicy).toEqual({ maxAgeDays: 90, forceRefresh: false });
    expect(payload.counts.plannedCompanyCount).toBe(1);
    logSpy.mockRestore();
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
    const insert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'icp-1' },
          error: null,
        }),
      }),
    });
    const from = vi.fn().mockReturnValue({
      insert,
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
      '--project-id',
      'project-1',
      '--offering-domain',
      'voicexpert.ru',
      '--company-criteria',
      '{"industry":"fintech"}',
    ]);

    expect(from).toHaveBeenCalledWith('icp_profiles');
    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        name: 'Fintech ICP',
        project_id: 'project-1',
        offering_domain: 'voicexpert.ru',
      }),
    ]);
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify({ id: 'icp-1' }));
    logSpy.mockRestore();
  });

  it('wires icp:hypothesis:create and prints hypothesis id', async () => {
    const insertHypotheses = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'hypo-1' },
          error: null,
        }),
      }),
    });
    const from = vi.fn((table: string) => {
      if (table === 'icp_hypotheses') {
        return {
          insert: insertHypotheses,
        };
      }
      if (table === 'icp_profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'icp-1', project_id: 'project-1' },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === 'offers') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { id: 'offer-1', project_id: 'project-1' },
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
      '--offer-id',
      'offer-1',
      '--targeting-defaults',
      '{"regions":["EU"]}',
      '--messaging-angle',
      'Negotiation room refresh',
      '--pattern-defaults',
      '{"introPattern":"standard"}',
      '--notes',
      'Use for audit waves',
      '--segment-id',
      'segment-1',
    ]);

    expect(from).toHaveBeenCalledWith('icp_hypotheses');
    expect(insertHypotheses).toHaveBeenCalledWith([
      expect.objectContaining({
        offer_id: 'offer-1',
        targeting_defaults: { regions: ['EU'] },
        messaging_angle: 'Negotiation room refresh',
        pattern_defaults: { introPattern: 'standard' },
        notes: 'Use for audit waves',
      }),
    ]);
    expect(logSpy).toHaveBeenCalledWith(JSON.stringify({ id: 'hypo-1' }));
    logSpy.mockRestore();
  });

  it('wires icp:list command and prints profiles', async () => {
    const selectProfiles = vi.fn().mockResolvedValue({
      data: [{ id: 'icp-1', name: 'ICP One', offering_domain: 'voicexpert.ru' }],
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
    await program.parseAsync(['node', 'gtm', 'icp:list']);

    expect(from).toHaveBeenCalledWith('icp_profiles');
    expect(selectProfiles).toHaveBeenCalledWith('id, name, description, offering_domain');
    const payload = JSON.parse((logSpy.mock.calls[0] as any[])[0] as string);
    expect(payload[0].id).toBe('icp-1');
    expect(payload[0].offering_domain).toBe('voicexpert.ru');
    logSpy.mockRestore();
  });

  it('handles icp:hypothesis:list errors without throwing from parseAsync', async () => {
    const selectHyp = vi.fn().mockResolvedValue({
      data: null,
      error: new Error('hypothesis list failed'),
    });
    const from = vi.fn((table: string) => {
      if (table === 'icp_hypotheses') return { select: selectHyp };
      throw new Error(`Unexpected table ${table}`);
    });
    const supabaseClient = { from } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
    });

    const originalExitCode = process.exitCode;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await program.parseAsync(['node', 'gtm', 'icp:hypothesis:list']);

    expect(errorSpy).toHaveBeenCalled();

    errorSpy.mockRestore();
    process.exitCode = originalExitCode;
  });

  it('wires icp:hypothesis:list with filters', async () => {
    const hypothesisEqById = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'hyp-1',
          icp_id: 'icp-1',
          status: 'active',
          hypothesis_label: 'Mid-market',
          search_config: {},
          created_at: '2026-03-13T10:00:00.000Z',
        },
      ],
      error: null,
    });
    const hypothesisEqByProfile = vi.fn().mockReturnValue({ eq: hypothesisEqById });
    const selectHyp = vi.fn().mockReturnValue({ eq: hypothesisEqByProfile });
    const segmentMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'seg-1', icp_hypothesis_id: 'hyp-1' },
      error: null,
    });
    const segmentEq = vi.fn().mockReturnValue({ maybeSingle: segmentMaybeSingle });
    const segmentIn = vi.fn().mockResolvedValue({
      data: [{ id: 'seg-1', icp_hypothesis_id: 'hyp-1' }],
      error: null,
    });
    const segmentSelect = vi.fn().mockReturnValue({ eq: segmentEq, in: segmentIn });
    const from = vi.fn((table: string) => {
      if (table === 'icp_hypotheses') return { select: selectHyp };
      if (table === 'segments') return { select: segmentSelect };
      throw new Error(`Unexpected table ${table}`);
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
      'icp:hypothesis:list',
      '--icp-profile-id',
      'icp-1',
      '--segment-id',
      'seg-1',
      '--columns',
      'id,icp_profile_id,segment_id',
    ]);

    expect(from).toHaveBeenCalledWith('icp_hypotheses');
    const payload = JSON.parse((logSpy.mock.calls[0] as any[])[0] as string);
    expect(payload[0].id).toBe('hyp-1');
    expect(payload[0].icp_profile_id).toBe('icp-1');
    expect(payload[0].segment_id).toBe('seg-1');
    logSpy.mockRestore();
  });

  it('cli_icp_coach_profile_calls_orchestrator_and_prints_json', async () => {
    const profilesInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'icp-1', name: 'ICP' },
          error: null,
        }),
      }),
    });
    const jobsInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'job-1', type: 'icp', status: 'created', result: {} },
          error: null,
        }),
      }),
    });
    const jobsUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'job-1', status: 'completed', result: {} },
            error: null,
          }),
        }),
      }),
    });
    const from = vi.fn((table: string) => {
      if (table === 'icp_profiles') {
        return { insert: profilesInsert };
      }
      if (table === 'jobs') {
        return {
          insert: jobsInsert,
          update: jobsUpdate,
        };
      }
      return {
        insert: vi.fn(),
        update: vi.fn(),
      };
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

    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true as any);
    await program.parseAsync([
      'node',
      'gtm',
      'icp:coach:profile',
      '--name',
      'ICP',
      '--offering-domain',
      'voicexpert.ru',
    ]);

    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    expect(profilesInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        offering_domain: 'voicexpert.ru',
      }),
    ]);
    const printed = (stdoutSpy.mock.calls[0] as any[])[0] as string;
    const parsed = JSON.parse(printed);
    expect(parsed).toHaveProperty('jobId');
    expect(parsed).toHaveProperty('profileId', 'icp-1');
    stdoutSpy.mockRestore();
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

    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true as any);
    await program.parseAsync([
      'node',
      'gtm',
      'icp:coach:hypothesis',
      '--icp-profile-id',
      'icp-1',
    ]);

    expect(stdoutSpy).toHaveBeenCalledTimes(1);
    const printed = (stdoutSpy.mock.calls[0] as any[])[0] as string;
    const parsed = JSON.parse(printed);
    expect(parsed).toHaveProperty('jobId', 'job-2');
    expect(parsed).toHaveProperty('hypothesisId', 'hypo-1');
    stdoutSpy.mockRestore();
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

  it('analytics:summary emits JSON error when error-format=json', async () => {
    const selectAnalytics = vi.fn().mockRejectedValue(new Error('analytics failed'));
    const gte = vi.fn().mockReturnValue({ select: selectAnalytics });
    const from = vi.fn((table: string) => {
      if (table === 'analytics_events_flat') return { select: selectAnalytics, gte };
      return { select: vi.fn() };
    });
    const supabaseClient = { from } as any;

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      smartleadClient: {} as any,
    });

    const originalExitCode = process.exitCode;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'analytics:summary',
      '--group-by',
      'pattern',
      '--error-format',
      'json',
    ]);

    expect(errorSpy).toHaveBeenCalled();
    const payload = JSON.parse((errorSpy.mock.calls[0] as any[])[0] as string);
    expect(payload.ok).toBe(false);
    expect(payload.error?.message).toMatch(/analytics failed/i);

    errorSpy.mockRestore();
    process.exitCode = originalExitCode;
  });

  it('campaign:audit emits JSON error when error-format=json', async () => {
    const campaignAudit = vi.fn().mockRejectedValue(new Error('audit failed'));
    const program = createProgram({
      supabaseClient: { from: vi.fn() } as any,
      aiClient: {} as any,
      handlers: { campaignAudit },
    });

    const originalExitCode = process.exitCode;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'campaign:audit',
      '--campaign-id',
      'camp-err',
      '--error-format',
      'json',
    ]);

    expect(errorSpy).toHaveBeenCalled();
    const payload = JSON.parse((errorSpy.mock.calls[0] as any[])[0] as string);
    expect(payload.ok).toBe(false);
    expect(payload.error?.message).toMatch(/audit failed/i);

    errorSpy.mockRestore();
    process.exitCode = originalExitCode;
  });

  it('analytics:optimize emits JSON error when error-format=json', async () => {
    const selectAnalytics = vi.fn().mockRejectedValue(new Error('optimize failed'));
    const gte = vi.fn().mockReturnValue({ select: selectAnalytics });
    const from = vi.fn((table: string) => {
      if (table === 'analytics_events_flat') return { select: selectAnalytics, gte };
      if (table === 'jobs') {
        return { select: vi.fn() };
      }
      return { select: vi.fn() };
    });
    const supabaseClient = { from } as any;

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      smartleadClient: {} as any,
    });

    const originalExitCode = process.exitCode;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await program.parseAsync(['node', 'gtm', 'analytics:optimize', '--error-format', 'json']);

    expect(errorSpy).toHaveBeenCalled();
    const payload = JSON.parse((errorSpy.mock.calls[0] as any[])[0] as string);
    expect(payload.ok).toBe(false);
    expect(payload.error?.message).toMatch(/optimize failed/i);

    errorSpy.mockRestore();
    process.exitCode = originalExitCode;
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

  it('wires campaign:mailbox-assignment:get', async () => {
    const getCampaignMailboxAssignment = vi.fn().mockResolvedValue({
      campaignId: 'camp-1',
      assignments: [
        {
          id: 'a-1',
          mailboxAccountId: 'mbox-1',
          senderIdentity: 'sales@acme.ai',
          provider: 'imap_mcp',
          source: 'outreacher',
          assignedAt: '2026-03-19T10:00:00Z',
          metadata: null,
        },
      ],
      summary: {
        assignmentCount: 1,
        mailboxAccountCount: 1,
        senderIdentityCount: 1,
        domainCount: 1,
        domains: ['acme.ai'],
      },
    });
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      handlers: { getCampaignMailboxAssignment } as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'campaign:mailbox-assignment:get',
      '--campaign-id',
      'camp-1',
      '--error-format',
      'json',
    ]);

    expect(getCampaignMailboxAssignment).toHaveBeenCalledWith(supabaseClient, 'camp-1');
    const payload = JSON.parse((logSpy.mock.calls.at(-1) as any[])[0] as string);
    expect(payload.summary.assignmentCount).toBe(1);
    logSpy.mockRestore();
  });

  it('wires campaign:mailbox-assignment:put', async () => {
    const replaceCampaignMailboxAssignment = vi.fn().mockResolvedValue({
      campaignId: 'camp-1',
      assignments: [
        {
          id: 'a-1',
          mailboxAccountId: 'mbox-1',
          senderIdentity: 'sales@acme.ai',
          provider: 'imap_mcp',
          source: 'outreacher',
          assignedAt: '2026-03-19T10:00:00Z',
          metadata: null,
        },
      ],
      summary: {
        assignmentCount: 1,
        mailboxAccountCount: 1,
        senderIdentityCount: 1,
        domainCount: 1,
        domains: ['acme.ai'],
      },
    });
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      handlers: { replaceCampaignMailboxAssignment } as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'campaign:mailbox-assignment:put',
      '--campaign-id',
      'camp-1',
      '--payload',
      JSON.stringify({
        assignments: [
          {
            mailboxAccountId: 'mbox-1',
            senderIdentity: 'sales@acme.ai',
            provider: 'imap_mcp',
          },
        ],
        source: 'outreacher',
      }),
      '--error-format',
      'json',
    ]);

    expect(replaceCampaignMailboxAssignment).toHaveBeenCalledWith(supabaseClient, {
      campaignId: 'camp-1',
      assignments: [
        {
          mailboxAccountId: 'mbox-1',
          senderIdentity: 'sales@acme.ai',
          provider: 'imap_mcp',
        },
      ],
      source: 'outreacher',
    });
    const payload = JSON.parse((logSpy.mock.calls.at(-1) as any[])[0] as string);
    expect(payload.summary.assignmentCount).toBe(1);
    logSpy.mockRestore();
  });

  it('wires campaign:send-preflight', async () => {
    const campaignSendPreflight = vi.fn().mockResolvedValue({
      campaign: {
        id: 'camp-1',
        name: 'Q2 Send',
        status: 'ready',
        segment_id: 'seg-1',
        segment_version: 1,
      },
      readyToSend: true,
      blockers: [],
      summary: {
        mailboxAssignmentCount: 1,
        draftCount: 5,
        approvedDraftCount: 5,
        generatedDraftCount: 0,
        rejectedDraftCount: 0,
        sentDraftCount: 0,
        sendableApprovedDraftCount: 5,
        approvedMissingRecipientEmailCount: 0,
      },
      senderPlan: {
        assignmentCount: 1,
        mailboxAccountCount: 1,
        senderIdentityCount: 1,
        domainCount: 1,
        domains: ['acme.ai'],
      },
    });
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      handlers: { campaignSendPreflight } as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'campaign:send-preflight',
      '--campaign-id',
      'camp-1',
      '--error-format',
      'json',
    ]);

    expect(campaignSendPreflight).toHaveBeenCalledWith(supabaseClient, 'camp-1');
    const payload = JSON.parse((logSpy.mock.calls.at(-1) as any[])[0] as string);
    expect(payload.readyToSend).toBe(true);
    logSpy.mockRestore();
  });

  it('campaign:send-preflight emits JSON error when error-format=json', async () => {
    const campaignSendPreflight = vi.fn().mockRejectedValue(new Error('preflight failed'));
    const program = createProgram({
      supabaseClient: { from: vi.fn() } as any,
      aiClient: {} as any,
      handlers: { campaignSendPreflight } as any,
    });

    const originalExitCode = process.exitCode;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'campaign:send-preflight',
      '--campaign-id',
      'camp-err',
      '--error-format',
      'json',
    ]);

    expect(errorSpy).toHaveBeenCalled();
    const payload = JSON.parse((errorSpy.mock.calls[0] as any[])[0] as string);
    expect(payload.ok).toBe(false);
    expect(payload.error?.message).toMatch(/preflight failed/i);

    errorSpy.mockRestore();
    process.exitCode = originalExitCode;
  });

  it('wires campaign:auto-send:get', async () => {
    const campaignAutoSendGet = vi.fn().mockResolvedValue({
      campaignId: 'camp-1',
      campaignName: 'Auto Send Campaign',
      campaignStatus: 'review',
      autoSendIntro: true,
      autoSendBump: false,
      bumpMinDaysSinceIntro: 3,
      updatedAt: '2026-03-21T10:00:00Z',
    });
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      handlers: { campaignAutoSendGet } as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'campaign:auto-send:get',
      '--campaign-id',
      'camp-1',
      '--error-format',
      'json',
    ]);

    expect(campaignAutoSendGet).toHaveBeenCalledWith(supabaseClient, 'camp-1');
    const payload = JSON.parse((logSpy.mock.calls.at(-1) as any[])[0] as string);
    expect(payload.autoSendIntro).toBe(true);
    logSpy.mockRestore();
  });

  it('wires campaign:auto-send:put', async () => {
    const campaignAutoSendPut = vi.fn().mockResolvedValue({
      campaignId: 'camp-1',
      campaignName: 'Auto Send Campaign',
      campaignStatus: 'review',
      autoSendIntro: true,
      autoSendBump: true,
      bumpMinDaysSinceIntro: 5,
      updatedAt: '2026-03-21T10:00:00Z',
    });
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      handlers: { campaignAutoSendPut } as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'campaign:auto-send:put',
      '--campaign-id',
      'camp-1',
      '--payload',
      JSON.stringify({
        autoSendIntro: true,
        autoSendBump: true,
        bumpMinDaysSinceIntro: 5,
      }),
      '--error-format',
      'json',
    ]);

    expect(campaignAutoSendPut).toHaveBeenCalledWith(supabaseClient, {
      campaignId: 'camp-1',
      autoSendIntro: true,
      autoSendBump: true,
      bumpMinDaysSinceIntro: 5,
    });
    const payload = JSON.parse((logSpy.mock.calls.at(-1) as any[])[0] as string);
    expect(payload.autoSendBump).toBe(true);
    logSpy.mockRestore();
  });

  it('wires campaign:send-policy:get', async () => {
    const campaignSendPolicyGet = vi.fn().mockResolvedValue({
      campaignId: 'camp-1',
      campaignName: 'EMEA Campaign',
      campaignStatus: 'review',
      sendTimezone: 'Europe/Berlin',
      sendWindowStartHour: 8,
      sendWindowEndHour: 16,
      sendWeekdaysOnly: true,
      updatedAt: '2026-03-21T12:00:00Z',
    });
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      handlers: { campaignSendPolicyGet } as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'campaign:send-policy:get',
      '--campaign-id',
      'camp-1',
      '--error-format',
      'json',
    ]);

    expect(campaignSendPolicyGet).toHaveBeenCalledWith(supabaseClient, 'camp-1');
    const payload = JSON.parse((logSpy.mock.calls.at(-1) as any[])[0] as string);
    expect(payload.sendTimezone).toBe('Europe/Berlin');
    logSpy.mockRestore();
  });

  it('wires campaign:send-policy:put', async () => {
    const campaignSendPolicyPut = vi.fn().mockResolvedValue({
      campaignId: 'camp-1',
      campaignName: 'EMEA Campaign',
      campaignStatus: 'review',
      sendTimezone: 'America/New_York',
      sendWindowStartHour: 9,
      sendWindowEndHour: 17,
      sendWeekdaysOnly: false,
      updatedAt: '2026-03-21T12:10:00Z',
    });
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      handlers: { campaignSendPolicyPut } as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'campaign:send-policy:put',
      '--campaign-id',
      'camp-1',
      '--payload',
      JSON.stringify({
        sendTimezone: 'America/New_York',
        sendWindowStartHour: 9,
        sendWindowEndHour: 17,
        sendWeekdaysOnly: false,
      }),
      '--error-format',
      'json',
    ]);

    expect(campaignSendPolicyPut).toHaveBeenCalledWith(supabaseClient, {
      campaignId: 'camp-1',
      sendTimezone: 'America/New_York',
      sendWindowStartHour: 9,
      sendWindowEndHour: 17,
      sendWeekdaysOnly: false,
    });
    const payload = JSON.parse((logSpy.mock.calls.at(-1) as any[])[0] as string);
    expect(payload.sendWeekdaysOnly).toBe(false);
    logSpy.mockRestore();
  });

  it('wires campaign:launch:preview', async () => {
    const campaignLaunchPreview = vi.fn().mockResolvedValue({
      ok: true,
      campaign: {
        name: 'Launch Q2',
        status: 'draft',
      },
      segment: {
        id: 'seg-1',
        version: 1,
        snapshotStatus: 'existing',
      },
      summary: {
        companyCount: 2,
        contactCount: 3,
        sendableContactCount: 2,
        freshCompanyCount: 1,
        staleCompanyCount: 0,
        missingCompanyCount: 1,
        senderAssignmentCount: 1,
      },
      senderPlan: {
        assignmentCount: 1,
        mailboxAccountCount: 1,
        senderIdentityCount: 1,
        domainCount: 1,
        domains: ['voicexpertout.ru'],
      },
      warnings: [],
    });
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      handlers: { campaignLaunchPreview } as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'campaign:launch:preview',
      '--payload',
      JSON.stringify({
        name: 'Launch Q2',
        segmentId: 'seg-1',
        segmentVersion: 1,
        snapshotMode: 'reuse',
      }),
      '--error-format',
      'json',
    ]);

    expect(campaignLaunchPreview).toHaveBeenCalledWith(supabaseClient, {
      name: 'Launch Q2',
      segmentId: 'seg-1',
      segmentVersion: 1,
      snapshotMode: 'reuse',
    });
    const payload = JSON.parse((logSpy.mock.calls.at(-1) as any[])[0] as string);
    expect(payload.ok).toBe(true);
    expect(payload.segment.snapshotStatus).toBe('existing');
    logSpy.mockRestore();
  });

  it('campaign:launch:preview emits JSON error when payload is invalid', async () => {
    const program = createProgram({
      supabaseClient: { from: vi.fn() } as any,
      aiClient: {} as any,
    });

    const originalExitCode = process.exitCode;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'campaign:launch:preview',
      '--payload',
      'not-json',
      '--error-format',
      'json',
    ]);

    expect(errorSpy).toHaveBeenCalled();
    const payload = JSON.parse((errorSpy.mock.calls[0] as any[])[0] as string);
    expect(payload.ok).toBe(false);
    expect(payload.error?.code).toBe('INVALID_JSON');
    expect(payload.error?.message).toMatch(/payload is not valid json/i);

    errorSpy.mockRestore();
    process.exitCode = originalExitCode;
  });

  it('wires campaign:launch', async () => {
    const campaignLaunch = vi.fn().mockResolvedValue({
      campaign: {
        id: 'camp-9',
        name: 'Launch Q2',
        status: 'draft',
      },
      segment: {
        id: 'seg-1',
        version: 3,
        snapshot: {
          version: 3,
          count: 120,
        },
      },
      senderPlan: {
        assignments: [],
        summary: {
          assignmentCount: 0,
          mailboxAccountCount: 0,
          senderIdentityCount: 0,
          domainCount: 0,
          domains: [],
        },
      },
    });
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      handlers: { campaignLaunch } as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'campaign:launch',
      '--payload',
      JSON.stringify({
        name: 'Launch Q2',
        segmentId: 'seg-1',
        segmentVersion: 1,
        snapshotMode: 'reuse',
      }),
      '--error-format',
      'json',
    ]);

    expect(campaignLaunch).toHaveBeenCalledWith(supabaseClient, {
      name: 'Launch Q2',
      segmentId: 'seg-1',
      segmentVersion: 1,
      snapshotMode: 'reuse',
    });
    const payload = JSON.parse((logSpy.mock.calls.at(-1) as any[])[0] as string);
    expect(payload.campaign.id).toBe('camp-9');
    expect(payload.segment.version).toBe(3);
    logSpy.mockRestore();
  });

  it('campaign:launch emits JSON error when payload is invalid', async () => {
    const program = createProgram({
      supabaseClient: { from: vi.fn() } as any,
      aiClient: {} as any,
    });

    const originalExitCode = process.exitCode;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'campaign:launch',
      '--payload',
      'not-json',
      '--error-format',
      'json',
    ]);

    expect(errorSpy).toHaveBeenCalled();
    const payload = JSON.parse((errorSpy.mock.calls[0] as any[])[0] as string);
    expect(payload.ok).toBe(false);
    expect(payload.error?.code).toBe('INVALID_JSON');
    expect(payload.error?.message).toMatch(/payload is not valid json/i);

    errorSpy.mockRestore();
    process.exitCode = originalExitCode;
  });

  it('wires campaign:next-wave:preview', async () => {
    const campaignNextWavePreview = vi.fn().mockResolvedValue({
      sourceCampaign: { id: 'camp-1', name: 'Wave 1' },
      defaults: {
        targetSegmentId: 'seg-1',
        targetSegmentVersion: 1,
        offerId: 'offer-1',
        icpHypothesisId: 'hyp-1',
        sendPolicy: {
          sendTimezone: 'Europe/Moscow',
          sendWindowStartHour: 9,
          sendWindowEndHour: 17,
          sendWeekdaysOnly: true,
        },
        senderPlanSummary: {
          assignmentCount: 1,
          mailboxAccountCount: 1,
          senderIdentityCount: 1,
          domainCount: 1,
          domains: ['example.com'],
        },
      },
      summary: {
        candidateContactCount: 5,
        eligibleContactCount: 2,
        blockedContactCount: 3,
      },
      blockedBreakdown: {
        suppressed_contact: 1,
        already_contacted_recently: 1,
        no_sendable_email: 1,
        already_in_target_wave: 0,
        already_used_in_source_wave: 0,
      },
      items: [],
    });
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      handlers: { campaignNextWavePreview } as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'campaign:next-wave:preview',
      '--campaign-id',
      'camp-1',
      '--error-format',
      'json',
    ]);

    expect(campaignNextWavePreview).toHaveBeenCalledWith(supabaseClient, {
      sourceCampaignId: 'camp-1',
    });
    const payload = JSON.parse((logSpy.mock.calls.at(-1) as any[])[0] as string);
    expect(payload.summary.candidateContactCount).toBe(5);
    logSpy.mockRestore();
  });

  it('wires campaign:next-wave:create', async () => {
    const campaignNextWaveCreate = vi.fn().mockResolvedValue({
      campaign: {
        id: 'camp-next',
        name: 'Wave 2',
        status: 'draft',
      },
      sourceCampaign: { id: 'camp-1', name: 'Wave 1' },
      defaults: {
        targetSegmentId: 'seg-1',
        targetSegmentVersion: 1,
        offerId: 'offer-1',
        icpHypothesisId: 'hyp-1',
        sendPolicy: {
          sendTimezone: 'Europe/Moscow',
          sendWindowStartHour: 9,
          sendWindowEndHour: 17,
          sendWeekdaysOnly: true,
        },
        senderPlanSummary: {
          assignmentCount: 1,
          mailboxAccountCount: 1,
          senderIdentityCount: 1,
          domainCount: 1,
          domains: ['example.com'],
        },
      },
      senderPlan: {
        assignments: [],
        summary: {
          assignmentCount: 0,
          mailboxAccountCount: 0,
          senderIdentityCount: 0,
          domainCount: 0,
          domains: [],
        },
      },
      sendPolicy: {
        sendTimezone: 'Europe/Moscow',
        sendWindowStartHour: 9,
        sendWindowEndHour: 17,
        sendWeekdaysOnly: true,
      },
      summary: {
        candidateContactCount: 5,
        eligibleContactCount: 2,
        blockedContactCount: 3,
      },
      blockedBreakdown: {
        suppressed_contact: 1,
        already_contacted_recently: 1,
        no_sendable_email: 1,
        already_in_target_wave: 0,
        already_used_in_source_wave: 0,
      },
      items: [],
    });
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      handlers: { campaignNextWaveCreate } as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'campaign:next-wave:create',
      '--payload',
      JSON.stringify({
        sourceCampaignId: 'camp-1',
        name: 'Wave 2',
      }),
      '--error-format',
      'json',
    ]);

    expect(campaignNextWaveCreate).toHaveBeenCalledWith(supabaseClient, {
      sourceCampaignId: 'camp-1',
      name: 'Wave 2',
    });
    const payload = JSON.parse((logSpy.mock.calls.at(-1) as any[])[0] as string);
    expect(payload.campaign.id).toBe('camp-next');
    logSpy.mockRestore();
  });

  it('wires campaign:rotation:preview', async () => {
    const campaignRotationPreview = vi.fn().mockResolvedValue({
      sourceCampaign: {
        campaignId: 'camp-1',
        campaignName: 'Wave 1',
        offerId: 'offer-1',
        offerTitle: 'Offer 1',
        icpHypothesisId: 'hyp-1',
        icpHypothesisLabel: 'Hypothesis 1',
        icpProfileId: 'icp-1',
        icpProfileName: 'ICP 1',
      },
      summary: {
        sourceContactCount: 5,
        candidateCount: 2,
        eligibleCandidateContactCount: 3,
        blockedCandidateContactCount: 7,
      },
      candidates: [],
      contacts: [],
    });
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      handlers: { campaignRotationPreview } as any,
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await program.parseAsync([
      'node',
      'gtm',
      'campaign:rotation:preview',
      '--campaign-id',
      'camp-1',
      '--error-format',
      'json',
    ]);

    expect(campaignRotationPreview).toHaveBeenCalledWith(supabaseClient, {
      sourceCampaignId: 'camp-1',
    });
    const payload = JSON.parse((logSpy.mock.calls.at(-1) as any[])[0] as string);
    expect(payload.summary.candidateCount).toBe(2);
    logSpy.mockRestore();
  });
});
