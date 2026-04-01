import type { SupabaseClient } from '@supabase/supabase-js';

import { evaluateCampaignSendCalendar, type CampaignSendCalendarReason } from './campaignSendCalendar.js';
import { resolveCampaignSendPolicy, type CampaignSendPolicyInput } from './campaignSendPolicy.js';
import {
  getCampaignSendPreflight,
  type CampaignSendPreflightBlockerCode,
} from './campaignSendPreflight.js';
import {
  listCampaignFollowupCandidates,
} from './campaignFollowupCandidates.js';

export type CampaignAutoSendTriggerReason =
  | 'auto_send_intro'
  | 'auto_send_bump'
  | 'auto_send_mixed';

export interface CampaignAutoSendTriggerRequest {
  campaignId: string;
  reason: CampaignAutoSendTriggerReason;
  batchLimit?: number;
}

export interface CampaignAutoSendSweepOptions {
  batchLimit?: number;
  now?: Date;
  executeSendCampaign?: (
    request: CampaignAutoSendTriggerRequest
  ) => Promise<Record<string, unknown>>;
  triggerSendCampaign?: (
    request: CampaignAutoSendTriggerRequest
  ) => Promise<Record<string, unknown>>;
}

interface AutoSendCampaignRow {
  id: string;
  name: string | null;
  status: string | null;
  auto_send_intro: boolean | null;
  auto_send_bump: boolean | null;
  bump_min_days_since_intro: number | null;
  send_timezone?: string | null;
  send_window_start_hour?: number | null;
  send_window_end_hour?: number | null;
  send_weekdays_only?: boolean | null;
  metadata?: Record<string, unknown> | null;
}

export type CampaignAutoSendSkipReason =
  | null
  | 'calendar_outside_send_window'
  | 'calendar_non_workday';

export interface CampaignAutoSendCampaignResult {
  campaignId: string;
  campaignName: string | null;
  campaignStatus: string | null;
  triggered: boolean;
  skipReason: CampaignAutoSendSkipReason;
  triggerReason: CampaignAutoSendTriggerReason | null;
  intro: {
    enabled: boolean;
    shouldTrigger: boolean;
    blockers: CampaignSendPreflightBlockerCode[];
  };
  bump: {
    enabled: boolean;
    shouldTrigger: boolean;
    eligibleCandidateCount: number;
    totalCandidateCount: number;
  };
  calendar?: {
    allowed: boolean;
    campaignLocalTime: string;
    reason: CampaignSendCalendarReason | null;
  };
  triggerResult?: Record<string, unknown>;
  error?: string;
}

export interface CampaignAutoSendSweepResult {
  summary: {
    checkedCount: number;
    triggeredCount: number;
    introTriggeredCount: number;
    bumpTriggeredCount: number;
    mixedTriggeredCount: number;
    skippedCount: number;
    errorCount: number;
  };
  campaigns: CampaignAutoSendCampaignResult[];
}

function buildEmptySummary(): CampaignAutoSendSweepResult['summary'] {
  return {
    checkedCount: 0,
    triggeredCount: 0,
    introTriggeredCount: 0,
    bumpTriggeredCount: 0,
    mixedTriggeredCount: 0,
    skippedCount: 0,
    errorCount: 0,
  };
}

function resolveTriggerReason(input: {
  introShouldTrigger: boolean;
  bumpShouldTrigger: boolean;
}): CampaignAutoSendTriggerReason | null {
  if (input.introShouldTrigger && input.bumpShouldTrigger) {
    return 'auto_send_mixed';
  }
  if (input.introShouldTrigger) {
    return 'auto_send_intro';
  }
  if (input.bumpShouldTrigger) {
    return 'auto_send_bump';
  }
  return null;
}

async function listAutoSendCampaigns(client: SupabaseClient): Promise<AutoSendCampaignRow[]> {
  const { data, error } = await client
    .from('campaigns')
    .select(
      'id,name,status,auto_send_intro,auto_send_bump,bump_min_days_since_intro,send_timezone,send_window_start_hour,send_window_end_hour,send_weekdays_only,metadata'
    )
    .or('auto_send_intro.eq.true,auto_send_bump.eq.true');

  if (error) {
    throw error;
  }

  return (data ?? []) as AutoSendCampaignRow[];
}

function readSendPolicyMetadata(
  metadata: Record<string, unknown> | null | undefined
): Partial<CampaignSendPolicyInput> {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {};
  }

  const sendPolicy = metadata.send_policy;
  if (!sendPolicy || typeof sendPolicy !== 'object' || Array.isArray(sendPolicy)) {
    return {};
  }

  const policy = sendPolicy as Record<string, unknown>;
  return {
    sendDayCountMode:
      policy.send_day_count_mode === 'business_days_campaign'
        ? 'business_days_campaign'
        : policy.send_day_count_mode === 'business_days_recipient'
          ? 'business_days_recipient'
          : undefined,
    sendCalendarCountryCode:
      typeof policy.send_calendar_country_code === 'string'
        ? policy.send_calendar_country_code
        : undefined,
    sendCalendarSubdivisionCode:
      typeof policy.send_calendar_subdivision_code === 'string'
        ? policy.send_calendar_subdivision_code
        : undefined,
  };
}

