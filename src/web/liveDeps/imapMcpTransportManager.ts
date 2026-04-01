import path from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { formatErrorMessage } from '../../lib/formatErrorMessage.js';

export interface ImapMcpTransportConfig {
  command: string;
  args: string[];
  env: Record<string, string>;
}

interface ImapMcpToolClient {
  callTool: (params: { name: string; arguments?: Record<string, unknown> }) => Promise<Record<string, unknown>>;
  close: () => Promise<void>;
}

export interface ManagedImapMcpTransportManager {
  callAccountToolJson: (
    accountId: string,
    name: string,
    args?: Record<string, unknown>
  ) => Promise<Record<string, unknown>>;
  close: () => Promise<void>;
}

let sharedManagerPromise: Promise<ManagedImapMcpTransportManager> | null = null;
let sharedManagerConfigKey: string | null = null;

const BASE_ACCOUNT_BACKOFF_MS = 30_000;
const MAX_ACCOUNT_BACKOFF_MS = 10 * 60_000;

function resolveImapMcpRoot() {
  const value = process.env.IMAP_MCP_SERVER_ROOT?.trim();
  return value ? value : null;
}

function resolveImapMcpEntry(root: string) {
  const value = process.env.IMAP_MCP_SERVER_ENTRY?.trim();
  if (!value) {
    return path.join(root, 'dist', 'index.js');
  }

  return path.isAbsolute(value) ? value : path.join(root, value);
}

function resolveImapMcpHome() {
  const value = process.env.IMAP_MCP_HOME?.trim();
  return value ? value : null;
}

export function isImapMcpTransportConfigured(): boolean {
  return Boolean(resolveImapMcpRoot() && resolveImapMcpHome());
}

export function resolveImapMcpTransportConfig(): ImapMcpTransportConfig | null {
  const root = resolveImapMcpRoot();
  const home = resolveImapMcpHome();
  if (!root || !home) {
    return null;
  }

  return {
    command: process.env.IMAP_MCP_SERVER_COMMAND?.trim() || 'node',
    args: [resolveImapMcpEntry(root)],
    env: {
      ...Object.fromEntries(
        Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
      ),
      HOME: home,
    },
  };
}

export const imapMcpTransportInternals = {
  // Operational logging is intentional here because transport startup problems are otherwise opaque.
  /* eslint-disable-next-line security-node/detect-crlf */
  log: (message: string) => console.log(message),
  connectClient: async (config: ImapMcpTransportConfig): Promise<ImapMcpToolClient> => {
    const client = new Client(
      { name: 'crew-five-imap', version: '0.1.0' },
      {
        capabilities: {},
      }
    );
    const transport = new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: config.env,
    });
    await client.connect(transport);

    return {
      callTool: async (params) => (await client.callTool(params)) as Record<string, unknown>,
      close: async () => {
        await client.close();
      },
    };
  },
};

function parseToolJson(result: unknown): Record<string, unknown> {
  if (!result || typeof result !== 'object' || Array.isArray(result)) {
    throw new Error('imap-mcp returned invalid payload');
  }

  const structuredContent = (result as { structuredContent?: unknown }).structuredContent;
  if (structuredContent && typeof structuredContent === 'object' && !Array.isArray(structuredContent)) {
    return structuredContent as Record<string, unknown>;
  }

  const content = Array.isArray((result as { content?: unknown }).content)
    ? ((result as { content?: Array<{ type?: string; text?: string }> }).content ?? [])
    : [];
  const textPayload = content
    .filter((item) => item.type === 'text' && typeof item.text === 'string')
    .map((item) => item.text?.trim() ?? '')
    .filter(Boolean)
    .join('\n')
    .trim();

  if (!textPayload) {
    throw new Error('imap-mcp returned no JSON payload');
  }

  const directParsed = tryParseJsonRecord(textPayload);
  if (directParsed) {
    return directParsed;
  }

  const lines = textPayload
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const lastLine = lines.at(-1);
  if (lastLine) {
    const lastLineParsed = tryParseJsonRecord(lastLine);
    if (lastLineParsed) {
      return lastLineParsed;
    }
  }

  const extractedParsed = tryParseJsonRecord(extractJsonObject(textPayload));
  if (extractedParsed) {
    return extractedParsed;
  }

  const isError = (result as { isError?: unknown }).isError === true;
  if (isError) {
    throw new Error(`imap-mcp error: ${textPayload}`);
  }

  throw new Error('imap-mcp returned invalid JSON payload');
}

