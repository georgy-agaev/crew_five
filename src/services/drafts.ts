import type { SupabaseClient } from '@supabase/supabase-js';

import type { AiClient, EmailDraftRequest } from './aiClient';
import { applyGracefulFallback, ensureGracefulToggle, getFallbackTemplate } from './fallbackTemplates';
import { applyVariantToDraft } from './experiments';

interface GenerateDraftsOptions {
  campaignId: string;
  dryRun?: boolean;
  failFast?: boolean;
  limit?: number;
  graceful?: boolean;
  previewGraceful?: boolean;
  variant?: string;
  interactionMode?: 'coach' | 'express';
  dataQualityMode?: 'strict' | 'graceful';
  icpProfileId?: string;
  icpHypothesisId?: string;
  provider?: string;
  model?: string;
}

interface SegmentMemberRow {
  contact_id: string;
  company_id: string;
  snapshot: {
    request?: EmailDraftRequest;
  };
}

function buildDraftPattern(metadata: Record<string, unknown>): string {
  const coachId = typeof metadata.coach_prompt_id === 'string' ? metadata.coach_prompt_id : 'unknown';
  const patternMode =
    typeof metadata.pattern_mode === 'string' && metadata.pattern_mode.length > 0
      ? (metadata.pattern_mode as string)
      : 'standard';
  const variant =
    typeof metadata.variant === 'string' && metadata.variant.length > 0 ? (metadata.variant as string) : 'default';
  return `${coachId}:${patternMode}:${variant}`;
}

export async function generateDrafts(
  client: SupabaseClient,
  aiClient: AiClient,
  options: GenerateDraftsOptions
) {
  const campaignRes = await client.from('campaigns').select('*').eq('id', options.campaignId).single();
  if (campaignRes.error || !campaignRes.data) {
    throw campaignRes.error ?? new Error('Campaign not found');
  }

  const campaign = campaignRes.data;

  const membersRes = await client
    .from('segment_members')
    .select('contact_id, company_id, snapshot')
    .match({ segment_id: campaign.segment_id, segment_version: campaign.segment_version })
    .limit(options.limit ?? 100);

  if (membersRes.error || !membersRes.data) {
    throw membersRes.error ?? new Error('No segment members found');
  }

  const draftsPayload = [] as any[];
  const summary = {
    generated: 0,
    skipped: 0,
    failed: 0,
    dryRun: Boolean(options.dryRun),
    gracefulUsed: 0,
    previewGraceful: Boolean(options.previewGraceful),
  };

  if (options.graceful && !getFallbackTemplate('general', 'en')) {
    ensureGracefulToggle(false);
  }

  for (const member of membersRes.data as SegmentMemberRow[]) {
    if (!member.snapshot?.request) {
      continue;
    }

    if (options.dryRun) {
      summary.skipped += 1;
      continue;
    }

    const response = await aiClient.generateDraft(member.snapshot.request);
    let subject = response.subject;
    let body = response.body;

    if (options.graceful || options.previewGraceful) {
      const tpl = getFallbackTemplate('general', 'en') ?? 'Fallback Body';
      const needsFallback = !member.snapshot.request?.brief;
      if (needsFallback) {
        summary.gracefulUsed += 1;
        if (options.previewGraceful) {
          summary.generated += 1;
          continue;
        }
        const filled = applyGracefulFallback({ subject, body }, tpl);
        subject = filled.subject ?? subject;
        body = filled.body ?? body;
      }
    }

    const metadataWithVariant =
      applyVariantToDraft({ metadata: response.metadata }, options.variant ?? '').metadata ?? {};
    const draftPattern = buildDraftPattern(metadataWithVariant);

    draftsPayload.push({
      campaign_id: options.campaignId,
      contact_id: member.contact_id,
      company_id: member.company_id,
      email_type: response.metadata.email_type,
      language: response.metadata.language,
      pattern_mode: response.metadata.pattern_mode,
      subject,
      body,
      metadata: {
        ...metadataWithVariant,
        draft_pattern: draftPattern,
        user_edited: false,
        icp_profile_id: options.icpProfileId ?? null,
        icp_hypothesis_id: options.icpHypothesisId ?? null,
        provider: options.provider ?? metadataWithVariant.provider ?? null,
        model: options.model ?? metadataWithVariant.model ?? null,
      },
      status: 'generated',
    });
    summary.generated += 1;
  }

  if (draftsPayload.length === 0) {
    return summary;
  }

  const insertRes = await client.from('drafts').insert(draftsPayload).select();

  if (insertRes.error) {
    if (options.failFast) {
      throw insertRes.error;
    }
    summary.failed += draftsPayload.length;
    return summary;
  }

  return summary;
}
