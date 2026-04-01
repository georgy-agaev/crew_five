import { formatErrorMessage } from '../../lib/formatErrorMessage.js';

import type {
  InboxMessageContent,
  InboxMessageSummary,
  InboxPollTransport,
} from '../../services/processReplies.js';

import {
  closeSharedImapMcpTransportManager,
  createImapMcpTransportManager,
  getSharedImapMcpTransportManager,
  isImapMcpTransportConfigured,
  resolveImapMcpTransportConfig,
  type ImapMcpTransportConfig,
} from './imapMcpTransportManager.js';

export interface ManagedInboxPollTransport extends InboxPollTransport {
  close: () => Promise<void>;
}

export interface ImapMcpInboxConfig extends ImapMcpTransportConfig {}

let sharedTransportPromise: Promise<ManagedInboxPollTransport> | null = null;
let sharedTransportConfigKey: string | null = null;

export function isImapMcpInboxConfigured(): boolean {
  return isImapMcpTransportConfigured();
}

function resolveImapMcpInboxConfig(): ImapMcpInboxConfig | null {
  return resolveImapMcpTransportConfig();
}

function buildConfigKey(config: ImapMcpInboxConfig) {
  return JSON.stringify({
    command: config.command,
    args: config.args,
    home: config.env.HOME ?? null,
  });
}

function toIsoDate(value: unknown) {
  if (typeof value === 'string') {
    const asDate = new Date(value);
    if (!Number.isNaN(asDate.getTime())) {
      return asDate.toISOString();
    }
  }
  return new Date().toISOString();
}

function normalizeMessage(row: Record<string, unknown>): InboxMessageSummary {
  return {
    uid: Number(row.uid),
    date: toIsoDate(row.date),
    from: typeof row.from === 'string' ? row.from : '',
    to: Array.isArray(row.to) ? row.to.filter((value): value is string => typeof value === 'string') : [],
    subject: typeof row.subject === 'string' ? row.subject : '',
    messageId: typeof row.messageId === 'string' ? row.messageId : '',
    inReplyTo: typeof row.inReplyTo === 'string' ? row.inReplyTo : null,
    flags: Array.isArray(row.flags) ? row.flags.filter((value): value is string => typeof value === 'string') : [],
  };
}

export async function createImapMcpInboxTransport(
  config: ImapMcpInboxConfig | null = resolveImapMcpInboxConfig()
): Promise<ManagedInboxPollTransport> {
  const manager = await createImapMcpTransportManager(config);

  return {
    searchUnread: async ({ accountId, folder = 'INBOX', sinceDate, limit = 100 }) => {
      const payload = await manager.callAccountToolJson(accountId, 'imap_search_emails', {
        folder,
        seen: false,
        since: sinceDate,
        limit,
      });
      const messages = Array.isArray(payload.messages)
        ? payload.messages
            .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
            .map(normalizeMessage)
        : [];
      return messages;
    },
    getEmail: async ({ accountId, folder = 'INBOX', uid }) => {
      const payload = await manager.callAccountToolJson(accountId, 'imap_get_email', {
        folder,
        uid,
      });
      const email =
        payload.email && typeof payload.email === 'object' && !Array.isArray(payload.email)
          ? (payload.email as Record<string, unknown>)
          : null;
      if (!email) {
        throw new Error('imap-mcp get_email returned no email payload');
      }

      const normalized = normalizeMessage(email);
      return {
        ...normalized,
        textContent: typeof email.textContent === 'string' ? email.textContent : null,
        htmlContent: typeof email.htmlContent === 'string' ? email.htmlContent : null,
      } satisfies InboxMessageContent;
    },
    markAsRead: async ({ accountId, folder = 'INBOX', uid }) => {
      await manager.callAccountToolJson(accountId, 'imap_mark_as_read', {
        folder,
        uid,
      });
    },
    close: async () => {
      await manager.close();
    },
  };
}

export async function getSharedImapMcpInboxTransport(
  config: ImapMcpInboxConfig | null = resolveImapMcpInboxConfig()
): Promise<ManagedInboxPollTransport> {
  if (!config) {
    throw new Error('imap-mcp direct inbox is not configured');
  }

  const configKey = buildConfigKey(config);
  if (sharedTransportPromise && sharedTransportConfigKey === configKey) {
    return sharedTransportPromise;
  }

  if (sharedTransportPromise && sharedTransportConfigKey !== configKey) {
    const previous = sharedTransportPromise;
    sharedTransportPromise = null;
    sharedTransportConfigKey = null;
    try {
      await (await previous).close();
    } catch {
      // Best-effort cleanup before reconnecting with a new launcher config.
    }
  }

  sharedTransportConfigKey = configKey;
  sharedTransportPromise = (async () => {
    const manager = await getSharedImapMcpTransportManager(config);
    return {
      searchUnread: async ({ accountId, folder = 'INBOX', sinceDate, limit = 100 }) => {
        const payload = await manager.callAccountToolJson(accountId, 'imap_search_emails', {
          folder,
          seen: false,
          since: sinceDate,
          limit,
        });
        const messages = Array.isArray(payload.messages)
          ? payload.messages
              .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === 'object')
              .map(normalizeMessage)
          : [];
        return messages;
      },
      getEmail: async ({ accountId, folder = 'INBOX', uid }) => {
        const payload = await manager.callAccountToolJson(accountId, 'imap_get_email', { folder, uid });
        const email =
          payload.email && typeof payload.email === 'object' && !Array.isArray(payload.email)
            ? (payload.email as Record<string, unknown>)
            : null;
        if (!email) {
          throw new Error('imap-mcp get_email returned no email payload');
        }
        const normalized = normalizeMessage(email);
        return {
          ...normalized,
          textContent: typeof email.textContent === 'string' ? email.textContent : null,
          htmlContent: typeof email.htmlContent === 'string' ? email.htmlContent : null,
        } satisfies InboxMessageContent;
      },
      markAsRead: async ({ accountId, folder = 'INBOX', uid }) => {
        await manager.callAccountToolJson(accountId, 'imap_mark_as_read', { folder, uid });
      },
      close: async () => {
        await closeSharedImapMcpTransportManager();
      },
    } satisfies ManagedInboxPollTransport;
  })();

  return sharedTransportPromise;
}

export async function closeSharedImapMcpInboxTransport() {
  const current = sharedTransportPromise;
  sharedTransportPromise = null;
  sharedTransportConfigKey = null;
  if (!current) {
    await closeSharedImapMcpTransportManager();
    return;
  }

  try {
    await (await current).close();
  } catch (error) {
    throw new Error(`Failed to close shared imap-mcp inbox transport: ${formatErrorMessage(error)}`);
  }
}

