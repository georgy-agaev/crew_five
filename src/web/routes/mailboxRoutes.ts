import type { AdapterDeps, DispatchRequest, DispatchResponse } from '../types.js';

export async function handleMailboxRoutes(
  deps: AdapterDeps,
  req: DispatchRequest
): Promise<DispatchResponse | null> {
  if (req.method !== 'GET' || req.pathname !== '/api/mailboxes') {
    return null;
  }
  if (!deps.listMailboxes) {
    return { status: 501, body: { error: 'Mailbox inventory not configured' } };
  }
  return {
    status: 200,
    body: await deps.listMailboxes(),
  };
}
