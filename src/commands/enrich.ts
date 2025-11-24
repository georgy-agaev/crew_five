import type { SupabaseClient } from '@supabase/supabase-js';

import { getEnrichmentAdapter } from '../services/enrichment/registry';

interface EnrichOptions {
  segmentId: string;
  adapter?: string;
  dryRun?: boolean;
  limit?: number;
}

export async function enrichCommand(client: SupabaseClient, options: EnrichOptions) {
  const adapter = getEnrichmentAdapter(options.adapter ?? 'mock');
  const { data, error } = await client
    .from('segment_members')
    .select('contact_id, company_id')
    .eq('segment_id', options.segmentId)
    .limit(options.limit ?? 10);
  if (error) throw error;

  const members = data ?? [];
  const summary = { processed: 0, skipped: 0, failed: 0, dryRun: Boolean(options.dryRun) };
  for (const m of members as any[]) {
    if (!m.contact_id) {
      summary.skipped += 1;
      continue;
    }
    if (options.dryRun) {
      summary.skipped += 1;
      continue;
    }
    try {
      await adapter.fetchEmployeeInsights({ contact_id: m.contact_id });
      summary.processed += 1;
    } catch {
      summary.failed += 1;
    }
  }
  return summary;
}
