import type { SupabaseClient } from '@supabase/supabase-js';

type ConflictError = Error & {
  code?: string;
  details?: Record<string, unknown>;
};

async function countByCompanyId(
  client: SupabaseClient,
  table: 'employees' | 'drafts' | 'segment_members',
  companyId: string
): Promise<number> {
  const { count, error } = await client
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId);
  if (error) throw error;
  return Number(count ?? 0);
}

export async function markDirectoryCompanyInvalid(client: SupabaseClient, companyId: string) {
  const { data, error } = await client
    .from('companies')
    .update({ processing_status: 'invalid' })
    .eq('id', companyId)
    .select('id,processing_status,updated_at')
    .single();

  if (error) throw error;

  return {
    companyId: String(data.id),
    processingStatus:
      typeof data.processing_status === 'string' ? data.processing_status : 'invalid',
    updatedAt: typeof data.updated_at === 'string' ? data.updated_at : null,
  };
}

export async function deleteDirectoryCompany(client: SupabaseClient, companyId: string) {
  const [contacts, drafts, segmentMemberships] = await Promise.all([
    countByCompanyId(client, 'employees', companyId),
    countByCompanyId(client, 'drafts', companyId),
    countByCompanyId(client, 'segment_members', companyId),
  ]);

  if (contacts > 0 || drafts > 0 || segmentMemberships > 0) {
    const error = new Error(
      'Company cannot be deleted because dependent contacts, drafts, or segment memberships exist'
    ) as ConflictError;
    error.code = 'COMPANY_DELETE_CONFLICT';
    error.details = { contacts, drafts, segmentMemberships };
    throw error;
  }

  const { error } = await client.from('companies').delete().eq('id', companyId);
  if (error) throw error;

  return {
    companyId,
    deleted: true as const,
  };
}