function tryParseJsonRecord(value: string | null): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return null;
  }

  return null;
}

function extractJsonObject(value: string): string | null {
  const start = value.indexOf('{');
  const end = value.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return value.slice(start, end + 1);
}

function isRetryableConnectionError(error: unknown) {
  const message = formatErrorMessage(error);
  return (
    /ECONNRESET/i.test(message) ||
    /Connection not available/i.test(message) ||
    /Request timed out/i.test(message) ||
    /MCP error -32001/i.test(message) ||
    /Socket timeout/i.test(message) ||
    /socket hang up/i.test(message) ||
    /EPIPE/i.test(message) ||
    /broken pipe/i.test(message)
  );
}

function requiresTransportRestart(error: unknown) {
  const message = formatErrorMessage(error);
  // imap-mcp may hold onto an ImapFlow instance that can't be reused after a disconnect,
  // so the only safe recovery is restarting the MCP stdio process.
  return /Can not re-use ImapFlow instance/i.test(message) || /Failed to reconnect/i.test(message);
}

class ImapMcpBackoffError extends Error {
  code = 'IMAP_MCP_BACKOFF' as const;
  accountId: string;
  retryAfterMs: number;

  constructor(accountId: string, retryAfterMs: number) {
    super(
      `imap-mcp account ${accountId} is temporarily unavailable (backoff ${Math.max(
        1,
        Math.ceil(retryAfterMs / 1000)
      )}s)`
    );
    this.accountId = accountId;
    this.retryAfterMs = retryAfterMs;
  }
}

function computeBackoffMs(consecutiveFailures: number) {
  const capped = Math.max(1, Math.min(10, Math.trunc(consecutiveFailures)));
  return Math.min(MAX_ACCOUNT_BACKOFF_MS, BASE_ACCOUNT_BACKOFF_MS * Math.pow(2, capped - 1));
}

function buildConfigKey(config: ImapMcpTransportConfig) {
  return JSON.stringify({
    command: config.command,
    args: config.args,
    home: config.env.HOME ?? null,
  });
}

