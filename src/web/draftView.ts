import type { DraftRow } from './types.js';

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
    metadata: row.metadata && typeof row.metadata === 'object' ? row.metadata : null,
  };
}
