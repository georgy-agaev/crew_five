import type { SupabaseClient } from '@supabase/supabase-js';

import { ingestEmailEvent } from './emailEvents.js';
import {
  classifyInboundReply,
  extractEmailAddresses,
  type ReplyClassification,
} from './replyClassifier.js';
import { normalizeEmailAddress } from './recipientResolver.js';

const DEFAULT_LOOKBACK_HOURS = 24;
const DEFAULT_FOLDER = 'INBOX';
const SEARCH_LIMIT = 100;
const OUTBOUND_MATCH_LIMIT = 20;

export interface InboxMessageSummary {
  uid: number;
  date: string;
  from: string;
  to: string[];
  subject: string;
  messageId: string;
  inReplyTo?: string | null;
  flags: string[];
}

export interface InboxMessageContent extends InboxMessageSummary {
  textContent: string | null;
  htmlContent?: string | null;
}

export interface InboxPollTransport {
  searchUnread(params: {
    accountId: string;
    folder?: string;
    sinceDate: string;
    limit?: number;
  }): Promise<InboxMessageSummary[]>;
  getEmail(params: {
    accountId: string;
    folder?: string;
    uid: number;
  }): Promise<InboxMessageContent>;
  markAsRead(params: {
    accountId: string;
    folder?: string;
    uid: number;
  }): Promise<void>;
}

interface MailboxAssignmentRow {
  mailbox_account_id: string | null;
  provider: string | null;
}

interface OutboundContextRow {
  id: string;
  draft_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  recipient_email: string | null;
  sender_identity: string | null;
  provider_message_id: string | null;
  sent_at: string | null;
  metadata: Record<string, unknown> | null;
}

export interface ProcessRepliesRequest {
  mailboxAccountId?: string;
  lookbackHours?: number;
}

export interface ProcessRepliesResult {
  source: 'crew_five-process-replies';
  requestedAt: string;
  upstreamStatus: number;
  accepted: boolean;
  mailboxAccountId: string | null;
  processed: number;
  classified: number;
  ingested: number;
  skipped: number;
  failed: number;
  polledAccounts: number;
  errors: string[];
  details: Array<{
    accountId: string;
    uid: number;
    status: 'ingested' | 'skipped' | 'failed';
    category?: string | null;
    outboundId?: string | null;
  }>;
  [key: string]: unknown;
}

function metadataMailboxAccountId(
  metadata: Record<string, unknown> | null | undefined,
  senderIdentity: string | null
) {
  const direct = metadata?.mailbox_account_id;
  if (typeof direct === 'string' && direct.trim().length > 0) {
    return direct.trim();
  }
  const imap = metadata?.imap_account_id;
  if (typeof imap === 'string' && imap.trim().length > 0) {
    return imap.trim();
  }
  return senderIdentity?.trim() || null;
}

function readOutboundRecipientEmail(
  metadata: Record<string, unknown> | null | undefined,
  directRecipientEmail: string | null | undefined
) {
  if (typeof directRecipientEmail === 'string' && directRecipientEmail.trim().length > 0) {
    return directRecipientEmail.trim();
  }
  const fromMetadata = metadata?.recipient_email;
  if (typeof fromMetadata === 'string' && fromMetadata.trim().length > 0) {
    return fromMetadata.trim();
  }
  return null;
}

function startOfLookbackDate(lookbackHours: number, now: Date) {
  const cutoff = new Date(now.getTime() - lookbackHours * 60 * 60 * 1000);
  return cutoff.toISOString().slice(0, 10);
}

async function loadMailboxAccountIds(
  client: SupabaseClient,
  requestedMailboxAccountId?: string
): Promise<string[]> {
  if (requestedMailboxAccountId?.trim()) {
    return [requestedMailboxAccountId.trim()];
  }

  const ids = new Set<string>();
  const { data: assignments, error: assignmentError } = await client
    .from('campaign_mailbox_assignments')
    .select('mailbox_account_id,provider');
  if (assignmentError) {
    throw assignmentError;
  }

  for (const row of ((assignments ?? []) as MailboxAssignmentRow[])) {
    if ((row.provider ?? 'imap_mcp') !== 'imap_mcp') continue;
    if (typeof row.mailbox_account_id === 'string' && row.mailbox_account_id.trim().length > 0) {
      ids.add(row.mailbox_account_id.trim());
    }
  }

  if (ids.size > 0) {
    return Array.from(ids).sort((left, right) => left.localeCompare(right));
  }

  const { data: outboundRows, error: outboundError } = await client
    .from('email_outbound')
    .select('metadata,sender_identity,provider')
    .eq('provider', 'imap_mcp')
    .order('sent_at', { ascending: false })
    .limit(200);
  if (outboundError) {
    throw outboundError;
  }

  for (const row of ((outboundRows ?? []) as Array<Record<string, unknown>>)) {
    const mailboxAccountId = metadataMailboxAccountId(
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : null,
      typeof row.sender_identity === 'string' ? row.sender_identity : null
    );
    if (mailboxAccountId) {
      ids.add(mailboxAccountId);
    }
  }

  return Array.from(ids).sort((left, right) => left.localeCompare(right));
}

