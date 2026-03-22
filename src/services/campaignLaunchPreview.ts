import type { SupabaseClient } from '@supabase/supabase-js';

import {
  summarizeCampaignMailboxAssignmentInputs,
  type CampaignMailboxAssignmentInput,
} from './campaignMailboxAssignments';
import { resolveCampaignHypothesis } from './campaignHypothesis';
import { deriveEnrichmentState } from './campaigns';
import { getFilterPreviewCounts } from './filterPreview';
import { resolveCampaignSendPolicy, type CampaignSendPolicy, type CampaignSendPolicyInput } from './campaignSendPolicy';
import { resolveRecipientEmail } from './recipientResolver';
import { snapshotExists } from './segmentSnapshotWorkflow';
import { getSegmentById } from './segments';

export interface CampaignLaunchPreviewInput extends CampaignSendPolicyInput {
  name: string;
  segmentId: string;
  segmentVersion?: number;
  offerId?: string;
  icpHypothesisId?: string;
  snapshotMode?: 'reuse' | 'refresh';
  senderPlan?: {
    assignments?: CampaignMailboxAssignmentInput[];
  };
}

export interface CampaignLaunchPreviewWarning {
  code: string;
  message: string;
}

export interface CampaignLaunchPreviewResult {
  ok: true;
  campaign: {
    name: string;
    status: 'draft';
    offerId?: string;
    icpHypothesisId?: string;
  };
  segment: {
    id: string;
    version: number;
    snapshotStatus: 'existing' | 'missing';
  };
  summary: {
    companyCount: number;
    contactCount: number;
    sendableContactCount: number;
    freshCompanyCount: number;
    staleCompanyCount: number;
    missingCompanyCount: number;
    senderAssignmentCount: number;
  };
  senderPlan: {
    assignmentCount: number;
    mailboxAccountCount: number;
    senderIdentityCount: number;
    domainCount: number;
    domains: string[];
  };
  sendPolicy: CampaignSendPolicy;
  warnings: CampaignLaunchPreviewWarning[];
}

interface SegmentMemberRow {
  company_id: string | null;
  contact_id: string | null;
}

interface CompanyRow {
  id: string;
  company_research: unknown;
  updated_at: string | null;
}

interface EmployeeRow {
  id: string;
  work_email: string | null;
  work_email_status: string | null;
  generic_email: string | null;
  generic_email_status: string | null;
}

function buildWarning(code: string, message: string): CampaignLaunchPreviewWarning {
  return { code, message };
}

async function loadSnapshotSummary(
  client: SupabaseClient,
  segmentId: string,
  segmentVersion: number
) {
  const { data: members, error: membersError } = await client
    .from('segment_members')
    .select('company_id,contact_id')
    .match({ segment_id: segmentId, segment_version: segmentVersion });

  if (membersError) {
    throw membersError;
  }

  const memberRows = (members ?? []) as SegmentMemberRow[];
  const companyIds = Array.from(
    new Set(memberRows.map((row) => row.company_id).filter((value): value is string => Boolean(value)))
  );
  const contactIds = Array.from(
    new Set(memberRows.map((row) => row.contact_id).filter((value): value is string => Boolean(value)))
  );

  let companiesById = new Map<string, CompanyRow>();
  if (companyIds.length > 0) {
    const { data: companies, error: companiesError } = await client
      .from('companies')
      .select('id,company_research,updated_at')
      .in('id', companyIds);

    if (companiesError) {
      throw companiesError;
    }

    companiesById = new Map(
      ((companies ?? []) as CompanyRow[]).map((company) => [company.id, company])
    );
  }

  let employeesById = new Map<string, EmployeeRow>();
  if (contactIds.length > 0) {
    const { data: employees, error: employeesError } = await client
      .from('employees')
      .select('id,work_email,work_email_status,generic_email,generic_email_status')
      .in('id', contactIds);

    if (employeesError) {
      throw employeesError;
    }

    employeesById = new Map(
      ((employees ?? []) as EmployeeRow[]).map((employee) => [employee.id, employee])
    );
  }

  let freshCompanyCount = 0;
  let staleCompanyCount = 0;
  let missingCompanyCount = 0;
  for (const companyId of companyIds) {
    const company = companiesById.get(companyId);
    const enrichment = deriveEnrichmentState(
      company?.company_research ?? null,
      company?.updated_at ?? null
    );
    if (enrichment.status === 'fresh') {
      freshCompanyCount += 1;
      continue;
    }
    if (enrichment.status === 'stale') {
      staleCompanyCount += 1;
      continue;
    }
    missingCompanyCount += 1;
  }

  let sendableContactCount = 0;
  for (const contactId of contactIds) {
    const employee = employeesById.get(contactId);
    const resolution = resolveRecipientEmail({
      work_email: employee?.work_email,
      work_email_status: employee?.work_email_status as any,
      generic_email: employee?.generic_email,
      generic_email_status: employee?.generic_email_status as any,
    });
    if (resolution.sendable) {
      sendableContactCount += 1;
    }
  }

  return {
    companyCount: companyIds.length,
    contactCount: contactIds.length,
    sendableContactCount,
    freshCompanyCount,
    staleCompanyCount,
    missingCompanyCount,
  };
}

