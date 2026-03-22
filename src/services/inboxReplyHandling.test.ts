import { describe, expect, it, vi } from 'vitest';

import { markInboxReplyHandled, markInboxReplyUnhandled } from './inboxReplyHandling.js';

describe('inboxReplyHandling', () => {
  it('marks inbox reply handled', async () => {
    const maybeSingle = vi.fn(async () => ({
      data: {
        id: 'evt-1',
        handled_at: '2026-03-18T22:00:00.000Z',
        handled_by: 'operator',
      },
      error: null,
    }));
    const select = vi.fn(() => ({ maybeSingle }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ update }));
    const client = { from } as any;

    const result = await markInboxReplyHandled(client, { replyId: 'evt-1', handledBy: 'operator' });

    expect(from).toHaveBeenCalledWith('email_events');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        handled_by: 'operator',
      })
    );
    expect(eq).toHaveBeenCalledWith('id', 'evt-1');
    expect(result).toEqual({
      id: 'evt-1',
      handled: true,
      handled_at: '2026-03-18T22:00:00.000Z',
      handled_by: 'operator',
    });
  });

  it('marks inbox reply unhandled', async () => {
    const maybeSingle = vi.fn(async () => ({
      data: {
        id: 'evt-1',
        handled_at: null,
        handled_by: null,
      },
      error: null,
    }));
    const select = vi.fn(() => ({ maybeSingle }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ update }));
    const client = { from } as any;

    const result = await markInboxReplyUnhandled(client, 'evt-1');

    expect(update).toHaveBeenCalledWith({
      handled_at: null,
      handled_by: null,
    });
    expect(result).toEqual({
      id: 'evt-1',
      handled: false,
      handled_at: null,
      handled_by: null,
    });
  });

  it('throws 404 when reply does not exist', async () => {
    const maybeSingle = vi.fn(async () => ({ data: null, error: null }));
    const select = vi.fn(() => ({ maybeSingle }));
    const eq = vi.fn(() => ({ select }));
    const update = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ update }));
    const client = { from } as any;

    await expect(markInboxReplyHandled(client, { replyId: 'missing' })).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
