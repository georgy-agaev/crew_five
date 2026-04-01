import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  closeSharedImapMcpInboxTransport,
  createImapMcpInboxTransport,
  getSharedImapMcpInboxTransport,
  isImapMcpInboxConfigured,
} from './imapMcpInboxTransport.js';
import { imapMcpTransportInternals } from './imapMcpTransportManager.js';

describe('imapMcpInboxTransport', () => {
  afterEach(() => {
    delete process.env.IMAP_MCP_SERVER_ROOT;
    delete process.env.IMAP_MCP_HOME;
    delete process.env.IMAP_MCP_SERVER_COMMAND;
    delete process.env.IMAP_MCP_SERVER_ENTRY;
    void closeSharedImapMcpInboxTransport();
    vi.restoreAllMocks();
  });

  it('detects whether direct imap-mcp inbox is configured', () => {
    expect(isImapMcpInboxConfigured()).toBe(false);

    process.env.IMAP_MCP_SERVER_ROOT = '/opt/imap';
    process.env.IMAP_MCP_HOME = '/state/imap';

    expect(isImapMcpInboxConfigured()).toBe(true);
  });

  it('calls inbox tools and normalizes their payloads', async () => {
    process.env.IMAP_MCP_SERVER_ROOT = '/opt/imap';
    process.env.IMAP_MCP_HOME = '/state/imap';

    const callTool = vi
      .fn()
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({ success: true, accountId: 'mbox-1' }) }],
      })
      .mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              messages: [
                {
                  uid: 10,
                  date: '2026-03-24T10:00:00Z',
                  from: 'Buyer <buyer@example.com>',
                  to: ['sales@example.com'],
                  subject: 'Re: Hello',
                  messageId: '<msg-2@example.com>',
                  inReplyTo: '<msg-1@example.com>',
                  flags: ['\\Seen'],
                },
              ],
            }),
          },
        ],
      })
      .mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              email: {
                uid: 10,
                date: '2026-03-24T10:00:00Z',
                from: 'Buyer <buyer@example.com>',
                to: ['sales@example.com'],
                subject: 'Re: Hello',
                messageId: '<msg-2@example.com>',
                inReplyTo: '<msg-1@example.com>',
                flags: ['\\Seen'],
                textContent: 'Interested',
              },
            }),
          },
        ],
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({ success: true }) }],
      });

    const close = vi.fn(async () => undefined);
    vi.spyOn(imapMcpTransportInternals, 'connectClient').mockResolvedValue({
      callTool,
      close,
    });

    const transport = await createImapMcpInboxTransport();
    const messages = await transport.searchUnread({
      accountId: 'mbox-1',
      sinceDate: '2026-03-24',
      limit: 25,
    });
    const content = await transport.getEmail({ accountId: 'mbox-1', uid: 10 });
    await transport.markAsRead({ accountId: 'mbox-1', uid: 10 });

    expect(callTool).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        name: 'imap_connect',
        arguments: { accountId: 'mbox-1' },
      })
    );
    expect(callTool).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        name: 'imap_search_emails',
        arguments: expect.objectContaining({
          accountId: 'mbox-1',
          folder: 'INBOX',
          seen: false,
          since: '2026-03-24',
          limit: 25,
        }),
      })
    );
    expect(messages[0]).toMatchObject({
      uid: 10,
      subject: 'Re: Hello',
      inReplyTo: '<msg-1@example.com>',
    });
    expect(content).toMatchObject({
      uid: 10,
      textContent: 'Interested',
    });
    expect(callTool).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        name: 'imap_mark_as_read',
        arguments: { accountId: 'mbox-1', folder: 'INBOX', uid: 10 },
      })
    );

    await transport.close();
    expect(close).toHaveBeenCalled();
  });

  it('parses inbox tool payloads when mcp adds banner text around the json body', async () => {
    process.env.IMAP_MCP_SERVER_ROOT = '/opt/imap';
    process.env.IMAP_MCP_HOME = '/state/imap';

    const callTool = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ success: true, accountId: 'mbox-1' }) }],
    });

    callTool
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({ success: true, accountId: 'mbox-1' }) }],
      })
      .mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: `IMAP MCP Server started\n${JSON.stringify({
              messages: [
                {
                  uid: 11,
                  date: '2026-03-24T11:00:00Z',
                  from: 'Buyer <buyer@example.com>',
                  to: ['sales@example.com'],
                  subject: 'Re: Banner',
                  messageId: '<msg-3@example.com>',
                  inReplyTo: '<msg-2@example.com>',
                  flags: [],
                },
              ],
            })}`,
          },
        ],
      });

    vi.spyOn(imapMcpTransportInternals, 'connectClient').mockResolvedValue({
      callTool,
      close: vi.fn(async () => undefined),
    });

    const transport = await createImapMcpInboxTransport();
    const messages = await transport.searchUnread({
      accountId: 'mbox-1',
      sinceDate: '2026-03-24',
      limit: 25,
    });

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      uid: 11,
      subject: 'Re: Banner',
      inReplyTo: '<msg-2@example.com>',
    });
    expect(callTool).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ name: 'imap_connect', arguments: { accountId: 'mbox-1' } })
    );
  });

  it('surfaces tool error text when imap-mcp reports mailbox configuration problems', async () => {
    process.env.IMAP_MCP_SERVER_ROOT = '/opt/imap';
    process.env.IMAP_MCP_HOME = '/state/imap';

    vi.spyOn(imapMcpTransportInternals, 'connectClient').mockResolvedValue({
      callTool: vi.fn().mockResolvedValue({
        isError: true,
        content: [
          {
            type: 'text',
            text: 'No connection configured for account mbox-1',
          },
        ],
      }),
      close: vi.fn(async () => undefined),
    });

    const transport = await createImapMcpInboxTransport();

    await expect(
      transport.searchUnread({
        accountId: 'mbox-1',
        sinceDate: '2026-03-24',
        limit: 25,
      })
    ).rejects.toThrow('imap-mcp error: No connection configured for account mbox-1');
  });

  it('connects only once per account for repeated inbox operations', async () => {
    process.env.IMAP_MCP_SERVER_ROOT = '/opt/imap';
    process.env.IMAP_MCP_HOME = '/state/imap';

    const callTool = vi
      .fn()
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({ success: true, accountId: 'mbox-1' }) }],
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({ messages: [] }) }],
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({ messages: [] }) }],
      });

    vi.spyOn(imapMcpTransportInternals, 'connectClient').mockResolvedValue({
      callTool,
      close: vi.fn(async () => undefined),
    });

    const transport = await createImapMcpInboxTransport();
    await transport.searchUnread({ accountId: 'mbox-1', sinceDate: '2026-03-24', limit: 25 });
    await transport.searchUnread({ accountId: 'mbox-1', sinceDate: '2026-03-24', limit: 25 });

    expect(callTool).toHaveBeenCalledTimes(3);
    expect(callTool).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ name: 'imap_connect', arguments: { accountId: 'mbox-1' } })
    );
    expect(callTool).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ name: 'imap_search_emails' })
    );
    expect(callTool).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ name: 'imap_search_emails' })
    );
  });

  it('reuses a shared inbox transport for identical config within one process', async () => {
    process.env.IMAP_MCP_SERVER_ROOT = '/opt/imap';
    process.env.IMAP_MCP_HOME = '/state/imap';

    const close = vi.fn(async () => undefined);
    const connectClient = vi.spyOn(imapMcpTransportInternals, 'connectClient').mockResolvedValue({
      callTool: vi.fn(),
      close,
    });
    vi.spyOn(imapMcpTransportInternals, 'log').mockImplementation(() => undefined);

    const first = await getSharedImapMcpInboxTransport();
    const second = await getSharedImapMcpInboxTransport();

    expect(first).toBe(second);
    expect(connectClient).toHaveBeenCalledTimes(1);

    await closeSharedImapMcpInboxTransport();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('reconnects when imap-mcp reports a dropped mailbox connection', async () => {
    process.env.IMAP_MCP_SERVER_ROOT = '/opt/imap';
    process.env.IMAP_MCP_HOME = '/state/imap';

    const callTool = vi
      .fn()
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({ success: true, accountId: 'mbox-1' }) }],
      })
      .mockRejectedValueOnce(new Error('Connection not available'))
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({ success: true, accountId: 'mbox-1' }) }],
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({ messages: [] }) }],
      });

    vi.spyOn(imapMcpTransportInternals, 'connectClient').mockResolvedValue({
      callTool,
      close: vi.fn(async () => undefined),
    });

    const transport = await createImapMcpInboxTransport();
    await transport.searchUnread({ accountId: 'mbox-1', sinceDate: '2026-03-24', limit: 25 });

    expect(callTool).toHaveBeenCalledTimes(4);
    expect(callTool).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ name: 'imap_connect', arguments: { accountId: 'mbox-1' } })
    );
    expect(callTool).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ name: 'imap_search_emails' })
    );
    expect(callTool).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ name: 'imap_connect', arguments: { accountId: 'mbox-1' } })
    );
    expect(callTool).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ name: 'imap_search_emails' })
    );
  });

  it('restarts the mcp process when imap-mcp reports an unrecoverable ImapFlow reconnect error', async () => {
    process.env.IMAP_MCP_SERVER_ROOT = '/opt/imap';
    process.env.IMAP_MCP_HOME = '/state/imap';

    const callToolFirst = vi
      .fn()
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({ success: true, accountId: 'mbox-1' }) }],
      })
      .mockResolvedValueOnce({
        isError: true,
        content: [
          {
            type: 'text',
            text: 'Failed to reconnect: Can not re-use ImapFlow instance',
          },
        ],
      });
    const closeFirst = vi.fn(async () => undefined);

    const callToolSecond = vi
      .fn()
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({ success: true, accountId: 'mbox-1' }) }],
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({ messages: [] }) }],
      });
    const closeSecond = vi.fn(async () => undefined);

    const connectClient = vi
      .spyOn(imapMcpTransportInternals, 'connectClient')
      .mockResolvedValueOnce({ callTool: callToolFirst, close: closeFirst })
      .mockResolvedValueOnce({ callTool: callToolSecond, close: closeSecond });
    vi.spyOn(imapMcpTransportInternals, 'log').mockImplementation(() => undefined);

    const transport = await createImapMcpInboxTransport();
    await transport.searchUnread({ accountId: 'mbox-1', sinceDate: '2026-03-24', limit: 25 });

    expect(connectClient).toHaveBeenCalledTimes(2);
    expect(closeFirst).toHaveBeenCalledTimes(1);
    expect(callToolFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ name: 'imap_connect', arguments: { accountId: 'mbox-1' } })
    );
    expect(callToolFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ name: 'imap_search_emails' })
    );
    expect(callToolSecond).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ name: 'imap_connect', arguments: { accountId: 'mbox-1' } })
    );
    expect(callToolSecond).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ name: 'imap_search_emails' })
    );
  });

  it('retries once when mcp times out while calling inbox tools', async () => {
    process.env.IMAP_MCP_SERVER_ROOT = '/opt/imap';
    process.env.IMAP_MCP_HOME = '/state/imap';

    const callTool = vi
      .fn()
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({ success: true, accountId: 'mbox-1' }) }],
      })
      .mockRejectedValueOnce(new Error('MCP error -32001: Request timed out'))
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({ success: true, accountId: 'mbox-1' }) }],
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({ messages: [] }) }],
      });

    vi.spyOn(imapMcpTransportInternals, 'connectClient').mockResolvedValue({
      callTool,
      close: vi.fn(async () => undefined),
    });

    const transport = await createImapMcpInboxTransport();
    await transport.searchUnread({ accountId: 'mbox-1', sinceDate: '2026-03-24', limit: 25 });

    expect(callTool).toHaveBeenCalledTimes(4);
    expect(callTool).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ name: 'imap_connect', arguments: { accountId: 'mbox-1' } })
    );
    expect(callTool).toHaveBeenNthCalledWith(2, expect.objectContaining({ name: 'imap_search_emails' }));
    expect(callTool).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ name: 'imap_connect', arguments: { accountId: 'mbox-1' } })
    );
    expect(callTool).toHaveBeenNthCalledWith(4, expect.objectContaining({ name: 'imap_search_emails' }));
  });
});
