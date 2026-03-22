import type { PromptStep } from '../../apiClient';

export function formatDraftSummary(params: {
  generated: number;
  failed?: number;
  skippedNoEmail?: number;
  dryRun: boolean;
  dataQualityMode: 'strict' | 'graceful';
  interactionMode: 'express' | 'coach';
}) {
  const failed = params.failed ?? 0;
  const skippedNoEmail = params.skippedNoEmail ?? 0;
  return `Drafts ready: generated=${params.generated}, failed=${failed}, skippedNoEmail=${skippedNoEmail}, dryRun=${params.dryRun}, modes=${params.dataQualityMode}/${params.interactionMode}`;
}

export function hasLiveDraftsReady(summary: {
  dryRun: boolean;
  generated: number;
  failed?: number;
}) {
  if (summary.dryRun) return false;
  if (summary.generated <= 0) return false;
  return (summary.failed ?? 0) === 0;
}

export function buildDraftGenerateOptions(params: {
  dryRun: boolean;
  limit: number;
  dataQualityMode: 'strict' | 'graceful';
  interactionMode: 'express' | 'coach';
  icpProfileId?: string;
  icpHypothesisId?: string;
  coachPromptStep?: string;
  explicitCoachPromptId?: string;
  provider?: string;
  model?: string;
}) {
  return {
    dryRun: params.dryRun,
    limit: params.limit,
    dataQualityMode: params.dataQualityMode,
    interactionMode: params.interactionMode,
    icpProfileId: params.icpProfileId,
    icpHypothesisId: params.icpHypothesisId,
    coachPromptStep: params.coachPromptStep,
    explicitCoachPromptId: params.explicitCoachPromptId,
    provider: params.provider,
    model: params.model,
  };
}

export function formatAnalyticsGroupKey(
  groupBy: string,
  row: Record<string, unknown>
) {
  if (groupBy === 'segment') {
    return `${row.segment_id ?? 'n/a'}@v${row.segment_version ?? 'n/a'} (${row.role ?? 'any'})`;
  }
  if (groupBy === 'pattern') {
    return `${row.draft_pattern ?? 'unknown'} [edited=${row.user_edited ?? false}]`;
  }
  if (groupBy === 'offer') {
    const title = (row.offer_title as string) ?? (row.offer_id as string) ?? 'n/a';
    const project = row.project_name as string | undefined;
    return project ? `${title} (${project})` : title;
  }
  if (groupBy === 'hypothesis') {
    return (row.hypothesis_label as string) ?? (row.icp_hypothesis_id as string) ?? 'n/a';
  }
  if (groupBy === 'recipient_type') {
    return (row.recipient_type as string) ?? 'n/a';
  }
  if (groupBy === 'sender_identity') {
    return (row.sender_identity as string) ?? 'n/a';
  }
  return `${row.icp_profile_id ?? 'n/a'} / ${row.icp_hypothesis_id ?? 'n/a'}`;
}

export function formatSendSummary(
  result: { fetched?: number; sent?: number; skipped?: number },
  truncated?: number
) {
  const base = `Smartlead prepare: fetched=${result.fetched ?? 0}, sent=${result.sent ?? 0}, skipped=${result.skipped ?? 0}`;
  return truncated && truncated > 0 ? `${base} (truncated preview by ${truncated})` : base;
}

export function getPromptStatusKey(entry: {
  is_active?: boolean;
  rollout_status?: string | null;
}) {
  if (entry.is_active) return 'active';
  if (entry.rollout_status === 'active') return 'active';
  if (entry.rollout_status === 'pilot') return 'pilot';
  if (entry.rollout_status === 'retired') return 'retired';
  return '';
}

export function aggregateAnalyticsMetrics(
  rows: Array<{ delivered?: number; opened?: number; replied?: number; positive_replies?: number }>
) {
  return rows.reduce(
    (acc, row) => ({
      delivered: acc.delivered + (row.delivered ?? 0),
      opened: acc.opened + (row.opened ?? 0),
      replied: acc.replied + (row.replied ?? 0),
      positive: acc.positive + (row.positive_replies ?? 0),
    }),
    { delivered: 0, opened: 0, replied: 0, positive: 0 } as {
      delivered: number;
      opened: number;
      replied: number;
      positive: number;
    }
  );
}

export function getActivePromptIdForStep(
  entries: Array<{
    id: string;
    step?: PromptStep;
    is_active?: boolean;
    rollout_status?: string | null;
  }>,
  step: PromptStep
) {
  const match = entries.find((entry) => {
    if (entry.step !== step) return false;
    return getPromptStatusKey(entry) === 'active';
  });
  return match?.id ?? null;
}
