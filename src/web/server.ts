/* eslint-disable security-node/detect-crlf */
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
import { ensureSegmentSnapshot } from '../services/segmentSnapshotWorkflow';
import { enqueueSegmentEnrichment, getSegmentEnrichmentStatus, runSegmentEnrichmentOnce } from '../services/enrichSegment';
import { getSegmentById } from '../services/segments';
import { createIcpHypothesis, createIcpProfile } from '../services/icp';
import {
  getAnalyticsByIcpAndHypothesis,
  getAnalyticsByPatternAndUserEdit,
  getAnalyticsBySegmentAndRole,
  getSimJobSummaryForAnalytics,
  suggestPromptPatternAdjustments,
} from '../services/analytics';
import { completeSimAsNotImplemented, createSimRequest } from '../services/sim';

type Campaign = { id: string; name: string; status?: string; segment_id?: string | null; segment_version?: number | null };
type DraftRow = { id: string; status?: string; contact?: string };
type DraftSummary = { generated: number; dryRun: boolean; gracefulUsed?: number };
type SendSummary = { sent: number; failed: number; skipped: number; fetched: number };
type EventRow = { id: string; event_type: string; occurred_at: string };
type PatternRow = { reply_label: string; count: number };

type AdapterDeps = {
  listCampaigns: () => Promise<Campaign[]>;
  listDrafts: (params: { campaignId?: string; status?: string }) => Promise<DraftRow[]>;
  listSegments?: () => Promise<any[]>;
  snapshotSegment?: (params: { segmentId: string; finalize?: boolean; allowEmpty?: boolean; maxContacts?: number }) => Promise<any>;
  enqueueSegmentEnrichment?: (params: { segmentId: string; adapter?: string; limit?: number; dryRun?: boolean }) => Promise<any>;
  runSegmentEnrichmentOnce?: (job: any, options: { dryRun?: boolean }) => Promise<any>;
  getSegmentEnrichmentStatus?: (segmentId: string) => Promise<any>;
  listCompanies?: (params: { segment?: string; limit?: number }) => Promise<any[]>;
  listContacts?: (params: { companyIds?: string[]; limit?: number }) => Promise<any[]>;
  listSmartleadCampaigns?: () => Promise<any[]>;
  smartleadCreateCampaign?: (payload: { name: string }) => Promise<{ id: string; name: string; status?: string }>;
  listIcpProfiles?: () => Promise<any[]>;
  createIcpProfile?: (payload: { name: string; description?: string }) => Promise<any>;
  listIcpHypotheses?: (params: { icpProfileId?: string; segmentId?: string }) => Promise<any[]>;
  createIcpHypothesis?: (payload: { icpProfileId: string; hypothesisLabel: string; segmentId?: string; searchConfig?: Record<string, unknown> }) => Promise<any>;
  generateDrafts: (payload: {
    campaignId: string;
    dryRun?: boolean;
    limit?: number;
    interactionMode?: 'coach' | 'express';
    dataQualityMode?: 'strict' | 'graceful';
    icpProfileId?: string;
    icpHypothesisId?: string;
  }) => Promise<DraftSummary>;
  sendSmartlead: (payload: { dryRun?: boolean; batchSize?: number; leadIds?: string[] }) => Promise<SendSummary>;
  listEvents: (params: { since?: string; limit?: number }) => Promise<EventRow[]>;
  listReplyPatterns: (params: { since?: string; topN?: number }) => Promise<PatternRow[]>;
  analyticsSummary?: (params: { groupBy?: string; since?: string }) => Promise<any>;
  analyticsOptimize?: (params: { since?: string }) => Promise<any>;
  listPromptRegistry?: () => Promise<any[]>;
  createPromptRegistryEntry?: (payload: Record<string, unknown>) => Promise<any>;
  createSimJobStub?: (payload: { mode?: string }) => Promise<any>;
  generateIcpProfile?: (payload: Record<string, unknown>) => Promise<any>;
  generateIcpHypothesis?: (payload: Record<string, unknown>) => Promise<any>;
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

  if (method === 'GET' && pathname === '/api/segments') {
    if (!deps.listSegments) return { status: 501, body: { error: 'Segments not configured' } };
    return { status: 200, body: await deps.listSegments() };
  }

  if (method === 'POST' && pathname === '/api/segments/snapshot') {
    if (!deps.snapshotSegment) return { status: 501, body: { error: 'Snapshot not configured' } };
    const body = req.body ?? {};
    if (!body.segmentId) return { status: 400, body: { error: 'segmentId is required' } };
    const finalize = body.finalize !== false;
    const allowEmpty = body.allowEmpty === true;
    const maxContacts = body.maxContacts ? Number(body.maxContacts) : undefined;
    return {
      status: 200,
      body: await deps.snapshotSegment({
        segmentId: body.segmentId,
        finalize,
        allowEmpty,
        maxContacts,
      }),
    };
  }

  if (method === 'POST' && pathname === '/api/enrich/segment') {
    if (!deps.enqueueSegmentEnrichment) return { status: 501, body: { error: 'Enrich not configured' } };
    const body = req.body ?? {};
    if (!body.segmentId) return { status: 400, body: { error: 'segmentId is required' } };
    const job = await deps.enqueueSegmentEnrichment({
      segmentId: body.segmentId,
      adapter: body.adapter ?? 'mock',
      limit: body.limit ? Number(body.limit) : undefined,
      dryRun: body.dryRun,
    });
    if (body.runNow && deps.runSegmentEnrichmentOnce) {
      const summary = await deps.runSegmentEnrichmentOnce(job, { dryRun: body.dryRun });
      return { status: 200, body: { status: 'completed', jobId: job.id, summary } };
    }
    return { status: 200, body: { status: 'queued', jobId: job.id } };
  }

  if (method === 'GET' && pathname === '/api/enrich/status') {
    if (!deps.getSegmentEnrichmentStatus) return { status: 501, body: { error: 'Enrich status not configured' } };
    const segmentId = searchParams.get('segmentId');
    if (!segmentId) return { status: 400, body: { error: 'segmentId is required' } };
    return { status: 200, body: await deps.getSegmentEnrichmentStatus(segmentId) };
  }

  if (method === 'POST' && pathname === '/api/drafts/generate') {
    return { status: 200, body: await deps.generateDrafts(req.body) };
  }

  if (method === 'POST' && pathname === '/api/smartlead/send') {
    const body = req.body ?? {};
    const leadIds = Array.isArray(body.leadIds) ? body.leadIds.slice(0, 500) : [];
    const payload = { ...body, dryRun: body.dryRun ?? true, leadIds };
    try {
      return { status: 200, body: await deps.sendSmartlead(payload) };
    } catch (err: any) {
      return { status: 500, body: { error: err?.message ?? 'Smartlead send failed' } };
    }
  }

  if (method === 'POST' && pathname === '/api/smartlead/campaigns') {
    if (!deps.smartleadCreateCampaign) {
      return { status: 501, body: { error: 'Smartlead create not configured' } };
    }
    const body = req.body ?? {};
    const dryRun = body.dryRun ?? true;
    const name = body.name as string | undefined;
    if (!name) return { status: 400, body: { error: 'Campaign name is required' } };
    if (dryRun) return { status: 200, body: { id: 'dry-run', name, status: 'dry-run', dryRun: true } };
    try {
      const created = await deps.smartleadCreateCampaign({ name });
      return { status: 200, body: created };
    } catch (err: any) {
      return { status: 500, body: { error: err?.message ?? 'Failed to create Smartlead campaign' } };
    }
  }

  if (method === 'GET' && pathname === '/api/icp/profiles') {
    if (!deps.listIcpProfiles) return { status: 501, body: { error: 'ICP not configured' } };
    return { status: 200, body: await deps.listIcpProfiles() };
  }

  if (method === 'POST' && pathname === '/api/icp/profiles') {
    if (!deps.createIcpProfile) return { status: 501, body: { error: 'ICP not configured' } };
    const body = req.body ?? {};
    if (!body.name) return { status: 400, body: { error: 'name is required' } };
    return { status: 200, body: await deps.createIcpProfile({ name: body.name, description: body.description }) };
  }

  if (method === 'GET' && pathname === '/api/icp/hypotheses') {
    if (!deps.listIcpHypotheses) return { status: 501, body: { error: 'ICP not configured' } };
    return {
      status: 200,
      body: await deps.listIcpHypotheses({
        icpProfileId: searchParams.get('icpProfileId') ?? undefined,
        segmentId: searchParams.get('segmentId') ?? undefined,
      }),
    };
  }

  if (method === 'POST' && pathname === '/api/icp/hypotheses') {
    if (!deps.createIcpHypothesis) return { status: 501, body: { error: 'ICP not configured' } };
    const body = req.body ?? {};
    if (!body.icpProfileId) return { status: 400, body: { error: 'icpProfileId is required' } };
    if (!body.hypothesisLabel) return { status: 400, body: { error: 'hypothesisLabel is required' } };
    return {
      status: 200,
      body: await deps.createIcpHypothesis({
        icpProfileId: body.icpProfileId,
        hypothesisLabel: body.hypothesisLabel,
        segmentId: body.segmentId,
        searchConfig: body.searchConfig,
      }),
    };
  }

  if (method === 'POST' && pathname === '/api/coach/icp') {
    if (!deps.generateIcpProfile) return { status: 501, body: { error: 'Coach not configured' } };
    return { status: 200, body: await deps.generateIcpProfile(req.body ?? {}) };
  }

  if (method === 'POST' && pathname === '/api/coach/hypothesis') {
    if (!deps.generateIcpHypothesis) return { status: 501, body: { error: 'Coach not configured' } };
    return { status: 200, body: await deps.generateIcpHypothesis(req.body ?? {}) };
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

  if (method === 'GET' && pathname === '/api/analytics/summary') {
    if (!deps.analyticsSummary) return { status: 501, body: { error: 'Analytics not configured' } };
    const groupBy = searchParams.get('groupBy') ?? undefined;
    const since = searchParams.get('since') ?? undefined;
    return { status: 200, body: await deps.analyticsSummary({ groupBy, since }) };
  }

  if (method === 'GET' && pathname === '/api/analytics/optimize') {
    if (!deps.analyticsOptimize) return { status: 501, body: { error: 'Analytics not configured' } };
    const since = searchParams.get('since') ?? undefined;
    return { status: 200, body: await deps.analyticsOptimize({ since }) };
  }

  if (method === 'GET' && pathname === '/api/prompt-registry') {
    if (!deps.listPromptRegistry) return { status: 501, body: { error: 'Prompt registry not configured' } };
    return { status: 200, body: await deps.listPromptRegistry() };
  }

  if (method === 'POST' && pathname === '/api/prompt-registry') {
    if (!deps.createPromptRegistryEntry) return { status: 501, body: { error: 'Prompt registry not configured' } };
    return { status: 200, body: await deps.createPromptRegistryEntry(req.body ?? {}) };
  }

  if (method === 'GET' && pathname === '/api/meta') {
    return { status: 200, body: meta ?? buildMeta({ mode: 'live' }) };
  }

  if (method === 'POST' && pathname === '/api/sim') {
    if (!deps.createSimJobStub) return { status: 501, body: { error: 'SIM not configured' } };
    const body = req.body ?? {};
    if (!body.segmentId && !(Array.isArray(body.draftIds) && body.draftIds.length > 0)) {
      return { status: 400, body: { error: 'segmentId or draftIds is required' } };
    }
    return { status: 200, body: await deps.createSimJobStub(body) };
  }

  if (method === 'GET' && pathname === '/api/companies') {
    const segment = searchParams.get('segment') ?? undefined;
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined;
    if (!deps.listCompanies) return { status: 501, body: { error: 'Companies endpoint not configured' } };
    return { status: 200, body: await deps.listCompanies({ segment, limit }) };
  }

  if (method === 'GET' && pathname === '/api/contacts') {
    const ids = searchParams.get('companyIds');
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined;
    const companyIds = ids ? ids.split(',').filter(Boolean) : undefined;
    if (!deps.listContacts) return { status: 501, body: { error: 'Contacts endpoint not configured' } };
    return { status: 200, body: await deps.listContacts({ companyIds, limit }) };
  }

  if (method === 'GET' && pathname === '/api/smartlead/campaigns') {
    if (!deps.listSmartleadCampaigns) return { status: 501, body: { error: 'Smartlead client not configured' } };
    return { status: 200, body: await deps.listSmartleadCampaigns() };
  }

  return { status: 404, body: { error: 'Not found' } };
}

function writeCorsHeaders(res: http.ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(res: http.ServerResponse, body: unknown, status = 200) {
  writeCorsHeaders(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

export function createWebAdapter(deps: AdapterDeps, meta: MetaStatus) {
  return http.createServer(async (req, res) => {
    writeCorsHeaders(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

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
  const mockCompanies = [
    { id: 'co-1', name: 'Mock Co', segment: 'AI', office_quantification: 'remote' },
    { id: 'co-2', name: 'Other Co', segment: 'Industrial', office_quantification: 'hq-heavy' },
  ];
  const mockContacts = [
    { id: 'ct-1', company_id: 'co-1', email: 'a@mock.com', email_status: 'verified' },
    { id: 'ct-2', company_id: 'co-2', email: null, email_status: 'missing' },
  ];
  const mockSegments = [{ id: 'seg-1', name: 'Mock Segment', version: 1 }];
  const mockPromptRegistry = [
    { id: 'draft_intro_v1', step: 'draft', version: 'v1', rollout_status: 'active' },
    { id: 'icp_v1', step: 'icp', version: 'v1', rollout_status: 'active' },
    { id: 'hypo_v1', step: 'hypothesis', version: 'v1', rollout_status: 'active' },
  ];
  const mockIcpProfiles = [{ id: 'p1', name: 'ICP Mock' }];
  const mockHypotheses = [{ id: 'h1', hypothesis_label: 'Hypothesis Mock' }];

  return {
    listCampaigns: async () => mockCampaigns,
    listDrafts: async ({ status }) => (status ? mockDrafts.filter((d) => d.status === status) : mockDrafts),
    listCompanies: async ({ segment }) =>
      segment ? mockCompanies.filter((c) => c.segment === segment) : mockCompanies,
    listContacts: async ({ companyIds }) =>
      companyIds ? mockContacts.filter((c) => companyIds.includes(c.company_id)) : mockContacts,
    listSegments: async () => mockSegments,
    snapshotSegment: async ({ segmentId }) => {
      const seg = mockSegments.find((s) => s.id === segmentId);
      return { version: seg?.version ?? 1, count: mockContacts.length };
    },
    enqueueSegmentEnrichment: async () => ({ id: 'job-1', status: 'queued' }),
    runSegmentEnrichmentOnce: async () => ({ processed: 1, dryRun: false, jobId: 'job-1' }),
    getSegmentEnrichmentStatus: async () => ({ jobId: 'job-1', status: 'completed' }),
    listIcpProfiles: async () => mockIcpProfiles,
    createIcpProfile: async ({ name }) => {
      const created = { id: `p-${mockIcpProfiles.length + 1}`, name };
      mockIcpProfiles.push(created);
      return created;
    },
    listIcpHypotheses: async () => mockHypotheses,
    createIcpHypothesis: async ({ hypothesisLabel }) => {
      const created = { id: `h-${mockHypotheses.length + 1}`, hypothesis_label: hypothesisLabel };
      mockHypotheses.push(created);
      return created;
    },
    generateIcpProfile: async (payload) => ({ id: `p-${mockIcpProfiles.length + 1}`, ...payload }),
    generateIcpHypothesis: async (payload) => ({ id: `h-${mockHypotheses.length + 1}`, ...payload }),
    listPromptRegistry: async () => mockPromptRegistry,
    createPromptRegistryEntry: async (payload) => {
      const created = { id: payload.id ?? `pr-${mockPromptRegistry.length + 1}`, ...payload };
      mockPromptRegistry.push(created as any);
      return created;
    },
    generateDrafts: async ({ dryRun }) => ({
      generated: dryRun ? 0 : mockDrafts.length,
      dryRun: Boolean(dryRun),
      gracefulUsed: 0,
    }),
    sendSmartlead: async ({ dryRun, leadIds }) => {
      const fetched = leadIds?.length ?? mockDrafts.length;
      return {
        sent: dryRun ? 0 : 1,
        failed: 0,
        skipped: dryRun ? fetched : 0,
        fetched,
      };
    },
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
      const { data, error } = await supabase.from('campaigns').select('id,name,status,segment_id,segment_version');
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
    listSegments: async () => {
      const { data, error } = await supabase
        .from('segments')
        .select('id,name,version,created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).filter((row: any) => (row.version ?? 0) >= 0);
    },
    snapshotSegment: async ({ segmentId, finalize = true, allowEmpty, maxContacts }) => {
      const segment = await getSegmentById(supabase, segmentId);
      const bumpVersion = finalize && ((segment.version ?? 0) < 1);
      const result = await ensureSegmentSnapshot(supabase, {
        segmentId,
        mode: 'refresh',
        bumpVersion,
        allowEmpty,
        maxContacts,
        forceVersion: finalize,
      });
      return result;
    },
    enqueueSegmentEnrichment: async ({ segmentId, adapter, limit, dryRun }) =>
      enqueueSegmentEnrichment(supabase, {
        segmentId,
        adapter: adapter ?? 'mock',
        limit,
        dryRun,
      }),
    runSegmentEnrichmentOnce: async (job, { dryRun }) => runSegmentEnrichmentOnce(supabase, job, { dryRun }),
    getSegmentEnrichmentStatus: async (segmentId: string) => getSegmentEnrichmentStatus(supabase, segmentId),
    listIcpProfiles: async () => {
      const { data, error } = await supabase.from('icp_profiles').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    createIcpProfile: async ({ name, description }) => createIcpProfile(supabase, { name, description }),
    listIcpHypotheses: async ({ icpProfileId }) => {
      let query = supabase.from('icp_hypotheses').select('*').order('created_at', { ascending: false });
      if (icpProfileId) query = query.eq('icp_id', icpProfileId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    createIcpHypothesis: async ({ icpProfileId, hypothesisLabel, segmentId, searchConfig }) =>
      createIcpHypothesis(supabase, {
        icpProfileId,
        hypothesisLabel,
        segmentId,
        searchConfig,
      }),
    generateDrafts: async ({ campaignId, dryRun, limit, interactionMode, dataQualityMode, icpProfileId, icpHypothesisId }) => {
      return generateDrafts(supabase, aiClient, {
        campaignId,
        dryRun,
        limit,
        // interactionMode/dataQualityMode not yet used by generator; captured for future telemetry
        interactionMode,
        dataQualityMode,
        icpProfileId,
        icpHypothesisId,
      } as any);
    },
    sendSmartlead: async ({ dryRun, batchSize, leadIds }) => {
      if (dryRun) {
        const fetched = leadIds?.length ?? 0;
        return { sent: 0, failed: 0, skipped: fetched, fetched };
      }
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
    analyticsSummary: async ({ groupBy, since }) => {
      const opts = { since };
      if (groupBy === 'segment') {
        return getAnalyticsBySegmentAndRole(supabase, opts);
      }
      if (groupBy === 'pattern') {
        return getAnalyticsByPatternAndUserEdit(supabase, opts);
      }
      return getAnalyticsByIcpAndHypothesis(supabase, opts);
    },
    analyticsOptimize: async ({ since }) => ({
      suggestions: await suggestPromptPatternAdjustments(supabase, { since }),
      simSummary: await getSimJobSummaryForAnalytics(supabase),
    }),
    listPromptRegistry: async () => {
      const { data, error } = await supabase
        .from('prompt_registry')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    createPromptRegistryEntry: async (payload: Record<string, unknown>) => {
      const insertPayload = {
        id: payload.id ?? undefined,
        coach_prompt_id: payload.coach_prompt_id ?? payload.id ?? undefined,
        description: payload.description ?? null,
        version: payload.version ?? null,
        rollout_status: payload.rollout_status ?? null,
        step: payload.step ?? null,
        variant: payload.variant ?? null,
      };
      const { data, error } = await supabase.from('prompt_registry').insert([insertPayload]).select().single();
      if (error || !data) throw error ?? new Error('Failed to insert prompt registry entry');
      return data;
    },
    createSimJobStub: async (payload: { mode?: string }) => {
      if (!payload.segmentId && !(Array.isArray(payload.draftIds) && payload.draftIds.length > 0)) {
        throw new Error('segmentId or draftIds is required');
      }
      const job = await createSimRequest(supabase, {
        mode: (payload.mode as any) ?? 'light_roast',
        segmentId: payload.segmentId ?? null,
        segmentVersion: payload.segmentVersion ?? null,
        draftIds: payload.draftIds ?? [],
      } as any);
      await completeSimAsNotImplemented(supabase, job.id, 'SIM not implemented (coming soon)');
      return { status: 'coming_soon', jobId: job.id };
    },
    generateIcpProfile: async (payload: Record<string, unknown>) => {
      const name = (payload.name as string) ?? 'ICP Profile';
      return createIcpProfile(supabase, {
        name,
        description: (payload.description as string) ?? null ?? undefined,
        companyCriteria: payload.companyCriteria as any,
        personaCriteria: payload.personaCriteria as any,
      });
    },
    generateIcpHypothesis: async (payload: Record<string, unknown>) => {
      const icpProfileId = payload.icpProfileId as string | undefined;
      if (!icpProfileId) throw new Error('icpProfileId is required');
      return createIcpHypothesis(supabase, {
        icpProfileId,
        hypothesisLabel: (payload.hypothesisLabel as string) ?? (payload.label as string) ?? 'Hypothesis',
        searchConfig: payload.searchConfig as any,
      });
    },
    listSmartleadCampaigns: async () => {
      const campaigns = (await smartlead.listCampaigns({ dryRun: false })).campaigns;
      const allowed = new Set(['active', 'ready', 'paused', 'stopped', 'completed']);
      return campaigns
        .filter((c: any) => {
          const status = (c.status ?? '').toLowerCase();
          if (!status) return true;
          if (status === 'archived') return false;
          return allowed.has(status);
        })
        .slice(0, 50)
        .map((c: any) => ({ id: String(c.id), name: c.name ?? `Campaign ${c.id}`, status: c.status ?? 'active' }));
    },
    smartleadCreateCampaign: async ({ name }) => {
      if (!smartlead.createCampaign) throw new Error('Smartlead create not supported');
      return smartlead.createCampaign({ name });
    },
    listCompanies: async ({ segment, limit }) => {
      let query = supabase
        .from('companies')
        .select(
          'id,company_name,segment,office_qualification,registration_date,status,created_at'
        )
        .order('created_at', { ascending: false })
        .limit(limit ?? 5000);
      if (segment) query = query.eq('segment', segment);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    listContacts: async ({ companyIds, limit }) => {
      let query = supabase
        .from('employees')
        .select('id,company_id,full_name,position,work_email,generic_email,company_name')
        .limit(limit ?? 5000);
      if (companyIds && companyIds.length) query = query.in('company_id', companyIds);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
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
  console.log(
    `[web adapter] listening on http://localhost:${port}/api (mode=${useMock ? 'mock' : 'live'})`
  );
}

export function buildSmartleadClientFromEnv(): SmartleadMcpClient {
  const url = process.env.SMARTLEAD_API_BASE ?? process.env.SMARTLEAD_MCP_URL;
  const token = process.env.SMARTLEAD_API_KEY ?? process.env.SMARTLEAD_MCP_TOKEN;
  const workspaceId = process.env.SMARTLEAD_WORKSPACE_ID ?? process.env.SMARTLEAD_MCP_WORKSPACE_ID;
  if (!url || !token) {
    throw new Error('SMARTLEAD_MCP_URL and SMARTLEAD_MCP_TOKEN are required for live adapter');
  }
  // Use real fetch for Smartlead list/ingest; keep sendEmail stub until outbound is wired.
  const client = buildSmartleadMcpClient({ url, token, workspaceId });
  return {
    ...client,
    sendEmail: async () => ({ provider_message_id: 'mock-id' }),
  };
}

export function buildMeta(opts: { mode: 'live' | 'mock' }): MetaStatus {
  const supabaseReady = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const smartleadReady =
    Boolean(process.env.SMARTLEAD_API_BASE && process.env.SMARTLEAD_API_KEY) ||
    Boolean(process.env.SMARTLEAD_MCP_URL && process.env.SMARTLEAD_MCP_TOKEN);
  return {
    mode: opts.mode,
    apiBase: '/api',
    supabaseReady,
    smartleadReady,
  };
}