async function evaluateIntroAutoSend(
  client: SupabaseClient,
  campaign: AutoSendCampaignRow
): Promise<CampaignAutoSendCampaignResult['intro']> {
  if (!campaign.auto_send_intro) {
    return {
      enabled: false,
      shouldTrigger: false,
      blockers: [],
    };
  }

  const preflight = await getCampaignSendPreflight(client, campaign.id);
  return {
    enabled: true,
    shouldTrigger: preflight.readyToSend,
    blockers: preflight.blockers.map((blocker) => blocker.code),
  };
}

async function evaluateBumpAutoSend(
  client: SupabaseClient,
  campaign: AutoSendCampaignRow,
  now?: Date
): Promise<CampaignAutoSendCampaignResult['bump']> {
  if (!campaign.auto_send_bump) {
    return {
      enabled: false,
      shouldTrigger: false,
      eligibleCandidateCount: 0,
      totalCandidateCount: 0,
    };
  }

  const followupOptions = {
    minDaysSinceIntro: campaign.bump_min_days_since_intro ?? 3,
    ...(now ? { now } : {}),
  };
  const candidates = await listCampaignFollowupCandidates(client, campaign.id, followupOptions);
  const eligibleCandidateCount = candidates.filter((candidate) => candidate.eligible).length;

  return {
    enabled: true,
    shouldTrigger: eligibleCandidateCount > 0,
    eligibleCandidateCount,
    totalCandidateCount: candidates.length,
  };
}

export async function runCampaignAutoSendSweep(
  client: SupabaseClient,
  options: CampaignAutoSendSweepOptions
): Promise<CampaignAutoSendSweepResult> {
  const campaigns = await listAutoSendCampaigns(client);
  const summary = buildEmptySummary();
  const results: CampaignAutoSendCampaignResult[] = [];
  const now = options.now;

  for (const campaign of campaigns) {
    summary.checkedCount += 1;
  const calendar = evaluateCampaignSendCalendar(
    resolveCampaignSendPolicy({
      sendTimezone: campaign.send_timezone ?? undefined,
      sendWindowStartHour: campaign.send_window_start_hour ?? undefined,
      sendWindowEndHour: campaign.send_window_end_hour ?? undefined,
      sendWeekdaysOnly: campaign.send_weekdays_only ?? undefined,
      ...readSendPolicyMetadata(campaign.metadata),
    }),
    now ?? new Date()
  );

    if (!calendar.allowed) {
      summary.skippedCount += 1;
      results.push({
        campaignId: campaign.id,
        campaignName: campaign.name,
        campaignStatus: campaign.status,
        triggered: false,
        skipReason:
          calendar.reason === 'non_workday'
            ? 'calendar_non_workday'
            : 'calendar_outside_send_window',
        triggerReason: null,
        intro: {
          enabled: Boolean(campaign.auto_send_intro),
          shouldTrigger: false,
          blockers: [],
        },
        bump: {
          enabled: Boolean(campaign.auto_send_bump),
          shouldTrigger: false,
          eligibleCandidateCount: 0,
          totalCandidateCount: 0,
        },
        calendar,
      });
      continue;
    }

    const intro = await evaluateIntroAutoSend(client, campaign);
    const bump = await evaluateBumpAutoSend(client, campaign, now);
    const triggerReason = resolveTriggerReason({
      introShouldTrigger: intro.shouldTrigger,
      bumpShouldTrigger: bump.shouldTrigger,
    });

    if (!triggerReason) {
      summary.skippedCount += 1;
      results.push({
        campaignId: campaign.id,
        campaignName: campaign.name,
        campaignStatus: campaign.status,
        triggered: false,
        skipReason: null,
        triggerReason: null,
        intro,
        bump,
        calendar,
      });
      continue;
    }

    try {
      const executeSendCampaign = options.executeSendCampaign ?? options.triggerSendCampaign;
      if (!executeSendCampaign) {
        throw new Error('Campaign send execution is not configured');
      }
      const triggerResult = await executeSendCampaign({
        campaignId: campaign.id,
        reason: triggerReason,
        batchLimit: options.batchLimit,
      });

      summary.triggeredCount += 1;
      if (triggerReason === 'auto_send_intro') summary.introTriggeredCount += 1;
      if (triggerReason === 'auto_send_bump') summary.bumpTriggeredCount += 1;
      if (triggerReason === 'auto_send_mixed') summary.mixedTriggeredCount += 1;

      results.push({
        campaignId: campaign.id,
        campaignName: campaign.name,
        campaignStatus: campaign.status,
        triggered: true,
        skipReason: null,
        triggerReason,
        intro,
        bump,
        calendar,
        triggerResult,
      });
    } catch (error) {
      summary.skippedCount += 1;
      summary.errorCount += 1;
      results.push({
        campaignId: campaign.id,
        campaignName: campaign.name,
        campaignStatus: campaign.status,
        triggered: false,
        skipReason: null,
        triggerReason,
        intro,
        bump,
        calendar,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    summary,
    campaigns: results,
  };
}
