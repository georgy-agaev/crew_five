import type { SupabaseClient } from '@supabase/supabase-js';

export interface SegmentRecord {
  id: string;
  version: number;
}

export interface ContactRow {
  id: string;
  company_id: string;
  full_name?: string;
  work_email?: string;
  position?: string;
  company?: {
    id: string;
    company_name?: string;
    segment?: string;
  };
}

export interface SnapshotResult {
  inserted: number;
  segmentId: string;
  segmentVersion: number;
}

export async function createSegmentSnapshot(
  client: SupabaseClient,
  segment: SegmentRecord,
  contacts: ContactRow[],
  filtersHash?: string
): Promise<SnapshotResult> {
  await client
    .from('segment_members')
    .delete()
    .match({ segment_id: segment.id, segment_version: segment.version });

  if (contacts.length === 0) {
    return { inserted: 0, segmentId: segment.id, segmentVersion: segment.version };
  }

  const rows = contacts.map((contact) => ({
    segment_id: segment.id,
    segment_version: segment.version,
    contact_id: contact.id,
    company_id: contact.company_id,
    snapshot: {
      contact: {
        full_name: contact.full_name,
        work_email: contact.work_email,
        position: contact.position,
      },
      company: contact.company ?? null,
      filters_hash: filtersHash ?? null,
    },
  }));

  const { data, error } = await client.from('segment_members').insert(rows).select();

  if (error) {
    throw error;
  }

  return {
    inserted: data?.length ?? rows.length,
    segmentId: segment.id,
    segmentVersion: segment.version,
  };
}
