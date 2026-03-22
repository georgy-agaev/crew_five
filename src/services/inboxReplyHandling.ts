import type { SupabaseClient } from '@supabase/supabase-js';

export interface InboxReplyHandledState {
  id: string;
  handled: boolean;
  handled_at: string | null;
  handled_by: string | null;
}

async function updateHandledState(
  client: SupabaseClient,
  replyId: string,
  patch: { handled_at: string | null; handled_by: string | null }
): Promise<InboxReplyHandledState> {
  const { data, error } = await client
    .from('email_events')
    .update(patch)
    .eq('id', replyId)
    .select('id,handled_at,handled_by')
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    const notFound = new Error(`Inbox reply not found: ${replyId}`) as Error & { statusCode?: number };
    notFound.statusCode = 404;
    throw notFound;
  }

  return {
    id: String(data.id),
    handled: Boolean(data.handled_at),
    handled_at: typeof data.handled_at === 'string' ? data.handled_at : null,
    handled_by: typeof data.handled_by === 'string' ? data.handled_by : null,
  };
}

export async function markInboxReplyHandled(
  client: SupabaseClient,
  params: { replyId: string; handledBy?: string | null }
): Promise<InboxReplyHandledState> {
  return updateHandledState(client, params.replyId, {
    handled_at: new Date().toISOString(),
    handled_by: params.handledBy?.trim() ? params.handledBy.trim() : 'web-ui',
  });
}

export async function markInboxReplyUnhandled(
  client: SupabaseClient,
  replyId: string
): Promise<InboxReplyHandledState> {
  return updateHandledState(client, replyId, {
    handled_at: null,
    handled_by: null,
  });
}
