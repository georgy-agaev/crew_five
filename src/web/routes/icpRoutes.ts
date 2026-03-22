import type { AdapterDeps, DispatchRequest, DispatchResponse } from '../types.js';

export async function handleIcpRoutes(
  deps: AdapterDeps,
  req: DispatchRequest
): Promise<DispatchResponse | null> {
  const { method, pathname, searchParams = new URLSearchParams() } = req;

  if (method === 'GET' && pathname === '/api/icp/profiles') {
    if (!deps.listIcpProfiles) return { status: 501, body: { error: 'ICP not configured' } };
    return { status: 200, body: await deps.listIcpProfiles() };
  }

  if (method === 'POST' && pathname === '/api/icp/profiles') {
    if (!deps.createIcpProfile) return { status: 501, body: { error: 'ICP not configured' } };
    const body = req.body ?? {};
    if (!body.name) return { status: 400, body: { error: 'name is required' } };
    return {
      status: 200,
      body: await deps.createIcpProfile({
        name: body.name,
        projectId: typeof body.projectId === 'string' ? body.projectId : undefined,
        description: body.description,
      }),
    };
  }

  if (method === 'GET' && pathname.startsWith('/api/icp/profiles/') && pathname.endsWith('/learnings')) {
    if (!deps.getIcpProfileLearnings) return { status: 501, body: { error: 'ICP learnings not configured' } };
    const profileId = pathname
      .slice('/api/icp/profiles/'.length, -'/learnings'.length)
      .replace(/\/$/, '');
    if (!profileId) return { status: 400, body: { error: 'profileId is required' } };
    return { status: 200, body: await deps.getIcpProfileLearnings(profileId) };
  }

  if (method === 'POST' && pathname.startsWith('/api/icp/profiles/') && pathname.endsWith('/learnings')) {
    if (!deps.updateIcpProfileLearnings) return { status: 501, body: { error: 'ICP learnings not configured' } };
    const profileId = pathname
      .slice('/api/icp/profiles/'.length, -'/learnings'.length)
      .replace(/\/$/, '');
    if (!profileId) return { status: 400, body: { error: 'profileId is required' } };
    const body = req.body ?? {};
    if (!Array.isArray(body.learnings)) {
      return { status: 400, body: { error: 'learnings must be an array' } };
    }
    return {
      status: 200,
      body: await deps.updateIcpProfileLearnings({
        profileId,
        learnings: body.learnings,
      }),
    };
  }

  if (method === 'GET' && pathname === '/api/icp/offerings') {
    if (!deps.listIcpOfferingMappings) return { status: 501, body: { error: 'ICP offerings not configured' } };
    return { status: 200, body: await deps.listIcpOfferingMappings() };
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
        offerId: body.offerId,
        segmentId: body.segmentId,
        searchConfig: body.searchConfig,
        targetingDefaults: body.targetingDefaults,
        messagingAngle: body.messagingAngle,
        patternDefaults: body.patternDefaults,
        notes: body.notes,
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

  if (method === 'POST' && pathname === '/api/icp/discovery') {
    if (!deps.runIcpDiscovery) return { status: 501, body: { error: 'ICP discovery not configured' } };
    const body = req.body ?? {};
    if (!body.icpProfileId) return { status: 400, body: { error: 'icpProfileId is required' } };
    return {
      status: 200,
      body: await deps.runIcpDiscovery({
        icpProfileId: body.icpProfileId,
        icpHypothesisId: body.icpHypothesisId,
        limit: body.limit ? Number(body.limit) : undefined,
      }),
    };
  }

  if (method === 'GET' && pathname === '/api/icp/discovery/candidates') {
    if (!deps.listIcpDiscoveryCandidates) {
      return { status: 501, body: { error: 'ICP discovery not configured' } };
    }
    return {
      status: 200,
      body: await deps.listIcpDiscoveryCandidates({
        runId: searchParams.get('runId') ?? undefined,
        icpProfileId: searchParams.get('icpProfileId') ?? undefined,
        icpHypothesisId: searchParams.get('icpHypothesisId') ?? undefined,
      }),
    };
  }

  if (method === 'POST' && pathname === '/api/icp/discovery/promote') {
    if (!deps.promoteIcpDiscoveryCandidates) {
      return { status: 501, body: { error: 'ICP discovery promotion not configured' } };
    }
    const body = req.body ?? {};
    if (!body.runId) return { status: 400, body: { error: 'runId is required' } };
    if (!body.segmentId) return { status: 400, body: { error: 'segmentId is required' } };
    return {
      status: 200,
      body: await deps.promoteIcpDiscoveryCandidates({
        runId: body.runId,
        segmentId: body.segmentId,
        candidateIds: Array.isArray(body.candidateIds) ? body.candidateIds : [],
      }),
    };
  }

  return null;
}
