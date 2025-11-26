import http from 'node:http';
import { URL, fileURLToPath } from 'node:url';

import { loadEnv } from '../config/env';
import { AiClient } from '../services/aiClient';
import { generateDrafts } from '../services/drafts';
import { getReplyPatterns } from '../services/emailEvents';
import { initSupabaseClient } from '../services/supabaseClient';
import { smartleadSendCommand } from '../commands/smartleadSend';
import type { SmartleadMcpClient } from '../integrations/smartleadMcp';
import { buildSmartleadMcpClient } from '../integrations/smartleadMcp';

type Campaign = { id: string; name: string; status?: string };
type DraftRow = { id: string; status?: string; contact?: string };
type DraftSummary = { generated: number; dryRun: boolean; gracefulUsed?: number };
type SendSummary = { sent: number; failed: number; skipped: number; fetched: number };
type EventRow = { id: string; event_type: string; occurred_at: string };
type PatternRow = { reply_label: string; count: number };

type AdapterDeps = {
  listCampaigns: () => Promise<Campaign[]>;
  listDrafts: (params: { campaignId?: string; status?: string }) => Promise<DraftRow[]>;
  generateDrafts: (payload: { campaignId: string; dryRun?: boolean; limit?: number }) => Promise<DraftSummary>;
  sendSmartlead: (payload: { dryRun?: boolean; batchSize?: number }) => Promise<SendSummary>;
  listEvents: (params: { since?: string; limit?: number }) => Promise<EventRow[]>;
  listReplyPatterns: (params: { since?: string; topN?: number }) => Promise<PatternRow[]>;
};

async function readJson<T>(req: http.IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString() || '{}';
  return JSON.parse(raw) as T;
}

type DispatchRequest = {
  method: string;
  pathname: string;
  searchParams?: URLSearchParams;
  body?: any;
};

type MetaStatus = {
  mode: 'live' | 'mock';
  apiBase: string;
  smartleadReady: boolean;
  supabaseReady: boolean;
};

type DispatchResponse = { status: number; body: unknown };

export async function dispatch(
  deps: AdapterDeps,
  req: DispatchRequest,
  meta?: MetaStatus
): Promise<DispatchResponse> {
  const { method, pathname, searchParams = new URLSearchParams() } = req;

  if (method === 'GET' && pathname === '/api/campaigns') {
    return { status: 200, body: await deps.listCampaigns() };
  }

  if (method === 'GET' && pathname === '/api/drafts') {
    return {
      status: 200,
      body: await deps.listDrafts({
        campaignId: searchParams.get('campaignId') ?? undefined,
        status: searchParams.get('status') ?? undefined,
      }),
    };
  }

  if (method === 'POST' && pathname === '/api/drafts/generate') {
    return { status: 200, body: await deps.generateDrafts(req.body) };
  }

  if (method === 'POST' && pathname === '/api/smartlead/send') {
    return { status: 200, body: await deps.sendSmartlead(req.body) };
  }

  if (method === 'GET' && pathname === '/api/events') {
    return {
      status: 200,
      body: await deps.listEvents({
        since: searchParams.get('since') ?? undefined,
        limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
      }),
    };
  }

  if (method === 'GET' && pathname === '/api/reply-patterns') {
    return {
      status: 200,
      body: await deps.listReplyPatterns({
        since: searchParams.get('since') ?? undefined,
        topN: searchParams.get('topN') ? Number(searchParams.get('topN')) : undefined,
      }),
    };
  }

  if (method === 'GET' && pathname === '/api/meta') {
    return { status: 200, body: meta ?? buildMeta({ mode: 'live' }) };
  }

  return { status: 404, body: { error: 'Not found' } };
}

function json(res: http.ServerResponse, body: unknown, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

export function createWebAdapter(deps: AdapterDeps, meta: MetaStatus) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const { pathname, searchParams } = url;

    try {
      const payload =
        req.method === 'POST' ? await readJson<any>(req) : undefined;
      const response = await dispatch(
        deps,
        {
          method: req.method ?? 'GET',
          pathname,
          searchParams,
          body: payload,
        },
        meta
      );
      json(res, response.body, response.status);
    } catch (err: any) {
      json(res, { error: err?.message ?? 'Server error' }, 500);
    }
  });
}

