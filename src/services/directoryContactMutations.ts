import type { SupabaseClient } from '@supabase/supabase-js';

type ConflictError = Error & {
  code?: string;
  details?: Record<string, unknown>;
};

async function countByContactId(
  client: SupabaseClient,
  table: 'drafts' | 'segment_members',
  contactId: string
): Promise<number> {
  const { count, error } = await client
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('contact_id', contactId);
  if (error) throw error;
  return Number(count ?? 0);
}

export async function markDirectoryContactInvalid(client: SupabaseClient, contactId: string) {
  const { data, error } = await client
    .from('employees')
    .update({ processing_status: 'invalid' })
    .eq('id', contactId)
    .select('id,processing_status,updated_at')
    .single();

  if (error) throw error;

  return {
    contactId: String(data.id),
    processingStatus:
      typeof data.processing_status === 'string' ? data.processing_status : 'invalid',
    updatedAt: typeof data.updated_at === 'string' ? data.updated_at : null,
  };
}

export async function deleteDirectoryContact(client: SupabaseClient, contactId: string) {
  const [drafts, segmentMemberships] = await Promise.all([
    countByContactId(client, 'drafts', contactId),
    countByContactId(client, 'segment_members', contactId),
  ]);

  if (drafts > 0 || segmentMemberships > 0) {
    const error = new Error(
      'Contact cannot be deleted because dependent drafts or segment memberships exist'
    ) as ConflictError;
    error.code = 'CONTACT_DELETE_CONFLICT';
    error.details = { drafts, segmentMemberships };
    throw error;
  }

  const { error } = await client.from('employees').delete().eq('id', contactId);
  if (error) throw error;

  return {
    contactId,
    deleted: true as const,
  };
}
