import type { SupabaseClient } from '@supabase/supabase-js';

import {
  fetchContactsForSegment,
  getSegmentById,
  parseSegmentFilters,
  setSegmentVersion,
} from './segments';
import { createSegmentSnapshot } from './segmentSnapshot';

export interface SnapshotOptions {
  segmentId: string;
  mode: 'reuse' | 'refresh';
  segmentVersion?: number;
  bumpVersion?: boolean;
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
  let targetVersion = options.segmentVersion ?? segment.version ?? 1;

  if (options.segmentVersion !== undefined && options.segmentVersion !== segment.version) {
    targetVersion = await setSegmentVersion(client, options.segmentId, options.segmentVersion);
  } else if (options.bumpVersion) {
    targetVersion = await setSegmentVersion(client, options.segmentId, (segment.version ?? 1) + 1);
  }

  if (options.mode === 'refresh') {
    const result = await refreshSnapshot(client, segment.filter_definition, targetVersion, segment.id);
    return { version: result.segmentVersion, count: result.inserted };
  }

  const existing = await snapshotExists(client, options.segmentId, targetVersion);
  if (existing.exists) {
    return { version: targetVersion, count: existing.count };
  }

  const result = await refreshSnapshot(client, segment.filter_definition, targetVersion, segment.id);
  return { version: result.segmentVersion, count: result.inserted };
}

async function refreshSnapshot(
  client: SupabaseClient,
  filterDefinition: unknown,
  version: number,
  segmentId: string
) {
  const filters = parseSegmentFilters(filterDefinition);
  const contacts = await fetchContactsForSegment(client, filters);
  return createSegmentSnapshot(client, { id: segmentId, version }, contacts);
}
