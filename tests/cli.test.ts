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

  it('wires the segment:snapshot command', async () => {
    const snapshotHandler = vi.fn();
    const program = createProgram({
      supabaseClient: {} as any,
      aiClient: {} as any,
      handlers: {
        segmentCreate: vi.fn(),
        campaignCreate: vi.fn(),
        draftGenerate: vi.fn(),
        segmentSnapshot: snapshotHandler,
      } as any,
    });

    await program.parseAsync([
      'node',
      'gtm',
      'segment:snapshot',
      '--segment-id',
      'segment-1',
    ]);

    expect(snapshotHandler).toHaveBeenCalledWith({}, { segmentId: 'segment-1', segmentVersion: undefined });
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
    });
  });
});