export async function getCampaignLaunchPreview(
  client: SupabaseClient,
  input: CampaignLaunchPreviewInput
): Promise<CampaignLaunchPreviewResult> {
  const segment = await getSegmentById(client, input.segmentId);
  const segmentVersion = input.segmentVersion ?? segment.version;
  const snapshot = await snapshotExists(client, input.segmentId, segmentVersion);
  const resolvedHypothesis = await resolveCampaignHypothesis(client, {
    icpHypothesisId: input.icpHypothesisId,
    offerId: input.offerId,
  });
  const senderPlan = summarizeCampaignMailboxAssignmentInputs(input.senderPlan?.assignments);
  const sendPolicy = resolveCampaignSendPolicy(input);
  const warnings: CampaignLaunchPreviewWarning[] = [];

  let summary: CampaignLaunchPreviewResult['summary'];
  let snapshotStatus: CampaignLaunchPreviewResult['segment']['snapshotStatus'];

  if (snapshot.exists) {
    snapshotStatus = 'existing';
    const snapshotSummary = await loadSnapshotSummary(client, input.segmentId, segmentVersion);
    summary = {
      ...snapshotSummary,
      senderAssignmentCount: senderPlan.assignmentCount,
    };

    if (snapshotSummary.missingCompanyCount > 0 || snapshotSummary.staleCompanyCount > 0) {
      warnings.push(
        buildWarning(
          'company_enrichment_incomplete',
          'Some companies in this campaign snapshot still need enrichment or refresh.'
        )
      );
    }
  } else {
    snapshotStatus = 'missing';
    const previewCounts = await getFilterPreviewCounts(client, segment.filter_definition);
    summary = {
      companyCount: previewCounts.companyCount,
      contactCount: previewCounts.employeeCount,
      sendableContactCount: 0,
      freshCompanyCount: 0,
      staleCompanyCount: 0,
      missingCompanyCount: 0,
      senderAssignmentCount: senderPlan.assignmentCount,
    };
    warnings.push(
      buildWarning(
        'snapshot_missing_refresh_required',
        'Segment snapshot is missing; create or refresh it before launching the campaign.'
      )
    );
  }

  if (senderPlan.assignmentCount === 0) {
    warnings.push(
      buildWarning(
        'missing_sender_plan',
        'No sender plan is attached yet; you will need mailbox assignment before sending.'
      )
    );
  }

  return {
    ok: true,
    campaign: {
      name: input.name,
      status: 'draft',
      offerId: resolvedHypothesis.offerId,
      icpHypothesisId: resolvedHypothesis.hypothesis?.id,
    },
    segment: {
      id: input.segmentId,
      version: segmentVersion,
      snapshotStatus,
    },
    summary,
    senderPlan,
    sendPolicy,
    warnings,
  };
}
