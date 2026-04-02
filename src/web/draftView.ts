import type { DraftRow } from './types.js';

const bumpLifecycleStates = new Set([
  'generated_pending_review',
  'approved_waiting_next_day',
  'approved_sendable',
] as const);

export function toDraftView(row: Record<string, any>): DraftRow {
  const contact = row.contact && typeof row.contact === 'object' ? row.contact : null;
  const company = row.company && typeof row.company === 'object' ? row.company : null;

  return {
    id: String(row.id),
    status: typeof row.status === 'string' ? row.status : undefined,
    email_type: typeof row.email_type === 'string' ? row.email_type : null,
    subject: typeof row.subject === 'string' ? row.subject : null,
    body: typeof row.body === 'string' ? row.body : null,
    pattern_mode: typeof row.pattern_mode === 'string' ? row.pattern_mode : null,
    variant_label: typeof row.variant_label === 'string' ? row.variant_label : null,
    reviewer: typeof row.reviewer === 'string' ? row.reviewer : null,
    created_at: typeof row.created_at === 'string' ? row.created_at : null,
    updated_at: typeof row.updated_at === 'string' ? row.updated_at : null,
    contact_id: typeof row.contact_id === 'string' ? row.contact_id : contact?.id ?? null,
    contact_name: typeof contact?.full_name === 'string' ? contact.full_name : null,
    contact_position: typeof contact?.position === 'string' ? contact.position : null,
    company_id: typeof row.company_id === 'string' ? row.company_id : company?.id ?? null,
    company_name:
      typeof company?.company_name === 'string'
        ? company.company_name
        : typeof contact?.company_name === 'string'
          ? contact.company_name
          : null,
    recipient_email: typeof row.recipient_email === 'string' ? row.recipient_email : null,
    recipient_email_source:
      typeof row.recipient_email_source === 'string' ? row.recipient_email_source : null,
    recipient_email_kind:
      typeof row.recipient_email_kind === 'string' ? row.recipient_email_kind : null,
    sendable: typeof row.sendable === 'boolean' ? row.sendable : undefined,
    bump_lifecycle_state:
      typeof row.bump_lifecycle_state === 'string' && bumpLifecycleStates.has(row.bump_lifecycle_state as any)
        ? (row.bump_lifecycle_state as DraftRow['bump_lifecycle_state'])
        : null,
    bump_can_send_now:
      typeof row.bump_can_send_now === 'boolean' ? row.bump_can_send_now : undefined,
    bump_send_block_reasons: Array.isArray(row.bump_send_block_reasons)
      ? row.bump_send_block_reasons.filter((value: unknown): value is string => typeof value === 'string')
      : [],
    bump_approved_at:
      typeof row.bump_approved_at === 'string' ? row.bump_approved_at : null,
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : null,
  };
}
