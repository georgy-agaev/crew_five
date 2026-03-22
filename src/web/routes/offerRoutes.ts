import type { AdapterDeps, DispatchRequest, DispatchResponse } from '../types.js';

export async function handleOfferRoutes(
  deps: AdapterDeps,
  req: DispatchRequest
): Promise<DispatchResponse | null> {
  const { method, pathname, searchParams = new URLSearchParams() } = req;

  if (method === 'GET' && pathname === '/api/offers') {
    if (!deps.listOffers) {
      return { status: 501, body: { error: 'Offer listing not configured' } };
    }
    try {
      const status = searchParams.get('status') ?? undefined;
      return { status: 200, body: await deps.listOffers({ ...(status ? { status: status as any } : {}) }) };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Offer list failed';
      return { status: 500, body: { error: message } };
    }
  }

  if (method === 'POST' && pathname === '/api/offers') {
    if (!deps.createOffer) {
      return { status: 501, body: { error: 'Offer creation not configured' } };
    }
    const body = req.body ?? {};
    if (typeof body.title !== 'string' || body.title.trim().length === 0) {
      return { status: 400, body: { error: 'title is required' } };
    }
    try {
      return {
        status: 201,
        body: await deps.createOffer({
          ...(typeof body.projectId === 'string' ? { projectId: body.projectId } : {}),
          title: body.title,
          projectName: typeof body.projectName === 'string' ? body.projectName : null,
          description: typeof body.description === 'string' ? body.description : null,
          status: typeof body.status === 'string' ? body.status : undefined,
        }),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Offer creation failed';
      return { status: 500, body: { error: message } };
    }
  }

  if (method === 'PUT' && pathname.startsWith('/api/offers/')) {
    if (!deps.updateOffer) {
      return { status: 501, body: { error: 'Offer update not configured' } };
    }
    const offerId = pathname.slice('/api/offers/'.length).replace(/\/$/, '');
    if (!offerId) {
      return { status: 400, body: { error: 'offerId is required' } };
    }
    const body = req.body ?? {};
    try {
      return {
        status: 200,
        body: await deps.updateOffer(offerId, {
          ...(body.projectId !== undefined ? { projectId: body.projectId } : {}),
          ...(body.title !== undefined ? { title: body.title } : {}),
          ...(body.projectName !== undefined ? { projectName: body.projectName } : {}),
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
        }),
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Offer update failed';
      return { status: 500, body: { error: message } };
    }
  }

  return null;
}
