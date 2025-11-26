import { createHash } from 'crypto';
import { emitTrace, finishTrace, isTracingEnabled, startTrace } from '../services/tracing';

export const DEFAULT_RETRY_AFTER_CAP_MS = 5000;

export interface SmartleadMcpConfig {
  url: string;
  token: string;
  workspaceId?: string;
  fetchImpl?: typeof fetch;
}

export interface SmartleadCampaign {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface SmartleadEvent {
  provider: 'smartlead';
  provider_event_id: string;
  event_type: string;
  outcome_classification: string | null;
  contact_id: string | null;
  outbound_id: string | null;
  occurred_at: string;
  payload: Record<string, unknown>;
}

export interface ListCampaignsOptions {
  dryRun?: boolean;
  format?: 'json' | 'text';
}

export interface PullEventsOptions {
  dryRun?: boolean;
  format?: 'json' | 'text';
  since?: string;
  limit?: number;
  retryAfterCapMs?: number;
  assumeNowOccurredAt?: boolean;
  pullTimestamp?: string;
  onAssumeNow?: (info: { count: number }) => void;
}

export interface SmartleadMcpClient {
  listCampaigns(options: ListCampaignsOptions): Promise<{ campaigns: SmartleadCampaign[]; dryRun?: boolean }>;
  pullEvents(options: PullEventsOptions): Promise<{ events: SmartleadEvent[]; dryRun?: boolean }>;
  sendEmail?(payload: {
    to: string;
    subject: string;
    body: string;
    campaignId?: string;
  }): Promise<{ provider_message_id: string }>;
}

export function buildSmartleadMcpClient(config: SmartleadMcpConfig): SmartleadMcpClient {
  const fetchImpl = config.fetchImpl ?? fetch;
  const envRetryCap = process.env.SMARTLEAD_MCP_RETRY_AFTER_CAP_MS;
  const envRetryCapMs = envRetryCap && !Number.isNaN(Number(envRetryCap)) ? Number(envRetryCap) : undefined;

  const baseHeaders = {
    Authorization: `Bearer ${config.token}`,
    'Content-Type': 'application/json',
    ...(config.workspaceId ? { 'X-Workspace-Id': config.workspaceId } : {}),
  };

  async function listCampaigns(options: ListCampaignsOptions = {}) {
    if (options.dryRun) {
      return { campaigns: [], dryRun: true as const };
    }
    const trace = isTracingEnabled()
      ? startTrace({ span: 'smartlead.listCampaigns', service: 'smartlead-mcp' })
      : undefined;
    try {
      const response = await fetchImpl(`${config.url}/campaigns`, {
        method: 'GET',
        headers: baseHeaders,
      });
      if (!response.ok) {
        const err = await buildResponseError(response, `${config.url}/campaigns`);
        throw err;
      }
      const data = (await response.json()) as { campaigns?: SmartleadCampaign[] };
      if (trace) emitTrace(finishTrace(trace, 'ok'));
      return { campaigns: data.campaigns ?? [] };
    } catch (err: any) {
      if (trace) emitTrace(finishTrace(trace, 'error', err?.message));
      throw err;
    }
  }

  async function pullEvents(options: PullEventsOptions = {}) {
    if (options.dryRun) {
      return { events: [], dryRun: true as const };
    }
    const pullTimestamp = options.assumeNowOccurredAt
      ? options.pullTimestamp ?? new Date().toISOString()
      : undefined;
    const qs = new URLSearchParams();
    if (options.since) qs.set('since', options.since);
    if (options.limit !== undefined) qs.set('limit', String(options.limit));
    const url = `${config.url}/events${qs.toString() ? `?${qs.toString()}` : ''}`;

    const trace = isTracingEnabled()
      ? startTrace({ span: 'smartlead.pullEvents', service: 'smartlead-mcp' })
      : undefined;
    try {
      const response = await requestWithRetry(
        fetchImpl,
        url,
        baseHeaders,
        options.retryAfterCapMs ?? envRetryCapMs
      );
      const data = (await response.json()) as { events?: Array<Record<string, any>> };
      let assumeCount = 0;
      const events = (data.events ?? []).map((evt) =>
        normalizeEvent(evt, {
          assumeNowOccurredAt: Boolean(options.assumeNowOccurredAt),
          pullTimestamp,
          onAssume: () => assumeCount++,
        })
      );
      if (assumeCount > 0 && options.onAssumeNow) {
        options.onAssumeNow({ count: assumeCount });
      }
      if (trace) emitTrace(finishTrace(trace, 'ok'));
      return { events };
    } catch (err: any) {
      if (trace) emitTrace(finishTrace(trace, 'error', err?.message));
      throw err;
    }
  }

  return {
    listCampaigns,
    pullEvents,
  };
}

function normalizeEvent(
  event: Record<string, any>,
  opts: { assumeNowOccurredAt?: boolean; pullTimestamp?: string; onAssume?: () => void }
): SmartleadEvent {
  const occurredAt =
    event.occurred_at ??
    (opts.assumeNowOccurredAt ? opts.pullTimestamp ?? new Date().toISOString() : undefined);
  if (!occurredAt) {
    throw new Error(
      '[ERR_MCP_OCCURRED_AT_MISSING] occurred_at is required for Smartlead events. Supply it from provider or use --assume-now-occurred-at if acceptable.'
    );
  }
  if (!event.occurred_at && opts.assumeNowOccurredAt && opts.onAssume) {
    opts.onAssume();
  }
  const providerEventId =
    event.id ??
    event.provider_event_id ??
    buildStableEventId(event.provider ?? 'smartlead', occurredAt, event.outbound_id, event.type, event.raw);
  return {
    provider: 'smartlead',
    provider_event_id: providerEventId,
    event_type: event.type ?? 'unknown',
    outcome_classification: event.outcome ?? null,
    contact_id: event.contact_id ?? null,
    outbound_id: event.outbound_id ?? null,
    occurred_at: occurredAt,
    payload: event.raw ? { raw: event.raw } : {},
  };
}

async function requestWithRetry(
  fetchImpl: typeof fetch,
  url: string,
  headers: Record<string, string>,
  retryAfterCapMs?: number
) {
  const maxRetries = 1;
  let attempt = 0;
  let lastError: any;
  while (attempt <= maxRetries) {
    const response = await fetchImpl(url, { method: 'GET', headers });
    if (response.ok) {
      return response;
    }
    const { error, retryAfterMs } = await buildResponseError(response, url);
    lastError = error;
    if ((response.status >= 500 || response.status === 429) && attempt < maxRetries) {
      const waitMs = Math.min(retryAfterMs ?? 50, retryAfterCapMs ?? DEFAULT_RETRY_AFTER_CAP_MS);
      await sleep(waitMs);
      attempt += 1;
      continue;
    }
    throw error;
  }
  throw lastError;
}

async function buildResponseError(response: any, url: string) {
  const bodyText = await response.text();
  let parsed: any;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    parsed = undefined;
  }
  const rawSnippet = parsed?.error ?? parsed?.message ?? bodyText;
  const snippetCap = 500;
  const truncated =
    typeof rawSnippet === 'string' && rawSnippet.length > snippetCap
      ? `${rawSnippet.slice(0, snippetCap)}...(truncated)`
      : rawSnippet;
  const bodySnippet = typeof truncated === 'string' ? truncated : JSON.stringify(truncated);
  const retryAfterMs = parseRetryAfter(response.headers);
  const err = new Error(
    `Smartlead MCP request failed (${response.status} ${response.statusText}) for ${url} - ${bodySnippet}`
  );
  return { error: err, retryAfterMs };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRetryAfter(headers: any): number | undefined {
  if (!headers || typeof headers.get !== 'function') return undefined;
  const raw = headers.get('Retry-After');
  if (!raw) return undefined;
  const asNumber = Number(raw);
  if (!Number.isNaN(asNumber)) {
    return Math.round(asNumber * 1000);
  }
  const date = Date.parse(raw);
  if (Number.isNaN(date)) return undefined;
  const diff = date - Date.now();
  return diff > 0 ? diff : undefined;
}

function buildStableEventId(
  provider: string,
  occurredAt?: string,
  outboundId?: string,
  eventType?: string,
  raw?: unknown
) {
  const parts = [provider, occurredAt ?? '', outboundId ?? '', eventType ?? '', raw ? JSON.stringify(raw) : ''];
  return createHash('sha256').update(parts.join('|')).digest('hex');
}
