import type { SupabaseClient } from '@supabase/supabase-js';

import { parseSegmentFilters } from '../filters';
import { fetchContactsForSegment, getSegmentById, setSegmentVersion } from './segments';
import { createSegmentSnapshot } from './segmentSnapshot';

export interface SnapshotOptions {
  segmentId: string;
  mode: 'reuse' | 'refresh';
  segmentVersion?: number;
  bumpVersion?: boolean;
  allowEmpty?: boolean;
  maxContacts?: number;
}

export interface SnapshotResult {
  version: number;
  count: number;
}

export async function snapshotExists(
  client: SupabaseClient,
  segmentId: string,
  version: number
): Promise<{ exists: boolean; count: number }>
export async function snapshotExists(
  client: SupabaseClient,
  segmentId: string,
  version: number
): Promise<{ exists: boolean; count: number }> {
  const { count, error } = await client
    .from('segment_members')
    .select('id', { head: true, count: 'exact' })
    .match({ segment_id: segmentId, segment_version: version });

  if (error) {
    throw error;
  }

  const resolvedCount = count ?? 0;
  return { exists: resolvedCount > 0, count: resolvedCount };
}

export async function ensureSegmentSnapshot(
  client: SupabaseClient,
  options: SnapshotOptions
): Promise<SnapshotResult> {
  const segment = await getSegmentById(client, options.segmentId);
  const maxContacts = options.maxContacts ?? 5000;
  let targetVersion = options.segmentVersion ?? segment.version ?? 1;

  if (options.bumpVersion) {
    targetVersion = await setSegmentVersion(client, options.segmentId, (segment.version ?? 1) + 1);
  } else if (options.segmentVersion !== undefined && options.segmentVersion !== segment.version) {
    targetVersion = await setSegmentVersion(client, options.segmentId, options.segmentVersion);
  }

  if (options.mode === 'refresh') {
    const result = await refreshSnapshot(client, segment.filter_definition, targetVersion, segment.id, {
      allowEmpty: options.allowEmpty,
      maxContacts,
    });
    return { version: result.segmentVersion, count: result.inserted };
  }

  const existing = await snapshotExists(client, options.segmentId, targetVersion);
  if (existing.exists) {
    if (existing.count > maxContacts) {
      throw new Error(`Segment size ${existing.count} exceeds max ${maxContacts}`);
    }
    if (!options.allowEmpty && existing.count === 0) {
      throw new Error('No contacts matched the segment filters; snapshot is empty.');
    }
    return { version: targetVersion, count: existing.count };
  }

  const result = await refreshSnapshot(client, segment.filter_definition, targetVersion, segment.id, {
    allowEmpty: options.allowEmpty,
    maxContacts,
  });
  return { version: result.segmentVersion, count: result.inserted };
}

async function refreshSnapshot(
  client: SupabaseClient,
  filterDefinition: unknown,
  version: number,
  segmentId: string,
  options: { allowEmpty?: boolean; maxContacts?: number }
) {
  const filters = parseSegmentFilters(filterDefinition);
  const contacts = await fetchContactsForSegment(client, filters);

  if (!options.allowEmpty && contacts.length === 0) {
    throw new Error('No contacts matched the segment filters; snapshot is empty.');
  }

  if (options.maxContacts !== undefined && contacts.length > options.maxContacts) {
    throw new Error(`Contact count ${contacts.length} exceeds max ${options.maxContacts}`);
  }

  return createSegmentSnapshot(client, { id: segmentId, version }, contacts);
}