async function findOutboundByMessageId(
  client: SupabaseClient,
  providerMessageId: string
): Promise<OutboundContextRow | null> {
  const variants = buildProviderMessageIdVariants(providerMessageId);
  const { data, error } = await client
    .from('email_outbound')
    .select(
      'id,draft_id,contact_id,company_id,sender_identity,provider_message_id,sent_at,metadata'
    )
    .eq('provider', 'imap_mcp')
    .in('provider_message_id', variants)
    .limit(1);
  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : null;
  return row ? normalizeOutboundRow(row as Record<string, unknown>) : null;
}

function stripAngleBrackets(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith('<') && trimmed.endsWith('>') && trimmed.length > 2) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function buildProviderMessageIdVariants(value: string) {
  const raw = value.trim();
  const core = stripAngleBrackets(raw);
  const variants = new Set<string>();
  if (raw) variants.add(raw);
  if (core) variants.add(core);
  if (core) variants.add(`<${core}>`);
  return Array.from(variants);
}

function normalizeOutboundRow(row: Record<string, unknown>): OutboundContextRow {
  const metadata =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : null;
  return {
    id: String(row.id),
    draft_id: typeof row.draft_id === 'string' ? row.draft_id : null,
    contact_id: typeof row.contact_id === 'string' ? row.contact_id : null,
    company_id: typeof row.company_id === 'string' ? row.company_id : null,
    recipient_email: readOutboundRecipientEmail(
      metadata,
      typeof row.recipient_email === 'string' ? row.recipient_email : null
    ),
    sender_identity: typeof row.sender_identity === 'string' ? row.sender_identity : null,
    provider_message_id:
      typeof row.provider_message_id === 'string' ? row.provider_message_id : null,
    sent_at: typeof row.sent_at === 'string' ? row.sent_at : null,
    metadata,
  };
}

async function findOutboundByRecipientEmail(
  client: SupabaseClient,
  recipientEmail: string,
  mailboxAccountId: string
): Promise<OutboundContextRow | null> {
  const { data, error } = await client
    .from('email_outbound')
    .select(
      'id,draft_id,contact_id,company_id,sender_identity,provider_message_id,sent_at,metadata'
    )
    .eq('provider', 'imap_mcp')
    .order('sent_at', { ascending: false })
    .limit(OUTBOUND_MATCH_LIMIT * 10);
  if (error) {
    throw error;
  }

  const normalizedRecipientEmail = recipientEmail.trim().toLowerCase();
  const normalizedRows = ((data ?? []) as Array<Record<string, unknown>>)
    .map(normalizeOutboundRow)
    .filter((row) => row.recipient_email?.trim().toLowerCase() === normalizedRecipientEmail);
  return (
    normalizedRows.find(
      (row) => metadataMailboxAccountId(row.metadata, row.sender_identity) === mailboxAccountId
    ) ??
    normalizedRows[0] ??
    null
  );
}

async function findOutboundForBounce(
  client: SupabaseClient,
  candidateEmails: string[],
  mailboxAccountId: string
): Promise<OutboundContextRow | null> {
  for (const email of candidateEmails) {
    const outbound = await findOutboundByRecipientEmail(client, email, mailboxAccountId);
    if (outbound) {
      return outbound;
    }
  }
  return null;
}

async function resolveOutboundContext(
  client: SupabaseClient,
  params: {
    mailboxAccountId: string;
    senderEmail: string | null;
    inReplyTo?: string | null;
    contentText: string;
    classification: ReplyClassification;
  }
): Promise<OutboundContextRow | null> {
  if (params.inReplyTo) {
    const byMessageId = await findOutboundByMessageId(client, params.inReplyTo);
    // If In-Reply-To is present but not ours, avoid guessing linkage via sender email.
    // This keeps replies from other tools (same mailbox) in the "unlinked" bucket.
    return byMessageId;
  }

  if (params.classification.category === 'bounce') {
    const candidateEmails = extractEmailAddresses(params.contentText).filter(
      (value) => value !== params.senderEmail
    );
    const byBounce = await findOutboundForBounce(client, candidateEmails, params.mailboxAccountId);
    if (byBounce) {
      return byBounce;
    }
  }

  if (!params.senderEmail) {
    return null;
  }

  return findOutboundByRecipientEmail(client, params.senderEmail, params.mailboxAccountId);
}

