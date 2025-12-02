import type { SupabaseClient } from '@supabase/supabase-js';

import { ensureFinalSegmentSnapshot } from '../services/segmentSnapshotWorkflow';
import { getEnrichmentAdapter } from '../services/enrichment/registry';
import { enqueueSegmentEnrichment, runSegmentEnrichmentOnce } from '../services/enrichSegment';

interface EnrichOptions {
  segmentId: string;
  adapter?: string;
  dryRun?: boolean;
  limit?: number;
  runNow?: boolean;
  legacySync?: boolean;
}

async function runLegacyEnrichment(client: SupabaseClient, options: EnrichOptions) {
  const adapterName = options.adapter ?? 'mock';
  const { data, error } = await client
    .from('segment_members')
    .select('contact_id, company_id')
    .eq('segment_id', options.segmentId)
    .limit(options.limit ?? 10);
  if (error) throw error;

  const members = (data ?? []) as any[];
  const summary = { processed: 0, skipped: 0, failed: 0, dryRun: Boolean(options.dryRun) };

  if (members.length > 0) {
    const adapter = getEnrichmentAdapter(adapterName);

    for (const m of members) {
      if (!m.contact_id) {
        summary.skipped += 1;
        continue;
      }
      if (options.dryRun) {
        summary.skipped += 1;
        continue;
      }
      try {
        const employeeResearch = await adapter.fetchEmployeeInsights({ contact_id: m.contact_id });
        await client.from('employees').update({ ai_research_data: employeeResearch }).eq('id', m.contact_id);
        summary.processed += 1;
      } catch {
        summary.failed += 1;
      }
    }
  }

  return { status: 'legacy', summary };
}

export async function enrichCommand(client: SupabaseClient, options: EnrichOptions) {
  const mode = options.legacySync ? 'legacy' : options.runNow ? 'async_run_now' : 'async';
  if (options.legacySync) {
    const legacy = await runLegacyEnrichment(client, options);
    return { ...legacy, mode };
  }

  const adapterName = options.adapter ?? 'mock';
  await ensureFinalSegmentSnapshot(client, options.segmentId);
  const job = await enqueueSegmentEnrichment(client, {
    segmentId: options.segmentId,
    adapter: adapterName,
    limit: options.limit,
    dryRun: options.dryRun,
  });

  if (options.runNow) {
    const summary = await runSegmentEnrichmentOnce(client, job, { dryRun: options.dryRun });
    return { status: 'completed', jobId: job.id, summary, mode };
  }

  return { status: 'queued', jobId: job.id, mode };
}
