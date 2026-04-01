import { formatErrorMessage } from '../../lib/formatErrorMessage.js';

import type {
  CampaignSendTransport,
  CampaignSendTransportRequest,
  CampaignSendTransportResult,
} from '../../services/campaignSendExecution.js';

import {
  closeSharedImapMcpTransportManager,
  createImapMcpTransportManager,
  getSharedImapMcpTransportManager,
  isImapMcpTransportConfigured,
  resolveImapMcpTransportConfig,
  type ImapMcpTransportConfig,
} from './imapMcpTransportManager.js';

export interface ManagedCampaignSendTransport extends CampaignSendTransport {
  close: () => Promise<void>;
}

export const imapMcpSendInternals = {
  now: () => new Date().toISOString(),
};

let sharedTransportPromise: Promise<ManagedCampaignSendTransport> | null = null;
let sharedTransportConfigKey: string | null = null;

export interface ImapMcpSendConfig extends ImapMcpTransportConfig {}

export function isImapMcpSendConfigured(): boolean {
  return isImapMcpTransportConfigured();
}

export function resolveImapMcpSendConfig(): ImapMcpSendConfig | null {
  return resolveImapMcpTransportConfig();
}

function buildConfigKey(config: ImapMcpSendConfig) {
  return JSON.stringify({
    command: config.command,
    args: config.args,
    home: config.env.HOME ?? null,
  });
}

export async function createImapMcpSendTransport(
  config: ImapMcpSendConfig | null = resolveImapMcpSendConfig()
): Promise<ManagedCampaignSendTransport> {
  const manager = await createImapMcpTransportManager(config);

  return {
    send: async (request: CampaignSendTransportRequest): Promise<CampaignSendTransportResult> => {
      if (!request.mailboxAccountId) {
        throw new Error('Mailbox account is required for imap-mcp send');
      }

      const payload = await manager.callAccountToolJson(request.mailboxAccountId, 'imap_send_email', {
        to: request.to,
        subject: request.subject,
        text: request.body,
      });

      if (payload.success === false) {
        throw new Error(typeof payload.message === 'string' ? payload.message : 'imap-mcp send failed');
      }

      return {
        provider: 'imap_mcp',
        providerMessageId: typeof payload.messageId === 'string' ? payload.messageId : null,
        sentAt: imapMcpSendInternals.now(),
        metadata: payload,
      };
    },
    close: async () => {
      await manager.close();
    },
  };
}

export async function getSharedImapMcpSendTransport(
  config: ImapMcpSendConfig | null = resolveImapMcpSendConfig()
): Promise<ManagedCampaignSendTransport> {
  if (!config) {
    throw new Error('imap-mcp direct send is not configured');
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
      send: async (request: CampaignSendTransportRequest) => {
        if (!request.mailboxAccountId) {
          throw new Error('Mailbox account is required for imap-mcp send');
        }

        const payload = await manager.callAccountToolJson(request.mailboxAccountId, 'imap_send_email', {
          to: request.to,
          subject: request.subject,
          text: request.body,
        });

        if (payload.success === false) {
          throw new Error(typeof payload.message === 'string' ? payload.message : 'imap-mcp send failed');
        }

        return {
          provider: 'imap_mcp',
          providerMessageId: typeof payload.messageId === 'string' ? payload.messageId : null,
          sentAt: imapMcpSendInternals.now(),
          metadata: payload,
        } satisfies CampaignSendTransportResult;
      },
      close: async () => {
        await closeSharedImapMcpTransportManager();
      },
    } satisfies ManagedCampaignSendTransport;
  })();

  return sharedTransportPromise;
}

export async function closeSharedImapMcpSendTransport() {
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
    // When closing during shutdown we want a best-effort release.
    throw new Error(`Failed to close shared imap-mcp send transport: ${formatErrorMessage(error)}`);
  }
}

