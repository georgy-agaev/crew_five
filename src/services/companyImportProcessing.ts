import type { SupabaseClient } from '@supabase/supabase-js';

import { createJob, updateJobStatus, type JobRow, type JobStatus } from './jobs.js';

export type CompanyImportProcessMode = 'full' | 'light';

export interface CompanyImportProcessRequest {
  companyIds: string[];
  mode?: CompanyImportProcessMode;
  source?: string | null;
}

export interface CompanyImportProcessCompanyResult {
  companyId: string;
  status: 'completed' | 'error' | 'skipped';
  company_name?: string;
  error?: string;
  note?: string;
}

export interface CompanyImportProcessCommandResult {
  accepted?: boolean;
  total?: number;
  completed?: number;
  failed?: number;
  skipped?: number;
  results?: CompanyImportProcessCompanyResult[];
  errors?: string[];
  [key: string]: unknown;
}

export interface CompanyImportProcessStartResult {
  jobId: string;
  status: JobStatus;
  mode: CompanyImportProcessMode;
  totalCompanies: number;
  batchSize: number;
  source: string | null;
}

export interface CompanyImportProcessStatusView extends CompanyImportProcessStartResult {
  processedCompanies: number;
  completedCompanies: number;
  failedCompanies: number;
  skippedCompanies: number;
  results: CompanyImportProcessCompanyResult[];
  errors: string[];
}

export interface CompanyImportProcessOptions {
  recommendedBatchSize?: number;
  hardMaxBatchSize?: number;
  maxJobCompanyCount?: number;
}

const DEFAULT_RECOMMENDED_BATCH_SIZE = 10;
const DEFAULT_HARD_MAX_BATCH_SIZE = 20;
const DEFAULT_MAX_JOB_COMPANY_COUNT = 5000;

