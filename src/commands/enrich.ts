import type { SupabaseClient } from '@supabase/supabase-js';

import { ensureFinalSegmentSnapshot } from '../services/segmentSnapshotWorkflow';
import { getEnrichmentAdapter } from '../services/enrichment/registry';
import { enqueueSegmentEnrichment, planSegmentEnrichment, runSegmentEnrichmentOnce } from '../services/enrichSegment';

interface EnrichOptions {
  segmentId: string;
  adapter?: string;
  provider?: string;
  dryRun?: boolean;
  limit?: number;
  runNow?: boolean;
  legacySync?: boolean;
  maxAgeDays?: number;
  forceRefresh?: boolean;
}

function parseSelectedProviders(options: EnrichOptions): string[] {
  const raw = options.provider ?? options.adapter ?? 'mock';
  return Array.from(
    new Set(
      String(raw)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );
}

async function runLegacyEnrichment(client: SupabaseClient, options: EnrichOptions) {
  const selectedProviders = parseSelectedProviders(options);
  if (selectedProviders.length !== 1) {
    const err: any = new Error('Legacy enrichment does not support multiple providers; use async job flow instead.');
    err.code = 'ENRICHMENT_LEGACY_MULTI_PROVIDER_UNSUPPORTED';
    throw err;
  }
  const adapterName = selectedProviders[0] ?? 'mock';
  if (adapterName === 'exa') {
    const err: any = new Error('Exa adapter does not support legacy synchronous enrichment; use async job flow instead.');
    err.code = 'EXA_ENRICHMENT_LEGACY_UNSUPPORTED';
    throw err;
  }
  const { data, error } = await client
    .from('segment_members')
    .select('contact_id, company_id')
    .eq('segment_id', options.segmentId)
    .limit(options.limit ?? 10);
  if (error) throw error;

  const members = (data ?? []) as any[];
  const summary = { processed: 0, skipped: 0, failed: 0, dryRun: Boolean(options.dryRun) };

  if (members.length > 0) {
    const adapter = getEnrichmentAdapter(adapterName, client);

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

  const selectedProviders = parseSelectedProviders(options);
  // Pre-validate adapter/provider so unknown or misconfigured providers
  // surface immediately (and can be formatted consistently by the CLI).
  selectedProviders.forEach((provider) => getEnrichmentAdapter(provider, client));

  await ensureFinalSegmentSnapshot(client, options.segmentId);
  const plan = await planSegmentEnrichment(client, {
    segmentId: options.segmentId,
    providers: selectedProviders,
    limit: options.limit,
    maxAgeDays: options.maxAgeDays,
    forceRefresh: options.forceRefresh,
  });

  if (options.dryRun) {
    return {
      status: 'preview',
      mode,
      dryRun: true,
      segmentId: plan.segmentId,
      segmentVersion: plan.segmentVersion,
      providers: selectedProviders,
      refreshPolicy: plan.refreshPolicy,
      counts: plan.counts,
      estimate: {
        costModel: 'none',
        estimatedCredits: null,
        estimatedUsd: null,
      },
    };
  }

  if (plan.plannedCompanyIds.length === 0 && plan.plannedContactIds.length === 0) {
    return {
      status: 'noop',
      mode,
      segmentId: plan.segmentId,
      segmentVersion: plan.segmentVersion,
      providers: selectedProviders,
      refreshPolicy: plan.refreshPolicy,
      counts: plan.counts,
    };
  }

  const job = await enqueueSegmentEnrichment(client, {
    segmentId: options.segmentId,
    adapter: selectedProviders[0],
    providers: selectedProviders,
    memberCompanyIds: plan.plannedCompanyIds,
    memberContactIds: plan.plannedContactIds,
    limit: options.limit,
    dryRun: false,
    maxAgeDays: plan.refreshPolicy.maxAgeDays,
    forceRefresh: plan.refreshPolicy.forceRefresh,
  });

  if (options.runNow) {
    const summary = await runSegmentEnrichmentOnce(client, job, { dryRun: options.dryRun });
    return { status: 'completed', jobId: job.id, summary, mode, counts: plan.counts, refreshPolicy: plan.refreshPolicy };
  }

  return {
    status: 'queued',
    jobId: job.id,
    mode,
    providers: selectedProviders,
    counts: plan.counts,
    refreshPolicy: plan.refreshPolicy,
  };
}
