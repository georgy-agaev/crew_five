import type { SupabaseClient } from '@supabase/supabase-js';

export interface SegmentFilterCondition {
  field: string;
  operator: 'eq' | 'ilike';
  value: string | number | boolean;
}

export interface ContactSnapshotRow {
  contact_id: string;
  company_id: string;
  snapshot: Record<string, unknown>;
}

export interface SegmentInput {
  name: string;
  locale: string;
  filterDefinition: Record<string, unknown>;
  description?: string;
  createdBy?: string;
}

export function parseSegmentFilters(definition: unknown): SegmentFilterCondition[] {
  if (!Array.isArray(definition)) {
    throw new Error('filter_definition must be an array of filter clauses');
  }

  return definition.map((clause, idx) => {
    if (
      !clause ||
      typeof clause !== 'object' ||
      typeof (clause as any).field !== 'string' ||
      typeof (clause as any).operator !== 'string'
    ) {
      throw new Error(`Invalid filter clause at index ${idx}`);
    }

    const { field, operator, value } = clause as {
      field: string;
      operator: string;
      value: any;
    };

    if (operator !== 'eq' && operator !== 'ilike') {
      throw new Error(`Unsupported operator: ${operator}`);
    }

    return { field, operator, value } as SegmentFilterCondition;
  });
}

export async function fetchContactsForSegment(
  client: SupabaseClient,
  filters: SegmentFilterCondition[]
): Promise<any[]> {
  let query: any = client
    .from('employees')
    .select(
      'id, company_id, full_name, work_email, position, company:companies(id, company_name, segment)'
    );

  for (const filter of filters) {
    if (filter.operator === 'eq') {
      query = query.eq(filter.field, filter.value);
    } else {
      query = query.ilike(filter.field, String(filter.value));
    }
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function createSegment(
  client: SupabaseClient,
  input: SegmentInput
): Promise<Record<string, any>> {
  const { data, error } = await client
    .from('segments')
    .insert([
      {
        name: input.name,
        locale: input.locale,
        filter_definition: input.filterDefinition,
        description: input.description,
        created_by: input.createdBy,
      },
    ])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as Record<string, any>;
}

export async function getSegmentById(client: SupabaseClient, id: string) {
  const { data, error } = await client.from('segments').select('*').eq('id', id).single();

  if (error || !data) {
    throw error ?? new Error('Segment not found');
  }

  return data;
}

export async function setSegmentVersion(
  client: SupabaseClient,
  segmentId: string,
  version: number
): Promise<number> {
  const { data, error } = await client
    .from('segments')
    .update({ version })
    .eq('id', segmentId)
    .select('version')
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to update segment version');
  }

  return data.version ?? version;
}
