import { describe, expect, it, vi } from 'vitest';

import { createProgram } from '../src/cli';

describe('createProgram', () => {
  it('wires the segment:create command to handler with parsed options', async () => {
    const segmentHandler = vi.fn().mockResolvedValue({ id: 'segment' });
    const program = createProgram({
      supabaseClient: {} as any,
      aiClient: {} as any,
      handlers: {
        segmentCreate: segmentHandler,
        campaignCreate: vi.fn(),
        draftGenerate: vi.fn(),
      },
    });

    await program.parseAsync([
      'node',
      'gtm',
      'segment:create',
      '--name',
      'Fintech',
      '--locale',
      'en',
      '--filter',
      '{"role":"CTO"}',
    ]);

    expect(segmentHandler).toHaveBeenCalledWith({}, {
      name: 'Fintech',
      locale: 'en',
      filter: '{"role":"CTO"}',
      description: undefined,
      createdBy: undefined,
    });
  });

  it('wires the segment:snapshot command with guardrail flags', async () => {
    const snapshotHandler = vi.fn();
    const program = createProgram({
      supabaseClient: {} as any,
      aiClient: {} as any,
      handlers: {
        segmentCreate: vi.fn(),
        campaignCreate: vi.fn(),
        draftGenerate: vi.fn(),
        segmentSnapshot: snapshotHandler,
        campaignUpdate: vi.fn(),
      } as any,
    });

    await program.parseAsync([
      'node',
      'gtm',
      'segment:snapshot',
      '--segment-id',
      'segment-1',
      '--allow-empty',
      '--max-contacts',
      '1000',
      '--force-version',
    ]);

    expect(snapshotHandler).toHaveBeenCalledWith({}, {
      segmentId: 'segment-1',
      segmentVersion: undefined,
      allowEmpty: true,
      maxContacts: 1000,
      forceVersion: true,
    });
  });

  it('passes snapshot options to campaign:create handler', async () => {
    const campaignHandler = vi.fn();
    const program = createProgram({
      supabaseClient: {} as any,
      aiClient: {} as any,
      handlers: {
        segmentCreate: vi.fn(),
        campaignCreate: campaignHandler,
        draftGenerate: vi.fn(),
        segmentSnapshot: vi.fn(),
        campaignUpdate: vi.fn(),
      },
    });

    await program.parseAsync([
      'node',
      'gtm',
      'campaign:create',
      '--name',
      'test',
      '--segment-id',
      'seg-1',
      '--segment-version',
      '2',
      '--snapshot-mode',
      'refresh',
      '--bump-segment-version',
      '--max-contacts',
      '500',
      '--force-version',
    ]);

    expect(campaignHandler).toHaveBeenCalledWith({}, {
      name: 'test',
      segmentId: 'seg-1',
      segmentVersion: 2,
      schedule: undefined,
      throttle: undefined,
      createdBy: undefined,
      interactionMode: undefined,
      dataQualityMode: undefined,
      snapshotMode: 'refresh',
      bumpSegmentVersion: true,
      allowEmpty: false,
      maxContacts: 500,
      forceVersion: true,
    });
  });

  it('wires the campaign:update command with allowed fields only', async () => {
    const campaignUpdateHandler = vi.fn();
    const program = createProgram({
      supabaseClient: {} as any,
      aiClient: {} as any,
      handlers: {
        segmentCreate: vi.fn(),
        campaignCreate: vi.fn(),
        draftGenerate: vi.fn(),
        segmentSnapshot: vi.fn(),
        campaignUpdate: campaignUpdateHandler,
      },
    });

    await program.parseAsync([
      'node',
      'gtm',
      'campaign:update',
      '--campaign-id',
      'camp-1',
      '--prompt-pack-id',
      'prompt-2',
      '--schedule',
      '{"cron":"0 9 * * *"}',
      '--throttle',
      '{"per_hour":100}',
    ]);

    expect(campaignUpdateHandler).toHaveBeenCalledWith({}, {
      campaignId: 'camp-1',
      promptPackId: 'prompt-2',
      schedule: '{"cron":"0 9 * * *"}',
      throttle: '{"per_hour":100}',
    });
  });

  it('wires the filters:validate command and prints JSON', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const program = createProgram({
      supabaseClient: {} as any,
      aiClient: {} as any,
      handlers: {},
    });

    await program.parseAsync([
      'node',
      'gtm',
      'filters:validate',
      '--filter',
      '[{"field":"employees.role","operator":"eq","value":"CTO"}]',
    ]);

    expect(consoleSpy).toHaveBeenCalledWith(
      JSON.stringify({ ok: true, filters: [{ field: 'employees.role', op: 'eq', value: 'CTO' }] })
    );
    consoleSpy.mockRestore();
  });
});
