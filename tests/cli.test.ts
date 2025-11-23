import { describe, expect, it, vi } from 'vitest';

import { createProgram } from '../src/cli';

describe('createProgram', () => {
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
});
