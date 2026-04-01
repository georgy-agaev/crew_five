import { afterEach, describe, expect, it, vi } from 'vitest';

import { closeSharedImapMcpSendTransport, getSharedImapMcpSendTransport } from './imapMcpSendTransport.js';
import { closeSharedImapMcpInboxTransport, getSharedImapMcpInboxTransport } from './imapMcpInboxTransport.js';
import { createImapMcpTransportManager, imapMcpTransportInternals } from './imapMcpTransportManager.js';

describe('imapMcpTransportManager', () => {
  afterEach(() => {
    delete process.env.IMAP_MCP_SERVER_ROOT;
    delete process.env.IMAP_MCP_HOME;
    delete process.env.IMAP_MCP_SERVER_COMMAND;
    delete process.env.IMAP_MCP_SERVER_ENTRY;
    void closeSharedImapMcpSendTransport();
    void closeSharedImapMcpInboxTransport();
    vi.restoreAllMocks();
  });

  it('shares one mcp stdio process between send and inbox transports for identical config', async () => {
    process.env.IMAP_MCP_SERVER_ROOT = '/opt/imap';
    process.env.IMAP_MCP_HOME = '/state/imap';

    const callTool = vi.fn(async () => ({ content: [{ type: 'text', text: JSON.stringify({ success: true }) }] }));
    const close = vi.fn(async () => undefined);
    const connectClient = vi
      .spyOn(imapMcpTransportInternals, 'connectClient')
      .mockResolvedValue({ callTool, close });
    vi.spyOn(imapMcpTransportInternals, 'log').mockImplementation(() => undefined);

    await getSharedImapMcpSendTransport();
    await getSharedImapMcpInboxTransport();

    expect(connectClient).toHaveBeenCalledTimes(1);
  });

  it('backs off accounts after repeated retryable connection errors', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-30T00:00:00Z'));

    const callTool = vi.fn(async ({ name }: any) => {
      if (name === 'imap_connect') {
        return { content: [{ type: 'text', text: JSON.stringify({ success: true }) }] };
      }
      throw new Error('read ECONNRESET');
    });
    const close = vi.fn(async () => undefined);
    vi.spyOn(imapMcpTransportInternals, 'connectClient').mockResolvedValue({ callTool, close });
    vi.spyOn(imapMcpTransportInternals, 'log').mockImplementation(() => undefined);

    const manager = await createImapMcpTransportManager({
      command: 'node',
      args: ['dist/index.js'],
      env: { HOME: '/state/imap' } as any,
    });

    await expect(
      manager.callAccountToolJson('mbox-1', 'imap_search_emails', { folder: 'INBOX' })
    ).rejects.toThrow(/ECONNRESET/i);

    const toolCallsAfterFailure = callTool.mock.calls.length;
    expect(toolCallsAfterFailure).toBeGreaterThanOrEqual(2);

    // Immediate second attempt should short-circuit via backoff and not hit the MCP process again.
    try {
      await manager.callAccountToolJson('mbox-1', 'imap_search_emails', { folder: 'INBOX' });
      throw new Error('Expected backoff error');
    } catch (err: any) {
      expect(err?.code).toBe('IMAP_MCP_BACKOFF');
      expect(typeof err?.retryAfterMs).toBe('number');
    }

    expect(callTool).toHaveBeenCalledTimes(toolCallsAfterFailure);

    // After cooldown, retry should call through again.
    const retryAfterMs = 31_000;
    vi.setSystemTime(new Date(Date.now() + retryAfterMs));
    await expect(
      manager.callAccountToolJson('mbox-1', 'imap_search_emails', { folder: 'INBOX' })
    ).rejects.toThrow(/ECONNRESET/i);

    expect(callTool.mock.calls.length).toBeGreaterThan(toolCallsAfterFailure);
    await manager.close();
    vi.useRealTimers();
  });
});