export function createMockDeps(): AdapterDeps {
  const mockCampaigns: Campaign[] = [{ id: 'camp-1', name: 'Mock Campaign', status: 'draft' }];
  const mockDrafts: DraftRow[] = [
    { id: 'draft-1', status: 'pending', contact: 'a@example.com' },
    { id: 'draft-2', status: 'approved', contact: 'b@example.com' },
  ];
  return {
    listCampaigns: async () => mockCampaigns,
    listDrafts: async ({ status }) => (status ? mockDrafts.filter((d) => d.status === status) : mockDrafts),
    generateDrafts: async ({ dryRun }) => ({
      generated: dryRun ? 0 : mockDrafts.length,
      dryRun: Boolean(dryRun),
      gracefulUsed: 0,
    }),
    sendSmartlead: async ({ dryRun }) => ({
      sent: dryRun ? 0 : 1,
      failed: 0,
      skipped: dryRun ? 1 : 0,
      fetched: mockDrafts.length,
    }),
    listEvents: async () => [],
    listReplyPatterns: async () => [],
  };
}

export function createLiveDeps(
  opts: {
    supabase?: any;
    aiClient?: AiClient;
    smartlead?: SmartleadMcpClient;
  } = {}
): AdapterDeps {
  const env = loadEnv();
  const supabase = opts.supabase ?? initSupabaseClient(env);
  const aiClient =
    opts.aiClient ??
    new AiClient(async () => ({
      subject: 'Draft subject',
      body: 'Draft body',
      metadata: {
        model: 'mock-model',
        language: 'en',
        pattern_mode: null,
        email_type: 'intro',
        coach_prompt_id: 'mock',
      },
    }));

  const smartlead = opts.smartlead ?? buildSmartleadClientFromEnv();

  return {
    listCampaigns: async () => {
      const { data, error } = await supabase.from('campaigns').select('id,name,status');
      if (error) throw error;
      return data as Campaign[];
    },
    listDrafts: async ({ campaignId, status }) => {
      let query = supabase.from('drafts').select('id,status,contact_id');
      if (campaignId) query = query.eq('campaign_id', campaignId);
      if (status) query = query.eq('status', status);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((row: any) => ({
        id: row.id,
        status: row.status,
        contact: row.contact_id,
      })) as DraftRow[];
    },
    generateDrafts: async ({ campaignId, dryRun, limit, interactionMode, dataQualityMode }) => {
      return generateDrafts(supabase, aiClient, {
        campaignId,
        dryRun,
        limit,
        // interactionMode/dataQualityMode not yet used by generator; captured for future telemetry
        interactionMode,
        dataQualityMode,
      } as any);
    },
    sendSmartlead: async ({ dryRun, batchSize }) => {
      const summary = await smartleadSendCommand(smartlead, supabase, {
        dryRun,
        batchSize,
      });
      return { ...summary, fetched: summary.fetched ?? 0 };
    },
    listEvents: async ({ since, limit }) => {
      let query = supabase.from('email_events').select('id,event_type,occurred_at').order('occurred_at', {
        ascending: false,
      });
      if (since) query = query.gte('occurred_at', since);
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return data as EventRow[];
    },
    listReplyPatterns: async ({ since, topN }) => getReplyPatterns(supabase, { since, topN }),
  };
}

export function startWebAdapter(deps: AdapterDeps, port = 8787, meta?: MetaStatus) {
  const server = createWebAdapter(
    deps,
    meta ?? buildMeta({ mode: process.env.WEB_ADAPTER_MODE === 'mock' ? 'mock' : 'live' })
  );
  server.listen(port);
  return server;
}

if ((process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 8787);
  const useMock = process.env.WEB_ADAPTER_MODE === 'mock';
  const deps = useMock ? createMockDeps() : createLiveDeps();
  startWebAdapter(deps, port, buildMeta({ mode: useMock ? 'mock' : 'live' }));
  // eslint-disable-next-line no-console
  console.log(
    `[web adapter] listening on http://localhost:${port}/api (mode=${useMock ? 'mock' : 'live'})`
  );
}

export function buildSmartleadClientFromEnv(): SmartleadMcpClient {
  const url = process.env.SMARTLEAD_MCP_URL;
  const token = process.env.SMARTLEAD_MCP_TOKEN;
  const workspaceId = process.env.SMARTLEAD_MCP_WORKSPACE_ID;
  if (!url || !token) {
    throw new Error('SMARTLEAD_MCP_URL and SMARTLEAD_MCP_TOKEN are required for live adapter');
  }
  const client = buildSmartleadMcpClient({ url, token, workspaceId, fetchImpl: async () => new Response() });
  // Provide sendEmail stub until outbound is fully wired.
  return {
    ...client,
    sendEmail: async () => ({ provider_message_id: 'mock-id' }),
  };
}

export function buildMeta(opts: { mode: 'live' | 'mock' }): MetaStatus {
  const supabaseReady = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const smartleadReady = Boolean(process.env.SMARTLEAD_MCP_URL && process.env.SMARTLEAD_MCP_TOKEN);
  return {
    mode: opts.mode,
    apiBase: '/api',
    supabaseReady,
    smartleadReady,
  };
}
