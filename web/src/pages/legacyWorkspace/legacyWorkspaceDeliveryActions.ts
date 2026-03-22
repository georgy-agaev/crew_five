import { formatSendSummary } from './legacyWorkspaceMetrics';

type EnrichmentResult = {
  provider: string;
  status: string;
  error?: string | null;
};

type RunEnrichmentJobInput = {
  segmentId: string;
  selectedProviders: string[];
  defaultProviders?: string[];
};

type RunEnrichmentJobDeps = {
  enqueueSingle: (input: {
    segmentId: string;
    adapter: string;
    limit: number;
    runNow: boolean;
  }) => Promise<{ status?: string; summary?: { status?: string } }>;
  enqueueMulti: (input: {
    segmentId: string;
    providers: string[];
    limit: number;
    runNow: boolean;
  }) => Promise<{ results?: EnrichmentResult[] | null }>;
};

type PrepareSmartleadCampaignSyncInput = {
  campaignId: string;
  smartleadCampaignId: string;
  batchSize: number;
  dryRun: boolean;
};

type PrepareSmartleadCampaignSyncDeps = {
  triggerSmartlead: (input: PrepareSmartleadCampaignSyncInput) => Promise<{
    leadsPrepared?: number;
    leadsPushed?: number;
    skippedContactsNoEmail?: number;
    sequencesSynced?: number;
    dryRun?: boolean;
  }>;
};

export async function runEnrichmentJob(
  input: RunEnrichmentJobInput,
  deps: RunEnrichmentJobDeps
) {
  const providers =
    input.selectedProviders.length > 0
      ? input.selectedProviders
      : input.defaultProviders?.length
        ? input.defaultProviders
        : ['mock'];

  if (providers.length === 1) {
    const result = await deps.enqueueSingle({
      segmentId: input.segmentId,
      adapter: providers[0],
      limit: 25,
      runNow: true,
    });

    return {
      status: result.status ?? result.summary?.status ?? 'queued',
      results: null,
    };
  }

  const result = await deps.enqueueMulti({
    segmentId: input.segmentId,
    providers,
    limit: 25,
    runNow: true,
  });

  return {
    status: 'completed',
    results: result.results ?? null,
  };
}

export async function prepareSmartleadCampaignSync(
  input: PrepareSmartleadCampaignSyncInput,
  deps: PrepareSmartleadCampaignSyncDeps
) {
  const result = await deps.triggerSmartlead(input);

  return (
    formatSendSummary(
      {
        fetched: result.leadsPrepared ?? 0,
        sent: result.leadsPushed ?? 0,
        skipped: result.skippedContactsNoEmail ?? 0,
      },
      0
    ) + ` · sequencesSynced=${result.sequencesSynced ?? 0} · dryRun=${Boolean(result.dryRun)}`
  );
}
