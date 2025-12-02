import type { SupabaseClient } from '@supabase/supabase-js';

import { getFinalizedSegmentVersion } from './segments';
import { getEnrichmentAdapter } from './enrichment/registry';
import { createJob, updateJobStatus, type JobRow } from './jobs';

export interface SegmentEnrichmentSummary {
  processed: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
  jobId?: string;
}

export interface EnqueueSegmentEnrichmentOptions {
  segmentId: string;
  adapter: string;
  limit?: number;
  dryRun?: boolean;
}

export async function enqueueSegmentEnrichment(
  client: SupabaseClient,
  options: EnqueueSegmentEnrichmentOptions
): Promise<JobRow> {
  const segmentVersion = await getFinalizedSegmentVersion(client, options.segmentId);

  const { data, error } = await client
    .from('segment_members')
    .select('contact_id, company_id')
    .eq('segment_id', options.segmentId)
    .eq('segment_version', segmentVersion)
    .limit(options.limit ?? 1000);

  if (error) {
    throw error;
  }

  const members = (data ?? []) as Array<{ contact_id: string; company_id: string }>;
  if (members.length === 0) {
    throw new Error('No segment members found for finalized segment');
  }

  const member_contact_ids = members.map((m) => m.contact_id);
  const member_company_ids = members.map((m) => m.company_id);

  const job = await createJob(client, {
    type: 'enrich',
    segmentId: options.segmentId,
    segmentVersion,
    payload: {
      adapter: options.adapter,
      member_contact_ids,
      member_company_ids,
      limit: options.limit ?? null,
    },
  });

  return job;
}

export async function runSegmentEnrichmentOnce(
  client: SupabaseClient,
  job: JobRow,
  options: { dryRun?: boolean }
): Promise<SegmentEnrichmentSummary> {
  const payload = (job.payload ?? {}) as any;
  const adapterName: string = payload.adapter ?? 'mock';
  const contactIds: string[] = Array.isArray(payload.member_contact_ids) ? payload.member_contact_ids : [];
  const companyIds: string[] = Array.isArray(payload.member_company_ids) ? payload.member_company_ids : [];

  const adapter = getEnrichmentAdapter(adapterName);

  const summary: SegmentEnrichmentSummary = {
    processed: 0,
    skipped: 0,
    failed: 0,
    dryRun: Boolean(options.dryRun),
    jobId: job.id,
  };

  // Enrich companies first (best-effort; ignore failures per company).
  for (const companyId of companyIds) {
    if (!companyId) {
      summary.skipped += 1;
      continue;
    }
    if (options.dryRun) {
      summary.skipped += 1;
      continue;
    }
    try {
      const companyResearch = await adapter.fetchCompanyInsights({ company_id: companyId });
      await client
        .from('companies')
        .update({ company_research: companyResearch })
        .eq('id', companyId);
      summary.processed += 1;
    } catch {
      summary.failed += 1;
    }
  }

  // Enrich contacts.
  for (const contactId of contactIds) {
    if (!contactId) {
      summary.skipped += 1;
      continue;
    }
    if (options.dryRun) {
      summary.skipped += 1;
      continue;
    }
    try {
      const employeeResearch = await adapter.fetchEmployeeInsights({ contact_id: contactId });
      await client
        .from('employees')
        .update({ ai_research_data: employeeResearch })
        .eq('id', contactId);
      summary.processed += 1;
    } catch {
      summary.failed += 1;
    }
  }

  await updateJobStatus(client, job.id, 'completed', {
    processed: summary.processed,
    skipped: summary.skipped,
    failed: summary.failed,
    dryRun: summary.dryRun,
  });

  return summary;
}

export async function getSegmentEnrichmentStatus(
  client: SupabaseClient,
  segmentId: string
): Promise<{ jobId: string; status: string } | null> {
  const { data, error } = await client
    .from('jobs')
    .select('id, status')
    .eq('segment_id', segmentId)
    .eq('type', 'enrich')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    return null;
  }

  const row = data[0] as { id: string; status: string };
  return { jobId: row.id, status: row.status };
}