function uniqueInOrder(values: string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function normalizeCompanyIds(companyIds: string[]) {
  return uniqueInOrder(
    companyIds
      .map((companyId) => String(companyId ?? '').trim())
      .filter(Boolean)
  );
}

function chunk<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function toStatusView(job: JobRow): CompanyImportProcessStatusView {
  const payload = (job.payload ?? {}) as Record<string, unknown>;
  const result = (job.result ?? {}) as Record<string, unknown>;
  const companyIds = Array.isArray(payload.company_ids)
    ? payload.company_ids.map((entry) => String(entry))
    : [];
  const results = Array.isArray(result.results)
    ? (result.results as CompanyImportProcessCompanyResult[])
    : [];
  const errors = Array.isArray(result.errors)
    ? result.errors.map((entry) => String(entry))
    : [];
  const completedCompanies =
    typeof result.completedCompanies === 'number'
      ? result.completedCompanies
      : results.filter((entry) => entry.status === 'completed').length;
  const failedCompanies =
    typeof result.failedCompanies === 'number'
      ? result.failedCompanies
      : results.filter((entry) => entry.status === 'error').length;
  const skippedCompanies =
    typeof result.skippedCompanies === 'number'
      ? result.skippedCompanies
      : results.filter((entry) => entry.status === 'skipped').length;
  const processedCompanies =
    typeof result.processedCompanies === 'number'
      ? result.processedCompanies
      : completedCompanies + failedCompanies + skippedCompanies;

  return {
    jobId: job.id,
    status: job.status,
    mode: payload.mode === 'light' ? 'light' : 'full',
    totalCompanies:
      typeof payload.total_companies === 'number' ? payload.total_companies : companyIds.length,
    batchSize:
      typeof payload.batch_size === 'number'
        ? payload.batch_size
        : Math.min(companyIds.length || DEFAULT_RECOMMENDED_BATCH_SIZE, DEFAULT_RECOMMENDED_BATCH_SIZE),
    source: typeof payload.source === 'string' ? payload.source : null,
    processedCompanies,
    completedCompanies,
    failedCompanies,
    skippedCompanies,
    results,
    errors,
  };
}

async function validateCompanyIds(client: SupabaseClient, companyIds: string[]) {
  const { data, error } = await client.from('companies').select('id').in('id', companyIds);
  if (error) {
    throw error;
  }
  const found = new Set(((data ?? []) as Array<{ id: string }>).map((row) => String(row.id)));
  return companyIds.filter((companyId) => !found.has(companyId));
}

export const companyImportProcessingInternals = {
  async runCompanyImportProcessJob(
    client: SupabaseClient,
    job: JobRow,
    trigger: (request: CompanyImportProcessRequest) => Promise<CompanyImportProcessCommandResult>
  ) {
    const payload = (job.payload ?? {}) as Record<string, unknown>;
    const companyIds = Array.isArray(payload.company_ids)
      ? payload.company_ids.map((entry) => String(entry))
      : [];
    const batchSize =
      typeof payload.batch_size === 'number'
        ? payload.batch_size
        : DEFAULT_RECOMMENDED_BATCH_SIZE;
    const mode = payload.mode === 'light' ? 'light' : 'full';
    const source = typeof payload.source === 'string' ? payload.source : null;
    const results: CompanyImportProcessCompanyResult[] = [];
    const errors: string[] = [];

    await updateJobStatus(client, job.id, 'running', {
      mode,
      source,
      totalCompanies: companyIds.length,
      batchSize,
      processedCompanies: 0,
      completedCompanies: 0,
      failedCompanies: 0,
      skippedCompanies: 0,
      results,
      errors,
    });

    try {
      for (const companyIdsBatch of chunk(companyIds, batchSize)) {
        const batchResult = await trigger({ companyIds: companyIdsBatch, mode, source });
        const batchEntries = Array.isArray(batchResult.results)
          ? batchResult.results
          : [];
        const batchErrors = Array.isArray(batchResult.errors)
          ? batchResult.errors.map((entry) => String(entry))
          : [];

        results.push(...batchEntries);
        errors.push(...batchErrors);

        const completedCompanies = results.filter((entry) => entry.status === 'completed').length;
        const failedCompanies = results.filter((entry) => entry.status === 'error').length;
        const skippedCompanies = results.filter((entry) => entry.status === 'skipped').length;

        await updateJobStatus(client, job.id, 'running', {
          mode,
          source,
          totalCompanies: companyIds.length,
          batchSize,
          processedCompanies: results.length,
          completedCompanies,
          failedCompanies,
          skippedCompanies,
          results,
          errors,
        });
      }

      const completedCompanies = results.filter((entry) => entry.status === 'completed').length;
      const failedCompanies = results.filter((entry) => entry.status === 'error').length;
      const skippedCompanies = results.filter((entry) => entry.status === 'skipped').length;

      const completedJob = await updateJobStatus(client, job.id, 'completed', {
        mode,
        source,
        totalCompanies: companyIds.length,
        batchSize,
        processedCompanies: results.length,
        completedCompanies,
        failedCompanies,
        skippedCompanies,
        results,
        errors,
      });

      return toStatusView(completedJob);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(message);
      const failedCompanies = results.filter((entry) => entry.status === 'error').length;
      const skippedCompanies = results.filter((entry) => entry.status === 'skipped').length;
      const completedCompanies = results.filter((entry) => entry.status === 'completed').length;

      const failedJob = await updateJobStatus(client, job.id, 'failed', {
        mode,
        source,
        totalCompanies: companyIds.length,
        batchSize,
        processedCompanies: results.length,
        completedCompanies,
        failedCompanies,
        skippedCompanies,
        results,
        errors,
      });
      return toStatusView(failedJob);
    }
  },
};

export async function startCompanyImportProcess(
  client: SupabaseClient,
  request: CompanyImportProcessRequest,
  trigger: (request: CompanyImportProcessRequest) => Promise<CompanyImportProcessCommandResult>,
  options: CompanyImportProcessOptions = {}
): Promise<CompanyImportProcessStartResult> {
  const companyIds = normalizeCompanyIds(request.companyIds);
  if (companyIds.length === 0) {
    throw new Error('companyIds must be a non-empty array');
  }

  const recommendedBatchSize = options.recommendedBatchSize ?? DEFAULT_RECOMMENDED_BATCH_SIZE;
  const hardMaxBatchSize = options.hardMaxBatchSize ?? DEFAULT_HARD_MAX_BATCH_SIZE;
  const maxJobCompanyCount = options.maxJobCompanyCount ?? DEFAULT_MAX_JOB_COMPANY_COUNT;
  if (companyIds.length > maxJobCompanyCount) {
    throw new Error(`companyIds exceeds max job company count ${maxJobCompanyCount}`);
  }
  const batchSize = Math.min(recommendedBatchSize, companyIds.length, hardMaxBatchSize);

  const missingCompanyIds = await validateCompanyIds(client, companyIds);
  if (missingCompanyIds.length > 0) {
    throw new Error(`Unknown companyIds: ${missingCompanyIds.join(', ')}`);
  }

  const mode = request.mode === 'light' ? 'light' : 'full';
  const job = await createJob(client, {
    type: 'company_process',
    status: 'created',
    payload: {
      company_ids: companyIds,
      total_companies: companyIds.length,
      batch_size: batchSize,
      mode,
      source: request.source ?? null,
    },
  });

  queueMicrotask(() => {
    void companyImportProcessingInternals.runCompanyImportProcessJob(client, job, trigger);
  });

  return {
    jobId: job.id,
    status: job.status,
    mode,
    totalCompanies: companyIds.length,
    batchSize,
    source: request.source ?? null,
  };
}

export async function getCompanyImportProcessStatus(
  client: SupabaseClient,
  jobId: string
): Promise<CompanyImportProcessStatusView | null> {
  const { data, error } = await client
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .eq('type', 'company_process')
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return toStatusView(data as JobRow);
}
