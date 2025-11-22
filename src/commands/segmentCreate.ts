import type { SupabaseClient } from '@supabase/supabase-js';

import { createSegment } from '../services/segments';

interface SegmentCreateOptions {
  name: string;
  locale: string;
  filter: string;
  description?: string;
  createdBy?: string;
}

export async function segmentCreateHandler(client: SupabaseClient, options: SegmentCreateOptions) {
  const filterDefinition = JSON.parse(options.filter);
  return createSegment(client, {
    name: options.name,
    locale: options.locale,
    filterDefinition,
    description: options.description,
    createdBy: options.createdBy,
  });
}
