import type { SupabaseClient } from '@supabase/supabase-js';

export interface CampaignMailboxAssignmentItem {
  id: string;
  mailboxAccountId: string | null;
  senderIdentity: string;
  user: string | null;
  domain: string | null;
  provider: string;
  source: string | null;
  assignedAt: string | null;
  metadata: Record<string, unknown> | null;
}

export interface CampaignMailboxAssignmentView {
  campaignId: string;
  assignments: CampaignMailboxAssignmentItem[];
  summary: {
    assignmentCount: number;
    mailboxAccountCount: number;
    senderIdentityCount: number;
    domainCount: number;
    domains: string[];
  };
}

export interface CampaignMailboxAssignmentInput {
  mailboxAccountId?: string | null;
  senderIdentity: string;
  provider?: string | null;
  source?: string | null;
  metadata?: Record<string, unknown> | null;
}

type CampaignMailboxAssignmentRow = {
  id: string;
  campaign_id: string;
  mailbox_account_id: string | null;
  sender_identity: string;
  provider: string | null;
  source: string | null;
  assigned_at: string | null;
  metadata: Record<string, unknown> | null;
};

function normalizeString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeSenderIdentity(value: unknown): string | null {
  const normalized = normalizeString(value);
  return normalized ? normalized.toLowerCase() : null;
}

export function summarizeCampaignMailboxAssignmentInputs(
  assignments: CampaignMailboxAssignmentInput[] | undefined
): CampaignMailboxAssignmentView['summary'] {
  const deduped = new Map<
    string,
    {
      mailboxAccountId: string | null;
      senderIdentity: string;
    }
  >();

  for (const assignment of assignments ?? []) {
    const senderIdentity = normalizeSenderIdentity(assignment.senderIdentity);
    if (!senderIdentity) {
      continue;
    }
    deduped.set(senderIdentity, {
      mailboxAccountId: normalizeString(assignment.mailboxAccountId),
      senderIdentity,
    });
  }

  const mailboxAccounts = new Set(
    Array.from(deduped.values()).map((row) => row.mailboxAccountId ?? row.senderIdentity)
  );
  const senderIdentities = new Set(Array.from(deduped.values()).map((row) => row.senderIdentity));
  const domains = Array.from(
    new Set(
      Array.from(deduped.values())
        .map((row) => parseSenderIdentity(row.senderIdentity).domain)
        .filter((value): value is string => Boolean(value))
    )
  ).sort((left, right) => left.localeCompare(right));

  return {
    assignmentCount: deduped.size,
    mailboxAccountCount: mailboxAccounts.size,
    senderIdentityCount: senderIdentities.size,
    domainCount: domains.length,
    domains,
  };
}

function parseSenderIdentity(senderIdentity: string) {
  if (!senderIdentity.includes('@')) {
    return { user: null, domain: null };
  }
  const [user, domain] = senderIdentity.split('@');
  return {
    user: user?.trim() || null,
    domain: domain?.trim() || null,
  };
}

function toView(campaignId: string, rows: CampaignMailboxAssignmentRow[]): CampaignMailboxAssignmentView {
  const assignments = rows
    .map((row) => {
      const senderIdentity = normalizeSenderIdentity(row.sender_identity) ?? row.sender_identity;
      const { user, domain } = parseSenderIdentity(senderIdentity);
      return {
        id: row.id,
        mailboxAccountId: normalizeString(row.mailbox_account_id),
        senderIdentity,
        user,
        domain,
        provider: normalizeString(row.provider) ?? 'imap_mcp',
        source: normalizeString(row.source),
        assignedAt: normalizeString(row.assigned_at),
        metadata:
          row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
            ? row.metadata
            : null,
      };
    })
    .sort((left, right) => left.senderIdentity.localeCompare(right.senderIdentity));

  const mailboxAccounts = new Set(
    assignments.map((row) => row.mailboxAccountId ?? row.senderIdentity)
  );
  const senderIdentities = new Set(assignments.map((row) => row.senderIdentity));
  const domains = Array.from(
    new Set(assignments.map((row) => row.domain).filter((value): value is string => Boolean(value)))
  ).sort((left, right) => left.localeCompare(right));

  return {
    campaignId,
    assignments,
    summary: {
      assignmentCount: assignments.length,
      mailboxAccountCount: mailboxAccounts.size,
      senderIdentityCount: senderIdentities.size,
      domainCount: domains.length,
      domains,
    },
  };
}

export async function getCampaignMailboxAssignment(
  client: SupabaseClient,
  campaignId: string
): Promise<CampaignMailboxAssignmentView> {
  const { data, error } = await client
    .from('campaign_mailbox_assignments')
    .select('id,campaign_id,mailbox_account_id,sender_identity,provider,source,assigned_at,metadata')
    .eq('campaign_id', campaignId)
    .order('sender_identity', { ascending: true });

  if (error) {
    throw error;
  }

  return toView(campaignId, (data ?? []) as CampaignMailboxAssignmentRow[]);
}

export async function replaceCampaignMailboxAssignment(
  client: SupabaseClient,
  params: {
    campaignId: string;
    assignments: CampaignMailboxAssignmentInput[];
    source?: string | null;
  }
): Promise<CampaignMailboxAssignmentView> {
  const deduped = new Map<string, CampaignMailboxAssignmentInput>();
  for (const assignment of params.assignments) {
    const senderIdentity = normalizeSenderIdentity(assignment.senderIdentity);
    if (!senderIdentity) {
      continue;
    }
    deduped.set(senderIdentity, {
      mailboxAccountId: normalizeString(assignment.mailboxAccountId),
      senderIdentity,
      provider: normalizeString(assignment.provider) ?? 'imap_mcp',
      source: normalizeString(assignment.source) ?? normalizeString(params.source),
      metadata:
        assignment.metadata && typeof assignment.metadata === 'object' && !Array.isArray(assignment.metadata)
          ? assignment.metadata
          : null,
    });
  }

  const { error: deleteError } = await client
    .from('campaign_mailbox_assignments')
    .delete()
    .eq('campaign_id', params.campaignId);
  if (deleteError) {
    throw deleteError;
  }

  if (deduped.size > 0) {
    const payload = Array.from(deduped.values()).map((assignment) => ({
      campaign_id: params.campaignId,
      mailbox_account_id: assignment.mailboxAccountId ?? null,
      sender_identity: assignment.senderIdentity,
      provider: assignment.provider ?? 'imap_mcp',
      source: assignment.source ?? null,
      metadata: assignment.metadata ?? null,
    }));
    const { error: insertError } = await client.from('campaign_mailbox_assignments').insert(payload);
    if (insertError) {
      throw insertError;
    }
  }

  return getCampaignMailboxAssignment(client, params.campaignId);
}

export async function assertCampaignHasMailboxAssignment(
  client: SupabaseClient,
  campaignId: string
): Promise<void> {
  const assignment = await getCampaignMailboxAssignment(client, campaignId);
  if (assignment.summary.assignmentCount > 0) {
    return;
  }
  const error: Error & { code?: string; statusCode?: number } = new Error(
    'Assign at least one mailbox sender identity before sending'
  );
  error.code = 'MAILBOX_ASSIGNMENT_REQUIRED';
  error.statusCode = 409;
  throw error;
}
