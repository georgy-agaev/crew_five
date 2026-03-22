import { buildMeta } from '../meta.js';
import type { AdapterDeps, DispatchRequest, DispatchResponse, MetaStatus } from '../types.js';

export async function handleSystemRoutes(
  deps: AdapterDeps,
  req: DispatchRequest,
  meta?: MetaStatus
): Promise<DispatchResponse | null> {
  const { method, pathname } = req;

  if (method === 'POST' && pathname === '/api/smartlead/send') {
    const body = req.body ?? {};
    if (!body.campaignId) return { status: 400, body: { error: 'campaignId is required' } };
    if (!body.smartleadCampaignId) {
      return { status: 400, body: { error: 'smartleadCampaignId is required' } };
    }
    try {
      return {
        status: 200,
        body: await deps.sendSmartlead({
          dryRun: body.dryRun ?? true,
          batchSize: body.batchSize,
          campaignId: body.campaignId,
          smartleadCampaignId: body.smartleadCampaignId,
          step: body.step,
          variantLabel: body.variantLabel,
        }),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Smartlead send failed';
      return { status: 500, body: { error: message } };
    }
  }

  if (method === 'POST' && pathname === '/api/smartlead/send/batch') {
    const body = req.body ?? {};
    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) {
      return { status: 400, body: { error: 'items must be a non-empty array' } };
    }

    const results: Array<{
      campaignId: string;
      smartleadCampaignId: string;
      status: 'completed' | 'error';
      summary?: unknown;
      error?: string;
    }> = [];

    for (const item of items) {
      const campaignId = typeof item?.campaignId === 'string' ? item.campaignId : '';
      const smartleadCampaignId =
        typeof item?.smartleadCampaignId === 'string' ? item.smartleadCampaignId : '';
      if (!campaignId || !smartleadCampaignId) {
        results.push({
          campaignId,
          smartleadCampaignId,
          status: 'error',
          error: 'campaignId and smartleadCampaignId are required',
        });
        continue;
      }

      try {
        const summary = await deps.sendSmartlead({
          dryRun: body.dryRun ?? true,
          batchSize: body.batchSize,
          campaignId,
          smartleadCampaignId,
          step: body.step,
          variantLabel: body.variantLabel,
        });
        results.push({
          campaignId,
          smartleadCampaignId,
          status: 'completed',
          summary,
        });
      } catch (err: unknown) {
        results.push({
          campaignId,
          smartleadCampaignId,
          status: 'error',
          error: err instanceof Error ? err.message : 'Smartlead send failed',
        });
      }
    }

    const ok = results.some((result) => result.status !== 'error');
    return { status: ok ? 200 : 400, body: { results } };
  }

  if (method === 'GET' && pathname === '/api/smartlead/campaigns') {
    if (!deps.listSmartleadCampaigns) {
      return { status: 501, body: { error: 'Smartlead client not configured' } };
    }
    return { status: 200, body: await deps.listSmartleadCampaigns() };
  }

  if (method === 'POST' && pathname === '/api/smartlead/campaigns') {
    if (!deps.smartleadCreateCampaign) {
      return { status: 501, body: { error: 'Smartlead create not configured' } };
    }
    const body = req.body ?? {};
    if (!body.name) return { status: 400, body: { error: 'Campaign name is required' } };
    if (body.dryRun ?? true) {
      return { status: 200, body: { id: 'dry-run', name: body.name, status: 'dry-run', dryRun: true } };
    }
    try {
      return { status: 200, body: await deps.smartleadCreateCampaign({ name: body.name }) };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create Smartlead campaign';
      return { status: 500, body: { error: message } };
    }
  }

  if (method === 'GET' && pathname === '/api/services') {
    const currentMeta = meta ?? buildMeta({ mode: 'live' });
    return {
      status: 200,
      body: {
        services: [
          { name: 'Supabase', category: 'database', status: currentMeta.supabaseReady ? 'connected' : 'disconnected', hasApiKey: currentMeta.supabaseReady },
          { name: 'OpenAI', category: 'llm', status: process.env.OPENAI_API_KEY ? 'connected' : 'disconnected', hasApiKey: Boolean(process.env.OPENAI_API_KEY) },
          { name: 'Anthropic', category: 'llm', status: process.env.ANTHROPIC_API_KEY ? 'connected' : 'disconnected', hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY) },
          { name: 'Gemini', category: 'llm', status: process.env.GEMINI_API_KEY ? 'connected' : 'disconnected', hasApiKey: Boolean(process.env.GEMINI_API_KEY) },
          { name: 'Smartlead', category: 'delivery', status: currentMeta.smartleadReady ? 'connected' : 'disconnected', hasApiKey: currentMeta.smartleadReady },
          { name: 'Serper', category: 'enrichment', status: process.env.SERPER_API_KEY ? 'connected' : 'disconnected', hasApiKey: Boolean(process.env.SERPER_API_KEY) },
          { name: 'Perplexity', category: 'enrichment', status: process.env.PERPLEXITY_API_KEY ? 'connected' : 'disconnected', hasApiKey: Boolean(process.env.PERPLEXITY_API_KEY) },
          { name: 'Exa', category: 'enrichment', status: process.env.EXA_API_KEY ? 'connected' : 'disconnected', hasApiKey: Boolean(process.env.EXA_API_KEY) },
          { name: 'Parallel', category: 'enrichment', status: process.env.PARALLEL_API_KEY ? 'connected' : 'disconnected', hasApiKey: Boolean(process.env.PARALLEL_API_KEY) },
          { name: 'Firecrawl', category: 'enrichment', status: process.env.FIRECRAWL_API_KEY ? 'connected' : 'disconnected', hasApiKey: Boolean(process.env.FIRECRAWL_API_KEY) },
          { name: 'Anysite', category: 'enrichment', status: process.env.ANYSITE_API_KEY ? 'connected' : 'disconnected', hasApiKey: Boolean(process.env.ANYSITE_API_KEY) },
          { name: 'Prospeo', category: 'enrichment', status: process.env.PROSPEO_API_KEY ? 'connected' : 'disconnected', hasApiKey: Boolean(process.env.PROSPEO_API_KEY) },
          { name: 'Leadmagic', category: 'enrichment', status: process.env.LEADMAGIC_API_KEY ? 'connected' : 'disconnected', hasApiKey: Boolean(process.env.LEADMAGIC_API_KEY) },
          { name: 'TryKitt', category: 'enrichment', status: process.env.TRYKITT_API_KEY ? 'connected' : 'disconnected', hasApiKey: Boolean(process.env.TRYKITT_API_KEY) },
        ],
      },
    };
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

  return null;
}
