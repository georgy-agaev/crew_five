/* eslint-disable security-node/detect-crlf */
import http from 'node:http';
import { URL, fileURLToPath } from 'node:url';

import { dispatch } from './dispatch.js';
import { createLiveDeps } from './liveDeps.js';
import { closeSharedImapMcpInboxTransport } from './liveDeps/imapMcpInboxTransport.js';
import { closeSharedImapMcpSendTransport } from './liveDeps/imapMcpSendTransport.js';
import { buildMeta } from './meta.js';
import { createMockDeps } from './mockDeps.js';
import {
  startAutoSendSchedulerFromEnv,
  type AutoSendSchedulerHandle,
} from './autoSendScheduler.js';
import { buildSmartleadClientFromEnv } from './smartlead.js';
import type { AdapterDeps, MetaStatus } from './types.js';
import { formatErrorMessage } from '../lib/formatErrorMessage.js';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': 'content-type',
};

const DEFAULT_INBOX_POLL_INTERVAL_MINUTES = 10;
const DEFAULT_INBOX_POLL_LOOKBACK_HOURS = 24;

export interface InboxPollSchedulerHandle {
  stop: () => void;
  readonly intervalMs: number;
  readonly lookbackHours: number;
}

function parseBooleanEnv(value: string | undefined) {
  return value === '1' || value === 'true';
}

function parsePositiveIntegerEnv(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function readJson<T>(req: http.IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString() || '{}';
  return JSON.parse(raw) as T;
}

function json(res: http.ServerResponse, body: unknown, status = 200) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    ...CORS_HEADERS,
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

export function createWebAdapter(deps: AdapterDeps, meta?: MetaStatus) {
  return http.createServer(async (req, res) => {
    if ((req.method ?? 'GET') === 'OPTIONS') {
      res.writeHead(204, CORS_HEADERS);
      res.end();
      return;
    }

    const url = new URL(req.url ?? '/', 'http://localhost');
    try {
      const response = await dispatch(
        deps,
        {
          method: req.method ?? 'GET',
          pathname: url.pathname,
          searchParams: url.searchParams,
          body: (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') ? await readJson<any>(req) : undefined,
        },
        meta
      );
      json(res, response.body, response.status);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Server error';
      json(res, { error: message }, 500);
    }
  });
}

export function startWebAdapter(deps: AdapterDeps, port = 8787, meta?: MetaStatus) {
  const server = createWebAdapter(
    deps,
    meta ?? buildMeta({ mode: process.env.WEB_ADAPTER_MODE === 'mock' ? 'mock' : 'live' })
  );
  server.listen(port);
  return server;
}

export function startInboxPollScheduler(
  deps: AdapterDeps,
  options: {
    intervalMs: number;
    lookbackHours: number;
    logger?: Pick<Console, 'log' | 'error'>;
  }
): InboxPollSchedulerHandle | null {
  if (!deps.triggerInboxPoll) {
    return null;
  }

  const triggerInboxPoll = deps.triggerInboxPoll;
  const logger = options.logger ?? console;
  let running = false;

  const tick = async () => {
    if (running) {
      return;
    }
    running = true;
    try {
      const result = await triggerInboxPoll({ lookbackHours: options.lookbackHours });
      logger.log(
        `[web adapter] inbox poll completed (accepted=${String(result.accepted ?? false)}, processed=${String(result.processed ?? 0)})`
      );
    } catch (error) {
      logger.error(`[web adapter] inbox poll failed: ${formatErrorMessage(error)}`);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => {
    void tick();
  }, options.intervalMs);
  timer.unref?.();

  return {
    stop: () => clearInterval(timer),
    intervalMs: options.intervalMs,
    lookbackHours: options.lookbackHours,
  };
}

export function startInboxPollSchedulerFromEnv(
  deps: AdapterDeps,
  options: {
    logger?: Pick<Console, 'log' | 'error'>;
    mode?: 'live' | 'mock';
  } = {}
): InboxPollSchedulerHandle | null {
  if (options.mode === 'mock' || !parseBooleanEnv(process.env.INBOX_POLL_ENABLED)) {
    return null;
  }

  const intervalMinutes = parsePositiveIntegerEnv(
    process.env.INBOX_POLL_INTERVAL_MINUTES,
    DEFAULT_INBOX_POLL_INTERVAL_MINUTES
  );
  const lookbackHours = parsePositiveIntegerEnv(
    process.env.INBOX_POLL_LOOKBACK_HOURS,
    DEFAULT_INBOX_POLL_LOOKBACK_HOURS
  );
  const intervalMs = intervalMinutes * 60 * 1000;
  const scheduler = startInboxPollScheduler(deps, {
    intervalMs,
    lookbackHours,
    logger: options.logger,
  });

  if (scheduler) {
    (options.logger ?? console).log(
      `[web adapter] inbox poll scheduler enabled (interval=${intervalMinutes}m, lookback=${lookbackHours}h)`
    );
  }

  return scheduler;
}

if ((process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 8787);
  const useMock = process.env.WEB_ADAPTER_MODE === 'mock';
  const deps = useMock ? createMockDeps() : createLiveDeps();
  const server = startWebAdapter(deps, port, buildMeta({ mode: useMock ? 'mock' : 'live' }));
  const scheduler = startInboxPollSchedulerFromEnv(deps, { mode: useMock ? 'mock' : 'live' });
  const autoSendScheduler = startAutoSendSchedulerFromEnv(deps, {
    mode: useMock ? 'mock' : 'live',
  });
  server.on('close', () => {
    scheduler?.stop();
    autoSendScheduler?.stop();
    void closeSharedImapMcpInboxTransport();
    void closeSharedImapMcpSendTransport();
  });
  console.log(
    `[web adapter] listening on http://localhost:${port}/api (mode=${useMock ? 'mock' : 'live'})`
  );
}
export {
  buildMeta,
  buildSmartleadClientFromEnv,
  createLiveDeps,
  createMockDeps,
  dispatch,
  startAutoSendSchedulerFromEnv,
  type AutoSendSchedulerHandle,
};
