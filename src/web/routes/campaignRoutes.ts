import type { AdapterDeps, DispatchRequest, DispatchResponse } from '../types.js';

function getCampaignDomainErrorStatus(err: unknown): number {
  const code = typeof err === 'object' && err !== null ? (err as { code?: unknown }).code : undefined;
  if (
    code === 'CAMPAIGN_ROTATION_REQUIRES_SENT_SOURCE_WAVE' ||
    code === 'CAMPAIGN_ROTATION_REQUIRES_ICP_PROFILE'
  ) {
    return 400;
  }
  return 500;
}

export async function handleCampaignRoutes(
  deps: AdapterDeps,
  req: DispatchRequest
): Promise<DispatchResponse | null> {
  const { method, pathname, searchParams = new URLSearchParams() } = req;

  if (method === 'GET' && pathname === '/api/campaigns') {
    return { status: 200, body: await deps.listCampaigns() };
  }

  if (method === 'GET' && pathname.startsWith('/api/campaigns/') && pathname.endsWith('/status-transitions')) {
    if (!deps.getCampaignStatusTransitions) {
      return { status: 501, body: { error: 'Campaign status transitions not configured' } };
    }
    const campaignId = pathname
      .slice('/api/campaigns/'.length, -'/status-transitions'.length)
      .replace(/\/$/, '');
    if (!campaignId) {
      return { status: 400, body: { error: 'campaignId is required' } };
    }
    try {
      return { status: 200, body: await deps.getCampaignStatusTransitions(campaignId) };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Campaign status transitions load failed';
      return { status: 500, body: { error: message } };
    }
  }

  if (method === 'POST' && pathname.startsWith('/api/campaigns/') && pathname.endsWith('/status')) {
    if (!deps.updateCampaignStatus) {
      return { status: 501, body: { error: 'Campaign status updates not configured' } };
    }
    const campaignId = pathname.slice('/api/campaigns/'.length, -'/status'.length).replace(/\/$/, '');
    if (!campaignId) {
      return { status: 400, body: { error: 'campaignId is required' } };
    }
    const body = req.body ?? {};
    if (!body.status) {
      return { status: 400, body: { error: 'status is required' } };
    }
    try {
      return {
        status: 200,
        body: await deps.updateCampaignStatus({
          campaignId,
          status: body.status,
        }),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Campaign status update failed';
      const statusCode =
        typeof (err as { statusCode?: unknown })?.statusCode === 'number'
          ? ((err as { statusCode: number }).statusCode)
          : 500;
      return {
        status: statusCode,
        body: {
          error: message,
          ...(typeof (err as { code?: unknown })?.code === 'string'
            ? { code: (err as { code: string }).code }
            : {}),
        },
      };
    }
  }

  if (method === 'GET' && pathname.startsWith('/api/campaigns/') && pathname.endsWith('/followup-candidates')) {
    if (!deps.listCampaignFollowupCandidates) {
      return { status: 501, body: { error: 'Campaign followup candidates not configured' } };
    }
    const campaignId = pathname
      .slice('/api/campaigns/'.length, -'/followup-candidates'.length)
      .replace(/\/$/, '');
    if (!campaignId) {
      return { status: 400, body: { error: 'campaignId is required' } };
    }
    try {
      const candidates = await deps.listCampaignFollowupCandidates(campaignId);
      return {
        status: 200,
        body: {
          candidates,
          summary: {
            total: candidates.length,
            eligible: candidates.filter((candidate) => candidate.eligible).length,
            ineligible: candidates.filter((candidate) => !candidate.eligible).length,
          },
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Campaign followup candidates load failed';
      return { status: 500, body: { error: message } };
    }
  }

  if (method === 'GET' && pathname.startsWith('/api/campaigns/') && pathname.endsWith('/detail')) {
    if (!deps.getCampaignReadModel) {
      return { status: 501, body: { error: 'Campaign detail read model not configured' } };
    }
    const campaignId = pathname.slice('/api/campaigns/'.length, -'/detail'.length).replace(/\/$/, '');
    if (!campaignId) {
      return { status: 400, body: { error: 'campaignId is required' } };
    }
    try {
      return { status: 200, body: await deps.getCampaignReadModel(campaignId) };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Campaign detail load failed';
      return { status: 500, body: { error: message } };
    }
  }

  if (method === 'POST' && pathname.startsWith('/api/campaigns/') && pathname.endsWith('/companies/attach')) {
    if (!deps.attachCompaniesToCampaign) {
      return { status: 501, body: { error: 'Campaign company attach not configured' } };
    }
    const campaignId = pathname.slice('/api/campaigns/'.length, -'/companies/attach'.length).replace(/\/$/, '');
    if (!campaignId) {
      return { status: 400, body: { error: 'campaignId is required' } };
    }
    const body = req.body ?? {};
    if (!Array.isArray(body.companyIds)) {
      return { status: 400, body: { error: 'companyIds must be an array' } };
    }
    try {
      return {
        status: 200,
        body: await deps.attachCompaniesToCampaign({
          campaignId,
          companyIds: body.companyIds,
          attachedBy: typeof body.attachedBy === 'string' ? body.attachedBy : null,
          source: typeof body.source === 'string' ? body.source : 'manual_attach',
        }),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Campaign company attach failed';
      const statusCode =
        typeof (err as { statusCode?: unknown })?.statusCode === 'number'
          ? (err as { statusCode: number }).statusCode
          : 500;
      return { status: statusCode, body: { error: message } };
    }
  }

  if (method === 'GET' && pathname.startsWith('/api/campaigns/') && pathname.endsWith('/mailbox-summary')) {
    if (!deps.getCampaignMailboxSummary) {
      return { status: 501, body: { error: 'Campaign mailbox summary not configured' } };
    }
    const campaignId = pathname
      .slice('/api/campaigns/'.length, -'/mailbox-summary'.length)
      .replace(/\/$/, '');
    if (!campaignId) {
      return { status: 400, body: { error: 'campaignId is required' } };
    }
    try {
      return { status: 200, body: await deps.getCampaignMailboxSummary(campaignId) };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Campaign mailbox summary load failed';
      return { status: 500, body: { error: message } };
    }
  }

  if (method === 'GET' && pathname.startsWith('/api/campaigns/') && pathname.endsWith('/mailbox-assignment')) {
    if (!deps.getCampaignMailboxAssignment) {
      return { status: 501, body: { error: 'Campaign mailbox assignment not configured' } };
    }
    const campaignId = pathname
      .slice('/api/campaigns/'.length, -'/mailbox-assignment'.length)
      .replace(/\/$/, '');
    if (!campaignId) {
      return { status: 400, body: { error: 'campaignId is required' } };
    }
    try {
      return { status: 200, body: await deps.getCampaignMailboxAssignment(campaignId) };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Campaign mailbox assignment load failed';
      return { status: 500, body: { error: message } };
    }
  }

  if (method === 'PUT' && pathname.startsWith('/api/campaigns/') && pathname.endsWith('/mailbox-assignment')) {
    if (!deps.replaceCampaignMailboxAssignment) {
      return { status: 501, body: { error: 'Campaign mailbox assignment not configured' } };
    }
    const campaignId = pathname
      .slice('/api/campaigns/'.length, -'/mailbox-assignment'.length)
      .replace(/\/$/, '');
    if (!campaignId) {
      return { status: 400, body: { error: 'campaignId is required' } };
    }
    const body = req.body ?? {};
    if (!Array.isArray(body.assignments)) {
      return { status: 400, body: { error: 'assignments must be an array' } };
    }
    try {
      return {
        status: 200,
        body: await deps.replaceCampaignMailboxAssignment({
          campaignId,
          assignments: body.assignments,
          source: typeof body.source === 'string' ? body.source : null,
        }),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Campaign mailbox assignment update failed';
      return { status: 500, body: { error: message } };
    }
  }

  if (method === 'GET' && pathname.startsWith('/api/campaigns/') && pathname.endsWith('/auto-send')) {
    if (!deps.getCampaignAutoSendSettings) {
      return { status: 501, body: { error: 'Campaign auto-send settings not configured' } };
    }
    const campaignId = pathname.slice('/api/campaigns/'.length, -'/auto-send'.length).replace(/\/$/, '');
    if (!campaignId) {
      return { status: 400, body: { error: 'campaignId is required' } };
    }
    try {
      return { status: 200, body: await deps.getCampaignAutoSendSettings(campaignId) };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Campaign auto-send settings load failed';
      const statusCode =
        typeof (err as { statusCode?: unknown })?.statusCode === 'number'
          ? ((err as { statusCode: number }).statusCode)
          : 500;
      return { status: statusCode, body: { error: message } };
    }
  }

  if (method === 'PUT' && pathname.startsWith('/api/campaigns/') && pathname.endsWith('/auto-send')) {
    if (!deps.updateCampaignAutoSendSettings) {
      return { status: 501, body: { error: 'Campaign auto-send settings not configured' } };
    }
    const campaignId = pathname.slice('/api/campaigns/'.length, -'/auto-send'.length).replace(/\/$/, '');
    if (!campaignId) {
      return { status: 400, body: { error: 'campaignId is required' } };
    }
    const body = req.body ?? {};
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return { status: 400, body: { error: 'auto-send payload must be an object' } };
    }
    try {
      return {
        status: 200,
        body: await deps.updateCampaignAutoSendSettings({
          campaignId,
          autoSendIntro: body.autoSendIntro,
          autoSendBump: body.autoSendBump,
          bumpMinDaysSinceIntro: body.bumpMinDaysSinceIntro,
        }),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Campaign auto-send settings update failed';
      const statusCode =
        typeof (err as { statusCode?: unknown })?.statusCode === 'number'
          ? ((err as { statusCode: number }).statusCode)
          : 500;
      return { status: statusCode, body: { error: message } };
    }
  }

  if (method === 'GET' && pathname.startsWith('/api/campaigns/') && pathname.endsWith('/send-policy')) {
    if (!deps.getCampaignSendPolicy) {
      return { status: 501, body: { error: 'Campaign send policy not configured' } };
    }
    const campaignId = pathname
      .slice('/api/campaigns/'.length, -'/send-policy'.length)
      .replace(/\/$/, '');
    if (!campaignId) {
      return { status: 400, body: { error: 'campaignId is required' } };
    }
    try {
      return { status: 200, body: await deps.getCampaignSendPolicy(campaignId) };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Campaign send policy load failed';
      const statusCode =
        typeof (err as { statusCode?: unknown })?.statusCode === 'number'
          ? ((err as { statusCode: number }).statusCode)
          : 500;
      return { status: statusCode, body: { error: message } };
    }
  }

  if (method === 'PUT' && pathname.startsWith('/api/campaigns/') && pathname.endsWith('/send-policy')) {
    if (!deps.updateCampaignSendPolicy) {
      return { status: 501, body: { error: 'Campaign send policy not configured' } };
    }
    const campaignId = pathname
      .slice('/api/campaigns/'.length, -'/send-policy'.length)
      .replace(/\/$/, '');
    if (!campaignId) {
      return { status: 400, body: { error: 'campaignId is required' } };
    }
    const body = req.body ?? {};
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return { status: 400, body: { error: 'send-policy payload must be an object' } };
    }
    try {
      return {
        status: 200,
        body: await deps.updateCampaignSendPolicy({
          campaignId,
          sendTimezone: body.sendTimezone,
          sendWindowStartHour: body.sendWindowStartHour,
          sendWindowEndHour: body.sendWindowEndHour,
          sendWeekdaysOnly: body.sendWeekdaysOnly,
        }),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Campaign send policy update failed';
      const statusCode =
        typeof (err as { statusCode?: unknown })?.statusCode === 'number'
          ? ((err as { statusCode: number }).statusCode)
          : 500;
      return { status: statusCode, body: { error: message } };
    }
  }

  if (method === 'GET' && pathname.startsWith('/api/campaigns/') && pathname.endsWith('/companies')) {
    if (!deps.listCampaignCompanies) {
      return { status: 501, body: { error: 'Campaign companies not configured' } };
    }
    const campaignId = pathname.slice('/api/campaigns/'.length, -'/companies'.length).replace(/\/$/, '');
    if (!campaignId) {
      return { status: 400, body: { error: 'campaignId is required' } };
    }
    try {
      return { status: 200, body: await deps.listCampaignCompanies(campaignId) };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Campaign companies load failed';
      return { status: 500, body: { error: message } };
    }
  }

  if (method === 'GET' && pathname.startsWith('/api/campaigns/') && pathname.endsWith('/audit')) {
    if (!deps.getCampaignAudit) {
      return { status: 501, body: { error: 'Campaign audit not configured' } };
    }
    const campaignId = pathname.slice('/api/campaigns/'.length, -'/audit'.length).replace(/\/$/, '');
    if (!campaignId) {
      return { status: 400, body: { error: 'campaignId is required' } };
    }
    try {
      return { status: 200, body: await deps.getCampaignAudit(campaignId) };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Campaign audit load failed';
      return { status: 500, body: { error: message } };
    }
  }

  if (method === 'GET' && pathname.startsWith('/api/campaigns/') && pathname.endsWith('/send-preflight')) {
    if (!deps.getCampaignSendPreflight) {
      return { status: 501, body: { error: 'Campaign send preflight not configured' } };
    }
    const campaignId = pathname
      .slice('/api/campaigns/'.length, -'/send-preflight'.length)
      .replace(/\/$/, '');
    if (!campaignId) {
      return { status: 400, body: { error: 'campaignId is required' } };
    }
    try {
      return { status: 200, body: await deps.getCampaignSendPreflight(campaignId) };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Campaign send preflight load failed';
      return { status: 500, body: { error: message } };
    }
  }

  if (method === 'POST' && pathname.startsWith('/api/campaigns/') && pathname.endsWith('/send')) {
    if (!deps.executeCampaignSend) {
      return { status: 501, body: { error: 'Campaign send execution not configured' } };
    }
    const campaignId = pathname
      .slice('/api/campaigns/'.length, -'/send'.length)
      .replace(/\/$/, '');
    if (!campaignId) {
      return { status: 400, body: { error: 'campaignId is required' } };
    }

    const body = req.body ?? {};
    if (body && (typeof body !== 'object' || Array.isArray(body))) {
      return { status: 400, body: { error: 'send payload must be an object' } };
    }

    const reason =
      body && typeof body.reason === 'string' ? body.reason : 'auto_send_mixed';
    if (
      reason !== 'auto_send_intro' &&
      reason !== 'auto_send_bump' &&
      reason !== 'auto_send_mixed'
    ) {
      return { status: 400, body: { error: 'reason must be auto_send_intro|auto_send_bump|auto_send_mixed' } };
    }

    const batchLimit =
      body && typeof body.batchLimit === 'number' && Number.isFinite(body.batchLimit)
        ? Math.trunc(body.batchLimit)
        : undefined;

    try {
      return {
        status: 200,
        body: await deps.executeCampaignSend({
          campaignId,
          reason,
          batchLimit,
        }),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Campaign send execution failed';
      return { status: 500, body: { error: message } };
    }
  }

  if (method === 'GET' && pathname.startsWith('/api/campaigns/') && pathname.endsWith('/next-wave-preview')) {
    if (!deps.getCampaignNextWavePreview) {
      return { status: 501, body: { error: 'Campaign next-wave preview not configured' } };
    }
    const campaignId = pathname
      .slice('/api/campaigns/'.length, -'/next-wave-preview'.length)
      .replace(/\/$/, '');
    if (!campaignId) {
      return { status: 400, body: { error: 'campaignId is required' } };
    }
    try {
      return { status: 200, body: await deps.getCampaignNextWavePreview({ sourceCampaignId: campaignId }) };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Campaign next-wave preview failed';
      return { status: 500, body: { error: message } };
    }
  }

  if (method === 'GET' && pathname.startsWith('/api/campaigns/') && pathname.endsWith('/rotation-preview')) {
    if (!deps.getCampaignRotationPreview) {
      return { status: 501, body: { error: 'Campaign rotation preview not configured' } };
    }
    const campaignId = pathname
      .slice('/api/campaigns/'.length, -'/rotation-preview'.length)
      .replace(/\/$/, '');
    if (!campaignId) {
      return { status: 400, body: { error: 'campaignId is required' } };
    }
    try {
      return { status: 200, body: await deps.getCampaignRotationPreview({ sourceCampaignId: campaignId }) };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Campaign rotation preview failed';
      return { status: getCampaignDomainErrorStatus(err), body: { error: message } };
    }
  }

  if (method === 'POST' && pathname === '/api/campaigns/launch-preview') {
    if (!deps.getCampaignLaunchPreview) {
      return { status: 501, body: { error: 'Campaign launch preview not configured' } };
    }
    const body = req.body ?? {};
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return { status: 400, body: { error: 'launch preview payload must be an object' } };
    }
    if (!body.name) {
      return { status: 400, body: { error: 'name is required' } };
    }
    if (!body.segmentId) {
      return { status: 400, body: { error: 'segmentId is required' } };
    }
    try {
      return { status: 200, body: await deps.getCampaignLaunchPreview(body) };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Campaign launch preview failed';
      return { status: 500, body: { error: message } };
    }
  }

  if (method === 'POST' && pathname === '/api/campaigns/next-wave') {
    if (!deps.createCampaignNextWave) {
      return { status: 501, body: { error: 'Campaign next-wave create not configured' } };
    }
    const body = req.body ?? {};
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return { status: 400, body: { error: 'next-wave payload must be an object' } };
    }
    if (!body.sourceCampaignId) {
      return { status: 400, body: { error: 'sourceCampaignId is required' } };
    }
    if (!body.name) {
      return { status: 400, body: { error: 'name is required' } };
    }
    try {
      return { status: 201, body: await deps.createCampaignNextWave(body as any) };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Campaign next-wave create failed';
      return { status: 500, body: { error: message } };
    }
  }

  if (method === 'POST' && pathname === '/api/campaigns/launch') {
    if (!deps.launchCampaign) {
      return { status: 501, body: { error: 'Campaign launch not configured' } };
    }
    const body = req.body ?? {};
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return { status: 400, body: { error: 'launch payload must be an object' } };
    }
    if (!body.name) {
      return { status: 400, body: { error: 'name is required' } };
    }
    if (!body.segmentId) {
      return { status: 400, body: { error: 'segmentId is required' } };
    }
    try {
      return { status: 201, body: await deps.launchCampaign(body) };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Campaign launch failed';
      return { status: 500, body: { error: message } };
    }
  }

  if (method === 'GET' && pathname.startsWith('/api/campaigns/') && pathname.endsWith('/outbounds')) {
    if (!deps.listCampaignOutbounds) {
      return { status: 501, body: { error: 'Campaign outbounds not configured' } };
    }
    const campaignId = pathname.slice('/api/campaigns/'.length, -'/outbounds'.length).replace(/\/$/, '');
    if (!campaignId) {
      return { status: 400, body: { error: 'campaignId is required' } };
    }
    try {
      return { status: 200, body: await deps.listCampaignOutbounds(campaignId) };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Campaign outbounds load failed';
      return { status: 500, body: { error: message } };
    }
  }

  if (method === 'GET' && pathname.startsWith('/api/campaigns/') && pathname.endsWith('/events')) {
    if (!deps.listCampaignEvents) {
      return { status: 501, body: { error: 'Campaign events not configured' } };
    }
    const campaignId = pathname.slice('/api/campaigns/'.length, -'/events'.length).replace(/\/$/, '');
    if (!campaignId) {
      return { status: 400, body: { error: 'campaignId is required' } };
    }
    try {
      return { status: 200, body: await deps.listCampaignEvents(campaignId) };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Campaign events load failed';
      return { status: 500, body: { error: message } };
    }
  }

  if (method === 'POST' && pathname === '/api/campaigns') {
    if (!deps.createCampaign) {
      return { status: 501, body: { error: 'Campaign creation not configured' } };
    }
    const body = req.body ?? {};
    if (!body.name) return { status: 400, body: { error: 'name is required' } };
    if (!body.segmentId) return { status: 400, body: { error: 'segmentId is required' } };
    if (body.segmentVersion === undefined || body.segmentVersion === null) {
      return { status: 400, body: { error: 'segmentVersion is required' } };
    }
    if (typeof body.segmentVersion !== 'number' || Number.isNaN(body.segmentVersion)) {
      return { status: 400, body: { error: 'segmentVersion must be a number' } };
    }

    try {
      const created = await deps.createCampaign({
        name: body.name,
        segmentId: body.segmentId,
        segmentVersion: body.segmentVersion,
        projectId: typeof body.projectId === 'string' ? body.projectId : undefined,
        offerId: typeof body.offerId === 'string' ? body.offerId : undefined,
        icpHypothesisId: typeof body.icpHypothesisId === 'string' ? body.icpHypothesisId : undefined,
        createdBy: body.createdBy,
      });
      return { status: 201, body: created };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Campaign creation failed';
      return { status: 500, body: { error: message } };
    }
  }

  if (method === 'GET' && pathname === '/api/drafts') {
    return {
      status: 200,
      body: await deps.listDrafts({
        campaignId: searchParams.get('campaignId') ?? undefined,
        status: searchParams.get('status') ?? undefined,
        includeRecipientContext: searchParams.get('includeRecipientContext') === 'true',
      }),
    };
  }

  if (method === 'POST' && pathname === '/api/drafts/batch-status') {
    if (!deps.updateDraftStatuses) {
      return { status: 501, body: { error: 'Draft batch review not configured' } };
    }
    const body = req.body ?? {};
    if (!Array.isArray(body.draftIds) || body.draftIds.length === 0) {
      return { status: 400, body: { error: 'draftIds must contain at least one draft id' } };
    }
    if (!body.status) {
      return { status: 400, body: { error: 'status is required' } };
    }
    try {
      return {
        status: 200,
        body: await deps.updateDraftStatuses({
          draftIds: body.draftIds,
          status: body.status,
          reviewer: body.reviewer,
          metadata: body.metadata,
        }),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Draft batch review update failed';
      return { status: 500, body: { error: message } };
    }
  }

  if (method === 'POST' && pathname.startsWith('/api/drafts/') && pathname.endsWith('/status')) {
    if (!deps.updateDraftStatus) {
      return { status: 501, body: { error: 'Draft review not configured' } };
    }
    const draftId = pathname.slice('/api/drafts/'.length, -'/status'.length).replace(/\/$/, '');
    if (!draftId) {
      return { status: 400, body: { error: 'draftId is required' } };
    }
    const body = req.body ?? {};
    if (!body.status) {
      return { status: 400, body: { error: 'status is required' } };
    }
    try {
      return {
        status: 200,
        body: await deps.updateDraftStatus({
          draftId,
          status: body.status,
          reviewer: body.reviewer,
          metadata: body.metadata,
        }),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Draft review update failed';
      return { status: 500, body: { error: message } };
    }
  }

  if (method === 'POST' && pathname.startsWith('/api/drafts/') && pathname.endsWith('/content')) {
    if (!deps.updateDraftContent) {
      return { status: 501, body: { error: 'Draft content update not configured' } };
    }
    const draftId = pathname.slice('/api/drafts/'.length, -'/content'.length).replace(/\/$/, '');
    if (!draftId) {
      return { status: 400, body: { error: 'draftId is required' } };
    }
    const body = req.body ?? {};
    if (typeof body.subject !== 'string' || typeof body.body !== 'string') {
      return { status: 400, body: { error: 'subject and body are required' } };
    }
    try {
      return {
        status: 200,
        body: await deps.updateDraftContent({
          draftId,
          subject: body.subject,
          body: body.body,
        }),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Draft content update failed';
      return { status: 500, body: { error: message } };
    }
  }

  if (method === 'POST' && pathname === '/api/drafts/generate') {
    return { status: 200, body: await deps.generateDrafts(req.body) };
  }

  return null;
}
