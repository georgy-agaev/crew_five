import type { SupabaseClient } from '@supabase/supabase-js';

interface IcpListOptions {
  columns?: string[];
}

interface IcpHypothesisListOptions {
  columns?: string[];
  icpProfileId?: string;
  segmentId?: string;
}

const allowedProfileColumns = [
  'id',
  'name',
  'description',
  'offering_domain',
  'company_criteria',
  'persona_criteria',
  'phase_outputs',
  'learnings',
  'created_by',
  'created_at',
];
const allowedHypothesisColumns = [
  'id',
  'icp_id',
  'icp_profile_id',
  'segment_id',
  'status',
  'hypothesis_label',
  'search_config',
  'created_at',
];

function buildColumns(columns: string[] | undefined, fallback: string[], allowed: string[]) {
  const selected = columns && columns.length > 0 ? columns : fallback;
  const invalid = selected.filter((c) => !allowed.includes(c));
  if (invalid.length > 0) {
    throw new Error(`Unknown columns: ${invalid.join(', ')}. Allowed: ${allowed.join(', ')}`);
  }
  return selected.join(', ');
}

export async function icpListCommand(client: SupabaseClient, options: IcpListOptions) {
  const columnString = buildColumns(options.columns, ['id', 'name', 'description', 'offering_domain'], allowedProfileColumns);
  const { data, error } = await client.from('icp_profiles').select(columnString);

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function icpHypothesisListCommand(client: SupabaseClient, options: IcpHypothesisListOptions) {
  buildColumns(
    options.columns,
    ['id', 'icp_profile_id', 'segment_id', 'status'],
    allowedHypothesisColumns
  );

  const hypothesisSelect = 'id, icp_id, status, hypothesis_label, search_config, created_at';
  let query: any = client.from('icp_hypotheses').select(hypothesisSelect);

  if (options.icpProfileId) {
    query = query.eq('icp_id', options.icpProfileId);
  }

  if (options.segmentId) {
    const { data: segment, error: segmentError } = await client
      .from('segments')
      .select('id, icp_hypothesis_id')
      .eq('id', options.segmentId)
      .maybeSingle();

    if (segmentError) {
      throw segmentError;
    }

    const hypothesisId = (segment as any)?.icp_hypothesis_id;
    if (!hypothesisId) {
      return [];
    }

    query = query.eq('id', hypothesisId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  if (rows.length === 0) {
    return [];
  }

  const requestedColumns = options.columns && options.columns.length > 0 ? options.columns : ['id', 'icp_profile_id', 'segment_id', 'status'];
  const needsSegmentIds = requestedColumns.includes('segment_id');

  const segmentIdsByHypothesis = new Map<string, string[]>();
  if (needsSegmentIds) {
    const hypothesisIds = rows.map((row) => String(row.id));
    const { data: segments, error: segmentsError } = await client
      .from('segments')
      .select('id, icp_hypothesis_id')
      .in('icp_hypothesis_id', hypothesisIds);

    if (segmentsError) {
      throw segmentsError;
    }

    for (const segment of (segments ?? []) as Array<Record<string, unknown>>) {
      const hypothesisId = String(segment.icp_hypothesis_id ?? '');
      if (!hypothesisId) continue;
      const existing = segmentIdsByHypothesis.get(hypothesisId) ?? [];
      existing.push(String(segment.id));
      segmentIdsByHypothesis.set(hypothesisId, existing);
    }
  }

  return rows.map((row) => {
    const mapped: Record<string, unknown> = {
      id: row.id,
      icp_id: row.icp_id,
      icp_profile_id: row.icp_id,
      status: row.status,
      hypothesis_label: row.hypothesis_label,
      search_config: row.search_config,
      created_at: row.created_at,
      segment_id: segmentIdsByHypothesis.get(String(row.id))?.[0] ?? (options.segmentId ?? null),
    };

    return requestedColumns.reduce<Record<string, unknown>>((acc, column) => {
      acc[column] = mapped[column] ?? null;
      return acc;
    }, {});
  });
}
