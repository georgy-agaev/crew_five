import type { AdapterDeps, DispatchRequest, DispatchResponse } from '../types.js';

export async function handleAnalyticsRoutes(
  deps: AdapterDeps,
  req: DispatchRequest
): Promise<DispatchResponse | null> {
  const { method, pathname, searchParams = new URLSearchParams() } = req;

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

  if (method === 'GET' && pathname === '/api/inbox/messages') {
    return { status: 200, body: { messages: [], total: 0 } };
  }

  if (method === 'GET' && pathname === '/api/inbox/replies') {
    if (!deps.listInboxReplies) {
      return { status: 501, body: { error: 'Inbox replies not configured' } };
    }
    return {
      status: 200,
      body: await deps.listInboxReplies({
        campaignId: searchParams.get('campaignId') ?? undefined,
        replyLabel: searchParams.get('replyLabel') ?? undefined,
        handled:
          searchParams.get('handled') === 'true'
            ? true
            : searchParams.get('handled') === 'false'
              ? false
              : undefined,
        limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
      }),
    };
  }

  if (method === 'POST' && pathname.startsWith('/api/inbox/replies/') && pathname.endsWith('/handled')) {
    if (!deps.markInboxReplyHandled) {
      return { status: 501, body: { error: 'Inbox handled state not configured' } };
    }
    const replyId = pathname.slice('/api/inbox/replies/'.length, -'/handled'.length).replace(/\/$/, '');
    return {
      status: 200,
      body: await deps.markInboxReplyHandled({
        replyId,
        handledBy: typeof req.body?.handledBy === 'string' ? req.body.handledBy : undefined,
      }),
    };
  }

  if (method === 'POST' && pathname.startsWith('/api/inbox/replies/') && pathname.endsWith('/unhandled')) {
    if (!deps.markInboxReplyUnhandled) {
      return { status: 501, body: { error: 'Inbox handled state not configured' } };
    }
    const replyId = pathname.slice('/api/inbox/replies/'.length, -'/unhandled'.length).replace(/\/$/, '');
    return {
      status: 200,
      body: await deps.markInboxReplyUnhandled(replyId),
    };
  }

  if (method === 'POST' && pathname === '/api/inbox/poll') {
    if (!deps.triggerInboxPoll) {
      return { status: 501, body: { error: 'Inbox poll trigger not configured' } };
    }
    return {
      status: 202,
      body: await deps.triggerInboxPoll({
        mailboxAccountId:
          typeof req.body?.mailboxAccountId === 'string' ? req.body.mailboxAccountId : undefined,
        lookbackHours:
          typeof req.body?.lookbackHours === 'number' ? req.body.lookbackHours : undefined,
      }),
    };
  }

  if (method === 'GET' && pathname === '/api/dashboard/overview') {
    if (!deps.dashboardOverview) {
      return { status: 501, body: { error: 'Dashboard overview not configured' } };
    }
    try {
      return { status: 200, body: await deps.dashboardOverview() };
    } catch (err: unknown) {
      const raw = err as any;
      return { status: 500, body: { error: raw?.message ?? 'Dashboard overview failed', code: raw?.code } };
    }
  }

  if (method === 'GET' && pathname === '/api/analytics/summary') {
    if (!deps.analyticsSummary) return { status: 501, body: { error: 'Analytics not configured' } };
    return {
      status: 200,
      body: await deps.analyticsSummary({
        groupBy: searchParams.get('groupBy') ?? undefined,
        since: searchParams.get('since') ?? undefined,
      }),
    };
  }

  if (method === 'GET' && pathname === '/api/analytics/rejection-reasons') {
    if (!deps.analyticsRejectionReasons) {
      return { status: 501, body: { error: 'Analytics not configured' } };
    }
    return {
      status: 200,
      body: await deps.analyticsRejectionReasons({
        since: searchParams.get('since') ?? undefined,
      }),
    };
  }

  if (method === 'GET' && pathname === '/api/analytics/optimize') {
    if (!deps.analyticsOptimize) return { status: 501, body: { error: 'Analytics not configured' } };
    return {
      status: 200,
      body: await deps.analyticsOptimize({ since: searchParams.get('since') ?? undefined }),
    };
  }

  return null;
}