export async function createImapMcpTransportManager(
  config: ImapMcpTransportConfig | null = resolveImapMcpTransportConfig()
): Promise<ManagedImapMcpTransportManager> {
  if (!config) {
    throw new Error('imap-mcp transport is not configured');
  }

  const resolvedConfig = config;
  let client = await imapMcpTransportInternals.connectClient(resolvedConfig);
  const logConnected = () =>
    imapMcpTransportInternals.log(
      `[web adapter] direct imap-mcp transport connected (${resolvedConfig.command} ${resolvedConfig.args.join(' ')})`
    );
  logConnected();

  const connectedAccountIds = new Set<string>();
  let restartPromise: Promise<void> | null = null;
  const connectInFlight = new Map<string, Promise<void>>();
  const accountFailureCounts = new Map<string, number>();
  const accountBackoffUntilMs = new Map<string, number>();

  function getAccountBackoffRemainingMs(accountId: string) {
    const until = accountBackoffUntilMs.get(accountId);
    if (!until) return 0;
    const remaining = until - Date.now();
    if (remaining <= 0) {
      accountBackoffUntilMs.delete(accountId);
      return 0;
    }
    return remaining;
  }

  function clearAccountBackoff(accountId: string) {
    accountFailureCounts.delete(accountId);
    accountBackoffUntilMs.delete(accountId);
  }

  function markAccountTransientFailure(accountId: string) {
    const next = (accountFailureCounts.get(accountId) ?? 0) + 1;
    accountFailureCounts.set(accountId, next);
    accountBackoffUntilMs.set(accountId, Date.now() + computeBackoffMs(next));
  }

  async function restartClient() {
    if (restartPromise) {
      await restartPromise;
      return;
    }

    restartPromise = (async () => {
      try {
        await client.close();
      } catch {
        // Best-effort cleanup before restarting the MCP process.
      }
      client = await imapMcpTransportInternals.connectClient(resolvedConfig);
      logConnected();
      connectedAccountIds.clear();
      connectInFlight.clear();
    })();

    try {
      await restartPromise;
    } finally {
      restartPromise = null;
    }
  }

  async function connectAccount(accountId: string) {
    if (connectedAccountIds.has(accountId)) return;
    const existing = connectInFlight.get(accountId);
    if (existing) {
      await existing;
      return;
    }

    const connectPromise = (async () => {
      try {
        parseToolJson(
          await client.callTool({
            name: 'imap_connect',
            arguments: { accountId },
          })
        );
        connectedAccountIds.add(accountId);
      } catch (error) {
        if (!requiresTransportRestart(error)) {
          throw error;
        }
        await restartClient();
        parseToolJson(
          await client.callTool({
            name: 'imap_connect',
            arguments: { accountId },
          })
        );
        connectedAccountIds.add(accountId);
      }
    })();

    connectInFlight.set(accountId, connectPromise);
    try {
      await connectPromise;
    } finally {
      connectInFlight.delete(accountId);
    }
  }

  async function callToolJson(name: string, args?: Record<string, unknown>) {
    return parseToolJson(
      await client.callTool({
        name,
        arguments: args,
      })
    );
  }

  async function callAccountToolJson(accountId: string, name: string, args?: Record<string, unknown>) {
    const remainingBackoff = getAccountBackoffRemainingMs(accountId);
    if (remainingBackoff > 0) {
      throw new ImapMcpBackoffError(accountId, remainingBackoff);
    }

    const run = () =>
      callToolJson(name, {
        ...(args ?? {}),
        accountId,
      });

    const attempt = async () => {
      await connectAccount(accountId);
      return await run();
    };

    try {
      const result = await attempt();
      clearAccountBackoff(accountId);
      return result;
    } catch (error) {
      try {
        if (requiresTransportRestart(error)) {
          connectedAccountIds.delete(accountId);
          await restartClient();
          const result = await attempt();
          clearAccountBackoff(accountId);
          return result;
        }

        if (!isRetryableConnectionError(error)) {
          throw error;
        }

        connectedAccountIds.delete(accountId);
        try {
          await connectAccount(accountId);
        } catch (connectError) {
          if (requiresTransportRestart(connectError)) {
            await restartClient();
            await connectAccount(accountId);
          } else {
            throw connectError;
          }
        }

        const result = await run();
        clearAccountBackoff(accountId);
        return result;
      } catch (finalError) {
        if (isRetryableConnectionError(finalError) || requiresTransportRestart(finalError)) {
          markAccountTransientFailure(accountId);
        }
        throw finalError;
      }
    }
  }

  return {
    callAccountToolJson,
    close: async () => {
      await client.close();
    },
  };
}

export async function getSharedImapMcpTransportManager(
  config: ImapMcpTransportConfig | null = resolveImapMcpTransportConfig()
): Promise<ManagedImapMcpTransportManager> {
  if (!config) {
    throw new Error('imap-mcp transport is not configured');
  }

  const configKey = buildConfigKey(config);
  if (sharedManagerPromise && sharedManagerConfigKey === configKey) {
    return sharedManagerPromise;
  }

  if (sharedManagerPromise && sharedManagerConfigKey !== configKey) {
    const previous = sharedManagerPromise;
    sharedManagerPromise = null;
    sharedManagerConfigKey = null;
    try {
      await (await previous).close();
    } catch {
      // Best-effort cleanup before reconnecting with a new launcher config.
    }
  }

  sharedManagerConfigKey = configKey;
  sharedManagerPromise = createImapMcpTransportManager(config);
  return sharedManagerPromise;
}

export async function closeSharedImapMcpTransportManager() {
  const current = sharedManagerPromise;
  sharedManagerPromise = null;
  sharedManagerConfigKey = null;
  if (!current) return;

  try {
    await (await current).close();
  } catch {
    // ignore best-effort close
  }
}
