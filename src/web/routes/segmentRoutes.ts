import type { AdapterDeps, DispatchRequest, DispatchResponse } from '../types.js';

export async function handleSegmentRoutes(
  deps: AdapterDeps,
  req: DispatchRequest
): Promise<DispatchResponse | null> {
  const { method, pathname, searchParams = new URLSearchParams() } = req;

  if (method === 'GET' && pathname === '/api/settings/enrichment') {
    if (!deps.getEnrichmentSettings) return { status: 501, body: { error: 'Settings not configured' } };
    return { status: 200, body: await deps.getEnrichmentSettings() };
  }

  if (method === 'POST' && pathname === '/api/settings/enrichment') {
    if (!deps.setEnrichmentSettings) return { status: 501, body: { error: 'Settings not configured' } };
    return { status: 200, body: await deps.setEnrichmentSettings(req.body ?? {}) };
  }

  if (method === 'GET' && pathname === '/api/segments') {
    if (!deps.listSegments) return { status: 501, body: { error: 'Segments not configured' } };
    return { status: 200, body: await deps.listSegments() };
  }

  if (method === 'POST' && pathname === '/api/segments') {
    if (!deps.createSegment) return { status: 501, body: { error: 'Segment creation not configured' } };
    const body = req.body ?? {};
    if (!body.name) return { status: 400, body: { error: 'name is required' } };
    if (!body.locale) return { status: 400, body: { error: 'locale is required' } };
    if (!body.filterDefinition) return { status: 400, body: { error: 'filterDefinition is required' } };

    const aiAttribution = body.aiAttribution
      ? {
          usedAI: true,
          suggestionId: body.aiAttribution.suggestionId,
          userDescription: body.aiAttribution.userDescription,
          timestamp: new Date().toISOString(),
        }
      : { usedAI: false };

    try {
      const segment = await deps.createSegment({
        name: body.name,
        locale: body.locale,
        filterDefinition: body.filterDefinition,
        description: body.description,
        createdBy: body.createdBy,
      });

      if (aiAttribution.usedAI) {
        // eslint-disable-next-line security-node/detect-crlf
        console.log('[Segment Creation] AI-assisted segment created:', {
          segmentId: segment.id,
          segmentName: body.name,
          suggestionId: aiAttribution.suggestionId,
          userDescription: aiAttribution.userDescription,
          timestamp: aiAttribution.timestamp,
        });
      }

      return { status: 201, body: segment };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Segment creation failed';
      return { status: 500, body: { error: message } };
    }
  }

  if (method === 'POST' && pathname === '/api/segments/exa') {
    if (!deps.saveExaSegment) return { status: 501, body: { error: 'EXA segment save not configured' } };
    const body = req.body ?? {};
    if (!body.name) return { status: 400, body: { error: 'name is required' } };
    if (!body.locale) return { status: 400, body: { error: 'locale is required' } };
    if (!body.query) return { status: 400, body: { error: 'query is required' } };
    if (!Array.isArray(body.companies) && !Array.isArray(body.employees)) {
      return { status: 400, body: { error: 'At least companies or employees array is required' } };
    }

    try {
      const result = await deps.saveExaSegment({
        name: body.name,
        locale: body.locale,
        companies: body.companies || [],
        employees: body.employees || [],
        query: body.query,
        description: body.description,
      });

      // eslint-disable-next-line security-node/detect-crlf
      console.log('[EXA Segment] Created:', {
        segmentId: result.id,
        segmentName: result.name,
        ...result.stats,
        query: body.query,
      });

      return { status: 201, body: result };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'EXA segment creation failed';
      console.error('[EXA Segment] Error:', message, err);
      return { status: 500, body: { error: message } };
    }
  }

  if (method === 'POST' && pathname === '/api/filters/preview') {
    if (!deps.getFilterPreview) return { status: 501, body: { error: 'Filter preview not configured' } };
    const body = req.body ?? {};
    if (!body.filterDefinition) return { status: 400, body: { error: 'filterDefinition is required' } };
    try {
      return { status: 200, body: await deps.getFilterPreview(body.filterDefinition) };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Filter preview failed';
      return { status: 400, body: { error: message } };
    }
  }

  if (method === 'POST' && pathname === '/api/segments/snapshot') {
    if (!deps.snapshotSegment) return { status: 501, body: { error: 'Snapshot not configured' } };
    const body = req.body ?? {};
    if (!body.segmentId) return { status: 400, body: { error: 'segmentId is required' } };
    return {
      status: 200,
      body: await deps.snapshotSegment({
        segmentId: body.segmentId,
        finalize: body.finalize !== false,
        allowEmpty: body.allowEmpty === true,
        maxContacts: body.maxContacts ? Number(body.maxContacts) : undefined,
      }),
    };
  }

  if (method === 'POST' && pathname === '/api/enrich/segment') {
    if (!deps.enqueueSegmentEnrichment) return { status: 501, body: { error: 'Enrich not configured' } };
    const body = req.body ?? {};
    if (!body.segmentId) return { status: 400, body: { error: 'segmentId is required' } };
    if (deps.snapshotSegment) {
      await deps.snapshotSegment({ segmentId: body.segmentId, finalize: true, allowEmpty: false });
    }
    const job = await deps.enqueueSegmentEnrichment({
      segmentId: body.segmentId,
      adapter: body.adapter ?? 'mock',
      limit: body.limit ? Number(body.limit) : body.runNow ? 25 : undefined,
      dryRun: body.dryRun,
    });
    if (body.runNow && deps.runSegmentEnrichmentOnce) {
      const summary = await deps.runSegmentEnrichmentOnce(job, { dryRun: body.dryRun });
      return { status: 200, body: { status: 'completed', jobId: job.id, summary } };
    }
    return { status: 200, body: { status: 'queued', jobId: job.id } };
  }

  if (method === 'POST' && pathname === '/api/enrich/segment/multi') {
    if (!deps.enqueueSegmentEnrichment) return { status: 501, body: { error: 'Enrich not configured' } };
    const body = req.body ?? {};
    const providers = body.providers as unknown;
    if (!body.segmentId) return { status: 400, body: { error: 'segmentId is required' } };
    if (!Array.isArray(providers) || providers.length === 0) {
      return { status: 400, body: { error: 'providers must be a non-empty array' } };
    }

    const effectiveLimit = body.limit ? Number(body.limit) : body.runNow ? 25 : undefined;
    if (deps.snapshotSegment) {
      await deps.snapshotSegment({ segmentId: body.segmentId, finalize: true, allowEmpty: false });
    }

    const results: Array<{ provider: string; jobId?: string; status: string; summary?: unknown; error?: string }> = [];
    for (const provider of providers.map((entry) => String(entry))) {
      try {
        const job = await deps.enqueueSegmentEnrichment({
          segmentId: body.segmentId,
          adapter: provider,
          limit: effectiveLimit,
          dryRun: Boolean(body.dryRun),
        });
        if (body.runNow && deps.runSegmentEnrichmentOnce) {
          const summary = await deps.runSegmentEnrichmentOnce(job, { dryRun: Boolean(body.dryRun) });
          results.push({ provider, jobId: job.id, status: 'completed', summary });
        } else {
          results.push({ provider, jobId: job.id, status: 'queued' });
        }
      } catch (err: any) {
        results.push({ provider, status: 'error', error: err?.message ?? 'Enrichment failed' });
      }
    }

    const ok = results.some((result) => result.status !== 'error');
    return { status: ok ? 200 : 400, body: { results } };
  }

  if (method === 'POST' && pathname === '/api/enrich/segments/batch') {
    if (!deps.enqueueSegmentEnrichment) return { status: 501, body: { error: 'Enrich not configured' } };
    const body = req.body ?? {};
    const segmentIds = Array.isArray(body.segmentIds) ? body.segmentIds.map((entry: unknown) => String(entry)) : [];
    if (segmentIds.length === 0) {
      return { status: 400, body: { error: 'segmentIds must be a non-empty array' } };
    }

    const results: Array<{ segmentId: string; status: string; jobId?: string; summary?: unknown; error?: string }> = [];
    const effectiveLimit = body.limit ? Number(body.limit) : body.runNow ? 25 : undefined;
    for (const segmentId of segmentIds) {
      try {
        if (deps.snapshotSegment) {
          await deps.snapshotSegment({ segmentId, finalize: true, allowEmpty: false });
        }
        const job = await deps.enqueueSegmentEnrichment({
          segmentId,
          adapter: body.adapter ?? 'mock',
          limit: effectiveLimit,
          dryRun: Boolean(body.dryRun),
        });
        if (body.runNow && deps.runSegmentEnrichmentOnce) {
          const summary = await deps.runSegmentEnrichmentOnce(job, { dryRun: Boolean(body.dryRun) });
          results.push({ segmentId, status: 'completed', jobId: job.id, summary });
        } else {
          results.push({ segmentId, status: 'queued', jobId: job.id });
        }
      } catch (err: any) {
        results.push({ segmentId, status: 'error', error: err?.message ?? 'Enrichment failed' });
      }
    }

    const ok = results.some((result) => result.status !== 'error');
    return { status: ok ? 200 : 400, body: { results } };
  }

  if (method === 'GET' && pathname === '/api/enrich/status') {
    if (!deps.getSegmentEnrichmentStatus) return { status: 501, body: { error: 'Enrich status not configured' } };
    const segmentId = searchParams.get('segmentId');
    if (!segmentId) return { status: 400, body: { error: 'segmentId is required' } };
    return { status: 200, body: await deps.getSegmentEnrichmentStatus(segmentId) };
  }

  if (method === 'GET' && pathname === '/api/companies') {
    if (!deps.listCompanies) return { status: 501, body: { error: 'Companies endpoint not configured' } };
    return {
      status: 200,
      body: await deps.listCompanies({
        segment: searchParams.get('segment') ?? undefined,
        limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
      }),
    };
  }

  if (method === 'GET' && pathname === '/api/contacts') {
    if (!deps.listContacts) return { status: 501, body: { error: 'Contacts endpoint not configured' } };
    const ids = searchParams.get('companyIds');
    return {
      status: 200,
      body: await deps.listContacts({
        companyIds: ids ? ids.split(',').filter(Boolean) : undefined,
        limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
      }),
    };
  }

  if (method === 'POST' && pathname === '/api/filters/ai-suggest') {
    if (!deps.aiSuggestFilters) {
      return { status: 501, body: { error: 'AI filter suggestions not configured' } };
    }
    const body = req.body ?? {};
    if (!body.userDescription) return { status: 400, body: { error: 'userDescription is required' } };
    try {
      return {
        status: 200,
        body: {
          suggestions: await deps.aiSuggestFilters({
            userDescription: body.userDescription,
            icpProfileId: body.icpProfileId,
            icpContext: body.icpContext,
            maxSuggestions: body.maxSuggestions,
          }),
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'AI filter suggestion failed';
      return { status: 500, body: { error: message } };
    }
  }

  if (method === 'POST' && pathname === '/api/exa/webset/search') {
    if (!deps.searchExaWebset) return { status: 501, body: { error: 'EXA Webset search not configured' } };
    const body = req.body ?? {};
    if (!body.description) return { status: 400, body: { error: 'description is required' } };
    try {
      return {
        status: 200,
        body: await deps.searchExaWebset({
          description: body.description,
          maxResults: body.maxResults ? Number(body.maxResults) : undefined,
        }),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'EXA Webset search failed';
      return { status: 500, body: { error: message } };
    }
  }

  return null;
}
