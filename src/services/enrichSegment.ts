import type { SupabaseClient } from '@supabase/supabase-js';

import { getFinalizedSegmentVersion } from './segments';
import { getEnrichmentAdapter } from './enrichment/registry';
import { upsertProviderResult } from './enrichment/store';
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

  const adapter = getEnrichmentAdapter(adapterName, client);
  const providerKey = adapterName;

  const companyResearchById = new Map<string, unknown>();
  if (companyIds.length) {
    const { data, error } = await client
      .from('companies')
      .select('id, company_research')
      .in('id', companyIds);
    if (error) throw error;
    for (const row of (data ?? []) as any[]) {
      companyResearchById.set(String(row.id), row.company_research);
    }
  }

  const employeeResearchById = new Map<string, unknown>();
  if (contactIds.length) {
    const { data, error } = await client
      .from('employees')
      .select('id, ai_research_data')
      .in('id', contactIds);
    if (error) throw error;
    for (const row of (data ?? []) as any[]) {
      employeeResearchById.set(String(row.id), row.ai_research_data);
    }
  }

  const summary: SegmentEnrichmentSummary = {
    processed: 0,
    skipped: 0,
    failed: 0,
    dryRun: Boolean(options.dryRun),
    jobId: job.id,
  };
  const companyCounts = { total: companyIds.length, processed: 0, skipped: 0, failed: 0 };
  const employeeCounts = { total: contactIds.length, processed: 0, skipped: 0, failed: 0 };
  const companyErrors: Array<{ id: string; message: string }> = [];
  const employeeErrors: Array<{ id: string; message: string }> = [];
  const maxSampledErrors = 5;

  // Enrich companies first (best-effort; ignore failures per company).
  for (const companyId of companyIds) {
    if (!companyId) {
      companyCounts.skipped += 1;
      summary.skipped += 1;
      continue;
    }
    if (options.dryRun) {
      companyCounts.skipped += 1;
      summary.skipped += 1;
      continue;
    }
    try {
      const companyResearch = await adapter.fetchCompanyInsights({ company_id: companyId });
      const merged = upsertProviderResult({
        existing: companyResearchById.get(companyId) ?? null,
        provider: providerKey,
        result: companyResearch,
      });
      await client
        .from('companies')
        .update({ company_research: merged })
        .eq('id', companyId);
      companyCounts.processed += 1;
      summary.processed += 1;
    } catch (err: unknown) {
      companyCounts.failed += 1;
      summary.failed += 1;
      if (companyErrors.length < maxSampledErrors) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        companyErrors.push({ id: companyId, message });
      }
    }
  }

  // Enrich contacts.
  for (const contactId of contactIds) {
    if (!contactId) {
      employeeCounts.skipped += 1;
      summary.skipped += 1;
      continue;
    }
    if (options.dryRun) {
      employeeCounts.skipped += 1;
      summary.skipped += 1;
      continue;
    }
    try {
      const employeeResearch = await adapter.fetchEmployeeInsights({ contact_id: contactId });
      const merged = upsertProviderResult({
        existing: employeeResearchById.get(contactId) ?? null,
        provider: providerKey,
        result: employeeResearch,
      });
      await client
        .from('employees')
        .update({ ai_research_data: merged })
        .eq('id', contactId);
      employeeCounts.processed += 1;
      summary.processed += 1;
    } catch (err: unknown) {
      employeeCounts.failed += 1;
      summary.failed += 1;
      if (employeeErrors.length < maxSampledErrors) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        employeeErrors.push({ id: contactId, message });
      }
    }
  }

  await updateJobStatus(client, job.id, 'completed', {
    provider: providerKey,
    processed: summary.processed,
    skipped: summary.skipped,
    failed: summary.failed,
    dryRun: summary.dryRun,
    counts: {
      companies: companyCounts,
      employees: employeeCounts,
    },
    sampledErrors: {
      companies: companyErrors,
      employees: employeeErrors,
    },
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
