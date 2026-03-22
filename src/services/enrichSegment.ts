import type { SupabaseClient } from '@supabase/supabase-js';

import { getFinalizedSegmentVersion } from './segments.js';
import { getEnrichmentAdapter } from './enrichment/registry.js';
import { isEnrichmentStoreV1, upsertProviderResult } from './enrichment/store.js';
import { createJob, updateJobStatus, type JobRow } from './jobs.js';

export interface SegmentEnrichmentSummary {
  processed: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
  jobId?: string;
  providers?: string[];
  counts?: {
    companies: { total: number; processed: number; skipped: number; failed: number };
    employees: { total: number; processed: number; skipped: number; failed: number };
  };
  sampledErrors?: {
    companies: Array<{ id: string; provider: string; message: string }>;
    employees: Array<{ id: string; provider: string; message: string }>;
  };
}

export interface EnqueueSegmentEnrichmentOptions {
  segmentId: string;
  adapter?: string;
  providers?: string[];
  memberCompanyIds?: string[];
  memberContactIds?: string[];
  limit?: number;
  dryRun?: boolean;
  maxAgeDays?: number;
  forceRefresh?: boolean;
}

export interface EnrichmentPreviewCounts {
  companiesTotal: number;
  companiesFresh: number;
  companiesStale: number;
  companiesMissing: number;
  companiesEligibleForRefresh: number;
  contactsTotal: number;
  contactsFresh: number;
  contactsStale: number;
  contactsMissing: number;
  contactsEligibleForRefresh: number;
  plannedCompanyCount: number;
  plannedContactCount: number;
}

export interface SegmentEnrichmentPlan {
  segmentId: string;
  segmentVersion: number;
  providers: string[];
  refreshPolicy: {
    maxAgeDays: number;
    forceRefresh: boolean;
  };
  counts: EnrichmentPreviewCounts;
  plannedCompanyIds: string[];
  plannedContactIds: string[];
}

interface SnapshotMemberRef {
  contact_id: string;
  company_id: string;
}

type FreshnessState = 'fresh' | 'stale' | 'missing';

