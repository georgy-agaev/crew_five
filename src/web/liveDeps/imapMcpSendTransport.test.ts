import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  closeSharedImapMcpSendTransport,
  createImapMcpSendTransport,
  getSharedImapMcpSendTransport,
  imapMcpSendInternals,
  isImapMcpSendConfigured,
  resolveImapMcpSendConfig,
} from './imapMcpSendTransport.js';
import { imapMcpTransportInternals } from './imapMcpTransportManager.js';

describe('imapMcpSendTransport', () => {
  afterEach(() => {
    delete process.env.IMAP_MCP_SERVER_ROOT;
    delete process.env.IMAP_MCP_HOME;
    delete process.env.IMAP_MCP_SERVER_COMMAND;
    delete process.env.IMAP_MCP_SERVER_ENTRY;
    void closeSharedImapMcpSendTransport();
    vi.restoreAllMocks();
  });

  it('detects whether direct imap-mcp send is configured', () => {
    expect(isImapMcpSendConfigured()).toBe(false);

    process.env.IMAP_MCP_SERVER_ROOT = '/opt/imap';
    process.env.IMAP_MCP_HOME = '/state/imap';

    expect(isImapMcpSendConfigured()).toBe(true);
    expect(resolveImapMcpSendConfig()).toMatchObject({
      command: 'node',
      args: ['/opt/imap/dist/index.js'],
      env: { HOME: '/state/imap' },
    });
  });

  it('supports overriding the imap-mcp launcher entrypoint', () => {
    process.env.IMAP_MCP_SERVER_ROOT = '/opt/imap';
    process.env.IMAP_MCP_HOME = '/state/imap';
    process.env.IMAP_MCP_SERVER_COMMAND = '/opt/imap/node_modules/.bin/tsx';
    process.env.IMAP_MCP_SERVER_ENTRY = 'src/index.ts';

    expect(resolveImapMcpSendConfig()).toMatchObject({
      command: '/opt/imap/node_modules/.bin/tsx',
      args: ['/opt/imap/src/index.ts'],
      env: { HOME: '/state/imap' },
    });
  });

  it('calls imap_send_email and parses the returned JSON payload', async () => {
    process.env.IMAP_MCP_SERVER_ROOT = '/opt/imap';
    process.env.IMAP_MCP_HOME = '/state/imap';

    const callTool = vi.fn().mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: true, messageId: '<msg-1@example.com>' }),
        },
      ],
    });
    const close = vi.fn(async () => undefined);
    vi.spyOn(imapMcpTransportInternals, 'connectClient').mockResolvedValue({
      callTool,
      close,
    });
    vi.spyOn(imapMcpSendInternals, 'now').mockReturnValue('2026-03-23T12:00:00.000Z');

    const transport = await createImapMcpSendTransport();
    const result = await transport.send({
      campaignId: 'camp-1',
      draftId: 'draft-1',
      contactId: 'contact-1',
      companyId: 'company-1',
      to: 'buyer@example.com',
      subject: 'Hello',
      body: 'Body',
      provider: 'imap_mcp',
      senderIdentity: 'sales@example.com',
      mailboxAccountId: 'mbox-1',
      metadata: {},
    });

    expect(callTool).toHaveBeenNthCalledWith(1, {
      name: 'imap_connect',
      arguments: { accountId: 'mbox-1' },
    });
    expect(callTool).toHaveBeenNthCalledWith(2, {
      name: 'imap_send_email',
      arguments: {
        accountId: 'mbox-1',
        to: 'buyer@example.com',
        subject: 'Hello',
        text: 'Body',
      },
    });
    expect(result).toEqual({
      provider: 'imap_mcp',
      providerMessageId: '<msg-1@example.com>',
      sentAt: '2026-03-23T12:00:00.000Z',
      metadata: { success: true, messageId: '<msg-1@example.com>' },
    });

    await transport.close();
    expect(close).toHaveBeenCalled();
  });

  it('parses banner-wrapped JSON payloads from imap-mcp send', async () => {
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
            text: ['IMAP MCP Server started', JSON.stringify({ success: true, messageId: '<msg-2@example.com>' })].join('\n'),
          },
        ],
      });
    vi.spyOn(imapMcpTransportInternals, 'connectClient').mockResolvedValue({
      callTool,
      close: vi.fn(async () => undefined),
    });
    vi.spyOn(imapMcpSendInternals, 'now').mockReturnValue('2026-03-23T12:00:00.000Z');

    const transport = await createImapMcpSendTransport();
    const result = await transport.send({
      campaignId: 'camp-1',
      draftId: 'draft-1',
      contactId: 'contact-1',
      companyId: 'company-1',
      to: 'buyer@example.com',
      subject: 'Hello',
      body: 'Body',
      provider: 'imap_mcp',
      senderIdentity: 'sales@example.com',
      mailboxAccountId: 'mbox-1',
      metadata: {},
    });

    expect(result.providerMessageId).toBe('<msg-2@example.com>');
  });

  it('surfaces raw imap-mcp send tool errors', async () => {
    process.env.IMAP_MCP_SERVER_ROOT = '/opt/imap';
    process.env.IMAP_MCP_HOME = '/state/imap';

    const callTool = vi
      .fn()
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({ success: true, accountId: 'mbox-1' }) }],
      })
      .mockResolvedValueOnce({
        isError: true,
        content: [
          {
            type: 'text',
            text: 'SMTP AUTH failed for mailbox mbox-1',
          },
        ],
      });
    vi.spyOn(imapMcpTransportInternals, 'connectClient').mockResolvedValue({
      callTool,
      close: vi.fn(async () => undefined),
    });

    const transport = await createImapMcpSendTransport();

    await expect(
      transport.send({
        campaignId: 'camp-1',
        draftId: 'draft-1',
        contactId: 'contact-1',
        companyId: 'company-1',
        to: 'buyer@example.com',
        subject: 'Hello',
        body: 'Body',
        provider: 'imap_mcp',
        senderIdentity: 'sales@example.com',
        mailboxAccountId: 'mbox-1',
        metadata: {},
      })
    ).rejects.toThrow(/smtp auth failed/i);
  });

  it('fails when mailboxAccountId is missing', async () => {
    process.env.IMAP_MCP_SERVER_ROOT = '/opt/imap';
    process.env.IMAP_MCP_HOME = '/state/imap';

    vi.spyOn(imapMcpTransportInternals, 'connectClient').mockResolvedValue({
      callTool: vi.fn(),
      close: vi.fn(async () => undefined),
    });

    const transport = await createImapMcpSendTransport();

    await expect(
      transport.send({
        campaignId: 'camp-1',
        draftId: 'draft-1',
        contactId: 'contact-1',
        companyId: 'company-1',
        to: 'buyer@example.com',
        subject: 'Hello',
        body: 'Body',
        provider: 'imap_mcp',
        senderIdentity: 'sales@example.com',
        mailboxAccountId: null,
        metadata: {},
      })
    ).rejects.toThrow(/mailbox account is required/i);
  });

  it('reuses a shared transport for identical config within one process', async () => {
    process.env.IMAP_MCP_SERVER_ROOT = '/opt/imap';
    process.env.IMAP_MCP_HOME = '/state/imap';

    const callTool = vi
      .fn()
      .mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify({ success: true, accountId: 'mbox-1' }) }],
      })
      .mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify({ success: true, messageId: '<msg@example.com>' }) }],
      });
    const close = vi.fn(async () => undefined);
    const connectClient = vi
      .spyOn(imapMcpTransportInternals, 'connectClient')
      .mockResolvedValue({ callTool, close });
    vi.spyOn(imapMcpTransportInternals, 'log').mockImplementation(() => undefined);

    const first = await getSharedImapMcpSendTransport();
    const second = await getSharedImapMcpSendTransport();

    expect(first).toBe(second);
    expect(connectClient).toHaveBeenCalledTimes(1);

    await closeSharedImapMcpSendTransport();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('reconnects and retries once when a transient mailbox connection error occurs', async () => {
    process.env.IMAP_MCP_SERVER_ROOT = '/opt/imap';
    process.env.IMAP_MCP_HOME = '/state/imap';

    const callTool = vi
      .fn()
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({ success: true, accountId: 'mbox-1' }) }],
      })
      .mockRejectedValueOnce(new Error('read ECONNRESET'))
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({ success: true, accountId: 'mbox-1' }) }],
      })
      .mockResolvedValueOnce({
        content: [{ type: 'text', text: JSON.stringify({ success: true, messageId: '<msg-3@example.com>' }) }],
      });
    vi.spyOn(imapMcpTransportInternals, 'connectClient').mockResolvedValue({
      callTool,
      close: vi.fn(async () => undefined),
    });
    vi.spyOn(imapMcpSendInternals, 'now').mockReturnValue('2026-03-23T12:00:00.000Z');

    const transport = await createImapMcpSendTransport();
    const result = await transport.send({
      campaignId: 'camp-1',
      draftId: 'draft-1',
      contactId: 'contact-1',
      companyId: 'company-1',
      to: 'buyer@example.com',
      subject: 'Hello',
      body: 'Body',
      provider: 'imap_mcp',
      senderIdentity: 'sales@example.com',
      mailboxAccountId: 'mbox-1',
      metadata: {},
    });

    expect(result.providerMessageId).toBe('<msg-3@example.com>');
    expect(callTool).toHaveBeenNthCalledWith(1, {
      name: 'imap_connect',
      arguments: { accountId: 'mbox-1' },
    });
    expect(callTool).toHaveBeenNthCalledWith(2, {
      name: 'imap_send_email',
      arguments: expect.objectContaining({ accountId: 'mbox-1' }),
    });
    expect(callTool).toHaveBeenNthCalledWith(3, {
      name: 'imap_connect',
      arguments: { accountId: 'mbox-1' },
    });
    expect(callTool).toHaveBeenNthCalledWith(4, {
      name: 'imap_send_email',
      arguments: expect.objectContaining({ accountId: 'mbox-1' }),
    });
  });

  it('retries once when mcp times out while calling send tools', async () => {
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
        content: [{ type: 'text', text: JSON.stringify({ success: true, messageId: '<msg-timeout@example.com>' }) }],
      });
    vi.spyOn(imapMcpTransportInternals, 'connectClient').mockResolvedValue({
      callTool,
      close: vi.fn(async () => undefined),
    });
    vi.spyOn(imapMcpSendInternals, 'now').mockReturnValue('2026-03-23T12:00:00.000Z');

    const transport = await createImapMcpSendTransport();
    const result = await transport.send({
      campaignId: 'camp-1',
      draftId: 'draft-1',
      contactId: 'contact-1',
      companyId: 'company-1',
      to: 'buyer@example.com',
      subject: 'Hello',
      body: 'Body',
      provider: 'imap_mcp',
      senderIdentity: 'sales@example.com',
      mailboxAccountId: 'mbox-1',
      metadata: {},
    });

    expect(result.providerMessageId).toBe('<msg-timeout@example.com>');
    expect(callTool).toHaveBeenNthCalledWith(1, {
      name: 'imap_connect',
      arguments: { accountId: 'mbox-1' },
    });
    expect(callTool).toHaveBeenNthCalledWith(2, {
      name: 'imap_send_email',
      arguments: expect.objectContaining({ accountId: 'mbox-1' }),
    });
    expect(callTool).toHaveBeenNthCalledWith(3, {
      name: 'imap_connect',
      arguments: { accountId: 'mbox-1' },
    });
    expect(callTool).toHaveBeenNthCalledWith(4, {
      name: 'imap_send_email',
      arguments: expect.objectContaining({ accountId: 'mbox-1' }),
    });
  });

  it('restarts the mcp process when imap-mcp send reports an unrecoverable ImapFlow reconnect error', async () => {
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
        content: [{ type: 'text', text: JSON.stringify({ success: true, messageId: '<msg-4@example.com>' }) }],
      });
    const closeSecond = vi.fn(async () => undefined);

    const connectClient = vi
      .spyOn(imapMcpTransportInternals, 'connectClient')
      .mockResolvedValueOnce({ callTool: callToolFirst, close: closeFirst })
      .mockResolvedValueOnce({ callTool: callToolSecond, close: closeSecond });
    vi.spyOn(imapMcpTransportInternals, 'log').mockImplementation(() => undefined);
    vi.spyOn(imapMcpSendInternals, 'now').mockReturnValue('2026-03-23T12:00:00.000Z');

    const transport = await createImapMcpSendTransport();
    const result = await transport.send({
      campaignId: 'camp-1',
      draftId: 'draft-1',
      contactId: 'contact-1',
      companyId: 'company-1',
      to: 'buyer@example.com',
      subject: 'Hello',
      body: 'Body',
      provider: 'imap_mcp',
      senderIdentity: 'sales@example.com',
      mailboxAccountId: 'mbox-1',
      metadata: {},
    });

    expect(connectClient).toHaveBeenCalledTimes(2);
    expect(closeFirst).toHaveBeenCalledTimes(1);
    expect(result.providerMessageId).toBe('<msg-4@example.com>');
    expect(callToolFirst).toHaveBeenNthCalledWith(1, {
      name: 'imap_connect',
      arguments: { accountId: 'mbox-1' },
    });
    expect(callToolFirst).toHaveBeenNthCalledWith(2, {
      name: 'imap_send_email',
      arguments: expect.objectContaining({ accountId: 'mbox-1' }),
    });
    expect(callToolSecond).toHaveBeenNthCalledWith(1, {
      name: 'imap_connect',
      arguments: { accountId: 'mbox-1' },
    });
    expect(callToolSecond).toHaveBeenNthCalledWith(2, {
      name: 'imap_send_email',
      arguments: expect.objectContaining({ accountId: 'mbox-1' }),
    });
  });
});