async function ensureInboxPlaceholderOutbound(
  client: SupabaseClient,
  params: {
    mailboxAccountId: string;
    uid: number;
    messageId: string;
    senderEmail: string | null;
    to: string[];
    occurredAt: string;
    subject: string;
    from: string;
  }
): Promise<OutboundContextRow> {
  const providerMessageId = `inbox:${params.mailboxAccountId}:${params.uid}`;
  const existing = await findOutboundByMessageId(client, providerMessageId);
  if (existing) return existing;

  const senderIdentity =
    params.to.find((addr) => typeof addr === 'string' && addr.trim().length > 0)?.trim() ?? null;

  const metadata: Record<string, unknown> = {
    mailbox_account_id: params.mailboxAccountId,
    inbox_uid: params.uid,
    inbox_message_id: params.messageId,
    recipient_email: params.senderEmail,
    inbound_from: params.from,
    inbound_subject: params.subject,
  };

  const { data, error } = await client
    .from('email_outbound')
    .insert({
      provider: 'imap_mcp',
      provider_message_id: providerMessageId,
      sender_identity: senderIdentity,
      status: 'sent',
      sent_at: params.occurredAt,
      metadata,
    })
    .select('id,draft_id,contact_id,company_id,sender_identity,provider_message_id,sent_at,metadata')
    .single();

  if (error) {
    throw error;
  }

  return normalizeOutboundRow(data as Record<string, unknown>);
}

function buildEventPayload(input: {
  accountId: string;
  content: InboxMessageContent;
  outbound: OutboundContextRow;
  classification: ReplyClassification;
}) {
  const classification = input.classification;
  const eventType =
    classification.category === 'bounce'
      ? 'bounced'
      : classification.category === 'unsubscribe'
        ? 'unsubscribed'
        : 'replied';
  const outcomeClassification =
    classification.category === 'interested'
      ? 'soft_interest'
      : classification.category === 'decline' || classification.category === 'resignation'
        ? 'decline'
        : null;

  return {
    provider: 'imap_mcp',
    provider_event_id: `${input.accountId}:${input.content.uid}`,
    event_type: eventType,
    outcome_classification: outcomeClassification,
    contact_id: input.outbound.contact_id ?? undefined,
    outbound_id: input.outbound.id,
    draft_id: input.outbound.draft_id ?? undefined,
    occurred_at: input.content.date,
    payload: {
      subject: input.content.subject,
      from: input.content.from,
      to: input.content.to,
      message_id: input.content.messageId,
      in_reply_to: input.content.inReplyTo ?? null,
      reply_text: input.content.textContent,
      html_content: input.content.htmlContent ?? null,
      classification_category: classification.category,
      classification_confidence: classification.confidence,
      classification_reason: classification.rawReason,
      auto_reply: classification.category === 'vacation',
      auto_reply_reason: classification.category === 'vacation' ? 'vacation' : null,
      alt_contact: classification.altContact,
      return_date: classification.returnDate,
      mailbox_account_id: input.accountId,
      folder: DEFAULT_FOLDER,
      uid: input.content.uid,
    },
  };
}

function formatErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const candidate = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
      error?: unknown;
    };
    const parts = [
      typeof candidate.message === 'string' ? candidate.message : null,
      typeof candidate.details === 'string' ? candidate.details : null,
      typeof candidate.hint === 'string' ? candidate.hint : null,
      typeof candidate.code === 'string' ? `code=${candidate.code}` : null,
      typeof candidate.error === 'string' ? candidate.error : null,
    ].filter((value): value is string => Boolean(value && value.trim()));

    if (parts.length > 0) {
      return parts.join(' | ');
    }

    try {
      return JSON.stringify(error);
    } catch {
      return '[unserializable error object]';
    }
  }

  return String(error);
}

