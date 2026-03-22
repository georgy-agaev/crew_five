import type { SupabaseClient } from '@supabase/supabase-js';

export interface MailboxInventoryItem {
  mailboxAccountId: string | null;
  senderIdentity: string | null;
  user: string | null;
  domain: string | null;
  provider: string;
  campaignCount: number;
  outboundCount: number;
  lastSentAt: string | null;
}

export interface CampaignMailboxSummary {
  campaignId: string;
  mailboxes: MailboxInventoryItem[];
  consistency: {
    consistent: boolean;
    mailboxAccountCount: number;
    senderIdentityCount: number;
    recommendedMailboxAccountId: string | null;
    recommendedSenderIdentity: string | null;
  };
}

type OutboundMailboxRow = {
  campaign_id: string | null;
  provider: string | null;
  sender_identity: string | null;
  sent_at: string | null;
  metadata: Record<string, unknown> | null;
};

function parseSenderIdentity(senderIdentity: string | null) {
  if (!senderIdentity || !senderIdentity.includes('@')) {
    return { user: null, domain: null };
  }
  const [user, domain] = senderIdentity.split('@');
  return {
    user: user?.trim() || null,
    domain: domain?.trim() || null,
  };
}

function readMailboxAccountId(
  metadata: Record<string, unknown> | null,
  senderIdentity: string | null
): string | null {
  const mailboxAccountId = metadata?.mailbox_account_id;
  if (typeof mailboxAccountId === 'string' && mailboxAccountId.trim().length > 0) {
    return mailboxAccountId.trim();
  }
  const imapAccountId = metadata?.imap_account_id;
  if (typeof imapAccountId === 'string' && imapAccountId.trim().length > 0) {
    return imapAccountId.trim();
  }
  return senderIdentity;
}

function buildMailboxKey(row: OutboundMailboxRow) {
  return [
    row.provider ?? 'unknown',
    readMailboxAccountId(row.metadata, row.sender_identity) ?? 'unknown',
    row.sender_identity ?? 'unknown',
  ].join('::');
}

function pickLaterIso(left: string | null, right: string | null) {
  if (!left) return right;
  if (!right) return left;
  return left >= right ? left : right;
}

function summarizeMailboxes(rows: OutboundMailboxRow[]): MailboxInventoryItem[] {
  const grouped = new Map<
    string,
    MailboxInventoryItem & {
      campaigns: Set<string>;
    }
  >();

  for (const row of rows) {
    const key = buildMailboxKey(row);
    const current = grouped.get(key);
    const { user, domain } = parseSenderIdentity(row.sender_identity);
    const mailboxAccountId = readMailboxAccountId(row.metadata, row.sender_identity);
    const provider = row.provider ?? 'unknown';
    const sentAt = row.sent_at ?? null;

    if (!current) {
      grouped.set(key, {
        mailboxAccountId,
        senderIdentity: row.sender_identity ?? null,
        user,
        domain,
        provider,
        campaignCount: row.campaign_id ? 1 : 0,
        outboundCount: 1,
        lastSentAt: sentAt,
        campaigns: new Set(row.campaign_id ? [row.campaign_id] : []),
      });
      continue;
    }

    current.outboundCount += 1;
    current.lastSentAt = pickLaterIso(current.lastSentAt, sentAt);
    if (row.campaign_id) {
      current.campaigns.add(row.campaign_id);
      current.campaignCount = current.campaigns.size;
    }
  }

  const items: MailboxInventoryItem[] = [];
  for (const value of grouped.values()) {
    items.push({
      mailboxAccountId: value.mailboxAccountId,
      senderIdentity: value.senderIdentity,
      user: value.user,
      domain: value.domain,
      provider: value.provider,
      campaignCount: value.campaignCount,
      outboundCount: value.outboundCount,
      lastSentAt: value.lastSentAt,
    });
  }

  return items.sort((left, right) => {
      const rightSent = right.lastSentAt ?? '';
      const leftSent = left.lastSentAt ?? '';
      if (rightSent !== leftSent) {
        return rightSent.localeCompare(leftSent);
      }
      return right.outboundCount - left.outboundCount;
    });
}

async function loadOutboundMailboxRows(
  client: SupabaseClient,
  campaignId?: string
): Promise<OutboundMailboxRow[]> {
  const query = client
    .from('email_outbound')
    .select('campaign_id,provider,sender_identity,sent_at,metadata');

  const { data, error } = await query.eq('provider', 'imap_mcp').order('sent_at', { ascending: false });
  if (error) {
    throw error;
  }

  return ((data ?? []) as OutboundMailboxRow[])
    .map((row) => ({
      campaign_id: typeof row.campaign_id === 'string' ? row.campaign_id : null,
      provider: typeof row.provider === 'string' ? row.provider : null,
      sender_identity: typeof row.sender_identity === 'string' ? row.sender_identity : null,
      sent_at: typeof row.sent_at === 'string' ? row.sent_at : null,
      metadata:
        row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
          ? row.metadata
          : null,
    }))
    .filter((row) => (campaignId ? row.campaign_id === campaignId : true));
}

export async function listMailboxes(client: SupabaseClient): Promise<MailboxInventoryItem[]> {
  return summarizeMailboxes(await loadOutboundMailboxRows(client));
}

export async function getCampaignMailboxSummary(
  client: SupabaseClient,
  campaignId: string
): Promise<CampaignMailboxSummary> {
  const mailboxes = summarizeMailboxes(await loadOutboundMailboxRows(client, campaignId));
  const mailboxAccountIds = new Set(mailboxes.map((row) => row.mailboxAccountId).filter(Boolean));
  const senderIdentities = new Set(mailboxes.map((row) => row.senderIdentity).filter(Boolean));
  const recommended = mailboxes[0] ?? null;

  return {
    campaignId,
    mailboxes,
    consistency: {
      consistent: mailboxAccountIds.size <= 1 && senderIdentities.size <= 1,
      mailboxAccountCount: mailboxAccountIds.size,
      senderIdentityCount: senderIdentities.size,
      recommendedMailboxAccountId: recommended?.mailboxAccountId ?? null,
      recommendedSenderIdentity: recommended?.senderIdentity ?? null,
    },
  };
}
