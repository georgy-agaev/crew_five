import type { SupabaseClient } from '@supabase/supabase-js';

import {
  replaceCampaignMailboxAssignment,
  summarizeCampaignMailboxAssignmentInputs,
  type CampaignMailboxAssignmentInput,
  type CampaignMailboxAssignmentView,
} from './campaignMailboxAssignments.js';
import { resolveCampaignHypothesis } from './campaignHypothesis.js';
import { createCampaign, type CampaignInput } from './campaigns.js';
import {
  buildCampaignSendPolicyMetadata,
  resolveCampaignSendPolicy,
  type CampaignSendPolicy,
  type CampaignSendPolicyInput,
} from './campaignSendPolicy.js';
import { ensureSegmentSnapshot } from './segmentSnapshotWorkflow.js';

export interface CampaignLaunchInput extends CampaignSendPolicyInput {
  name: string;
  segmentId: string;
  segmentVersion?: number;
  projectId?: string;
  offerId?: string;
  icpHypothesisId?: string;
  senderProfileId?: string;
  promptPackId?: string;
  schedule?: Record<string, unknown>;
  throttle?: Record<string, unknown>;
  createdBy?: string;
  snapshotMode?: 'reuse' | 'refresh';
  bumpSegmentVersion?: boolean;
  allowEmpty?: boolean;
  maxContacts?: number;
  forceVersion?: boolean;
  senderPlan?: {
    source?: string | null;
    assignments?: CampaignMailboxAssignmentInput[];
  };
}

export interface CampaignLaunchResult {
  campaign: Record<string, any>;
  segment: {
    id: string;
    version: number;
    snapshot: Record<string, unknown>;
  };
  senderPlan: {
    assignments: CampaignMailboxAssignmentView['assignments'];
    summary: CampaignMailboxAssignmentView['summary'];
  };
  sendPolicy: CampaignSendPolicy;
}

function toCampaignCreateInput(
  input: CampaignLaunchInput,
  segmentVersion: number,
  snapshot: Record<string, unknown>,
  sendPolicy: CampaignSendPolicy,
  resolved: {
    projectId?: string;
    offerId?: string;
    icpHypothesisId?: string;
  }
): CampaignInput {
  return {
    name: input.name,
    segmentId: input.segmentId,
    segmentVersion,
    projectId: resolved.projectId,
    offerId: resolved.offerId,
    icpHypothesisId: resolved.icpHypothesisId,
    senderProfileId: input.senderProfileId,
    promptPackId: input.promptPackId,
    schedule: input.schedule,
    throttle: input.throttle,
    createdBy: input.createdBy,
    sendTimezone: sendPolicy.sendTimezone,
    sendWindowStartHour: sendPolicy.sendWindowStartHour,
    sendWindowEndHour: sendPolicy.sendWindowEndHour,
    sendWeekdaysOnly: sendPolicy.sendWeekdaysOnly,
    sendDayCountMode: sendPolicy.sendDayCountMode,
    sendCalendarCountryCode: sendPolicy.sendCalendarCountryCode,
    sendCalendarSubdivisionCode: sendPolicy.sendCalendarSubdivisionCode,
    metadata: {
      snapshot,
      ...buildCampaignSendPolicyMetadata(null, sendPolicy),
    },
  };
}

export async function launchCampaign(
  client: SupabaseClient,
  input: CampaignLaunchInput
): Promise<CampaignLaunchResult> {
  const sendPolicy = resolveCampaignSendPolicy(input);
  const resolvedHypothesis = await resolveCampaignHypothesis(client, {
    icpHypothesisId: input.icpHypothesisId,
    offerId: input.offerId,
    projectId: input.projectId,
  });
  const snapshot = await ensureSegmentSnapshot(client, {
    segmentId: input.segmentId,
    segmentVersion: input.segmentVersion,
    mode: input.snapshotMode ?? 'reuse',
    bumpVersion: input.bumpSegmentVersion,
    allowEmpty: input.allowEmpty,
    maxContacts: input.maxContacts,
    forceVersion: input.forceVersion,
  });

  const campaign = await createCampaign(
    client,
    toCampaignCreateInput(
      input,
      snapshot.version,
      snapshot as unknown as Record<string, unknown>,
      sendPolicy,
      {
        projectId: resolvedHypothesis.projectId,
        offerId: resolvedHypothesis.offerId,
        icpHypothesisId: resolvedHypothesis.hypothesis?.id,
      }
    )
  );

  const assignments = input.senderPlan?.assignments ?? [];
  const senderPlan =
    assignments.length > 0
      ? await replaceCampaignMailboxAssignment(client, {
          campaignId: String(campaign.id),
          assignments,
          source: input.senderPlan?.source ?? null,
        })
      : {
          campaignId: String(campaign.id),
          assignments: [],
          summary: summarizeCampaignMailboxAssignmentInputs(assignments),
        };

  return {
    campaign,
    segment: {
      id: input.segmentId,
      version: snapshot.version,
      snapshot: snapshot as unknown as Record<string, unknown>,
    },
    senderPlan: {
      assignments: senderPlan.assignments,
      summary: senderPlan.summary,
    },
    sendPolicy,
  };
}
