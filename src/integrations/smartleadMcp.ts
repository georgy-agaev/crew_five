/* eslint-disable security-node/detect-unhandled-async-errors */
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

export interface SmartleadLeadInput {
  first_name?: string;
  last_name?: string;
  email: string;
  phone_number?: string;
  company_name?: string;
  website?: string;
  location?: string;
  custom_fields?: Record<string, unknown>;
  linkedin_profile?: string;
  company_url?: string;
}

export interface SmartleadLeadSettings {
  ignore_global_block_list?: boolean;
  ignore_unsubscribe_list?: boolean;
  ignore_community_bounce_list?: boolean;
  ignore_duplicate_leads_in_other_campaign?: boolean;
  return_lead_ids?: boolean;
}

export interface SmartleadSequenceInput {
  seq_number: number;
  delay_in_days: number;
  subject: string;
  email_body: string;
  variant_label: string;
}

export interface SmartleadMcpClient {
  listCampaigns(options: ListCampaignsOptions): Promise<{ campaigns: SmartleadCampaign[]; dryRun?: boolean }>;
  listActiveCampaigns?: () => Promise<SmartleadCampaign[]>;
  createCampaign?: (payload: { name: string; status?: string }) => Promise<{ id: string; name: string; status?: string }>;
  pullEvents(options: PullEventsOptions): Promise<{ events: SmartleadEvent[]; dryRun?: boolean }>;
  sendEmail?(payload: {
    to: string;
    subject: string;
    body: string;
    campaignId?: string;
  }): Promise<{ provider_message_id: string }>;
  addLeadsToCampaign?(args: {
    campaignId: string;
    leads: SmartleadLeadInput[];
    settings?: SmartleadLeadSettings;
  }): Promise<{ message?: string; leadIds?: Record<string, string> }>;
  saveCampaignSequences?(args: {
    campaignId: string;
    sequences: SmartleadSequenceInput[];
  }): Promise<unknown>;
}

