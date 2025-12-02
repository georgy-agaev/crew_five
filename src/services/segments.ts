import type { SupabaseClient } from '@supabase/supabase-js';

import type { FilterClause } from '../filters';
import { buildContactQuery } from '../filters';

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

export async function fetchContactsForSegment(
  client: SupabaseClient,
  filters: FilterClause[]
): Promise<any[]> {
  const query = buildContactQuery(client, filters);
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

export async function getFinalizedSegmentVersion(client: SupabaseClient, segmentId: string): Promise<number> {
  const segment = await getSegmentById(client, segmentId);
  const version = typeof segment.version === 'number' ? segment.version : 1;
  return version < 1 ? 1 : version;
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
