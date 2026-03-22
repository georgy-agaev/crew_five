import {
  buildDraftGenerateOptions,
  formatDraftSummary,
  hasLiveDraftsReady,
} from './legacyWorkspaceMetrics';

type DraftGenerateInput = {
  campaignId: string;
  dryRun: boolean;
  limit: number;
  dataQualityMode: 'strict' | 'graceful';
  interactionMode: 'express' | 'coach';
  icpProfileId?: string;
  icpHypothesisId?: string;
  provider?: string;
  model?: string;
  explicitCoachPromptId?: string;
};

type DraftGenerateResult = {
  generated: number;
  failed?: number;
  skippedNoEmail?: number;
  dryRun: boolean;
  error?: string;
  [key: string]: unknown;
};

type DraftGenerateDeps = {
  triggerDraftGenerate: (
    campaignId: string,
    options: ReturnType<typeof buildDraftGenerateOptions>
  ) => Promise<DraftGenerateResult>;
};

function deriveDraftGenerationError(result: DraftGenerateResult) {
  const failed = result.failed ?? 0;
  const skippedNoEmail = result.skippedNoEmail ?? 0;

  if (failed > 0) {
    return `Draft generation failed for ${failed} contact(s).${result.error ? ` ${result.error}` : ''}`;
  }
  if (skippedNoEmail > 0) {
    return `No drafts generated because ${skippedNoEmail} contact(s) have no email.`;
  }
  return 'No drafts were generated. Check segment members and campaign binding.';
}

export async function generateDraftsForCampaign(
  input: DraftGenerateInput,
  deps: DraftGenerateDeps
) {
  const result = await deps.triggerDraftGenerate(
    input.campaignId,
    buildDraftGenerateOptions({
      dryRun: input.dryRun,
      limit: input.limit,
      dataQualityMode: input.dataQualityMode,
      interactionMode: input.interactionMode,
      icpProfileId: input.icpProfileId,
      icpHypothesisId: input.icpHypothesisId,
      provider: input.provider,
      model: input.model,
      explicitCoachPromptId: input.explicitCoachPromptId,
    })
  );

  const summary = formatDraftSummary({
    generated: result.generated,
    failed: result.failed ?? 0,
    skippedNoEmail: result.skippedNoEmail ?? 0,
    dryRun: result.dryRun,
    dataQualityMode: input.dataQualityMode,
    interactionMode: input.interactionMode,
  });

  if (input.dryRun) {
    return {
      summary,
      error: null,
      completedDraft: null,
      nextStep: null,
    };
  }

  if (!hasLiveDraftsReady(result)) {
    return {
      summary,
      error: deriveDraftGenerationError(result),
      completedDraft: null,
      nextStep: null,
    };
  }

  return {
    summary,
    error: null,
    completedDraft: {
      ...result,
      campaignId: input.campaignId,
    },
    nextStep: 'send' as const,
  };
}