export function buildSmartleadMcpClient(config: SmartleadMcpConfig): SmartleadMcpClient {
  const fetchImpl = config.fetchImpl ?? fetch;
  const envRetryCap = process.env.SMARTLEAD_MCP_RETRY_AFTER_CAP_MS;
  const envRetryCapMs = envRetryCap && !Number.isNaN(Number(envRetryCap)) ? Number(envRetryCap) : undefined;
  const isSmartleadApi = config.url.includes('server.smartlead.ai/api');

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
      let campaigns: SmartleadCampaign[] = [];
      if (isSmartleadApi) {
        const base = config.url.endsWith('/') ? config.url.slice(0, -1) : config.url;
        const url = `${base}/analytics/campaign/list?${new URLSearchParams({
          api_key: config.token,
        }).toString()}`;
        const response = await fetchImpl(url, {
          method: 'GET',
        });
        if (!response.ok) {
          const { error } = await buildResponseError(response, url);
          throw error;
        }
        const data = (await response.json()) as any;
        const rawCampaigns =
          data?.data?.campaigns ??
          data?.data?.campaign_list ??
          data?.campaigns ??
          data?.campaign_list ??
          [];
        campaigns = (rawCampaigns as any[]).map((c) => ({
          id: String(c.id),
          name: String(c.name ?? ''),
          ...c,
        }));
      } else {
        const url = `${config.url}/campaigns`;
        const response = await fetchImpl(url, {
          method: 'GET',
          headers: baseHeaders,
        });
        if (!response.ok) {
          const { error } = await buildResponseError(response, url);
          throw error;
        }
        const data = (await response.json()) as { campaigns?: SmartleadCampaign[] };
        campaigns = data.campaigns ?? [];
      }
      if (trace) emitTrace(finishTrace(trace, 'ok'));
      return { campaigns };
    } catch (err: any) {
      if (trace) emitTrace(finishTrace(trace, 'error', err?.message));
      throw err;
    }
  }

  async function listActiveCampaigns() {
    if (!isSmartleadApi) {
      const { campaigns } = await listCampaigns();
      return campaigns.filter((c: any) => !c.status || ['active', 'paused', 'completed', 'ready', 'stopped'].includes((c.status ?? '').toLowerCase()));
    }
    const base = config.url.endsWith('/') ? config.url.slice(0, -1) : config.url;
    const search = new URLSearchParams({
      api_key: config.token,
      status: 'active',
    });
    // Smartlead API may not support multiple statuses; fetch active first
    const urls = [
      `${base}/analytics/campaign/list?${search.toString()}`,
      `${base}/analytics/campaign/list?${new URLSearchParams({ api_key: config.token, status: 'paused' }).toString()}`,
      `${base}/analytics/campaign/list?${new URLSearchParams({ api_key: config.token, status: 'completed' }).toString()}`,
    ];
    const all: any[] = [];
    for (const url of urls) {
      const response = await fetchImpl(url, { method: 'GET' });
      if (!response.ok) {
        const { error } = await buildResponseError(response, url);
        throw error;
      }
      const data = (await response.json()) as any;
      const rawCampaigns =
        data?.data?.campaigns ?? data?.data?.campaign_list ?? data?.campaigns ?? data?.campaign_list ?? [];
      all.push(...rawCampaigns);
    }
    const seen = new Set<string>();
    return all
      .map((c) => ({
        id: String(c.id),
        name: String(c.name ?? ''),
        status: c.status ?? 'active',
        ...c,
      }))
      .filter((c) => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
      });
  }

  async function createCampaign(payload: { name: string; status?: string }) {
    const status = payload.status ?? 'active';
    if (!payload.name) throw new Error('Campaign name is required');
    if (!isSmartleadApi) {
      throw new Error('Smartlead MCP mode does not support campaign creation');
    }
    const base = config.url.endsWith('/') ? config.url.slice(0, -1) : config.url;
    const url = `${base}/campaigns/create?${new URLSearchParams({ api_key: config.token }).toString()}`;
    const body: Record<string, any> = { name: payload.name };
    if (config.workspaceId) body.client_id = config.workspaceId;
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const { error } = await buildResponseError(response, url);
      throw error;
    }
    const data = (await response.json()) as any;
    const created = data?.data ?? data ?? {};
    return { id: String(created.id ?? created.campaign_id ?? created.campaignId ?? payload.name), name: payload.name, status };
  }

  async function pullEvents(options: PullEventsOptions = {}) {
    if (options.dryRun) {
      return { events: [], dryRun: true as const };
    }
    if (isSmartleadApi) {
      throw new Error(
        '[ERR_SMARTLEAD_EVENTS_UNSUPPORTED] pullEvents is not implemented for direct Smartlead API; use webhooks or an MCP server for event ingestion.'
      );
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

  async function addLeadsToCampaign(args: {
    campaignId: string;
    leads: SmartleadLeadInput[];
    settings?: SmartleadLeadSettings;
  }) {
    if (!isSmartleadApi) {
      throw new Error(
        '[ERR_SMARTLEAD_API_ONLY] addLeadsToCampaign is only supported for the direct Smartlead API.'
      );
    }
    const base = config.url.endsWith('/') ? config.url.slice(0, -1) : config.url;
    const url = `${base}/campaigns/${encodeURIComponent(
      args.campaignId
    )}/leads?${new URLSearchParams({ api_key: config.token }).toString()}`;
    const body: any = {
      lead_list: args.leads,
    };
    if (args.settings) {
      body.settings = args.settings;
    }
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const { error } = await buildResponseError(response, url);
      throw error;
    }
    const data = (await response.json().catch(() => ({}))) as any;
    const leadIds = data.lead_ids ?? data.leadIds;
    return {
      message: data.message as string | undefined,
      leadIds: leadIds as Record<string, string> | undefined,
    };
  }

  async function saveCampaignSequences(args: {
    campaignId: string;
    sequences: SmartleadSequenceInput[];
  }) {
    if (!isSmartleadApi) {
      throw new Error(
        '[ERR_SMARTLEAD_API_ONLY] saveCampaignSequences is only supported for the direct Smartlead API.'
      );
    }
    const base = config.url.endsWith('/') ? config.url.slice(0, -1) : config.url;
    const url = `${base}/campaigns/${encodeURIComponent(
      args.campaignId
    )}/sequences?${new URLSearchParams({ api_key: config.token }).toString()}`;
    const sequencesPayload = args.sequences.map((seq) => ({
      seq_number: seq.seq_number,
      seq_delay_details: { delay_in_days: seq.delay_in_days },
      seq_type: 'EMAIL',
      seq_variants: [
        {
          subject: seq.subject,
          email_body: seq.email_body,
          variant_label: seq.variant_label,
        },
      ],
    }));
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sequences: sequencesPayload }),
    });
    if (!response.ok) {
      const { error } = await buildResponseError(response, url);
      throw error;
    }
    return response.json().catch(() => ({}));
  }

  return {
    listCampaigns,
    listActiveCampaigns,
    createCampaign,
    pullEvents,
    addLeadsToCampaign,
    saveCampaignSequences,
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
