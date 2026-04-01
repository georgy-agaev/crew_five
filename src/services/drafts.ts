import type { SupabaseClient } from '@supabase/supabase-js';

import type { AiClient, EmailDraftRequest } from './aiClient.js';
import { applyGracefulFallback, ensureGracefulToggle, getFallbackTemplate } from './fallbackTemplates.js';
import { applyVariantToDraft } from './experiments.js';
import { resolvePromptForStep } from './promptRegistry.js';
import { getPrimaryProvidersForWorkflow } from './enrichmentSettings.js';
import { getProviderResult } from './enrichment/store.js';
import { buildHybridEnrichmentByProvider } from './enrichment/hybridContext.js';
import { listCampaignAudience } from './campaignAudience.js';
import {
  resolveRecipientEmail,
  type EmailDeliverabilityStatus,
} from './recipientResolver.js';

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
    contact?: {
      full_name?: string;
      work_email?: string;
      generic_email?: string | null;
      position?: string;
      recipient_email?: string | null;
      recipient_email_source?: string | null;
      recipient_email_kind?: string | null;
      sendable?: boolean;
    };
    company?: Record<string, unknown> | null;
    request?: EmailDraftRequest;
  };
}

interface OfferingProvenance {
  offeringDomain: string | null;
  offeringHash: string | null;
  offeringSummary: Record<string, unknown> | null;
}

interface EmployeeContextRow {
  id: string;
  ai_research_data?: unknown;
  work_email?: string | null;
  work_email_status?: EmailDeliverabilityStatus | null;
  generic_email?: string | null;
  generic_email_status?: EmailDeliverabilityStatus | null;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!trimmed.includes('@')) return null;
  return trimmed;
}

function resolveMemberEmail(
  snapshot: SegmentMemberRow['snapshot'],
  employee?: EmployeeContextRow | null
): string | null {
  const fromRequest = snapshot?.request?.brief?.prospect?.email;
  const fromSnapshotRecipient = snapshot?.contact?.recipient_email;
  const fromSnapshot = snapshot?.contact?.work_email;
  const fromEmployee = employee
    ? resolveRecipientEmail({
        work_email: employee.work_email ?? null,
        work_email_status: employee.work_email_status ?? null,
        generic_email: employee.generic_email ?? null,
        generic_email_status: employee.generic_email_status ?? null,
      }).recipientEmail
    : null;
  return normalizeEmail(fromRequest) ?? normalizeEmail(fromSnapshotRecipient) ?? normalizeEmail(fromSnapshot) ?? normalizeEmail(fromEmployee);
}

function coerceLanguage(value: unknown): string {
  if (typeof value !== 'string') return 'en';
  const normalized = value.trim().toLowerCase();
  if (!normalized) return 'en';
  // Accept common locales and let the model handle the specifics.
  if (['en', 'ru'].includes(normalized)) return normalized;
  return normalized;
}

