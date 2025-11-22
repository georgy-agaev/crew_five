import type { SupabaseClient } from '@supabase/supabase-js';

import { hashFilters, parseSegmentFilters } from '../filters';
import { fetchContactsForSegment, getSegmentById, setSegmentVersion } from './segments';
import { createSegmentSnapshot } from './segmentSnapshot';

export interface SnapshotOptions {
  segmentId: string;
  mode: 'reuse' | 'refresh';
  segmentVersion?: number;
  bumpVersion?: boolean;
  allowEmpty?: boolean;
  maxContacts?: number;
  forceVersion?: boolean;
}

export interface SnapshotResult {
  version: number;
  count: number;
  filtersHash?: string;
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
    if (!options.forceVersion) {
      throw new Error('segment version mismatch; pass --force-version to override');
    }
    targetVersion = await setSegmentVersion(client, options.segmentId, options.segmentVersion);
  }

  const filters = parseSegmentFilters(segment.filter_definition);
  const filtersHash = hashFilters(filters);

  if (options.mode === 'refresh') {
    const result = await refreshSnapshot(client, filters, targetVersion, segment.id, {
      allowEmpty: options.allowEmpty,
      maxContacts,
      filtersHash,
    });
    return { version: result.segmentVersion, count: result.inserted, filtersHash };
  }

  const existing = await getSnapshotMeta(client, options.segmentId, targetVersion);
  if (existing.exists) {
    if (existing.count > maxContacts) {
      throw new Error(`Segment size ${existing.count} exceeds max ${maxContacts}`);
    }
    if (!options.allowEmpty && existing.count === 0) {
      throw new Error('No contacts matched the segment filters; snapshot is empty.');
    }
    if (existing.filtersHash && existing.filtersHash !== filtersHash) {
      throw new Error('Snapshot filters hash mismatch; refresh required.');
    }
    return { version: targetVersion, count: existing.count, filtersHash: existing.filtersHash };
  }

  const result = await refreshSnapshot(client, filters, targetVersion, segment.id, {
    allowEmpty: options.allowEmpty,
    maxContacts,
    filtersHash,
  });
  return { version: result.segmentVersion, count: result.inserted, filtersHash };
}

async function refreshSnapshot(
  client: SupabaseClient,
  filters: ReturnType<typeof parseSegmentFilters>,
  version: number,
  segmentId: string,
  options: { allowEmpty?: boolean; maxContacts?: number; filtersHash?: string }
) {
  const contacts = await fetchContactsForSegment(client, filters);

  if (!options.allowEmpty && contacts.length === 0) {
    throw new Error('No contacts matched the segment filters; snapshot is empty.');
  }

  if (options.maxContacts !== undefined && contacts.length > options.maxContacts) {
    throw new Error(`Contact count ${contacts.length} exceeds max ${options.maxContacts}`);
  }

  return createSegmentSnapshot(client, { id: segmentId, version }, contacts, options.filtersHash);
}

async function getSnapshotMeta(client: SupabaseClient, segmentId: string, version: number) {
  const { data, error, count } = (await client
    .from('segment_members')
    .select('snapshot', { count: 'exact' })
    .match({ segment_id: segmentId, segment_version: version })
    .limit(1)) as any;

  if (error) {
    throw error;
  }

  const filtersHash = data?.[0]?.snapshot?.filters_hash as string | undefined;
  return { exists: (count ?? 0) > 0, count: count ?? 0, filtersHash };
}
