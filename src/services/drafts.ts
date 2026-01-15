import type { SupabaseClient } from '@supabase/supabase-js';

import type { AiClient, EmailDraftRequest } from './aiClient';
import { applyGracefulFallback, ensureGracefulToggle, getFallbackTemplate } from './fallbackTemplates';
import { applyVariantToDraft } from './experiments';
import { resolvePromptForStep } from './promptRegistry';
import { getPrimaryProvidersForWorkflow } from './enrichmentSettings';
import { getProviderResult } from './enrichment/store';
import { buildHybridEnrichmentByProvider } from './enrichment/hybridContext';

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
   coachPromptStep?: string;
   explicitCoachPromptId?: string;
}

interface SegmentMemberRow {
  contact_id: string;
  company_id: string;
  snapshot: {
    request?: EmailDraftRequest;
  };
}

function applyHybridEnrichmentToRequest(params: {
  request: EmailDraftRequest;
  primaryProviders: { company: string; employee: string };
  companyResearch: unknown;
  employeeResearch: unknown;
}) {
  const companyPrimary = getProviderResult(params.companyResearch, params.primaryProviders.company);
  const employeePrimary = getProviderResult(params.employeeResearch, params.primaryProviders.employee);

  const byProvider = buildHybridEnrichmentByProvider({
    primaryProvider: params.primaryProviders.company,
    companyStore: params.companyResearch,
    employeeStore: params.employeeResearch,
  });

  const supplementalByProvider =
    byProvider &&
    Object.fromEntries(
      Object.entries(byProvider).map(([providerId, entry]) => {
        const primaryFor: Array<'company' | 'employee'> = [];
        if (providerId === params.primaryProviders.company) primaryFor.push('company');
        if (providerId === params.primaryProviders.employee) primaryFor.push('employee');

        if (primaryFor.length) {
          return [
            providerId,
            {
              primaryFor,
              mode: 'primary',
              meta: (entry as any)?.meta,
            },
          ];
        }

        return [providerId, entry];
      })
    );

  const enrichmentByProvider = supplementalByProvider ?? null;

  if (!companyPrimary && !employeePrimary && !enrichmentByProvider) {
    return { request: params.request, enrichmentProvider: params.primaryProviders, enrichmentByProvider };
  }

  return {
    enrichmentProvider: params.primaryProviders,
    enrichmentByProvider,
    request: {
      ...params.request,
      brief: {
        ...params.request.brief,
        company: {
          ...params.request.brief.company,
          enrichment: companyPrimary ?? null,
        },
        context: {
          ...params.request.brief.context,
          enrichment_provider: params.primaryProviders,
          lead_enrichment: employeePrimary ?? null,
          enrichment_by_provider: enrichmentByProvider,
        },
      },
    },
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

  let resolvedCoachPromptId: string | undefined = options.explicitCoachPromptId;
  if (!resolvedCoachPromptId && options.coachPromptStep) {
    resolvedCoachPromptId = await resolvePromptForStep(client, {
      step: options.coachPromptStep,
      explicitId: undefined,
    });
  }

  const primaryProvider = await getPrimaryProvidersForWorkflow(client, 'mock');
  const memberRows = membersRes.data as SegmentMemberRow[];
  const contactIds = Array.from(new Set(memberRows.map((m) => m.contact_id).filter(Boolean)));
  const companyIds = Array.from(new Set(memberRows.map((m) => m.company_id).filter(Boolean)));

  const companyResearchById = new Map<string, unknown>();
  if (companyIds.length) {
    const { data, error } = await client.from('companies').select('id, company_research').in('id', companyIds);
    if (error) throw error;
    for (const row of (data ?? []) as any[]) {
      companyResearchById.set(String(row.id), row.company_research);
    }
  }

  const employeeResearchById = new Map<string, unknown>();
  if (contactIds.length) {
    const { data, error } = await client.from('employees').select('id, ai_research_data').in('id', contactIds);
    if (error) throw error;
    for (const row of (data ?? []) as any[]) {
      employeeResearchById.set(String(row.id), row.ai_research_data);
    }
  }

  for (const member of memberRows) {
    if (!member.snapshot?.request) {
      continue;
    }

    if (options.dryRun) {
      summary.skipped += 1;
      continue;
    }

    const enriched = applyHybridEnrichmentToRequest({
      request: member.snapshot.request,
      primaryProviders: primaryProvider,
      companyResearch: companyResearchById.get(member.company_id) ?? null,
      employeeResearch: employeeResearchById.get(member.contact_id) ?? null,
    });
    const response = await aiClient.generateDraft(enriched.request);
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
    if (resolvedCoachPromptId) {
      (metadataWithVariant as any).coach_prompt_id = resolvedCoachPromptId;
    }
    const draftPattern = buildDraftPattern(metadataWithVariant);
    const existingProvider = (metadataWithVariant as any).provider;
    const existingModel = (metadataWithVariant as any).model;

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
        provider: options.provider ?? existingProvider ?? null,
        model: options.model ?? existingModel ?? null,
        enrichment_provider: enriched.enrichmentProvider,
        enrichment_by_provider: enriched.enrichmentByProvider,
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