function buildRequestFromSnapshot(params: {
  snapshot: SegmentMemberRow['snapshot'];
  language: string;
  patternMode: EmailDraftRequest['pattern_mode'];
  offer: EmailDraftRequest['brief']['offer'];
  context: Record<string, unknown>;
}): EmailDraftRequest | null {
  if (params.snapshot?.request) {
    return params.snapshot.request;
  }

  const contact = params.snapshot?.contact ?? {};
  const company = params.snapshot?.company ?? null;

  const fullName = typeof contact.full_name === 'string' && contact.full_name.trim() ? contact.full_name.trim() : 'there';
  const role = typeof contact.position === 'string' && contact.position.trim() ? contact.position.trim() : 'prospect';
  const companyNameRaw =
    company && typeof (company as any).company_name === 'string' ? String((company as any).company_name) : '';
  const companyName = companyNameRaw.trim() ? companyNameRaw.trim() : 'your company';

  const email =
    typeof contact.recipient_email === 'string' && contact.recipient_email.includes('@')
      ? contact.recipient_email
      : typeof contact.work_email === 'string' && contact.work_email.includes('@')
        ? contact.work_email
        : undefined;

  return {
    email_type: 'intro',
    language: params.language,
    pattern_mode: params.patternMode,
    brief: {
      prospect: {
        full_name: fullName,
        role,
        company_name: companyName,
        email,
      },
      company: company ?? {},
      context: params.context,
      offer: params.offer,
      constraints: {},
    },
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

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asObjectRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function buildOfferingSummaryFromOffer(offer: EmailDraftRequest['brief']['offer']): Record<string, unknown> {
  return {
    product_name: offer.product_name,
    one_liner: offer.one_liner,
    key_benefits: offer.key_benefits,
    proof_points: offer.proof_points ?? [],
    main_cta: offer.CTA ?? null,
  };
}

function resolveOfferingProvenance(params: {
  request: EmailDraftRequest;
  profile: Record<string, unknown> | null;
}): OfferingProvenance {
  const context = asObjectRecord(params.request?.brief?.context) ?? {};
  const offeringDomain =
    asTrimmedString(context.offering_domain) ??
    asTrimmedString(context.offeringDomain) ??
    asTrimmedString(params.profile?.offering_domain) ??
    null;
  const offeringHash = asTrimmedString(context.offering_hash) ?? asTrimmedString(context.offeringHash) ?? null;
  const offeringSummary =
    asObjectRecord(context.offering_summary) ??
    asObjectRecord(context.offeringSummary) ??
    buildOfferingSummaryFromOffer(params.request.brief.offer);

  return {
    offeringDomain,
    offeringHash,
    offeringSummary,
  };
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
  const draftLimit = Math.max(0, options.limit ?? 100);
  const memberFetchLimit = Math.min(Math.max(draftLimit * 25, 250), 2000);
  const audience = await listCampaignAudience(client, options.campaignId, { limit: memberFetchLimit });
  const memberRows = audience.rows.slice(0, memberFetchLimit) as SegmentMemberRow[];

  if (memberRows.length === 0) {
    throw new Error('No campaign audience members found');
  }

  const draftsPayload = [] as any[];
  const summary = {
    generated: 0,
    skipped: 0,
    skippedNoEmail: 0,
    failed: 0,
    dryRun: Boolean(options.dryRun),
    gracefulUsed: 0,
    previewGraceful: Boolean(options.previewGraceful),
    error: undefined as string | undefined,
  };

  if (options.graceful && !getFallbackTemplate('general', 'en')) {
    ensureGracefulToggle(false);
  }

  const segmentLocaleRes = await client
    .from('segments')
    .select('locale')
    .eq('id', campaign.segment_id)
    .maybeSingle();
  if (segmentLocaleRes.error) throw segmentLocaleRes.error;
  const resolvedLanguage = coerceLanguage((campaign as any).language ?? segmentLocaleRes.data?.locale ?? 'en');
  const resolvedPatternMode = ((campaign as any).pattern_mode ?? 'standard') as EmailDraftRequest['pattern_mode'];

  let resolvedCoachPromptId: string | undefined = options.explicitCoachPromptId;
  if (!resolvedCoachPromptId && options.coachPromptStep) {
    resolvedCoachPromptId = await resolvePromptForStep(client, {
      step: options.coachPromptStep,
      explicitId: undefined,
    });
  }

  const profileRes = options.icpProfileId
    ? await client
        .from('icp_profiles')
        .select('id,name,description,offering_domain,company_criteria,persona_criteria,phase_outputs')
        .eq('id', options.icpProfileId)
        .maybeSingle()
    : null;
  if (profileRes?.error) throw profileRes.error;

  const profile = profileRes?.data ?? null;
  const phases = (profile as any)?.phase_outputs ?? {};
  const phase1 = phases?.phase1 ?? {};
  const valueProp =
    (typeof phase1.valueProp === 'string' && phase1.valueProp.trim()) ||
    ((profile as any)?.description as string | undefined) ||
    'Quick intro';

  const productName =
    (typeof (profile as any)?.name === 'string' && (profile as any).name.trim()) ? (profile as any).name.trim() : 'Our product';

  const offer: EmailDraftRequest['brief']['offer'] = {
    product_name: productName,
    one_liner: String(valueProp),
    key_benefits: [],
  };

  const context: Record<string, unknown> = {
    icp_profile_id: options.icpProfileId ?? null,
    icp_hypothesis_id: options.icpHypothesisId ?? null,
  };

  const primaryProvider = await getPrimaryProvidersForWorkflow(client, 'mock');
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

  const employeeById = new Map<string, EmployeeContextRow>();
  if (contactIds.length) {
    const { data, error } = await client
      .from('employees')
      .select('id, ai_research_data, work_email, work_email_status, generic_email, generic_email_status')
      .in('id', contactIds);
    if (error) throw error;
    for (const row of (data ?? []) as EmployeeContextRow[]) {
      employeeById.set(String(row.id), row);
    }
  }

  let eligibleContactsConsidered = 0;
  for (const member of memberRows) {
    if (draftLimit > 0 && eligibleContactsConsidered >= draftLimit) {
      break;
    }

    const employee = employeeById.get(member.contact_id) ?? null;
    const memberEmail = resolveMemberEmail(member.snapshot, employee);
    if (!memberEmail) {
      summary.skippedNoEmail += 1;
      continue;
    }

    const requestBase = buildRequestFromSnapshot({
      snapshot: member.snapshot,
      language: resolvedLanguage,
      patternMode: resolvedPatternMode,
      offer,
      context,
    });
    if (!requestBase) {
      summary.skipped += 1;
      continue;
    }

    const request: EmailDraftRequest =
      requestBase?.brief?.prospect?.email
        ? requestBase
        : {
            ...requestBase,
            brief: {
              ...requestBase.brief,
              prospect: {
                ...requestBase.brief.prospect,
                email: memberEmail,
              },
            },
          };

    const offeringProvenance = resolveOfferingProvenance({
      request,
      profile: (profile as Record<string, unknown> | null) ?? null,
    });

    if (options.dryRun) {
      summary.skipped += 1;
      eligibleContactsConsidered += 1;
      continue;
    }

    eligibleContactsConsidered += 1;

    const enriched = applyHybridEnrichmentToRequest({
      request,
      primaryProviders: primaryProvider,
      companyResearch: companyResearchById.get(member.company_id) ?? null,
      employeeResearch: employee?.ai_research_data ?? null,
    });
    const response = await aiClient.generateDraft(enriched.request);
    let subject = response.subject;
    let body = response.body;

    if (options.graceful || options.previewGraceful) {
      const tpl = getFallbackTemplate('general', 'en') ?? 'Fallback Body';
      const needsFallback = !request?.brief;
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

    const metadataBase: Record<string, unknown> = { ...(response.metadata as any) };
    if (typeof metadataBase.email_type !== 'string') metadataBase.email_type = request.email_type;
    if (typeof metadataBase.language !== 'string') metadataBase.language = request.language;
    if (typeof metadataBase.pattern_mode !== 'string' && typeof request.pattern_mode === 'string') {
      metadataBase.pattern_mode = request.pattern_mode;
    }
    if (typeof metadataBase.model !== 'string') metadataBase.model = options.model ?? 'unknown';

    const metadataWithVariant =
      applyVariantToDraft({ metadata: metadataBase }, options.variant ?? '').metadata ?? {};
    if (resolvedCoachPromptId) {
      (metadataWithVariant as any).coach_prompt_id = resolvedCoachPromptId;
    } else if (typeof (metadataWithVariant as any).coach_prompt_id !== 'string') {
      (metadataWithVariant as any).coach_prompt_id = 'unknown';
    }
    const draftPattern = buildDraftPattern(metadataWithVariant);
    const existingProvider = (metadataWithVariant as any).provider;
    const existingModel = (metadataWithVariant as any).model;

    draftsPayload.push({
      campaign_id: options.campaignId,
      contact_id: member.contact_id,
      company_id: member.company_id,
      email_type: (metadataWithVariant as any).email_type ?? request.email_type,
      language: (metadataWithVariant as any).language ?? request.language,
      pattern_mode: (metadataWithVariant as any).pattern_mode ?? request.pattern_mode,
      subject,
      body,
      metadata: {
        ...metadataWithVariant,
        draft_pattern: draftPattern,
        user_edited: false,
        icp_profile_id: options.icpProfileId ?? null,
        icp_hypothesis_id: options.icpHypothesisId ?? null,
        offering_domain: offeringProvenance.offeringDomain,
        offering_hash: offeringProvenance.offeringHash,
        offering_summary: offeringProvenance.offeringSummary,
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
    summary.error = insertRes.error.message ?? 'Failed to insert drafts';
    return summary;
  }

  return summary;
}