export async function processReplies(
  client: SupabaseClient,
  transport: InboxPollTransport,
  request: ProcessRepliesRequest = {}
): Promise<ProcessRepliesResult> {
  const requestedAt = new Date().toISOString();
  const lookbackHours = Number.isFinite(request.lookbackHours)
    ? Math.max(1, Math.trunc(request.lookbackHours as number))
    : DEFAULT_LOOKBACK_HOURS;
  const sinceDate = startOfLookbackDate(lookbackHours, new Date(requestedAt));
  const mailboxAccountIds = await loadMailboxAccountIds(client, request.mailboxAccountId);

  if (mailboxAccountIds.length === 0) {
    return {
      source: 'crew_five-process-replies',
      requestedAt,
      upstreamStatus: 200,
      accepted: false,
      mailboxAccountId: request.mailboxAccountId ?? null,
      processed: 0,
      classified: 0,
      ingested: 0,
      skipped: 0,
      failed: 0,
      polledAccounts: 0,
      errors: ['No imap_mcp mailbox accounts are configured for reply polling'],
      details: [],
    };
  }

  const result: ProcessRepliesResult = {
    source: 'crew_five-process-replies',
    requestedAt,
    upstreamStatus: 200,
    accepted: true,
    mailboxAccountId: request.mailboxAccountId ?? null,
    processed: 0,
    classified: 0,
    ingested: 0,
    skipped: 0,
    failed: 0,
    polledAccounts: mailboxAccountIds.length,
    errors: [],
    details: [],
  };

  for (const accountId of mailboxAccountIds) {
    let messages: InboxMessageSummary[] = [];

    try {
      messages = await transport.searchUnread({
        accountId,
        folder: DEFAULT_FOLDER,
        sinceDate,
        limit: SEARCH_LIMIT,
      });
    } catch (error) {
      if ((error as any)?.code === 'IMAP_MCP_BACKOFF') {
        result.skipped += 1;
        result.details.push({
          accountId,
          uid: 0,
          status: 'skipped',
        });
        continue;
      }
      result.failed += 1;
      result.errors.push(`mailbox ${accountId}: ${formatErrorMessage(error)}`);
      continue;
    }

    result.processed += messages.length;

    for (const message of messages) {
      try {
        const content = await transport.getEmail({
          accountId,
          folder: DEFAULT_FOLDER,
          uid: message.uid,
        });
        const bodyText = [content.subject, content.textContent ?? '', content.htmlContent ?? '']
          .filter(Boolean)
          .join('\n');
        const senderEmail = normalizeEmailAddress(content.from);
        const classification = classifyInboundReply({
          subject: content.subject,
          body: content.textContent ?? content.htmlContent ?? '',
          sender: senderEmail,
        });
        const outbound = await resolveOutboundContext(client, {
          mailboxAccountId: accountId,
          senderEmail,
          inReplyTo: content.inReplyTo ?? message.inReplyTo ?? null,
          contentText: bodyText,
          classification,
        });

        if (!outbound) {
          const placeholderOutbound = await ensureInboxPlaceholderOutbound(client, {
            mailboxAccountId: accountId,
            uid: content.uid,
            messageId: content.messageId,
            senderEmail,
            to: content.to,
            occurredAt: content.date,
            subject: content.subject,
            from: content.from,
          });

          await ingestEmailEvent(
            client,
            buildEventPayload({
              accountId,
              content,
              outbound: placeholderOutbound,
              classification,
            })
          );
          result.classified += 1;
          result.ingested += 1;
          result.details.push({
            accountId,
            uid: message.uid,
            status: 'ingested',
            category: classification.category,
            outboundId: placeholderOutbound.id,
          });
          await transport.markAsRead({ accountId, folder: DEFAULT_FOLDER, uid: message.uid });
          continue;
        }

        await ingestEmailEvent(client, buildEventPayload({ accountId, content, outbound, classification }));
        result.classified += 1;
        result.ingested += 1;
        result.details.push({
          accountId,
          uid: message.uid,
          status: 'ingested',
          category: classification.category,
          outboundId: outbound.id,
        });
        await transport.markAsRead({ accountId, folder: DEFAULT_FOLDER, uid: message.uid });
      } catch (error) {
        if ((error as any)?.code === 'IMAP_MCP_BACKOFF') {
          result.skipped += 1;
          result.details.push({
            accountId,
            uid: message.uid,
            status: 'skipped',
          });
          // Account is in backoff; skip remaining messages for this mailbox.
          break;
        }
        result.failed += 1;
        result.errors.push(`mailbox ${accountId} uid ${message.uid}: ${formatErrorMessage(error)}`);
        result.details.push({
          accountId,
          uid: message.uid,
          status: 'failed',
        });
      }
    }
  }

  return result;
}