function uniqueInOrder(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function classifyFreshness(store: unknown, now: Date, maxAgeDays: number): FreshnessState {
  if (!isEnrichmentStoreV1(store)) {
    return 'missing';
  }

  const updatedAt = parseIsoDate(store.lastUpdatedAt);
  if (!updatedAt) {
    return 'missing';
  }

  const ageMs = now.getTime() - updatedAt.getTime();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  return ageMs > maxAgeMs ? 'stale' : 'fresh';
}

export async function planSegmentEnrichment(
  client: SupabaseClient,
  options: {
    segmentId: string;
    providers: string[];
    limit?: number;
    maxAgeDays?: number;
    forceRefresh?: boolean;
    now?: Date;
  }
): Promise<SegmentEnrichmentPlan> {
  const now = options.now ?? new Date();
  const maxAgeDays = Math.max(1, options.maxAgeDays ?? 90);
  const forceRefresh = Boolean(options.forceRefresh);
  const segmentVersion = await getFinalizedSegmentVersion(client, options.segmentId);

  const { data, error } = await client
    .from('segment_members')
    .select('contact_id, company_id')
    .eq('segment_id', options.segmentId)
    .eq('segment_version', segmentVersion);

  if (error) {
    throw error;
  }

  const members = (data ?? []) as SnapshotMemberRef[];
  if (members.length === 0) {
    throw new Error('No segment members found for finalized segment');
  }

  const companyIds = uniqueInOrder(members.map((row) => row.company_id));
  const contactIds = uniqueInOrder(members.map((row) => row.contact_id));

  const companyState = new Map<string, FreshnessState>();
  if (companyIds.length > 0) {
    const { data: companies, error: companiesError } = await client
      .from('companies')
      .select('id, company_research')
      .in('id', companyIds);
    if (companiesError) {
      throw companiesError;
    }

    for (const row of (companies ?? []) as Array<{ id: string; company_research: unknown }>) {
      companyState.set(String(row.id), classifyFreshness(row.company_research, now, maxAgeDays));
    }
  }
  for (const companyId of companyIds) {
    if (!companyState.has(companyId)) {
      companyState.set(companyId, 'missing');
    }
  }

  const contactState = new Map<string, FreshnessState>();
  if (contactIds.length > 0) {
    const { data: contacts, error: contactsError } = await client
      .from('employees')
      .select('id, ai_research_data')
      .in('id', contactIds);
    if (contactsError) {
      throw contactsError;
    }

    for (const row of (contacts ?? []) as Array<{ id: string; ai_research_data: unknown }>) {
      contactState.set(String(row.id), classifyFreshness(row.ai_research_data, now, maxAgeDays));
    }
  }
  for (const contactId of contactIds) {
    if (!contactState.has(contactId)) {
      contactState.set(contactId, 'missing');
    }
  }

  const countStates = (states: Iterable<FreshnessState>) => {
    const counts = { fresh: 0, stale: 0, missing: 0 };
    for (const state of states) {
      counts[state] += 1;
    }
    return counts;
  };

  const companyCounts = countStates(companyState.values());
  const contactCounts = countStates(contactState.values());

  const eligibleCompanyIds = companyIds.filter((companyId) => {
    if (forceRefresh) {
      return true;
    }
    if (companyState.get(companyId) !== 'fresh') {
      return true;
    }
    return members.some((member) => member.company_id === companyId && contactState.get(member.contact_id) !== 'fresh');
  });

  const limitedCompanyIds =
    options.limit !== undefined ? eligibleCompanyIds.slice(0, Math.max(0, options.limit)) : eligibleCompanyIds;
  const limitedCompanySet = new Set(limitedCompanyIds);

  const plannedContactIds = uniqueInOrder(
    members
      .filter((member) => limitedCompanySet.has(member.company_id))
      .map((member) => member.contact_id)
      .filter((contactId) => forceRefresh || contactState.get(contactId) !== 'fresh')
  );

  return {
    segmentId: options.segmentId,
    segmentVersion,
    providers: options.providers,
    refreshPolicy: {
      maxAgeDays,
      forceRefresh,
    },
    counts: {
      companiesTotal: companyIds.length,
      companiesFresh: companyCounts.fresh,
      companiesStale: companyCounts.stale,
      companiesMissing: companyCounts.missing,
      companiesEligibleForRefresh: eligibleCompanyIds.length,
      contactsTotal: contactIds.length,
      contactsFresh: contactCounts.fresh,
      contactsStale: contactCounts.stale,
      contactsMissing: contactCounts.missing,
      contactsEligibleForRefresh: forceRefresh
        ? contactIds.length
        : Array.from(contactState.values()).filter((state) => state !== 'fresh').length,
      plannedCompanyCount: limitedCompanyIds.length,
      plannedContactCount: plannedContactIds.length,
    },
    plannedCompanyIds: limitedCompanyIds,
    plannedContactIds,
  };
}

export async function enqueueSegmentEnrichment(
  client: SupabaseClient,
  options: EnqueueSegmentEnrichmentOptions
): Promise<JobRow> {
  const segmentVersion = await getFinalizedSegmentVersion(client, options.segmentId);
  let member_contact_ids = options.memberContactIds ?? [];
  let member_company_ids = options.memberCompanyIds ?? [];

  if (member_contact_ids.length === 0 && member_company_ids.length === 0) {
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

    member_contact_ids = uniqueInOrder(members.map((m) => m.contact_id));
    member_company_ids = uniqueInOrder(members.map((m) => m.company_id));
  }

  const job = await createJob(client, {
    type: 'enrich',
    segmentId: options.segmentId,
    segmentVersion,
    payload: {
      adapter: options.adapter ?? options.providers?.[0] ?? 'mock',
      providers: options.providers ?? (options.adapter ? [options.adapter] : ['mock']),
      member_contact_ids,
      member_company_ids,
      limit: options.limit ?? null,
      maxAgeDays: options.maxAgeDays ?? null,
      forceRefresh: options.forceRefresh ?? false,
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
  const providers: string[] = Array.isArray(payload.providers) && payload.providers.length > 0
    ? payload.providers
    : [payload.adapter ?? 'mock'];
  const contactIds: string[] = Array.isArray(payload.member_contact_ids) ? payload.member_contact_ids : [];
  const companyIds: string[] = Array.isArray(payload.member_company_ids) ? payload.member_company_ids : [];
  const adapters = providers.map((provider) => ({
    provider,
    adapter: getEnrichmentAdapter(provider, client),
  }));

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
    providers,
  };
  const companyCounts = { total: companyIds.length, processed: 0, skipped: 0, failed: 0 };
  const employeeCounts = { total: contactIds.length, processed: 0, skipped: 0, failed: 0 };
  const companyErrors: Array<{ id: string; provider: string; message: string }> = [];
  const employeeErrors: Array<{ id: string; provider: string; message: string }> = [];
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
      let merged = companyResearchById.get(companyId) ?? null;
      for (const providerEntry of adapters) {
        const companyResearch = await providerEntry.adapter.fetchCompanyInsights({ company_id: companyId });
        merged = upsertProviderResult({
          existing: merged,
          provider: providerEntry.provider,
          result: companyResearch,
        });
      }
      await client
        .from('companies')
        .update({ company_research: merged })
        .eq('id', companyId);
      companyResearchById.set(companyId, merged);
      companyCounts.processed += 1;
      summary.processed += 1;
    } catch (err: unknown) {
      companyCounts.failed += 1;
      summary.failed += 1;
      if (companyErrors.length < maxSampledErrors) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        companyErrors.push({ id: companyId, provider: providers.join(','), message });
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
      let merged = employeeResearchById.get(contactId) ?? null;
      for (const providerEntry of adapters) {
        const employeeResearch = await providerEntry.adapter.fetchEmployeeInsights({ contact_id: contactId });
        merged = upsertProviderResult({
          existing: merged,
          provider: providerEntry.provider,
          result: employeeResearch,
        });
      }
      await client
        .from('employees')
        .update({ ai_research_data: merged })
        .eq('id', contactId);
      employeeResearchById.set(contactId, merged);
      employeeCounts.processed += 1;
      summary.processed += 1;
    } catch (err: unknown) {
      employeeCounts.failed += 1;
      summary.failed += 1;
      if (employeeErrors.length < maxSampledErrors) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        employeeErrors.push({ id: contactId, provider: providers.join(','), message });
      }
    }
  }

  await updateJobStatus(client, job.id, 'completed', {
    provider: providers[0] ?? 'mock',
    providers,
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

  summary.counts = {
    companies: companyCounts,
    employees: employeeCounts,
  };
  summary.sampledErrors = {
    companies: companyErrors,
    employees: employeeErrors,
  };

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
