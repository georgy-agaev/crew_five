import type { SupabaseClient } from '@supabase/supabase-js';

interface IcpListOptions {
  columns?: string[];
}

interface IcpHypothesisListOptions {
  columns?: string[];
  icpProfileId?: string;
  segmentId?: string;
}

const allowedProfileColumns = ['id', 'name', 'description', 'company_criteria', 'persona_criteria', 'created_by'];
const allowedHypothesisColumns = ['id', 'icp_profile_id', 'segment_id', 'status', 'hypothesis_label', 'search_config'];

function buildColumns(columns: string[] | undefined, fallback: string[], allowed: string[]) {
  const selected = columns && columns.length > 0 ? columns : fallback;
  const invalid = selected.filter((c) => !allowed.includes(c));
  if (invalid.length > 0) {
    throw new Error(`Unknown columns: ${invalid.join(', ')}. Allowed: ${allowed.join(', ')}`);
  }
  return selected.join(', ');
}

export async function icpListCommand(client: SupabaseClient, options: IcpListOptions) {
  const columnString = buildColumns(options.columns, ['id', 'name', 'description'], allowedProfileColumns);
  const { data, error } = await client.from('icp_profiles').select(columnString);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function icpHypothesisListCommand(client: SupabaseClient, options: IcpHypothesisListOptions) {
  const columnString = buildColumns(
    options.columns,
    ['id', 'icp_profile_id', 'segment_id', 'status'],
    allowedHypothesisColumns
  );
  let query: any = client.from('icp_hypotheses').select(columnString);

  if (options.icpProfileId) {
    query = query.eq('icp_profile_id', options.icpProfileId);
  }

  if (options.segmentId) {
    query = query.eq('segment_id', options.segmentId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return data ?? [];
}
